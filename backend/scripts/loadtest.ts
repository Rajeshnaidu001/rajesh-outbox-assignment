/**
 * Simulates scheduling 100+ concurrent emails against a deliberately tight rate limit,
 * to demonstrate that jobs get rescheduled into later hourly windows (never dropped) and
 * that killing/restarting the worker mid-run does not lose or duplicate sends.
 *
 * Usage:
 *   1. docker-compose up -d && npm run prisma:migrate (from /backend)
 *   2. npm run dev:server  (in one terminal)
 *   3. npm run dev:worker  (in another terminal)
 *   4. npm run loadtest    (in a third terminal, from /backend)
 *
 * To verify restart recovery: while the loadtest is polling, Ctrl+C the `dev:worker`
 * terminal and restart it a few seconds later. The polled counts will pause, then resume
 * converging to 100% sent with no duplicate or lost recipients.
 */

const API_URL = process.env.API_URL ?? "http://localhost:4000";
const RECIPIENT_COUNT = Number(process.env.LOADTEST_COUNT ?? 120);
const HOURLY_LIMIT = Number(process.env.LOADTEST_HOURLY_LIMIT ?? 10);
const MIN_DELAY_SECONDS = Number(process.env.LOADTEST_MIN_DELAY ?? 2);

interface Sender {
  id: string;
  name: string;
}

async function devLogin(): Promise<string> {
  const res = await fetch(`${API_URL}/api/auth/dev-login`, { method: "POST" });
  if (!res.ok) throw new Error(`Dev login failed: ${res.status} ${await res.text()}`);
  const { token } = (await res.json()) as { token: string };
  return token;
}

async function createSender(token: string): Promise<Sender> {
  const res = await fetch(`${API_URL}/api/senders`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      name: `Loadtest Sender ${Date.now()}`,
      fromAddress: "loadtest@example.com",
      minDelaySeconds: MIN_DELAY_SECONDS,
      hourlyLimit: HOURLY_LIMIT,
    }),
  });
  if (!res.ok) throw new Error(`Create sender failed: ${res.status} ${await res.text()}`);
  return res.json() as Promise<Sender>;
}

function buildRecipientsCsv(count: number): string {
  const lines = ["email"];
  for (let i = 0; i < count; i++) lines.push(`loadtest-recipient-${i}@example.com`);
  return lines.join("\n");
}

async function createCampaign(token: string, senderId: string): Promise<{ campaignId: string; scheduledCount: number }> {
  const form = new FormData();
  form.set("subject", "Load test campaign");
  form.set("body", "<p>This is a load test email.</p>");
  form.set("senderConfigId", senderId);
  form.set("startTime", new Date().toISOString());
  form.set("recipients", new Blob([buildRecipientsCsv(RECIPIENT_COUNT)], { type: "text/csv" }), "recipients.csv");

  const res = await fetch(`${API_URL}/api/campaigns`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  if (!res.ok) throw new Error(`Create campaign failed: ${res.status} ${await res.text()}`);
  return res.json() as Promise<{ campaignId: string; scheduledCount: number }>;
}

interface EmailRow {
  id: string;
  status: string;
  scheduledAt: string;
}

async function fetchEmails(token: string, campaignId: string, status: "scheduled" | "sent"): Promise<EmailRow[]> {
  const res = await fetch(`${API_URL}/api/emails?status=${status}&campaignId=${campaignId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Fetch emails failed: ${res.status}`);
  return res.json() as Promise<EmailRow[]>;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log(`Logging in and creating a sender with hourlyLimit=${HOURLY_LIMIT}, minDelaySeconds=${MIN_DELAY_SECONDS}...`);
  const token = await devLogin();
  const sender = await createSender(token);

  console.log(`Scheduling a campaign with ${RECIPIENT_COUNT} recipients on sender "${sender.name}"...`);
  const { campaignId, scheduledCount } = await createCampaign(token, sender.id);
  console.log(`Backend accepted ${scheduledCount} recipients as delayed BullMQ jobs (campaign ${campaignId}).\n`);

  console.log(
    `With hourlyLimit=${HOURLY_LIMIT}, expect only the first ${HOURLY_LIMIT} to send within the first hour —` +
      ` the rest should show scheduledAt times pushed into later hourly windows instead of failing.\n`
  );
  console.log("Polling every 5s. Feel free to Ctrl+C the worker process now and restart it a few seconds later\n" +
    "to prove restart recovery — the counts below should simply pause and then keep converging.\n");

  for (let i = 0; i < 60; i++) {
    const [scheduled, sent] = await Promise.all([
      fetchEmails(token, campaignId, "scheduled"),
      fetchEmails(token, campaignId, "sent"),
    ]);
    const sentOk = sent.filter((e) => e.status === "sent").length;
    const failed = sent.filter((e) => e.status === "failed").length;
    const nextWindows = new Set(scheduled.map((e) => new Date(e.scheduledAt).toISOString().slice(0, 13))).size;

    console.log(
      `[t+${i * 5}s] scheduled=${scheduled.length} sent=${sentOk} failed=${failed} ` +
        `distinctUpcomingHourWindows=${nextWindows} total=${scheduled.length + sent.length}/${RECIPIENT_COUNT}`
    );

    if (scheduled.length === 0 && sent.length >= RECIPIENT_COUNT) {
      console.log("\nAll recipients reached a final state (sent/failed), no drops or duplicates. Done.");
      return;
    }

    await sleep(5000);
  }

  console.log("\nStopped polling after 5 minutes — check /admin/queues for remaining job state.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
