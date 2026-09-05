import { Worker } from "bullmq";
import { env } from "./config/env";
import { logger } from "./lib/logger";
import { createRedisConnection, redis } from "./lib/redis";
import { ensureEmailsIndex } from "./lib/elasticsearch";
import { EMAIL_QUEUE_NAME, type EmailJobData } from "./queues/emailQueue";
import { makeProcessor } from "./queues/processor";
import { DelayedError } from "bullmq";

export async function startWorker(): Promise<void> {
  await ensureEmailsIndex();

  const worker = new Worker<EmailJobData>(EMAIL_QUEUE_NAME, makeProcessor(redis), {
    connection: createRedisConnection(),
    concurrency: env.workerConcurrency,
  });

  worker.on("completed", (job) => {
    logger.info({ jobId: job.id }, "Job completed");
  });

  worker.on("failed", (job, err) => {
    if (err instanceof DelayedError) return; // expected: job was rescheduled, not a real failure
    logger.error({ jobId: job?.id, err }, "Job failed");
  });

  worker.on("error", (err) => {
    logger.error({ err }, "Worker error");
  });

  logger.info({ concurrency: env.workerConcurrency }, "Email worker started");

  const shutdown = async () => {
    logger.info("Shutting down worker...");
    await worker.close();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

if (require.main === module) {
  startWorker().catch((err) => {
    logger.error({ err }, "Worker failed to start");
    process.exit(1);
  });
}
