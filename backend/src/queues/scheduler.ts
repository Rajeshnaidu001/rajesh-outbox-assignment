import { randomUUID } from "node:crypto";
import { prisma } from "../lib/prisma";
import { emailQueue } from "./emailQueue";
import { indexEmailJob } from "../services/elasticsearchSync";
import { logger } from "../lib/logger";
import type { SenderConfig } from "@prisma/client";

export interface CreateCampaignInput {
  userId: string;
  senderConfigId: string;
  subject: string;
  body: string;
  recipients: string[];
  startTime: Date;
}

function hourBucketId(date: Date): string {
  return `${date.getUTCFullYear()}${date.getUTCMonth()}${date.getUTCDate()}${date.getUTCHours()}`;
}

function startOfNextHour(date: Date): Date {
  const next = new Date(date);
  next.setUTCMinutes(0, 0, 0);
  next.setUTCHours(next.getUTCHours() + 1);
  return next;
}

// Pre-computes a realistic initial schedule: space sends by minDelaySeconds and, once a
// sender-hour would exceed hourlyLimit, push the remainder to the next hour boundary. This
// is a best-effort initial layout only — the worker's runtime rate-limit gates (see
// queues/processor.ts) are the authoritative source of truth once jobs actually run.
function computeSchedule(
  count: number,
  startTime: Date,
  sender: Pick<SenderConfig, "minDelaySeconds" | "hourlyLimit">
): Date[] {
  const schedule: Date[] = [];
  let cursor = new Date(startTime);
  let bucket = hourBucketId(cursor);
  let countInBucket = 0;

  for (let i = 0; i < count; i++) {
    const currentBucket = hourBucketId(cursor);
    if (currentBucket !== bucket) {
      bucket = currentBucket;
      countInBucket = 0;
    }
    if (countInBucket >= sender.hourlyLimit) {
      cursor = startOfNextHour(cursor);
      bucket = hourBucketId(cursor);
      countInBucket = 0;
    }
    schedule.push(new Date(cursor));
    countInBucket += 1;
    cursor = new Date(cursor.getTime() + sender.minDelaySeconds * 1000);
  }

  return schedule;
}

export async function createCampaign(input: CreateCampaignInput) {
  const sender = await prisma.senderConfig.findUniqueOrThrow({ where: { id: input.senderConfigId } });

  const campaign = await prisma.campaign.create({
    data: {
      userId: input.userId,
      senderConfigId: input.senderConfigId,
      subject: input.subject,
      body: input.body,
      startTime: input.startTime,
    },
  });

  const schedule = computeSchedule(input.recipients.length, input.startTime, sender);

  const createdJobs = [];
  for (let i = 0; i < input.recipients.length; i++) {
    // Generate the id up front so it can double as the deterministic BullMQ jobId —
    // this is what makes re-scheduling/restarts idempotent (BullMQ rejects duplicate jobIds).
    const id = randomUUID();
    const emailJob = await prisma.emailJob.create({
      data: {
        id,
        bullJobId: id,
        campaignId: campaign.id,
        senderConfigId: sender.id,
        userId: input.userId,
        recipient: input.recipients[i],
        subject: input.subject,
        body: input.body,
        scheduledAt: schedule[i],
      },
    });

    const delay = Math.max(0, schedule[i].getTime() - Date.now());
    await emailQueue.add("send", { emailId: emailJob.id }, { jobId: id, delay });

    indexEmailJob(emailJob).catch(() => undefined);
    createdJobs.push(emailJob);
  }

  logger.info({ campaignId: campaign.id, count: createdJobs.length }, "Campaign scheduled");
  return { campaign, emailJobs: createdJobs };
}
