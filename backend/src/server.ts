import express from "express";
import cors from "cors";
import passport from "passport";
import basicAuth from "express-basic-auth";
import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { ExpressAdapter } from "@bull-board/express";

import { env } from "./config/env";
import { logger } from "./lib/logger";
import { ensureEmailsIndex } from "./lib/elasticsearch";
import { configurePassport } from "./auth/passport";
import { emailQueue } from "./queues/emailQueue";
import { errorHandler } from "./middleware/errorHandler";

import { authRouter } from "./routes/auth";
import { slackRouter } from "./routes/slack";
import { sendersRouter } from "./routes/senders";
import { campaignsRouter } from "./routes/campaigns";
import { emailsRouter } from "./routes/emails";
import { searchRouter } from "./routes/search";

export async function startServer(): Promise<void> {
  await ensureEmailsIndex();
  configurePassport();

  const app = express();
  app.use(cors({ origin: env.frontendUrl }));
  app.use(express.json());
  app.use(passport.initialize());

  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath("/admin/queues");
  createBullBoard({ queues: [new BullMQAdapter(emailQueue)], serverAdapter });
  app.use(
    "/admin/queues",
    basicAuth({ users: { [env.adminQueuesUser]: env.adminQueuesPass }, challenge: true }),
    serverAdapter.getRouter()
  );

  app.get("/health", (_req, res) => res.json({ ok: true }));

  app.use("/api/auth", authRouter);
  app.use("/api/slack", slackRouter);
  app.use("/api/senders", sendersRouter);
  app.use("/api/campaigns", campaignsRouter);
  app.use("/api/emails", emailsRouter);
  app.use("/api/emails", searchRouter);

  app.use(errorHandler);

  app.listen(env.port, () => {
    logger.info(`API server listening on http://localhost:${env.port}`);
    logger.info(`Bull Board admin UI at http://localhost:${env.port}/admin/queues`);
  });
}

if (require.main === module) {
  startServer().catch((err) => {
    logger.error({ err }, "Server failed to start");
    process.exit(1);
  });
}
