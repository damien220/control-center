import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { RateLimiter } from "../lib/rate-limit";
import { aiDailyLimit, aiUsageToday, DEFAULT_AI_DAILY_LIMIT, initializeAiUsageStore, reserveAiRequest } from "../lib/ai-usage";

test("token bucket allows a burst, then refills over time", () => {
  let now = 0;
  const limiter = new RateLimiter(() => now);
  const rule = { capacity: 2, refillPerMinute: 1 };
  assert.equal(limiter.take("a", rule), 0);
  assert.equal(limiter.take("a", rule), 0);
  assert.equal(limiter.take("a", rule), 60);
  assert.equal(limiter.take("b", rule), 0, "keys are independent");
  now += 60_000;
  assert.equal(limiter.take("a", rule), 0);
});

test("daily AI cap counts atomically and refuses past the limit", () => {
  const database = initializeAiUsageStore(new DatabaseSync(":memory:"));
  const day = new Date("2026-09-27T10:00:00Z");
  assert.deepEqual(reserveAiRequest(database, 2, day), { allowed: true, used: 1, limit: 2 });
  assert.deepEqual(reserveAiRequest(database, 2, day), { allowed: true, used: 2, limit: 2 });
  assert.deepEqual(reserveAiRequest(database, 2, day), { allowed: false, used: 2, limit: 2 });
  assert.equal(aiUsageToday(database, day), 2);
  assert.equal(reserveAiRequest(database, 2, new Date("2026-09-28T00:00:01Z")).allowed, true, "the cap resets each UTC day");
});

test("daily AI limit parses the environment value", () => {
  assert.equal(aiDailyLimit(undefined), DEFAULT_AI_DAILY_LIMIT);
  assert.equal(aiDailyLimit("0"), 0);
  assert.equal(aiDailyLimit(" 25 "), 25);
  assert.equal(aiDailyLimit("-4"), DEFAULT_AI_DAILY_LIMIT);
  assert.equal(aiDailyLimit("lots"), DEFAULT_AI_DAILY_LIMIT);
});
