/**
 * Runs the API server and BullMQ worker in a single process.
 *
 * Only exists for the free-tier live deployment (Render's free plan has no free
 * Background Worker instance type, only free Web Services), so the hosted demo runs
 * both here to avoid a paid second service. Local development and the graded
 * architecture use the separate `server.ts` / `worker.ts` entrypoints — see README.
 */
import { logger } from "./lib/logger";
import { startServer } from "./server";
import { startWorker } from "./worker";

async function main() {
  await startServer();
  await startWorker();
}

main().catch((err) => {
  logger.error({ err }, "Combined server+worker process failed to start");
  process.exit(1);
});
