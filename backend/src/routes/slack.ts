import { Router } from "express";
import { env, isSlackOAuthConfigured } from "../config/env";
import { requireAuth } from "../middleware/requireAuth";
import { signAuthToken, verifyAuthToken } from "../auth/jwt";
import { prisma } from "../lib/prisma";
import { logger } from "../lib/logger";

export const slackRouter = Router();

// Returns the Slack authorize URL rather than redirecting directly: the frontend reaches
// this endpoint via an authenticated fetch() (Bearer header), then navigates the browser
// to the returned URL itself — a plain top-level <a href> couldn't carry the auth header.
// The state param round-trips the authenticated user's id through Slack's redirect
// (signed the same way as our normal auth JWT, just reused as a short-lived carrier).
slackRouter.get("/oauth/url", requireAuth, (req, res) => {
  if (!isSlackOAuthConfigured) {
    res.status(503).json({ error: "Slack OAuth is not configured on the server (missing SLACK_CLIENT_ID/SECRET)." });
    return;
  }
  const state = signAuthToken({ sub: req.authUserId!, email: "" });
  const url = new URL("https://slack.com/oauth/v2/authorize");
  url.searchParams.set("client_id", env.slackClientId);
  url.searchParams.set("scope", "incoming-webhook");
  url.searchParams.set("redirect_uri", env.slackRedirectUri);
  url.searchParams.set("state", state);
  res.json({ url: url.toString() });
});

slackRouter.get("/oauth/callback", async (req, res) => {
  const { code, state } = req.query as { code?: string; state?: string };
  if (!code || !state) {
    res.status(400).send("Missing code/state from Slack redirect");
    return;
  }

  let userId: string;
  try {
    userId = verifyAuthToken(state).sub;
  } catch {
    res.status(400).send("Invalid or expired state");
    return;
  }

  try {
    const tokenRes = await fetch("https://slack.com/api/oauth.v2.access", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: env.slackClientId,
        client_secret: env.slackClientSecret,
        code,
        redirect_uri: env.slackRedirectUri,
      }),
    });
    const data = (await tokenRes.json()) as {
      ok: boolean;
      team?: { name?: string };
      incoming_webhook?: { url: string; channel?: string };
    };

    if (!data.ok || !data.incoming_webhook?.url) {
      logger.error({ data }, "Slack OAuth exchange failed");
      res.redirect(`${env.frontendUrl}/?slackError=1`);
      return;
    }

    await prisma.slackConnection.upsert({
      where: { userId },
      update: {
        teamName: data.team?.name ?? "Unknown workspace",
        webhookUrl: data.incoming_webhook.url,
        channel: data.incoming_webhook.channel ?? null,
      },
      create: {
        userId,
        teamName: data.team?.name ?? "Unknown workspace",
        webhookUrl: data.incoming_webhook.url,
        channel: data.incoming_webhook.channel ?? null,
      },
    });

    res.redirect(`${env.frontendUrl}/?slackConnected=1`);
  } catch (err) {
    logger.error({ err }, "Slack OAuth callback failed");
    res.redirect(`${env.frontendUrl}/?slackError=1`);
  }
});

slackRouter.delete("/connection", requireAuth, async (req, res) => {
  await prisma.slackConnection.deleteMany({ where: { userId: req.authUserId } });
  res.json({ ok: true });
});
