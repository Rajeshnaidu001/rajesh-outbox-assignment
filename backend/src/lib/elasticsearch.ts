import { Client } from "@elastic/elasticsearch";
import { env } from "../config/env";
import { logger } from "./logger";

export const EMAILS_INDEX = "emails";

export const esClient = new Client({ node: env.elasticsearchUrl });

export async function ensureEmailsIndex(): Promise<void> {
  try {
    const exists = await esClient.indices.exists({ index: EMAILS_INDEX });
    if (exists) return;

    await esClient.indices.create({
      index: EMAILS_INDEX,
      mappings: {
        properties: {
          userId: { type: "keyword" },
          senderConfigId: { type: "keyword" },
          campaignId: { type: "keyword" },
          recipient: { type: "text", fields: { keyword: { type: "keyword" } } },
          subject: { type: "text" },
          body: { type: "text" },
          status: { type: "keyword" },
          scheduledAt: { type: "date" },
          sentAt: { type: "date" },
        },
      },
    });
    logger.info(`Created Elasticsearch index "${EMAILS_INDEX}"`);
  } catch (err) {
    // The API server and worker both call this on boot and can race each other between
    // the exists-check and the create call — harmless, the index just already exists.
    const alreadyExists =
      err instanceof Error && "meta" in err && (err as { meta?: { body?: { error?: { type?: string } } } }).meta?.body?.error?.type === "resource_already_exists_exception";
    if (alreadyExists) return;
    logger.error({ err }, "Failed to ensure Elasticsearch index (search will be degraded)");
  }
}
