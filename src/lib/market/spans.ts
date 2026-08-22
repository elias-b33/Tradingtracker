import type { Candle, IntervalId, SpanId } from "./types";

export function recommendedInterval(span: SpanId): IntervalId {
  switch (span) {
    case "1D":
      return "15m";
    case "1W":
      return "1h";
    case "1M":
      return "1h";
    case "6M":
      return "4h";
    case "YTD":
    case "1Y":
      return "1d";
    case "5Y":
    case "ALL":
      return "1w";
  }
}

/** Inclusive window start in ms, or null for all-time (latest N candles). */
export function spanStartMs(span: SpanId, now = Date.now()): number | null {
  switch (span) {
    case "1D":
      return now - 86_400_000;
    case "1W":
      return now - 7 * 86_400_000;
    case "1M":
      return now - 30 * 86_400_000;
    case "6M":
      return now - 182 * 86_400_000;
    case "YTD":
      return Date.UTC(new Date(now).getUTCFullYear(), 0, 1);
    case "1Y":
      return now - 365 * 86_400_000;
    case "5Y":
      return now - 5 * 365 * 86_400_000;
    case "ALL":
      return null;
  }
}

export function spanLabel(span: SpanId | null): string {
  if (!span || span === "1D") return "Day";
  if (span === "1W") return "Week";
  if (span === "1M") return "Month";
  return span;
}

/** Open of the first candle in the window → last print. */
export function rangeMove(
  candles: Candle[],
  lastPrice: number,
  span: SpanId | null,
): { pct: number; delta: number; from: number } | null {
  if (!candles.length || !Number.isFinite(lastPrice) || lastPrice <= 0) return null;
  const start = span && span !== "ALL" ? spanStartMs(span) : null;
  const startSec = start ? start / 1000 : 0;
  const first = startSec ? (candles.find((c) => c.time >= startSec) ?? candles[0]) : candles[0];
  const from = first.open;
  if (!from) return null;
  return { pct: ((lastPrice - from) / from) * 100, delta: lastPrice - from, from };
}