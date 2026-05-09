type Bucket = {
  tokens: number;
  lastRefillAt: number;
};

export class RateLimiter {
  private readonly buckets = new Map<string, Bucket>();

  constructor(
    private readonly options: {
      maxRequests: number;
      windowMs: number;
    }
  ) {}

  allow(key: string): boolean {
    const now = Date.now();
    const bucket = this.buckets.get(key) ?? {
      tokens: this.options.maxRequests,
      lastRefillAt: now
    };

    const elapsedMs = now - bucket.lastRefillAt;
    const refillTokens = (elapsedMs / this.options.windowMs) * this.options.maxRequests;
    bucket.tokens = Math.min(this.options.maxRequests, bucket.tokens + refillTokens);
    bucket.lastRefillAt = now;

    if (bucket.tokens < 1) {
      this.buckets.set(key, bucket);
      return false;
    }

    bucket.tokens -= 1;
    this.buckets.set(key, bucket);
    return true;
  }

  reset(key?: string) {
    if (key) {
      this.buckets.delete(key);
      return;
    }

    this.buckets.clear();
  }
}

export const authWriteLimiter = new RateLimiter({
  maxRequests: 8,
  windowMs: 60 * 1000
});

export function normalizeRateLimitKey(value: string | undefined): string {
  const trimmed = value?.trim().toLowerCase();
  return trimmed && trimmed.length > 0 ? trimmed : "unknown";
}
