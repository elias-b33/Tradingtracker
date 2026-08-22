import type { SymbolInfo } from "@/lib/market/types";

export type StockAssetKind = "stock" | "etf" | "index";
export type StockRegion = "usa" | "sweden" | "global";
export type StockKindFilter = "all" | StockAssetKind;
export type StockRegionFilter = "all" | "usa" | "sweden";

export interface StockDiscoveryItem {
  symbol: string;
  name: string;
  exchange: string;
  currency: string;
  kind: StockAssetKind;
  region: StockRegion;
  market: string;
  status: string;
}

export interface DiscoverySection {
  id: string;
  title: string;
  description: string;
  items: StockDiscoveryItem[];
}

const ETF_SYMBOLS = new Set(["SPY", "QQQ", "IWM", "DIA", "VOO", "VTI", "EEM", "GLD"]);
const INDEX_SYMBOLS = new Set(["^GSPC", "^IXIC", "^DJI", "^OMXS30"]);

const CURATED: Record<string, Omit<StockDiscoveryItem, "symbol" | "status">> = {
  AAPL: stock("Apple", "NASDAQ", "USD", "usa", "United States"),
  MSFT: stock("Microsoft", "NASDAQ", "USD", "usa", "United States"),
  NVDA: stock("NVIDIA", "NASDAQ", "USD", "usa", "United States"),
  GOOGL: stock("Alphabet", "NASDAQ", "USD", "usa", "United States"),
  AMZN: stock("Amazon", "NASDAQ", "USD", "usa", "United States"),
  META: stock("Meta Platforms", "NASDAQ", "USD", "usa", "United States"),
  TSLA: stock("Tesla", "NASDAQ", "USD", "usa", "United States"),
  SPY: fund("SPDR S&P 500 ETF Trust", "NYSE Arca", "USD", "usa", "United States"),
  QQQ: fund("Invesco QQQ Trust", "NASDAQ", "USD", "usa", "United States"),
  IWM: fund("iShares Russell 2000 ETF", "NYSE Arca", "USD", "usa", "United States"),
  "^GSPC": index("S&P 500 Index", "S&P Dow Jones", "USD", "usa", "United States"),
  "^IXIC": index("Nasdaq Composite", "NASDAQ", "USD", "usa", "United States"),
  "^DJI": index("Dow Jones Industrial Average", "S&P Dow Jones", "USD", "usa", "United States"),
  "ERIC-B.ST": stock("Ericsson B", "Nasdaq Stockholm", "SEK", "sweden", "Sweden"),
  "VOLCAR-B.ST": stock("Volvo Car B", "Nasdaq Stockholm", "SEK", "sweden", "Sweden"),
  "VOLV-B.ST": stock("Volvo B", "Nasdaq Stockholm", "SEK", "sweden", "Sweden"),
  "ATCO-A.ST": stock("Atlas Copco A", "Nasdaq Stockholm", "SEK", "sweden", "Sweden"),
  "^OMXS30": index("OMX Stockholm 30", "Nasdaq Stockholm", "SEK", "sweden", "Sweden"),
};

function stock(
  name: string,
  exchange: string,
  currency: string,
  region: StockRegion,
  market: string,
) {
  return { name, exchange, currency, kind: "stock" as const, region, market };
}

function fund(
  name: string,
  exchange: string,
  currency: string,
  region: StockRegion,
  market: string,
) {
  return { name, exchange, currency, kind: "etf" as const, region, market };
}

function index(
  name: string,
  exchange: string,
  currency: string,
  region: StockRegion,
  market: string,
) {
  return { name, exchange, currency, kind: "index" as const, region, market };
}

function inferredKind(symbol: string, name: string): StockAssetKind {
  if (INDEX_SYMBOLS.has(symbol) || symbol.startsWith("^") || /\b(index|composite)\b/i.test(name)) {
    return "index";
  }
  if (ETF_SYMBOLS.has(symbol) || /\b(etf|fund|trust)\b/i.test(name)) return "etf";
  return "stock";
}

function inferredRegion(symbol: string, exchange: string): StockRegion {
  if (
    symbol.endsWith(".ST") ||
    symbol === "^OMXS30" ||
    /stockholm|sweden|omx sto/i.test(exchange)
  ) {
    return "sweden";
  }
  if (
    !symbol.includes(".") ||
    /nasdaq|nyse|cboe|arca|amex|united states|s&p dow jones/i.test(exchange)
  ) {
    return "usa";
  }
  return "global";
}

function inferredCurrency(symbol: string, region: StockRegion): string {
  if (region === "sweden") return "SEK";
  if (region === "usa") return "USD";
  if (symbol.endsWith(".CO")) return "DKK";
  if (symbol.endsWith(".OL")) return "NOK";
  if (symbol.endsWith(".L")) return "GBp";
  if (symbol.endsWith(".HE") || symbol.endsWith(".PA") || symbol.endsWith(".DE")) return "EUR";
  return "—";
}

function inferredMarket(region: StockRegion, exchange: string): string {
  if (region === "sweden") return "Sweden";
  if (region === "usa") return "United States";
  return exchange || "Global market";
}

function fallbackExchange(symbol: string, region: StockRegion): string {
  if (region === "sweden") return "Nasdaq Stockholm";
  if (symbol.endsWith(".L")) return "London Stock Exchange";
  if (symbol.endsWith(".CO")) return "Nasdaq Copenhagen";
  if (symbol.endsWith(".HE")) return "Nasdaq Helsinki";
  if (symbol.endsWith(".OL")) return "Oslo Børs";
  return region === "usa" ? "US market" : "Global exchange";
}

export function stockDiscoveryItem(item: SymbolInfo): StockDiscoveryItem {
  const symbol = item.symbol.toUpperCase();
  const curated = CURATED[symbol];
  if (curated) return { symbol, status: item.status, ...curated };

  const exchange = item.quote.trim();
  const region = inferredRegion(symbol, exchange);
  return {
    symbol,
    name: item.base || symbol,
    exchange: exchange || fallbackExchange(symbol, region),
    currency: inferredCurrency(symbol, region),
    kind: inferredKind(symbol, item.base),
    region,
    market: inferredMarket(region, exchange),
    status: item.status,
  };
}

export function filterStockItems(
  items: StockDiscoveryItem[],
  kind: StockKindFilter,
  region: StockRegionFilter,
): StockDiscoveryItem[] {
  return items.filter(
    (item) => (kind === "all" || item.kind === kind) && (region === "all" || item.region === region),
  );
}

export function matchesStockQuery(item: StockDiscoveryItem, query: string): boolean {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return true;
  return [item.symbol, item.name, item.exchange, item.market, item.currency, item.kind]
    .join(" ")
    .toLocaleLowerCase()
    .includes(needle);
}

export function dedupeStockItems(items: StockDiscoveryItem[]): StockDiscoveryItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.symbol)) return false;
    seen.add(item.symbol);
    return true;
  });
}

export const STOCK_DISCOVERY_SECTIONS: DiscoverySection[] = [
  section("popular", "Popular US stocks", "Large companies many investors start with", [
    "AAPL",
    "MSFT",
    "NVDA",
    "GOOGL",
    "AMZN",
    "META",
    "TSLA",
  ]),
  section("funds", "Broad-market ETFs", "Diversified funds traded like a stock", ["SPY", "QQQ", "IWM"]),
  section("sweden", "Sweden", "Companies and the leading Stockholm index", [
    "ERIC-B.ST",
    "VOLCAR-B.ST",
    "VOLV-B.ST",
    "ATCO-A.ST",
    "^OMXS30",
  ]),
  section("indices", "Major indices", "Benchmarks that summarize a market", ["^GSPC", "^IXIC", "^DJI"]),
];

function section(id: string, title: string, description: string, symbols: string[]): DiscoverySection {
  return {
    id,
    title,
    description,
    items: symbols.map((symbol) => ({ symbol, status: "TRADING", ...CURATED[symbol] })),
  };
}

export function parseRecentStocks(value: string | null): StockDiscoveryItem[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return dedupeStockItems(
      parsed.filter(isStockDiscoveryItem).map((item) => ({ ...item, symbol: item.symbol.toUpperCase() })),
    ).slice(0, 8);
  } catch {
    return [];
  }
}

function isStockDiscoveryItem(value: unknown): value is StockDiscoveryItem {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<StockDiscoveryItem>;
  return (
    typeof item.symbol === "string" &&
    typeof item.name === "string" &&
    typeof item.exchange === "string" &&
    typeof item.currency === "string" &&
    (item.kind === "stock" || item.kind === "etf" || item.kind === "index") &&
    (item.region === "usa" || item.region === "sweden" || item.region === "global") &&
    typeof item.market === "string" &&
    typeof item.status === "string"
  );
}

export function kindLabel(kind: StockAssetKind): string {
  if (kind === "etf") return "ETF";
  if (kind === "index") return "Index";
  return "Stock";
}
