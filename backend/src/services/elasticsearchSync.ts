import type { EmailJob } from "@prisma/client";
import { esClient, EMAILS_INDEX } from "../lib/elasticsearch";
import { logger } from "../lib/logger";

type EmailJobWithSender = EmailJob & { senderConfig: { name: string } };

export async function indexEmailJob(job: EmailJobWithSender): Promise<void> {
  try {
    await esClient.index({
      index: EMAILS_INDEX,
      id: job.id,
      body: {
        userId: job.userId,
        senderConfigId: job.senderConfigId,
        campaignId: job.campaignId,
        recipient: job.recipient,
        subject: job.subject,
        body: job.body,
        status: job.status,
        scheduledAt: job.scheduledAt,
        sentAt: job.sentAt,
        sender: job.senderConfig.name,
      },
    });
  } catch (err) {
    logger.error({ err, jobId: job.id }, "Failed to index email in Elasticsearch (search may lag)");
  }
}
