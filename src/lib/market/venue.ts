import type { IntervalId, SpanId, VenueId } from "./types";

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
  OMXS30: { name: "OMX Stockholm 30" },
};

export const STOCK_LOGO: Record<string, string> = {
  AAPL: "apple",
  MSFT: "microsoft",
  NVDA: "nvidia",
  GOOGL: "alphabet",
  AMZN: "amazon",
  META: "meta-platforms",
  TSLA: "tesla",
  SPY: "spdr-s-p-500-etf-trust",
  QQQ: "invesco",
};

export const DEFAULT_CRYPTO_SLICE: VenueSlice = {
  symbol: "BTCUSDT",
  watchlist: ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT", "DOGEUSDT", "ADAUSDT", "LINKUSDT"],
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
  return raw.replace(/[^A-Za-z0-9.^-]/g, "").toUpperCase().slice(0, 24);
}

export const STOCK_FEATURED = [...DEFAULT_STOCKS, "ERIC-B.ST", "VOLCAR-B.ST", "OMXS30"] as const;

export function chartTimeZone(symbol: string, venue: VenueId): string | undefined {
  if (venue !== "stocks") return undefined;
  if (/\.(ST|CO|HE)$/.test(symbol)) return "Europe/Stockholm";
  if (/\.OL$/.test(symbol)) return "Europe/Oslo";
  if (/\.L$/.test(symbol)) return "Europe/London";
  return "America/New_York";
}

export function sourceLabel(source?: "binance" | "iex" | "delayed", venue?: VenueId): string {
  if (source === "iex") return "IEX";
  if (source === "delayed") return "delayed";
  if (venue === "stocks") return "delayed";
  return "BINANCE";
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

