/**
 * Simple in-memory cache with TTL support
 * Used for caching frequently accessed data like resource categories and map data
 */

export interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

export class Cache<T> {
  private entries: Map<string, CacheEntry<T>> = new Map();
  private defaultTtlMs: number;

  constructor(defaultTtlMs: number = 5 * 60 * 1000) {
    // Default 5 minutes
    this.defaultTtlMs = defaultTtlMs;
  }

  /**
   * Get a cached value, returning null if not found or expired
   */
  get(key: string): T | null {
    const entry = this.entries.get(key);
    if (!entry) return null;

    if (Date.now() >= entry.expiresAt) {
      this.entries.delete(key);
      return null;
    }

    return entry.data;
  }

  /**
   * Set a cached value with optional custom TTL
   */
  set(key: string, data: T, ttlMs?: number): void {
    const expiresAt = Date.now() + (ttlMs ?? this.defaultTtlMs);
    this.entries.set(key, { data, expiresAt });
  }

  /**
   * Clear a specific key or all entries
   */
  clear(key?: string): void {
    if (key) {
      this.entries.delete(key);
    } else {
      this.entries.clear();
    }
  }

  /**
   * Check if a key exists and is not expired
   */
  has(key: string): boolean {
    return this.get(key) !== null;
  }

  /**
   * Get cache stats for debugging
   */
  getStats() {
    return {
      size: this.entries.size,
      entries: Array.from(this.entries.entries()).map(([key, entry]) => ({
        key,
        expiresAt: new Date(entry.expiresAt).toISOString(),
        isExpired: Date.now() >= entry.expiresAt
      }))
    };
  }
}

// Resource categories cache (1 hour TTL)
export const resourceCategoriesCache = new Cache<string[]>(60 * 60 * 1000);

// Map data cache (10 minute TTL)
export const mapDataCache = new Cache<Record<string, unknown>>(10 * 60 * 1000);

// Resource recommendations cache (5 minute TTL)
export const recommendationsCache = new Cache<Record<string, unknown>>(5 * 60 * 1000);
