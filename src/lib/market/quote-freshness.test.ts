import { describe, expect, it } from "vitest";
import {
  STOCK_FEATURED,
  STOCK_META,
  chartTimeZone,
  deriveQuoteFreshness,
  quoteFeedStatus,
  sourceLabel,
} from "./venue";

describe("stock quote freshness", () => {
  const now = 2_000_000;

  it("uses a provider-declared exchange delay instead of guessing", () => {
    const quote = {
      source: "yahoo" as const,
      marketState: "regular" as const,
      lastTime: now - 30,
      delaySeconds: 15 * 60,
      feed: "exchange",
    };

    expect(deriveQuoteFreshness(quote, now)).toBe("delayed");
    expect(quoteFeedStatus(quote, now)).toMatchObject({
      label: "15-minute delayed quote",
      updatedLabel: "Updated 30s ago",
    });
  });

  it("calls a timestamp-current Yahoo quote recent without claiming real-time", () => {
    const quote = {
      source: "yahoo" as const,
      marketState: "regular" as const,
      lastTime: now - 12,
      delaySeconds: 0,
      feed: "exchange",
    };

    expect(deriveQuoteFreshness(quote, now)).toBe("recent");
    expect(quoteFeedStatus(quote, now).label).toBe("Recent exchange quote");
  });

  it("identifies a current Alpaca IEX print as live but makes feed coverage clear", () => {
    const quote = {
      source: "alpaca-iex" as const,
      marketState: "regular" as const,
      lastTime: now - 2,
      delaySeconds: 0,
      feed: "iex",
    };
    const status = quoteFeedStatus(quote, now);

    expect(status.freshness).toBe("real-time");
    expect(status.label).toBe("Live U.S. quote");
    expect(status.explanation).toContain("one U.S. exchange");
    expect(sourceLabel(quote.source, "stocks", quote.feed)).toBe("Alpaca · IEX");
  });

  it("treats an old regular-session print as stale but not an expected closed-market print", () => {
    expect(
      deriveQuoteFreshness(
        { source: "finnhub", marketState: "regular", lastTime: now - 31 * 60 },
        now,
      ),
    ).toBe("stale");
    expect(
      deriveQuoteFreshness(
        { source: "yahoo", marketState: "closed", lastTime: now - 12 * 60 * 60 },
        now,
      ),
    ).toBe("market-closed");
  });
});

describe("global stock metadata", () => {
  it("uses Yahoo's verified OMX Stockholm 30 symbol and local timezone", () => {
    expect(STOCK_FEATURED).toContain("^OMXS30");
    expect(STOCK_META["^OMXS30"]?.name).toBe("OMX Stockholm 30");
    expect(chartTimeZone("^OMXS30", "stocks")).toBe("Europe/Stockholm");
  });
});
