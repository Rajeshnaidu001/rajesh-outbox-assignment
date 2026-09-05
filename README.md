# Outbox — Email Scheduler & Dashboard

A production-style email scheduling service: compose a campaign, upload a CSV of recipients,
and Outbox schedules delayed BullMQ jobs that respect a per-sender minimum delay and hourly
rate limit — automatically rescheduling (never dropping) any email that would exceed the
limit, alerting a connected Slack channel the instant that happens. Sent/scheduled emails are
indexed in Elasticsearch and searchable from the dashboard.

## Tech stack

- **Backend:** Node.js + TypeScript, Express, BullMQ (Redis), PostgreSQL + Prisma, Ethereal
  Email (fake SMTP), Elasticsearch, Passport (Google OAuth), Slack OAuth v2.
- **Frontend:** Next.js (App Router) + TypeScript + Tailwind CSS.
- **Infra:** Docker Compose for Redis, PostgreSQL, and Elasticsearch.

## Project layout

```
backend/     Express API + BullMQ worker (two entrypoints, one codebase)
frontend/    Next.js dashboard
docker-compose.yml   Redis, Postgres, Elasticsearch
```

## Setup

```bash
# 1. Start infra
docker compose up -d

# 2. Backend
cd backend
cp .env.example .env        # edit if needed — defaults match docker-compose.yml
npm install
npx prisma migrate dev --name init
npm run dev:server          # terminal A — API on :4000, admin UI at /admin/queues
npm run dev:worker          # terminal B — BullMQ worker

# 3. Frontend
cd ../frontend
cp .env.example .env.local
npm install
npm run dev                 # terminal C — dashboard on :3000
```

Open http://localhost:3000, click **Dev Login** (see below), and compose your first campaign.

### Environment variables

See `backend/.env.example` and `frontend/.env.example` for the full list with inline
descriptions. The important ones:

| Var | Purpose |
|---|---|
| `DATABASE_URL` / `REDIS_URL` / `ELASTICSEARCH_URL` | Match `docker-compose.yml` by default |
| `JWT_SECRET` | Signs the app's own session tokens (issued after any login method) |
| `ENABLE_DEV_LOGIN` | `true` by default — exposes a "Dev Login" button so the app is fully testable without registering OAuth apps |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | From [Google Cloud Console](https://console.cloud.google.com/apis/credentials). Redirect URI: `http://localhost:4000/api/auth/google/callback` |
| `SLACK_CLIENT_ID` / `SLACK_CLIENT_SECRET` | From [api.slack.com/apps](https://api.slack.com/apps), scope `incoming-webhook`. Redirect URI: `http://localhost:4000/api/slack/oauth/callback` |
| `ADMIN_QUEUES_USER` / `ADMIN_QUEUES_PASS` | Basic-auth credentials for `/admin/queues` (Bull Board has no auth of its own) |

Without real Google/Slack credentials, everything works except the two "Continue with
Google" / "Connect Slack" buttons — use Dev Login to explore the rest of the app.

## Architecture

### Persistent, restart-safe scheduling (no cron)

Every recipient becomes a Postgres `EmailJob` row **and** a BullMQ delayed job in the same
queue, using the row's own id as the BullMQ `jobId`. Because:

- Redis runs with `--appendonly yes` (see `docker-compose.yml`), delayed jobs survive a Redis
  restart, and
- the `jobId` is deterministic and unique per `EmailJob`, so BullMQ refuses to enqueue a
  duplicate, and
- the worker re-checks the row's `status` in Postgres before sending and skips anything
  already `sent`/`failed`,

killing and restarting the API server, the worker, or Redis itself never loses a pending send
and never double-sends one that already went out. There is no cron/interval polling anywhere
— every send is a BullMQ delayed job that fires exactly once at its due time.

### Rate limiting & rescheduling

Two independent Redis-backed gates run inside the worker's job processor
(`backend/src/queues/processor.ts`), both implemented as single-round-trip Lua scripts
(`backend/src/queues/rateLimiter.ts`) so they stay correct under concurrent workers:

1. **Min delay between sends** — `sender:{id}:lastSentAt` is atomically checked-and-set; a job
   arriving too soon after the previous send is moved forward, not failed.
2. **Hourly limit** — `sender:{id}:hour:{yyyyMMddHH}` is atomically incremented (and rolled
   back if it would exceed the sender's limit).

When either gate says "not yet," the worker calls BullMQ's `job.moveToDelayed(...)` — the
official pattern for "reschedule, don't fail" — and throws `DelayedError` so BullMQ treats it
as an intentional reschedule (no retry-count burn, no `failed` event). Because the same job
is *moved*, not re-queued behind newer jobs, **FIFO order is preserved**: a sender's
rate-limited emails still go out in the order they were originally scheduled, just later.

At campaign-creation time (`backend/src/queues/scheduler.ts`) sends are also pre-spaced by
the sender's delay/hourly-limit settings, so the initial "Scheduled For" times in the
dashboard are realistic — but the runtime gates above are the actual source of truth and
handle cases the pre-computed schedule can't (e.g. two campaigns on the same sender running
at once).

### Slack alerts

Slack is connected per-user via OAuth v2's "Incoming Webhook" flow
(`backend/src/routes/slack.ts`) — the authorize URL is fetched over an authenticated request
and the browser is redirected to it (a bare `<a href>` can't carry the auth header), and the
webhook URL Slack returns is stored on the user's `SlackConnection` row. The instant a sender
hits its hourly limit, the worker posts to that webhook (`backend/src/services/slack.ts`),
guarded by a `SETNX` flag so a burst of simultaneously-limited jobs only fires one message per
sender per hour. If no Slack connection exists, or the webhook call fails, the job continues
normally — a Slack outage never blocks email delivery.

### Search

Every `EmailJob` is written through to an Elasticsearch `emails` index on creation and on
every status change (`backend/src/services/elasticsearchSync.ts`). The dashboard's search bar
hits `GET /api/emails/search`, which runs a `multi_match` across subject/body/recipient
scoped to the current user.

### Auth

Both Google login and Slack connect are handled entirely by the backend (Passport +
Slack OAuth v2); the frontend never talks to either provider directly. On success the backend
issues its own JWT and redirects to `/auth/callback?token=...`, which the frontend stores and
sends as `Authorization: Bearer <token>` on every API call. `ENABLE_DEV_LOGIN=true` exposes an
equivalent `POST /api/auth/dev-login` for local testing without OAuth credentials.

## Load test / restart-recovery demo

```bash
cd backend
npm run loadtest
```

This schedules 120 emails (configurable via `LOADTEST_COUNT`) against a sender with a
deliberately low hourly limit (`LOADTEST_HOURLY_LIMIT=10`), then polls
`GET /api/emails?status=scheduled|sent` every 5s so you can watch:

- only the first 10 emails/hour go out, the rest get pushed into later hourly windows instead
  of failing (and a Slack message fires once, if you've connected Slack), and
- if you `Ctrl+C` the `dev:worker` process mid-run and restart it a few seconds later, the
  counts simply pause and then keep converging — no duplicate sends, no lost recipients.

You can also watch the same campaign live in the Bull Board UI at
`http://localhost:4000/admin/queues`.
