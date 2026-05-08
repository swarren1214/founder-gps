/**
 * Simple token bucket rate limiter
 * Protects AI-intensive endpoints from being overwhelmed
 */

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

export class RateLimiter {
  private buckets: Map<string, { tokens: number; lastRefillAt: number }> = new Map();
  private maxRequests: number;
  private windowMs: number;

  constructor(config: RateLimitConfig) {
    this.maxRequests = config.maxRequests;
    this.windowMs = config.windowMs;
  }

  /**
   * Check if a request should be allowed
   * Returns true if within rate limit, false if limit exceeded
   */
  isAllowed(key: string): boolean {
    const now = Date.now();
    let bucket = this.buckets.get(key);

    if (!bucket) {
      bucket = { tokens: this.maxRequests, lastRefillAt: now };
      this.buckets.set(key, bucket);
      return true;
    }

    // Calculate elapsed time and refill tokens
    const elapsedMs = now - bucket.lastRefillAt;
    const tokensToAdd = (elapsedMs / this.windowMs) * this.maxRequests;

    bucket.tokens = Math.min(this.maxRequests, bucket.tokens + tokensToAdd);
    bucket.lastRefillAt = now;

    // Check if we have tokens available
    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      return true;
    }

    return false;
  }

  /**
   * Get remaining tokens for a key
   */
  getRemaining(key: string): number {
    const bucket = this.buckets.get(key);
    if (!bucket) return this.maxRequests;

    const now = Date.now();
    const elapsedMs = now - bucket.lastRefillAt;
    const tokensToAdd = (elapsedMs / this.windowMs) * this.maxRequests;

    return Math.min(this.maxRequests, bucket.tokens + tokensToAdd);
  }

  /**
   * Clear a specific key or all keys
   */
  clear(key?: string): void {
    if (key) {
      this.buckets.delete(key);
    } else {
      this.buckets.clear();
    }
  }
}

// Rate limiters for different services
// AI analysis: 20 requests per minute (roughly 0.33 requests per second)
export const aiAnalysisLimiter = new RateLimiter({
  maxRequests: 20,
  windowMs: 60 * 1000
});

// Roadmap generation: 10 requests per minute
export const roadmapLimiter = new RateLimiter({
  maxRequests: 10,
  windowMs: 60 * 1000
});

// General recommendation generation: 30 requests per minute
export const recommendationLimiter = new RateLimiter({
  maxRequests: 30,
  windowMs: 60 * 1000
});

/**
 * Extract a rate limit key from request context
 * Uses IP address (or X-Forwarded-For header for proxied requests)
 */
export function getRateLimitKey(req: { headers: Record<string, string | string[] | undefined> }): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") {
    return forwarded.split(",")[0].trim();
  }
  const ip = Array.isArray(forwarded) ? forwarded[0] : req.headers["x-real-ip"];
  return typeof ip === "string" ? ip : "unknown";
}
