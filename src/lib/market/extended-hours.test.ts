import { describe, expect, it } from "vitest";
import { ema, macd } from "./indicators";
import { extendedQuoteFields, mergeStockQuotes, rangeForSpan, tagExtendedSessions } from "./stocks";
import type { Candle, Quote } from "./types";

const day = Date.UTC(2026, 10, 6) / 1000;
const period = {
  pre: { start: day + 9 * 3600, end: day + 14.5 * 3600 },
  regular: { start: day + 14.5 * 3600, end: day + 21 * 3600 },
  post: { start: day + 21 * 3600, end: day + 25 * 3600 },
};

function bar(time: number, close: number): Candle {
  return { time, open: close, high: close, low: close, close, volume: 1 };
}

describe("extended hours", () => {
  it("reports the latest after-hours print relative to the regular close", () => {
    const ts = [period.regular.end - 300, period.post.start + 600, period.post.start + 900];
    const fields = extendedQuoteFields(
      { regularMarketPrice: 100, currentTradingPeriod: period },
      ts,
      [100, 101, null],
    );
    expect(fields).toMatchObject({ extSession: "post", extPrice: 101, extChange: 1, extTime: ts[1] });
    expect(fields.extChangePercent).toBeCloseTo(1);
  });

  it("reports pre-market prints and ignores regular-session bars", () => {
    const pre = extendedQuoteFields(
      { regularMarketPrice: 50, currentTradingPeriod: period },
      [period.pre.start + 60],
      [49],
    );
    expect(pre).toMatchObject({ extSession: "pre", extPrice: 49 });
    const regular = extendedQuoteFields(
      { regularMarketPrice: 50, currentTradingPeriod: period },
      [period.regular.start + 60],
      [51],
    );
    expect(regular).toEqual({});
  });

  it("tags candles by trading window", () => {
    const tagged = tagExtendedSessions(
      [bar(period.pre.start, 1), bar(period.regular.start, 2), bar(period.post.start, 3)],
      { pre: [period.pre], regular: [period.regular], post: [period.post] },
    );
    expect(tagged.map((c) => c.session)).toEqual(["pre", undefined, "post"]);
  });

  it("tags bars when Yahoo's pre/post windows lag a day behind the regular ones", () => {
    const prevDay = { start: period.pre.start - 86_400, end: period.pre.end - 86_400 };
    const prevPost = { start: period.post.start - 86_400, end: period.post.end - 86_400 };
    const tagged = tagExtendedSessions(
      [
        bar(period.pre.start + 3600, 1),
        bar(period.regular.start + 60, 2),
        bar(period.post.end - 17, 3),
      ],
      { pre: [prevDay], regular: [period.regular], post: [prevPost] },
    );
    expect(tagged.map((c) => c.session)).toEqual(["pre", undefined, "post"]);
  });

  it("keeps the regular close as headline price outside regular hours", () => {
    const fallback: Quote = {
      symbol: "AAPL",
      lastPrice: 100,
      openPrice: 99,
      priceChange: 1,
      priceChangePercent: 1.01,
      highPrice: 101,
      lowPrice: 98,
      volume: 10,
      quoteVolume: 0,
      source: "yahoo",
      marketState: "post",
    };
    const preferred: Quote = { ...fallback, lastPrice: 102, source: "alpaca-iex", lastTime: day + 22 * 3600 };
    const merged = mergeStockQuotes(fallback, preferred, day + 22 * 3600);
    expect(merged).toMatchObject({ lastPrice: 100, extSession: "post", extPrice: 102, extChange: 2 });
  });
});

describe("stock ranges", () => {
  it("honours the chosen candle size inside a range when Yahoo allows it", () => {
    expect(rangeForSpan("1D", "1m")).toEqual({ interval: "1m", range: "1d" });
    expect(rangeForSpan("1M", "1h")).toEqual({ interval: "60m", range: "1mo" });
  });

  it("steps to a coarser candle when the range is too long", () => {
    expect(rangeForSpan("1Y", "5m")).toEqual({ interval: "60m", range: "1y" });
    expect(rangeForSpan("ALL", "1h")).toEqual({ interval: "1d", range: "max" });
  });
});

describe("Pine-compatible moving averages", () => {
  it("seeds the EMA with the SMA of the first period", () => {
    const candles = [1, 2, 3, 4, 5].map((v, i) => bar(i, v));
    const out = ema(candles, 3);
    expect(out[0]).toEqual({ time: 2, value: 2 });
    expect(out[1].value).toBeCloseTo(3);
    expect(out[2].value).toBeCloseTo(4);
  });

  it("returns MACD only once the signal line has seeded", () => {
    const candles = Array.from({ length: 60 }, (_, i) => bar(i, 100 + Math.sin(i / 3) * 5));
    const out = macd(candles);
    expect(out).toHaveLength(60 - 26 + 1 - 9 + 1);
    expect(out[0].time).toBe(25 + 8);
  });
});
