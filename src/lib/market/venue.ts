import type { IntervalId, Quote, QuoteFreshness, QuoteSource, SpanId, VenueId } from "./types";

export type { VenueId };

export interface VenueSlice {
  symbol: string;
  watchlist: string[];
  span: SpanId | null;
  interval: IntervalId;
}

export const DEFAULT_STOCKS = [
  "SPY",
  "QQQ",
  "AAPL",
  "MSFT",
  "NVDA",
  "GOOGL",
  "AMZN",
  "META",
  "TSLA",
] as const;

export const STOCK_META: Record<string, { name: string }> = {
  SPY: { name: "S&P 500 ETF" },
  QQQ: { name: "Nasdaq 100 ETF" },
  AAPL: { name: "Apple" },
  MSFT: { name: "Microsoft" },
  NVDA: { name: "NVIDIA" },
  GOOGL: { name: "Alphabet" },
  AMZN: { name: "Amazon" },
  META: { name: "Meta" },
  TSLA: { name: "Tesla" },
  "ERIC-B.ST": { name: "Ericsson B" },
  "VOLCAR-B.ST": { name: "Volvo Car B" },
  "VOLV-B.ST": { name: "Volvo B" },
  "ATCO-A.ST": { name: "Atlas Copco A" },
  "^OMXS30": { name: "OMX Stockholm 30" },
};

export const DEFAULT_CRYPTO_SLICE: VenueSlice = {
  symbol: "BTCUSDT",
  watchlist: [
    "BTCUSDT",
    "ETHUSDT",
    "SOLUSDT",
    "BNBUSDT",
    "XRPUSDT",
    "DOGEUSDT",
    "ADAUSDT",
    "LINKUSDT",
  ],
  span: null,
  interval: "1h",
};

export const DEFAULT_STOCKS_SLICE: VenueSlice = {
  symbol: "AAPL",
  watchlist: [...DEFAULT_STOCKS],
  span: null,
  interval: "1d",
};

export function isCryptoSymbol(symbol: string): boolean {
  return /USDT$|USDC$|FDUSD$|BUSD$/.test(symbol);
}

export function isUsEquity(symbol: string): boolean {
  return /^[A-Z]{1,5}(-[A-Z])?$/.test(symbol);
}

export function sanitizeMarketSymbol(raw: string, venue: VenueId): string {
  if (venue === "crypto") return raw.replace(/[^A-Z0-9]/gi, "").toUpperCase();
  return raw
    .replace(/[^A-Za-z0-9.^-]/g, "")
    .toUpperCase()
    .slice(0, 24);
}

export const STOCK_FEATURED = [...DEFAULT_STOCKS, "ERIC-B.ST", "VOLCAR-B.ST", "^OMXS30"] as const;

export function chartTimeZone(symbol: string, venue: VenueId): string | undefined {
  if (venue !== "stocks") return undefined;
  if (symbol === "^OMXS30") return "Europe/Stockholm";
  if (/\.(ST|CO|HE)$/.test(symbol)) return "Europe/Stockholm";
  if (/\.OL$/.test(symbol)) return "Europe/Oslo";
  if (/\.L$/.test(symbol)) return "Europe/London";
  return "America/New_York";
}

export function sourceLabel(source?: QuoteSource, venue?: VenueId, feed?: string): string {
  if (source === "alpaca-iex") return feed ? `Alpaca · ${feed.toUpperCase()}` : "Alpaca · IEX";
  if (source === "finnhub") return "Finnhub";
  if (source === "yahoo" || source === "delayed") return "Yahoo";
  if (source === "iex") return "IEX";
  if (venue === "stocks") return "Market data";
  return "BINANCE";
}

type FreshnessInput = Pick<Quote, "source" | "marketState" | "lastTime" | "delaySeconds">;

export function quoteAgeSeconds(
  lastTime: number | undefined,
  nowSeconds = Date.now() / 1000,
): number | null {
  if (!lastTime || !Number.isFinite(lastTime)) return null;
  return Math.max(0, Math.floor(nowSeconds - lastTime));
}

/** Derive timing without assuming that every non-US exchange has the same delay. */
export function deriveQuoteFreshness(
  quote: FreshnessInput,
  nowSeconds = Date.now() / 1000,
): QuoteFreshness {
  const age = quoteAgeSeconds(quote.lastTime, nowSeconds);
  if (quote.marketState === "closed") return "market-closed";
  if (
    (quote.marketState === "pre" || quote.marketState === "post") &&
    (age === null || age > 20 * 60)
  ) {
    return "previous-close";
  }
  if ((quote.delaySeconds ?? 0) > 0) return "delayed";
  if (age === null) return "unknown";
  if (quote.source === "alpaca-iex" || quote.source === "iex") {
    return age <= 90 ? "real-time" : age > 10 * 60 ? "stale" : "unknown";
  }
  if (age <= 90) return "recent";
  if (age > 30 * 60) return "stale";
  return "unknown";
}

function ageLabel(ageSeconds: number | null): string {
  if (ageSeconds === null) return "Update time unavailable";
  if (ageSeconds < 5) return "Updated just now";
  if (ageSeconds < 60) return `Updated ${ageSeconds}s ago`;
  const minutes = Math.floor(ageSeconds / 60);
  if (minutes < 60) return `Updated ${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Updated ${hours}h ago`;
  return `Updated ${Math.floor(hours / 24)}d ago`;
}

export type QuoteFeedStatus = {
  freshness: QuoteFreshness;
  label: string;
  updatedLabel: string;
  explanation: string;
};

/** Beginner-facing status copy generated from provider-neutral quote metadata. */
export function quoteFeedStatus(
  quote: FreshnessInput & Pick<Quote, "feed">,
  nowSeconds = Date.now() / 1000,
): QuoteFeedStatus {
  const freshness = deriveQuoteFreshness(quote, nowSeconds);
  const age = quoteAgeSeconds(quote.lastTime, nowSeconds);
  const provider = sourceLabel(quote.source, "stocks", quote.feed);
  const delayMinutes = Math.max(0, Math.round((quote.delaySeconds ?? 0) / 60));
  const label: Record<QuoteFreshness, string> = {
    "real-time": quote.source === "alpaca-iex" ? "Live U.S. quote" : "Live quote",
    recent: "Recent exchange quote",
    delayed: delayMinutes ? `${delayMinutes}-minute delayed quote` : "Delayed quote",
    "previous-close": "Previous regular-session price",
    "market-closed": "Market closed",
    stale: "Stale quote",
    unknown: age === null ? "Quote timing unavailable" : "Provider quote",
  };

  let explanation = `${provider} market data.`;
  if (quote.source === "alpaca-iex") {
    explanation =
      "Alpaca IEX shows trades from one U.S. exchange, so it can differ slightly from the full market.";
  } else if (quote.source === "finnhub") {
    explanation = "Finnhub quote timing depends on the configured market-data plan.";
  } else if (quote.source === "yahoo" || quote.source === "delayed") {
    explanation = delayMinutes
      ? `Yahoo exchange data reports a ${delayMinutes}-minute delay for this listing.`
      : "Yahoo exchange data; timing is based on the provider's quote timestamp.";
  }

  return {
    freshness,
    label: label[freshness],
    updatedLabel: ageLabel(age),
    explanation,
  };
}

export function exchangeLabel(code?: string): string {
  if (!code) return "";
  const key = code.toUpperCase();
  const map: Record<string, string> = {
    NMS: "NASDAQ",
    NGM: "NASDAQ",
    NAS: "NASDAQ",
    NASDAQ: "NASDAQ",
    NYQ: "NYSE",
    NYE: "NYSE",
    NYSE: "NYSE",
    PCX: "NYSE Arca",
    ARCA: "NYSE Arca",
    BATS: "Cboe BZX",
    BZX: "Cboe BZX",
    NCM: "NASDAQ",
    ASE: "NYSE Amex",
    AMX: "NYSE Amex",
    OTC: "OTC",
    PNK: "OTC",
    STO: "OMX STO",
    NIM: "OMX STO",
    CPH: "OMX CPH",
    HEL: "OMX HEL",
    OSL: "Oslo",
    LSE: "LSE",
    LON: "LSE",
    FRA: "Frankfurt",
    GER: "Xetra",
  };
  return map[key] ?? code;
}

export function sessionLabel(state?: QuoteState): string {
  if (state === "regular") return "Open";
  if (state === "pre") return "Pre-market";
  if (state === "post") return "After hours";
  if (state === "closed") return "Closed";
  return "";
}

type QuoteState = "regular" | "pre" | "post" | "closed";
