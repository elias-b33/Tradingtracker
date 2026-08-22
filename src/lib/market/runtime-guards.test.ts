import { describe, expect, it } from "vitest";
import { FixedWindowRateLimiter, TtlLruCache } from "./runtime-guards";

describe("public endpoint runtime guards", () => {
  it("expires cached values and evicts the least-recently-used key", () => {
    const cache = new TtlLruCache<number>({ maxEntries: 2 });
    cache.set("a", 1, 100, 0);
    cache.set("b", 2, 100, 0);
    expect(cache.get("a", 10)).toBe(1);

    cache.set("c", 3, 100, 10);
    expect(cache.get("b", 10)).toBeUndefined();
    expect(cache.get("a", 10)).toBe(1);
    expect(cache.get("c", 111)).toBeUndefined();
  });

  it("rejects excess requests until the fixed window resets", () => {
    const limiter = new FixedWindowRateLimiter();

    expect(limiter.consume("client", 2, 1_000, 0)).toMatchObject({ allowed: true, remaining: 1 });
    expect(limiter.consume("client", 2, 1_000, 10)).toMatchObject({ allowed: true, remaining: 0 });
    expect(limiter.consume("client", 2, 1_000, 20)).toMatchObject({
      allowed: false,
      retryAfterMs: 980,
    });
    expect(limiter.consume("client", 2, 1_000, 1_000)).toMatchObject({
      allowed: true,
      remaining: 1,
    });
  });
});
