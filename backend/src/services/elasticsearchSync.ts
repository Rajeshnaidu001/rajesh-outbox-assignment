import type { EmailJob } from "@prisma/client";
import { esClient, EMAILS_INDEX } from "../lib/elasticsearch";
import { logger } from "../lib/logger";

export async function indexEmailJob(job: EmailJob): Promise<void> {
  try {
    await esClient.index({
      index: EMAILS_INDEX,
      id: job.id,
      document: {
        userId: job.userId,
        senderConfigId: job.senderConfigId,
        campaignId: job.campaignId,
        recipient: job.recipient,
        subject: job.subject,
        body: job.body,
        status: job.status,
        scheduledAt: job.scheduledAt,
        sentAt: job.sentAt,
      },
    });
  } catch (err) {
    logger.error({ err, jobId: job.id }, "Failed to index email in Elasticsearch (search may lag)");
  }
}
