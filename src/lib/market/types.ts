export const INTERVALS = [
  { id: "1m", label: "1m", key: "1" },
  { id: "5m", label: "5m", key: "2" },
  { id: "15m", label: "15m", key: "3" },
  { id: "1h", label: "1H", key: "4" },
  { id: "4h", label: "4H", key: "5" },
  { id: "1d", label: "1D", key: "6" },
  { id: "1w", label: "1W", key: "7" },
] as const;

export type IntervalId = (typeof INTERVALS)[number]["id"];

export const SPANS = [
  { id: "1D", label: "Day", title: "Today" },
  { id: "1W", label: "Week", title: "1 week" },
  { id: "1M", label: "Month", title: "1 month" },
  { id: "6M", label: "6M", title: "6 months" },
  { id: "YTD", label: "YTD", title: "This year" },
  { id: "1Y", label: "1Y", title: "1 year" },
  { id: "5Y", label: "5Y", title: "5 years" },
  { id: "ALL", label: "ALL", title: "All time" },
] as const;

export type SpanId = (typeof SPANS)[number]["id"];

export type VenueId = "crypto" | "stocks";

export type ChartType = "candles" | "line" | "area";

export type DrawingTool = "cursor" | "hline" | "trend" | "fib";

export type MobileTab = "watch" | "chart" | "book" | "more";

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

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
  source?: "binance" | "iex" | "delayed";
  marketState?: "regular" | "pre" | "post" | "closed";
  currency?: string;
  exchange?: string;
  shortName?: string;
  lastTime?: number;
  priceHint?: number;
  sessionStart?: number;
  sessionEnd?: number;
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
