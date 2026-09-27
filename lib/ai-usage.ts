import type { DatabaseSync } from "node:sqlite";

export const DEFAULT_AI_DAILY_LIMIT = 300;

export function initializeAiUsageStore(database: DatabaseSync) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS ai_usage (
      day TEXT PRIMARY KEY,
      requests INTEGER NOT NULL DEFAULT 0
    );
  `);
  return database;
}

/** Daily cloud AI request cap. `0` disables the cap. */
export function aiDailyLimit(value = process.env.CONTROL_CENTER_AI_DAILY_LIMIT) {
  const trimmed = value?.trim();
  if (!trimmed) return DEFAULT_AI_DAILY_LIMIT;
  const parsed = Number(trimmed);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : DEFAULT_AI_DAILY_LIMIT;
}

function usageDay(now: Date) {
  return now.toISOString().slice(0, 10);
}

/**
 * Atomically counts one request against today's (UTC) cap. Returns whether the
 * request may proceed; a refused request is not counted.
 */
export function reserveAiRequest(database: DatabaseSync, limit: number, now = new Date()) {
  const day = usageDay(now);
  const row = database.prepare(`
    INSERT INTO ai_usage (day, requests) VALUES (?, 1)
    ON CONFLICT(day) DO UPDATE SET requests = requests + 1 WHERE requests < ?
    RETURNING requests
  `).get(day, limit) as { requests: number } | undefined;
  if (row) return { allowed: true, used: row.requests, limit };
  const current = database.prepare("SELECT requests FROM ai_usage WHERE day = ?").get(day) as { requests: number } | undefined;
  return { allowed: false, used: current?.requests ?? limit, limit };
}

export function aiUsageToday(database: DatabaseSync, now = new Date()) {
  const row = database.prepare("SELECT requests FROM ai_usage WHERE day = ?").get(usageDay(now)) as { requests: number } | undefined;
  return row?.requests ?? 0;
}
