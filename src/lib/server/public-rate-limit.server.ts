import { getRequest } from "@tanstack/react-start/server";
import { FixedWindowRateLimiter } from "../market/runtime-guards";

const limiter = new FixedWindowRateLimiter(2048);

function clientAddress(request: Request | undefined): string {
  if (!request) return "unknown";
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const address =
    forwarded ||
    request.headers.get("x-real-ip")?.trim() ||
    request.headers.get("cf-connecting-ip")?.trim() ||
    "unknown";
  // Header values are untrusted input. Keep cache keys small and predictable.
  return address.replace(/[^a-fA-F0-9.:_-]/g, "").slice(0, 64) || "unknown";
}

export class PublicRateLimitError extends Error {
  readonly status = 429;
  readonly retryAfterSeconds: number;

  constructor(retryAfterMs: number) {
    const retryAfterSeconds = Math.max(1, Math.ceil(retryAfterMs / 1000));
    super(`Too many requests. Try again in ${retryAfterSeconds}s.`);
    this.name = "PublicRateLimitError";
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

/**
 * Per-instance and per-client protection for public data functions.
 * Vercel instances intentionally keep independent counters; upstream caches and
 * provider limits remain the second line of defence.
 */
export function enforcePublicRateLimit(
  scope: string,
  limit: number,
  windowMs = 60_000,
): void {
  const request = getRequest();
  const key = `${scope}:${clientAddress(request)}`;
  const result = limiter.consume(key, limit, windowMs);
  if (!result.allowed) throw new PublicRateLimitError(result.retryAfterMs);
}
