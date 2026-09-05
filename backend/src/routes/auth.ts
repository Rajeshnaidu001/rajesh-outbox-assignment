import { Router } from "express";
import passport from "passport";
import type { User } from "@prisma/client";
import { env, isGoogleOAuthConfigured, isSlackOAuthConfigured } from "../config/env";
import { signAuthToken } from "../auth/jwt";
import { getOrCreateDevUser } from "../auth/devLogin";
import { requireAuth } from "../middleware/requireAuth";
import { prisma } from "../lib/prisma";

export const authRouter = Router();

authRouter.get("/config", (_req, res) => {
  res.json({
    devLoginEnabled: env.enableDevLogin,
    googleOAuthConfigured: isGoogleOAuthConfigured,
    slackOAuthConfigured: isSlackOAuthConfigured,
  });
});

authRouter.get("/google", (req, res, next) => {
  if (!isGoogleOAuthConfigured) {
    res.status(503).send("Google OAuth is not configured on the server (missing GOOGLE_CLIENT_ID/SECRET).");
    return;
  }
  passport.authenticate("google", { scope: ["profile", "email"], session: false })(req, res, next);
});

authRouter.get(
  "/google/callback",
  (req, res, next) => {
    passport.authenticate("google", { session: false, failureRedirect: `${env.frontendUrl}/login?error=google` })(
      req,
      res,
      next
    );
  },
  (req, res) => {
    const user = req.user as User;
    const token = signAuthToken({ sub: user.id, email: user.email });
    res.redirect(`${env.frontendUrl}/auth/callback?token=${encodeURIComponent(token)}`);
  }
);

authRouter.post("/dev-login", async (_req, res) => {
  if (!env.enableDevLogin) {
    res.status(403).json({ error: "Dev login is disabled" });
    return;
  }
  const user = await getOrCreateDevUser();
  const token = signAuthToken({ sub: user.id, email: user.email });
  res.json({ token });
});

authRouter.get("/me", requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.authUserId },
    include: { slackConnection: true },
  });
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json({
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
    isDev: user.isDev,
    slackConnected: Boolean(user.slackConnection),
    slackTeamName: user.slackConnection?.teamName ?? null,
  });
});
