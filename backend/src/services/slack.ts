import { prisma } from "../lib/prisma";
import { logger } from "../lib/logger";

export async function notifyRateLimitHit(userId: string, senderName: string, hourlyLimit: number): Promise<void> {
  try {
    const connection = await prisma.slackConnection.findUnique({ where: { userId } });
    if (!connection) {
      logger.info({ userId, senderName }, "Sender hit hourly rate limit (no Slack connected, skipping alert)");
      return;
    }

    const text = [
      `:rotating_light: *Rate limit hit* for sender *${senderName}*`,
      `It reached its hourly limit of *${hourlyLimit}* emails — remaining emails are being`,
      `automatically rescheduled into the next available hourly window, nothing was dropped.`,
    ].join(" ");

    const res = await fetch(connection.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });

    if (!res.ok) {
      logger.warn({ status: res.status }, "Slack webhook responded with a non-OK status");
    }
  } catch (err) {
    logger.error({ err, userId, senderName }, "Failed to send Slack rate-limit notification (continuing)");
  }
}
