// In-process token buckets for endpoints that trigger outbound collection or
// billable AI calls. A single local server process makes this sufficient; the
// persistent daily AI cap lives in lib/ai-usage.ts.

type Bucket = { tokens: number; updatedAt: number };

export type RateLimitRule = {
  /** Burst size. */
  capacity: number;
  /** Tokens restored per minute. */
  refillPerMinute: number;
};

export class RateLimiter {
  private buckets = new Map<string, Bucket>();

  constructor(private readonly now: () => number = Date.now) {}

  /** Returns 0 when allowed, otherwise the seconds until a token is available. */
  take(key: string, rule: RateLimitRule): number {
    const now = this.now();
    const refillPerMs = rule.refillPerMinute / 60_000;
    const bucket = this.buckets.get(key) ?? { tokens: rule.capacity, updatedAt: now };
    bucket.tokens = Math.min(rule.capacity, bucket.tokens + (now - bucket.updatedAt) * refillPerMs);
    bucket.updatedAt = now;
    this.buckets.set(key, bucket);
    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      return 0;
    }
    return Math.max(1, Math.ceil((1 - bucket.tokens) / refillPerMs / 1000));
  }

  reset() {
    this.buckets.clear();
  }
}
