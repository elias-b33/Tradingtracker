export type CacheOptions = {
  maxEntries: number;
};

type CacheEntry<T> = {
  expiresAt: number;
  value: T;
};

/**
 * Small in-memory TTL cache with least-recently-used eviction.
 *
 * Serverless instances do not share this cache. The size bound is intentional:
 * untrusted market symbols must never be able to grow process memory without a
 * limit. `now` is injectable so expiry and eviction can be tested without
 * timers.
 */
export class TtlLruCache<T> {
  private readonly entries = new Map<string, CacheEntry<T>>();
  readonly maxEntries: number;

  constructor({ maxEntries }: CacheOptions) {
    if (!Number.isInteger(maxEntries) || maxEntries < 1) {
      throw new Error("maxEntries must be a positive integer");
    }
    this.maxEntries = maxEntries;
  }

  get size(): number {
    return this.entries.size;
  }

  get(key: string, now = Date.now()): T | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= now) {
      this.entries.delete(key);
      return undefined;
    }

    // Map iteration order is our LRU order. Touch successful reads.
    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry.value;
  }

  set(key: string, value: T, ttlMs: number, now = Date.now()): void {
    if (!Number.isFinite(ttlMs) || ttlMs <= 0) return;
    this.entries.delete(key);
    this.pruneExpired(now);
    while (this.entries.size >= this.maxEntries) {
      const oldest = this.entries.keys().next().value as string | undefined;
      if (oldest === undefined) break;
      this.entries.delete(oldest);
    }
    this.entries.set(key, { expiresAt: now + ttlMs, value });
  }

  delete(key: string): boolean {
    return this.entries.delete(key);
  }

  clear(): void {
    this.entries.clear();
  }

  private pruneExpired(now: number): void {
    for (const [key, entry] of this.entries) {
      if (entry.expiresAt <= now) this.entries.delete(key);
    }
  }
}

export type RateLimitResult =
  | { allowed: true; remaining: number; retryAfterMs: 0 }
  | { allowed: false; remaining: 0; retryAfterMs: number };

type RateWindow = {
  count: number;
  startedAt: number;
};

/** A bounded, per-process fixed-window limiter suitable for serverless guards. */
export class FixedWindowRateLimiter {
  private readonly windows = new Map<string, RateWindow>();

  constructor(readonly maxEntries = 2048) {
    if (!Number.isInteger(maxEntries) || maxEntries < 1) {
      throw new Error("maxEntries must be a positive integer");
    }
  }

  consume(
    key: string,
    limit: number,
    windowMs: number,
    now = Date.now(),
  ): RateLimitResult {
    if (!Number.isInteger(limit) || limit < 1 || !Number.isFinite(windowMs) || windowMs <= 0) {
      throw new Error("Rate limit and window must be positive");
    }

    let window = this.windows.get(key);
    if (!window || now - window.startedAt >= windowMs) {
      window = { count: 0, startedAt: now };
    } else {
      this.windows.delete(key);
    }

    if (window.count >= limit) {
      this.windows.set(key, window);
      return {
        allowed: false,
        remaining: 0,
        retryAfterMs: Math.max(1, window.startedAt + windowMs - now),
      };
    }

    window.count += 1;
    this.pruneAndStore(key, window, now, windowMs);
    return { allowed: true, remaining: Math.max(0, limit - window.count), retryAfterMs: 0 };
  }

  private pruneAndStore(key: string, window: RateWindow, now: number, windowMs: number): void {
    if (this.windows.size >= this.maxEntries) {
      for (const [candidate, value] of this.windows) {
        if (now - value.startedAt >= windowMs) this.windows.delete(candidate);
      }
    }
    while (this.windows.size >= this.maxEntries) {
      const oldest = this.windows.keys().next().value as string | undefined;
      if (oldest === undefined) break;
      this.windows.delete(oldest);
    }
    this.windows.set(key, window);
  }
}
