import { config } from "dotenv";

config();

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

export const env = {
  port: Number(process.env.PORT ?? 4000),
  frontendUrl: required("FRONTEND_URL", "http://localhost:3000"),
  nodeEnv: process.env.NODE_ENV ?? "development",

  databaseUrl: required("DATABASE_URL"),
  redisUrl: required("REDIS_URL", "redis://localhost:6379"),
  elasticsearchUrl: required("ELASTICSEARCH_URL", "http://localhost:9200"),

  jwtSecret: required("JWT_SECRET"),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "7d",
  enableDevLogin: (process.env.ENABLE_DEV_LOGIN ?? "true") === "true",

  googleClientId: process.env.GOOGLE_CLIENT_ID ?? "",
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
  googleCallbackUrl: process.env.GOOGLE_CALLBACK_URL ?? "http://localhost:4000/api/auth/google/callback",

  slackClientId: process.env.SLACK_CLIENT_ID ?? "",
  slackClientSecret: process.env.SLACK_CLIENT_SECRET ?? "",
  slackRedirectUri: process.env.SLACK_REDIRECT_URI ?? "http://localhost:4000/api/slack/oauth/callback",

  adminQueuesUser: process.env.ADMIN_QUEUES_USER ?? "admin",
  adminQueuesPass: process.env.ADMIN_QUEUES_PASS ?? "admin",

  workerConcurrency: Number(process.env.WORKER_CONCURRENCY ?? 5),
};

export const isGoogleOAuthConfigured = Boolean(env.googleClientId && env.googleClientSecret);
export const isSlackOAuthConfigured = Boolean(env.slackClientId && env.slackClientSecret);
