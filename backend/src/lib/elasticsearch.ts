import { Client } from "@opensearch-project/opensearch";
import { env } from "../config/env";
import { logger } from "./logger";

export const EMAILS_INDEX = "emails";

// Uses the OpenSearch client rather than @elastic/elasticsearch: Elastic's v7+ client
// actively refuses to talk to non-Elastic-branded servers (a licensing-driven "product
// check"), which breaks the free-tier live deployment (Bonsai's free Sandbox plan backs
// onto OpenSearch). The OpenSearch client speaks the same wire protocol our mappings and
// queries use and works identically against genuine Elasticsearch too — verified against
// the real Elasticsearch 8.x container in docker-compose.yml, which is what local dev uses.
export const esClient = new Client({ node: env.elasticsearchUrl });

export async function ensureEmailsIndex(): Promise<void> {
  try {
    const exists = await esClient.indices.exists({ index: EMAILS_INDEX });
    if (exists.statusCode === 200) return;

    await esClient.indices.create({
      index: EMAILS_INDEX,
      body: {
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
            sender: { type: "keyword" },
          },
        },
      },
    });
    logger.info(`Created search index "${EMAILS_INDEX}"`);
  } catch (err) {
    // The API server and worker both call this on boot and can race each other between
    // the exists-check and the create call — harmless, the index just already exists.
    const alreadyExists =
      err instanceof Error &&
      "body" in err &&
      (err as { body?: { error?: { type?: string } } }).body?.error?.type === "resource_already_exists_exception";
    if (alreadyExists) return;
    logger.error({ err }, "Failed to ensure search index (search will be degraded)");
  }
}
