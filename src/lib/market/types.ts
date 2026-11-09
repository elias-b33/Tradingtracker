export const INTERVALS = [
  { id: "1m", label: "1m", key: "1" },
  { id: "5m", label: "5m", key: "2" },
  { id: "15m", label: "15m", key: "3" },
  { id: "1h", label: "1h", key: "4" },
  { id: "4h", label: "4h", key: "5" },
  { id: "1d", label: "D", key: "6" },
  { id: "1w", label: "W", key: "7" },
] as const;

export type IntervalId = (typeof INTERVALS)[number]["id"];

export const SPANS = [
  { id: "1D", label: "1D", title: "1 day" },
  { id: "1W", label: "5D", title: "5 days" },
  { id: "1M", label: "1M", title: "1 month" },
  { id: "3M", label: "3M", title: "3 months" },
  { id: "6M", label: "6M", title: "6 months" },
  { id: "YTD", label: "YTD", title: "Year to date" },
  { id: "1Y", label: "1Y", title: "1 year" },
  { id: "5Y", label: "5Y", title: "5 years" },
  { id: "ALL", label: "All", title: "All time" },
] as const;

export const SPAN_IDS = ["1D", "1W", "1M", "3M", "6M", "YTD", "1Y", "5Y", "ALL"] as const;

export type SpanId = (typeof SPANS)[number]["id"];

export type VenueId = "crypto" | "stocks";

export type ChartType = "candles" | "hollow" | "bars" | "line" | "area" | "baseline";

export type PriceScaleMode = "normal" | "log" | "percent";

/** Trading session a bar or quote belongs to. Undefined means regular hours. */
export type MarketSession = "pre" | "post";

export type DrawingTool = "cursor" | "hline" | "trend" | "fib";

export type MobileTab = "watch" | "chart" | "book" | "more";

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  /** Extended-hours bar (stocks only). */
  session?: MarketSession;
}

export type QuoteSource =
  | "binance"
  | "alpaca-iex"
  | "finnhub"
  | "yahoo"
  // Kept for cached quotes created by older app versions.
  | "iex"
  | "delayed";

export type QuoteFreshness =
  "real-time" | "recent" | "delayed" | "previous-close" | "market-closed" | "stale" | "unknown";

export interface Quote {
  symbol: string;
  lastPrice: number;
  priceChange: number;
  priceChangePercent: number;
  highPrice: number;
  lowPrice: number;
  volume: number;
  quoteVolume: number;
  openPrice: number;
  /** Data provider. Feed and timing are separate so global providers can be added safely. */
  source?: QuoteSource;
  /** Provider-specific feed, for example Alpaca's `iex` feed or Yahoo's exchange feed. */
  feed?: string;
  freshness?: QuoteFreshness;
  /** Provider-declared delay, in seconds. Zero means no declared delay. */
  delaySeconds?: number;
  /** Unix timestamp (seconds) when the server received this quote. */
  receivedAt?: number;
  marketState?: "regular" | "pre" | "post" | "closed";
  currency?: string;
  exchange?: string;
  shortName?: string;
  lastTime?: number;
  priceHint?: number;
  sessionStart?: number;
  sessionEnd?: number;
  /** Latest pre-market or after-hours print, relative to the regular close. */
  extSession?: MarketSession;
  extPrice?: number;
  extChange?: number;
  extChangePercent?: number;
  extTime?: number;
}

export interface DepthLevel {
  price: number;
  qty: number;
}

export interface DepthBook {
  lastUpdateId: number;
  bids: DepthLevel[];
  asks: DepthLevel[];
}

export interface TradePrint {
  id: number;
  price: number;
  qty: number;
  time: number;
  isBuyerMaker: boolean;
}

export interface SymbolInfo {
  symbol: string;
  base: string;
  quote: string;
  status: string;
}

export interface LinePoint {
  time: number;
  value: number;
}

export interface MacdPoint {
  time: number;
  macd: number;
  signal: number;
  hist: number;
}

export interface IndicatorsState {
  sma20: boolean;
  sma50: boolean;
  sma200: boolean;
  ema12: boolean;
  ema26: boolean;
  bb: boolean;
  vwap: boolean;
  volume: boolean;
  rsi: boolean;
  macd: boolean;
}

export const DEFAULT_INDICATORS: IndicatorsState = {
  sma20: true,
  sma50: true,
  sma200: false,
  ema12: false,
  ema26: false,
  bb: false,
  vwap: false,
  volume: true,
  rsi: false,
  macd: false,
};

export interface PriceAlert {
  id: string;
  symbol: string;
  kind: "level" | "pct";
  price: number;
  direction: "above" | "below";
  percent?: number;
  createdAt: number;
  triggeredAt?: number;
  firedPrice?: number;
}

export interface AlertLogEntry {
  id: string;
  alertId: string;
  symbol: string;
  text: string;
  price: number;
  at: number;
}

export interface Holding {
  symbol: string;
  qty: number;
  cost: number;
}

export interface CoinEvent {
  id: string;
  symbol: string;
  date: string;
  label: string;
}

export type StoredDrawing =
  | { id: string; kind: "hline"; price: number }
  | { id: string; kind: "trend"; t1: number; p1: number; t2: number; p2: number }
  | { id: string; kind: "fib"; t1: number; p1: number; t2: number; p2: number };
