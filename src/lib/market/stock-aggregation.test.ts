import { describe, expect, it } from "vitest";
import { aggregateStockCandles, mergeStockQuotes, quoteTimestampSeconds } from "./stocks";
import type { Candle } from "./types";

function hourlySession(start: number, closes: number[]): Candle[] {
  return closes.map((close, index) => ({
    time: start + index * 60 * 60,
    open: close - 0.5,
    high: close + 1,
    low: close - 1,
    close,
    volume: 100 + index,
  }));
}

describe("stock candle aggregation", () => {
  it("turns seven hourly US-session candles into two 4H bars without crossing sessions", () => {
    const firstOpen = Date.UTC(2026, 7, 20, 13, 30) / 1000;
    const nextOpen = Date.UTC(2026, 7, 21, 13, 30) / 1000;
    const firstSession = hourlySession(firstOpen, [100, 101, 102, 103, 104, 105, 106]);
    const nextSession = hourlySession(nextOpen, [110]);

    const bars = aggregateStockCandles(
      [...firstSession, ...nextSession],
      4 * 60 * 60,
      "America/New_York",
    );

    expect(bars).toHaveLength(3);
    expect(bars[0]).toMatchObject({
      time: firstOpen,
      open: 99.5,
      high: 104,
      low: 99,
      close: 103,
      volume: 406,
    });
    expect(bars[1]).toMatchObject({
      time: firstOpen + 4 * 60 * 60,
      open: 103.5,
      high: 107,
      low: 103,
      close: 106,
      volume: 315,
    });
    expect(bars[2]).toMatchObject({ time: nextOpen, open: 109.5, close: 110 });
  });

  it("normalizes provider timestamps and keeps fallback exchange metadata", () => {
    const lastTime = Date.UTC(2026, 7, 20, 14, 0) / 1000;
    expect(quoteTimestampSeconds("2026-08-20T14:00:00Z")).toBe(lastTime);
    expect(quoteTimestampSeconds(lastTime * 1000)).toBe(lastTime);

    const merged = mergeStockQuotes(
      {
        symbol: "AAPL",
        lastPrice: 200,
        openPrice: 198,
        priceChange: 2,
        priceChangePercent: 1,
        highPrice: 202,
        lowPrice: 197,
        volume: 1_000,
        quoteVolume: 0,
        source: "yahoo",
        exchange: "NMS",
        marketState: "regular",
        currency: "USD",
      },
      {
        symbol: "AAPL",
        lastPrice: 201,
        openPrice: 198,
        priceChange: 3,
        priceChangePercent: 1.5,
        highPrice: 0,
        lowPrice: 0,
        volume: 0,
        quoteVolume: 0,
        source: "alpaca-iex",
        feed: "iex",
        delaySeconds: 0,
        lastTime,
      },
      lastTime + 2,
    );

    expect(merged).toMatchObject({
      lastPrice: 201,
      highPrice: 202,
      lowPrice: 197,
      volume: 1_000,
      source: "alpaca-iex",
      feed: "iex",
      freshness: "real-time",
      exchange: "NMS",
      marketState: "regular",
    });
  });
});
