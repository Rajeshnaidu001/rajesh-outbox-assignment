import { DelayedError, type Job } from "bullmq";
import type { Redis } from "ioredis";
import { prisma } from "../lib/prisma";
import { logger } from "../lib/logger";
import { sendEmail } from "../services/mailer";
import { notifyRateLimitHit } from "../services/slack";
import { indexEmailJob } from "../services/elasticsearchSync";
import { checkHourlyLimit, checkMinDelay, claimNotificationSlot } from "./rateLimiter";
import type { EmailJobData } from "./emailQueue";

// Keeps the DB row (and its Elasticsearch doc) in sync with reality whenever a rate-limit
// gate pushes a job's actual send time out — otherwise the dashboard's "Scheduled For"
// column would keep showing the original, now-stale, pre-computed time.
async function rescheduleTo(emailId: string, scheduledAt: Date): Promise<void> {
  const updated = await prisma.emailJob.update({ where: { id: emailId }, data: { scheduledAt } });
  await indexEmailJob(updated);
}

export function makeProcessor(redis: Redis) {
  return async function processEmailJob(job: Job<EmailJobData>, token?: string): Promise<void> {
    const emailJob = await prisma.emailJob.findUnique({
      where: { id: job.data.emailId },
      include: { senderConfig: true },
    });

    if (!emailJob) {
      logger.warn({ emailId: job.data.emailId }, "EmailJob no longer exists, dropping job");
      return;
    }

    // Idempotency guard: if a previous attempt already delivered this email (e.g. the
    // process crashed after sending but before the job was marked complete in Redis),
    // skip re-sending instead of double-delivering on retry/restart.
    if (emailJob.status === "sent" || emailJob.status === "failed") {
      logger.info({ emailId: emailJob.id, status: emailJob.status }, "EmailJob already finalized, skipping");
      return;
    }

    const sender = emailJob.senderConfig;

    const minDelay = await checkMinDelay(redis, sender.id, sender.minDelaySeconds);
    if (!minDelay.allowed) {
      await rescheduleTo(emailJob.id, new Date(minDelay.nextAllowedAt));
      await job.moveToDelayed(minDelay.nextAllowedAt, token);
      // BullMQ's documented signal that this job was intentionally moved to "delayed"
      // rather than failed — suppresses retry/backoff/failed-event handling for it.
      throw new DelayedError();
    }

    const hourly = await checkHourlyLimit(redis, sender.id, sender.hourlyLimit);
    if (!hourly.allowed) {
      const shouldNotify = await claimNotificationSlot(redis, sender.id);
      if (shouldNotify) {
        await notifyRateLimitHit(emailJob.userId, sender.name, sender.hourlyLimit);
      }
      await rescheduleTo(emailJob.id, hourly.nextWindowStart);
      await job.moveToDelayed(hourly.nextWindowStart.getTime(), token);
      throw new DelayedError();
    }

    await prisma.emailJob.update({ where: { id: emailJob.id }, data: { status: "sending" } });

    try {
      await sendEmail(sender, emailJob.recipient, emailJob.subject, emailJob.body);
      const updated = await prisma.emailJob.update({
        where: { id: emailJob.id },
        data: { status: "sent", sentAt: new Date() },
      });
      await indexEmailJob(updated);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const updated = await prisma.emailJob.update({
        where: { id: emailJob.id },
        data: { status: "failed", error: message },
      });
      await indexEmailJob(updated);
      logger.error({ err, emailId: emailJob.id }, "Failed to send email");
    }
  };
}
