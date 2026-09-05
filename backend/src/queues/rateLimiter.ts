import type { Redis } from "ioredis";

// Atomically increments an hourly counter and rejects (rolling back the increment)
// once it would exceed the limit. Single round-trip, safe under concurrent workers.
const HOURLY_LIMIT_SCRIPT = `
local key = KEYS[1]
local limit = tonumber(ARGV[1])
local ttlSeconds = tonumber(ARGV[2])
local count = redis.call('INCR', key)
if count == 1 then
  redis.call('EXPIRE', key, ttlSeconds)
end
if count > limit then
  redis.call('DECR', key)
  return -1
end
return count
`;

// Atomically checks "has enough time passed since the sender's last send" and,
// if so, records `now` as the new last-sent time in the same round-trip.
const MIN_DELAY_SCRIPT = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local minDelayMs = tonumber(ARGV[2])
local last = tonumber(redis.call('GET', key) or '0')
if (now - last) < minDelayMs then
  return last + minDelayMs
end
redis.call('SET', key, now)
return 0
`;

function hourBucketId(date: Date): string {
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
    String(date.getUTCHours()).padStart(2, "0"),
  ].join("");
}

export function hourlyLimitKey(senderId: string, date: Date): string {
  return `sender:${senderId}:hour:${hourBucketId(date)}`;
}

export function notifiedKey(senderId: string, date: Date): string {
  return `${hourlyLimitKey(senderId, date)}:notified`;
}

export function lastSentKey(senderId: string): string {
  return `sender:${senderId}:lastSentAt`;
}

export function startOfNextHour(date: Date): Date {
  const next = new Date(date);
  next.setUTCMinutes(0, 0, 0);
  next.setUTCHours(next.getUTCHours() + 1);
  return next;
}

export interface HourlyLimitResult {
  allowed: boolean;
  count: number;
  nextWindowStart: Date;
}

export async function checkHourlyLimit(
  redis: Redis,
  senderId: string,
  hourlyLimit: number,
  now = new Date()
): Promise<HourlyLimitResult> {
  const key = hourlyLimitKey(senderId, now);
  const result = (await redis.eval(HOURLY_LIMIT_SCRIPT, 1, key, hourlyLimit, 2 * 3600)) as number;
  return {
    allowed: result !== -1,
    count: result,
    nextWindowStart: startOfNextHour(now),
  };
}

export interface MinDelayResult {
  allowed: boolean;
  nextAllowedAt: number;
}

export async function checkMinDelay(
  redis: Redis,
  senderId: string,
  minDelaySeconds: number,
  now = Date.now()
): Promise<MinDelayResult> {
  const key = lastSentKey(senderId);
  const result = (await redis.eval(MIN_DELAY_SCRIPT, 1, key, now, minDelaySeconds * 1000)) as number;
  return { allowed: result === 0, nextAllowedAt: result === 0 ? now : result };
}

// Ensures the Slack alert for a given sender+hour fires exactly once, no matter how
// many jobs get rate-limited into that same bucket concurrently.
export async function claimNotificationSlot(redis: Redis, senderId: string, now = new Date()): Promise<boolean> {
  const key = notifiedKey(senderId, now);
  const result = await redis.set(key, "1", "EX", 2 * 3600, "NX");
  return result === "OK";
}
