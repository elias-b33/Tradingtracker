import { describe, expect, it } from "vitest";
import { bollinger, rsi, sma, vwap } from "./indicators";
import { rangeMove, recommendedInterval, spanStartMs } from "./spans";
import type { Candle } from "./types";

function candle(time: number, close: number, overrides: Partial<Candle> = {}): Candle {
  return {
    time,
    open: close,
    high: close,
    low: close,
    close,
    volume: 1,
    ...overrides,
  };
}

describe("market calculations", () => {
  it("calculates rolling simple averages and Bollinger bands", () => {
    const candles = [1, 2, 3, 4].map((close, index) => candle(index + 1, close));

    expect(sma(candles, 3)).toEqual([
      { time: 3, value: 2 },
      { time: 4, value: 3 },
    ]);

    const bands = bollinger(candles, 3, 2);
    expect(bands.mid).toHaveLength(2);
    expect(bands.upper[0].value).toBeCloseTo(3.632993, 5);
    expect(bands.lower[0].value).toBeCloseTo(0.367007, 5);
  });

  it("resets VWAP at the UTC day boundary", () => {
    const dayOne = Date.UTC(2026, 0, 1) / 1000;
    const dayTwo = Date.UTC(2026, 0, 2) / 1000;
    const candles = [
      candle(dayOne, 10, { high: 12, low: 8, volume: 2 }),
      candle(dayOne + 60, 20, { high: 22, low: 18, volume: 1 }),
      candle(dayTwo, 30, { high: 32, low: 28, volume: 4 }),
    ];

    expect(vwap(candles).map((point) => point.value)).toEqual([10, 40 / 3, 30]);
  });

  it("returns RSI extremes for one-direction price series", () => {
    const rising = [1, 2, 3, 4].map((close, index) => candle(index, close));
    const falling = [4, 3, 2, 1].map((close, index) => candle(index, close));

    expect(rsi(rising, 3).at(-1)?.value).toBe(100);
    expect(rsi(falling, 3).at(-1)?.value).toBe(0);
  });

  it("maps chart spans to sensible candle intervals", () => {
    expect(recommendedInterval("1D")).toBe("15m");
    expect(recommendedInterval("6M")).toBe("4h");
    expect(recommendedInterval("5Y")).toBe("1w");
  });

  it("uses the first candle in a selected range as performance basis", () => {
    const now = Date.UTC(2026, 0, 8);
    const start = spanStartMs("1W", now)! / 1000;
    const candles = [
      candle(start - 60, 80, { open: 80 }),
      candle(start, 100, { open: 100 }),
      candle(start + 60, 105, { open: 105 }),
    ];

    const originalNow = Date.now;
    Date.now = () => now;
    try {
      expect(rangeMove(candles, 110, "1W")).toEqual({ pct: 10, delta: 10, from: 100 });
    } finally {
      Date.now = originalNow;
    }
  });
});
