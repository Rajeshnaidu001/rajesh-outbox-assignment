import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { env, isGoogleOAuthConfigured } from "../config/env";
import { prisma } from "../lib/prisma";
import { logger } from "../lib/logger";

export function configurePassport(): void {
  if (!isGoogleOAuthConfigured) {
    logger.warn("GOOGLE_CLIENT_ID/SECRET not set — Google OAuth routes will return an error until configured");
    return;
  }

  passport.use(
    new GoogleStrategy(
      {
        clientID: env.googleClientId,
        clientSecret: env.googleClientSecret,
        callbackURL: env.googleCallbackUrl,
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value;
          if (!email) return done(new Error("Google profile has no email"));

          const user = await prisma.user.upsert({
            where: { googleId: profile.id },
            update: {
              name: profile.displayName,
              avatarUrl: profile.photos?.[0]?.value,
            },
            create: {
              googleId: profile.id,
              email,
              name: profile.displayName,
              avatarUrl: profile.photos?.[0]?.value,
            },
          });

          done(null, user);
        } catch (err) {
          done(err as Error);
        }
      }
    )
  );
}
