import { Queue } from "bullmq";
import { createRedisConnection } from "../lib/redis";

export const EMAIL_QUEUE_NAME = "email-send";

export interface EmailJobData {
  emailId: string;
}

export const emailQueue = new Queue<EmailJobData>(EMAIL_QUEUE_NAME, {
  connection: createRedisConnection(),
  defaultJobOptions: {
    removeOnComplete: { age: 7 * 24 * 60 * 60, count: 5000 },
    removeOnFail: { age: 30 * 24 * 60 * 60 },
    attempts: 5,
    backoff: { type: "exponential", delay: 5000 },
  },
});
