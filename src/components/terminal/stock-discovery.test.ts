import { describe, expect, it } from "vitest";
import {
  STOCK_DISCOVERY_SECTIONS,
  filterStockItems,
  matchesStockQuery,
  parseRecentStocks,
  stockDiscoveryItem,
} from "./stock-discovery";

describe("stock discovery metadata", () => {
  it("explains familiar US, Swedish, ETF, and index symbols", () => {
    expect(stockDiscoveryItem({ symbol: "AAPL", base: "Apple Inc.", quote: "NasdaqGS", status: "TRADING" }))
      .toMatchObject({ kind: "stock", region: "usa", market: "United States", currency: "USD" });
    expect(stockDiscoveryItem({ symbol: "SPY", base: "SPDR S&P 500 ETF", quote: "NYSE Arca", status: "TRADING" }))
      .toMatchObject({ kind: "etf", region: "usa", currency: "USD" });
    expect(stockDiscoveryItem({ symbol: "VOLV-B.ST", base: "Volvo B", quote: "Stockholm", status: "TRADING" }))
      .toMatchObject({ kind: "stock", region: "sweden", market: "Sweden", currency: "SEK" });
    expect(stockDiscoveryItem({ symbol: "^OMXS30", base: "OMX Stockholm 30", quote: "Nasdaq Stockholm", status: "TRADING" }))
      .toMatchObject({ kind: "index", region: "sweden", currency: "SEK" });
  });

  it("keeps international results available through All markets", () => {
    const global = stockDiscoveryItem({
      symbol: "SHEL.L",
      base: "Shell plc",
      quote: "London",
      status: "TRADING",
    });

    expect(global).toMatchObject({ region: "global", market: "London", currency: "GBp" });
    expect(filterStockItems([global], "all", "all")).toEqual([global]);
    expect(filterStockItems([global], "all", "usa")).toEqual([]);
  });

  it("searches company names and exchange metadata, not only tickers", () => {
    const ericsson = STOCK_DISCOVERY_SECTIONS.flatMap((section) => section.items).find(
      (item) => item.symbol === "ERIC-B.ST",
    )!;
    expect(matchesStockQuery(ericsson, "Ericsson")).toBe(true);
    expect(matchesStockQuery(ericsson, "Stockholm")).toBe(true);
    expect(matchesStockQuery(ericsson, "Canada")).toBe(false);
  });

  it("loads only valid, unique recent selections", () => {
    const apple = stockDiscoveryItem({ symbol: "AAPL", base: "Apple", quote: "NASDAQ", status: "TRADING" });
    expect(parseRecentStocks("not json")).toEqual([]);
    expect(parseRecentStocks(JSON.stringify([apple, apple, { symbol: "BROKEN" }]))).toEqual([apple]);
  });
});
