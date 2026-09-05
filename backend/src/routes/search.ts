import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth";
import { esClient, EMAILS_INDEX } from "../lib/elasticsearch";
import { logger } from "../lib/logger";

export const searchRouter = Router();
searchRouter.use(requireAuth);

searchRouter.get("/search", async (req, res) => {
  const q = (req.query.q as string | undefined)?.trim();
  const status = req.query.status as string | undefined;

  const filter: object[] = [{ term: { userId: req.authUserId } }];
  if (status === "scheduled") filter.push({ terms: { status: ["scheduled", "sending"] } });
  if (status === "sent") filter.push({ terms: { status: ["sent", "failed"] } });

  const must = q ? [{ multi_match: { query: q, fields: ["subject", "body", "recipient"] } }] : [];

  try {
    const result = await esClient.search({
      index: EMAILS_INDEX,
      size: 100,
      sort: [{ scheduledAt: "desc" }],
      query: { bool: { must, filter } },
    });

    res.json(
      result.hits.hits.map((hit) => {
        const source = hit._source as Record<string, unknown>;
        return { id: hit._id, ...source };
      })
    );
  } catch (err) {
    logger.error({ err }, "Elasticsearch search failed");
    res.status(503).json({ error: "Search is temporarily unavailable" });
  }
});
