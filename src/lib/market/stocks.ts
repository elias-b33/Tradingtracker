import { createServerFn } from "@tanstack/react-start";
import { spanStartMs } from "./spans";
import { deriveQuoteFreshness, STOCK_META, isUsEquity, sanitizeMarketSymbol } from "./venue";
import type { Candle, IntervalId, Quote, SpanId, SymbolInfo } from "./types";
import type { SpanMove } from "./binance";
import { TtlLruCache } from "./runtime-guards";

const cache = new TtlLruCache<Promise<unknown>>({ maxEntries: 192 });

export type StockProfile = {
  symbol: string;
  name?: string;
  logoUrl?: string;
};

function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit) return hit as Promise<T>;
  const pending = fn();
  cache.set(key, pending, ttlMs);
  void pending.catch(() => cache.delete(key));
  return pending;
}

async function guardPublicRequest(scope: string, limit: number): Promise<void> {
  const { enforcePublicRateLimit } = await import("../server/public-rate-limit.server");
  enforcePublicRateLimit(`stocks:${scope}`, limit);
}

function finnhubLogoUrl(value: unknown): string | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && ["static.finnhub.io", "static2.finnhub.io"].includes(url.hostname)
      ? url.toString()
      : undefined;
  } catch {
    return undefined;
  }
}

async function fetchFinnhubProfile(symbol: string, key: string): Promise<StockProfile | null> {
  const response = await fetch(
    `https://finnhub.io/api/v1/stock/profile2?symbol=${encodeURIComponent(symbol)}`,
    {
      headers: { "X-Finnhub-Token": key },
      signal: AbortSignal.timeout(8000),
    },
  );
  if (!response.ok) throw new Error(`Finnhub profile returned ${response.status}`);
  const row = (await response.json()) as { ticker?: string; name?: string; logo?: string };
  if (!row.ticker && !row.name && !row.logo) return null;
  return {
    symbol,
    name: row.name?.trim() || undefined,
    logoUrl: finnhubLogoUrl(row.logo),
  };
}

/** Optional, cached company branding. Provider credentials remain server-only. */
export const getStockProfiles = createServerFn({ method: "GET" })
  .validator((input: { symbols?: string[] }) => ({
    symbols: [...new Set((input.symbols ?? []).map((symbol) => sanitizeMarketSymbol(symbol, "stocks")).filter(Boolean))]
      .slice(0, 8),
  }))
  .handler(async ({ data }): Promise<{ ok: true; profiles: StockProfile[] } | { ok: false; error: string }> => {
    try {
      await guardPublicRequest("profiles", 30);
      const key = process.env.FINNHUB_API_KEY?.trim();
      if (!key || data.symbols.length === 0) return { ok: true, profiles: [] };
      const settled = await Promise.allSettled(
        data.symbols.map((symbol) =>
          cached(`fh-profile:${symbol}`, 12 * 60 * 60 * 1000, () => fetchFinnhubProfile(symbol, key)),
        ),
      );
      return {
        ok: true,
        profiles: settled.flatMap((result) =>
          result.status === "fulfilled" && result.value ? [result.value as StockProfile] : [],
        ),
      };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : "Stock profiles unavailable" };
    }
  });

async function yahoo(path: string): Promise<unknown> {
  const url = path.startsWith("http") ? path : `https://query1.finance.yahoo.com${path}`;
  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "Mozilla/5.0 (compatible; AetherDesk/1.0)",
    },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Yahoo returned ${res.status}`);
  return res.json();
}

type SparkMeta = {
  symbol?: string;
  regularMarketPrice?: number;
  chartPreviousClose?: number;
  regularMarketDayHigh?: number;
  regularMarketDayLow?: number;
  regularMarketVolume?: number;
  regularMarketTime?: number;
  shortName?: string;
  longName?: string;
  currency?: string;
  exchangeName?: string;
  priceHint?: number;
  /** Yahoo reports this value in minutes for the listing's exchange feed. */
  exchangeDataDelayedBy?: number;
  currentTradingPeriod?: {
    pre?: { start: number; end: number };
    regular?: { start: number; end: number };
    post?: { start: number; end: number };
  };
};

function marketState(meta: SparkMeta, now = Date.now() / 1000): Quote["marketState"] {
  const p = meta.currentTradingPeriod;
  if (!p?.regular) return "closed";
  if (now >= p.regular.start && now < p.regular.end) return "regular";
  if (p.pre && now >= p.pre.start && now < p.pre.end) return "pre";
  if (p.post && now >= p.post.start && now < p.post.end) return "post";
  return "closed";
}

function quoteFromMeta(symbol: string, meta: SparkMeta, source: Quote["source"]): Quote | null {
  const last = Number(meta.regularMarketPrice);
  const prev = Number(meta.chartPreviousClose);
  if (!Number.isFinite(last) || last <= 0) return null;
  const open = Number.isFinite(prev) && prev > 0 ? prev : last;
  const receivedAt = Math.floor(Date.now() / 1000);
  const delayMinutes = Number(meta.exchangeDataDelayedBy);
  const quote: Quote = {
    symbol,
    lastPrice: last,
    openPrice: open,
    priceChange: last - open,
    priceChangePercent: open ? ((last - open) / open) * 100 : 0,
    highPrice: Number(meta.regularMarketDayHigh) || last,
    lowPrice: Number(meta.regularMarketDayLow) || last,
    volume: Number(meta.regularMarketVolume) || 0,
    quoteVolume: 0,
    source,
    feed: "exchange",
    delaySeconds: Number.isFinite(delayMinutes) ? Math.max(0, delayMinutes * 60) : undefined,
    receivedAt,
    marketState: marketState(meta),
    currency: meta.currency,
    exchange: meta.exchangeName,
    shortName: meta.shortName || meta.longName,
    lastTime: Number(meta.regularMarketTime) || undefined,
    priceHint: Number(meta.priceHint) || undefined,
    sessionStart: meta.currentTradingPeriod?.regular?.start,
    sessionEnd: meta.currentTradingPeriod?.regular?.end,
  };
  quote.freshness = deriveQuoteFreshness(quote, receivedAt);
  return quote;
}

type UsQuoteCfg = { kind: "finnhub"; key: string } | { kind: "alpaca"; id: string; secret: string };

function usQuoteConfig(): UsQuoteCfg | null {
  // Alpaca supplies all requested U.S. IEX snapshots in one call. Prefer that
  // batch contract over Finnhub's one-request-per-symbol fallback.
  const id = process.env.ALPACA_API_KEY_ID?.trim();
  const secret = process.env.ALPACA_API_SECRET_KEY?.trim();
  if (id && secret) return { kind: "alpaca", id, secret };
  const fh = process.env.FINNHUB_API_KEY?.trim();
  if (fh) return { kind: "finnhub", key: fh };
  return null;
}

export function quoteTimestampSeconds(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.floor(value > 10_000_000_000 ? value / 1000 : value);
  }
  if (typeof value !== "string" || !value.trim()) return undefined;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? Math.floor(parsed / 1000) : undefined;
}

async function usProviderQuotes(symbols: string[]): Promise<Record<string, Quote>> {
  const cfg = usQuoteConfig();
  const us = symbols.filter(isUsEquity);
  if (!cfg || !us.length) return {};
  const ttlMs = cfg.kind === "alpaca" ? 4000 : 30_000;
  return cached(`us-quotes:${cfg.kind}:${us.join(",")}`, ttlMs, async () => {
    const out: Record<string, Quote> = {};
    const receivedAt = Math.floor(Date.now() / 1000);
    try {
      if (cfg.kind === "finnhub") {
        await Promise.all(
          us.map(async (symbol) => {
            const res = await fetch(
              `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${cfg.key}`,
              { signal: AbortSignal.timeout(8000) },
            );
            if (!res.ok) return;
            const row = (await res.json()) as {
              c?: number;
              d?: number;
              dp?: number;
              h?: number;
              l?: number;
              o?: number;
              pc?: number;
              t?: number;
            };
            const last = Number(row.c);
            const prev = Number(row.pc);
            if (!Number.isFinite(last) || last <= 0) return;
            const open = Number.isFinite(prev) && prev > 0 ? prev : last;
            const quote: Quote = {
              symbol,
              lastPrice: last,
              openPrice: open,
              priceChange: Number(row.d) || last - open,
              priceChangePercent: Number(row.dp) || (open ? ((last - open) / open) * 100 : 0),
              highPrice: Number(row.h) || last,
              lowPrice: Number(row.l) || last,
              volume: 0,
              quoteVolume: 0,
              source: "finnhub",
              feed: "quote",
              lastTime: quoteTimestampSeconds(row.t),
              receivedAt,
              currency: "USD",
            };
            quote.freshness = deriveQuoteFreshness(quote, receivedAt);
            out[symbol] = quote;
          }),
        );
      } else {
        const res = await fetch(
          `https://data.alpaca.markets/v2/stocks/snapshots?symbols=${encodeURIComponent(us.join(","))}&feed=iex`,
          {
            headers: {
              "APCA-API-KEY-ID": cfg.id,
              "APCA-API-SECRET-KEY": cfg.secret,
            },
            signal: AbortSignal.timeout(8000),
          },
        );
        if (!res.ok) return {};
        const raw = (await res.json()) as Record<
          string,
          {
            latestTrade?: { p?: number; t?: string };
            dailyBar?: { o?: number; h?: number; l?: number; v?: number; c?: number; t?: string };
            prevDailyBar?: { c?: number };
          }
        >;
        for (const symbol of us) {
          const row = raw[symbol];
          const last = Number(row?.latestTrade?.p ?? row?.dailyBar?.c);
          const prev = Number(row?.prevDailyBar?.c);
          if (!Number.isFinite(last) || last <= 0) continue;
          const open = Number.isFinite(prev) && prev > 0 ? prev : last;
          const quote: Quote = {
            symbol,
            lastPrice: last,
            openPrice: open,
            priceChange: last - open,
            priceChangePercent: open ? ((last - open) / open) * 100 : 0,
            highPrice: Number(row?.dailyBar?.h) || last,
            lowPrice: Number(row?.dailyBar?.l) || last,
            volume: Number(row?.dailyBar?.v) || 0,
            quoteVolume: 0,
            source: "alpaca-iex",
            feed: "iex",
            delaySeconds: 0,
            lastTime: quoteTimestampSeconds(row?.latestTrade?.t ?? row?.dailyBar?.t),
            receivedAt,
            currency: "USD",
          };
          quote.freshness = deriveQuoteFreshness(quote, receivedAt);
          out[symbol] = quote;
        }
      }
    } catch {
      return {};
    }
    return out;
  });
}

async function sparkQuotes(symbols: string[]): Promise<Quote[]> {
  if (!symbols.length) return [];
  return cached(`yf-spark:${symbols.join(",")}`, 4500, async () => {
    const param = encodeURIComponent(symbols.join(","));
    const json = (await yahoo(`/v7/finance/spark?symbols=${param}&range=1d&interval=1d`)) as {
      spark?: { result?: Array<{ symbol: string; response?: Array<{ meta?: SparkMeta }> }> };
    };
    const quotes: Quote[] = [];
    for (const row of json.spark?.result ?? []) {
      const meta = row.response?.[0]?.meta;
      if (!meta) continue;
      const q = quoteFromMeta(row.symbol, meta, "yahoo");
      if (q) quotes.push(q);
    }
    return quotes;
  });
}

const YF_INTERVAL: Record<IntervalId, { interval: string; range: string }> = {
  "1m": { interval: "1m", range: "5d" },
  "5m": { interval: "5m", range: "1mo" },
  "15m": { interval: "15m", range: "1mo" },
  "1h": { interval: "60m", range: "3mo" },
  "4h": { interval: "60m", range: "6mo" },
  "1d": { interval: "1d", range: "5y" },
  "1w": { interval: "1wk", range: "max" },
};

function rangeForSpan(
  span: SpanId | null | undefined,
  interval: IntervalId,
): { interval: string; range: string } {
  if (!span) return YF_INTERVAL[interval];
  switch (span) {
    case "1D":
      return { interval: "5m", range: "1d" };
    case "1W":
      return { interval: "60m", range: "1mo" };
    case "1M":
      return { interval: "60m", range: "3mo" };
    case "6M":
      return { interval: "1d", range: "1y" };
    case "YTD":
      return { interval: "1d", range: "ytd" };
    case "1Y":
      return { interval: "1d", range: "1y" };
    case "5Y":
      return { interval: "1wk", range: "5y" };
    case "ALL":
      return { interval: "1wk", range: "max" };
  }
}

type YahooChartData = {
  candles: Candle[];
  timeZone: string;
};

function parseChart(json: unknown): YahooChartData {
  const result = (json as { chart?: { result?: Array<Record<string, unknown>> } }).chart
    ?.result?.[0];
  if (!result) return { candles: [], timeZone: "UTC" };
  const ts = (result.timestamp as number[] | undefined) ?? [];
  const quote = (result.indicators as { quote?: Array<Record<string, Array<number | null>>> })
    ?.quote?.[0];
  const meta = result.meta as { exchangeTimezoneName?: string } | undefined;
  const timeZone = meta?.exchangeTimezoneName || "UTC";
  if (!quote) return { candles: [], timeZone };
  const candles: Candle[] = [];
  for (let i = 0; i < ts.length; i++) {
    const open = Number(quote.open?.[i]);
    const high = Number(quote.high?.[i]);
    const low = Number(quote.low?.[i]);
    const close = Number(quote.close?.[i]);
    if (![open, high, low, close].every(Number.isFinite)) continue;
    candles.push({
      time: ts[i],
      open,
      high,
      low,
      close,
      volume: Number(quote.volume?.[i]) || 0,
    });
  }
  return { candles, timeZone };
}

function sessionDateFormatter(timeZone: string): Intl.DateTimeFormat {
  const options: Intl.DateTimeFormatOptions = {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  };
  try {
    return new Intl.DateTimeFormat("en-US", options);
  } catch {
    return new Intl.DateTimeFormat("en-US", { ...options, timeZone: "UTC" });
  }
}

/**
 * Aggregate intraday stock candles without allowing a bucket to cross an
 * exchange session. Buckets are anchored to the first regular-session print,
 * which correctly handles half-hour opens and daylight-saving transitions.
 */
export function aggregateStockCandles(
  candles: Candle[],
  bucketSeconds = 4 * 60 * 60,
  timeZone = "UTC",
): Candle[] {
  if (!Number.isFinite(bucketSeconds) || bucketSeconds <= 0 || candles.length === 0) return [];
  const formatter = sessionDateFormatter(timeZone);
  const sessionKey = (time: number) => {
    const parts = formatter.formatToParts(new Date(time * 1000));
    const year = parts.find((part) => part.type === "year")?.value ?? "";
    const month = parts.find((part) => part.type === "month")?.value ?? "";
    const day = parts.find((part) => part.type === "day")?.value ?? "";
    return `${year}-${month}-${day}`;
  };

  const ordered = candles
    .filter(
      (candle) =>
        Number.isFinite(candle.time) &&
        [candle.open, candle.high, candle.low, candle.close, candle.volume].every(Number.isFinite),
    )
    .slice()
    .sort((a, b) => a.time - b.time);
  const aggregated: Candle[] = [];
  let activeSession = "";
  let sessionStart = 0;
  let activeBucket = -1;

  for (const candle of ordered) {
    const nextSession = sessionKey(candle.time);
    if (nextSession !== activeSession) {
      activeSession = nextSession;
      sessionStart = candle.time;
      activeBucket = -1;
    }
    const bucket = Math.max(0, Math.floor((candle.time - sessionStart) / bucketSeconds));
    const current = aggregated.at(-1);
    if (!current || bucket !== activeBucket) {
      aggregated.push({ ...candle });
      activeBucket = bucket;
      continue;
    }
    current.high = Math.max(current.high, candle.high);
    current.low = Math.min(current.low, candle.low);
    current.close = candle.close;
    current.volume += candle.volume;
  }

  return aggregated;
}

async function fetchChartData(
  symbol: string,
  interval: string,
  range: string,
): Promise<YahooChartData> {
  const path = `/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${interval}&range=${range}&includePrePost=false`;
  return cached(`yf:${symbol}:${interval}:${range}`, 20_000, async () => {
    const json = await yahoo(path);
    return parseChart(json);
  });
}

async function fetchChart(symbol: string, interval: string, range: string): Promise<Candle[]> {
  return (await fetchChartData(symbol, interval, range)).candles;
}

function moveFrom(candles: Candle[], last: number, startMs: number | null): SpanMove | null {
  if (!candles.length || !last) return null;
  const startSec = startMs ? startMs / 1000 : 0;
  const first = startSec ? (candles.find((c) => c.time >= startSec) ?? candles[0]) : candles[0];
  if (!first?.open) return null;
  return { pct: ((last - first.open) / first.open) * 100, delta: last - first.open };
}

/** Prefer the faster U.S. print while retaining Yahoo's exchange/session metadata. */
export function mergeStockQuotes(
  fallback: Quote | undefined,
  preferred: Quote | undefined,
  nowSeconds = Date.now() / 1000,
): Quote | undefined {
  if (!preferred) return fallback;
  if (!fallback) {
    return { ...preferred, freshness: deriveQuoteFreshness(preferred, nowSeconds) };
  }
  const previousClose = fallback.openPrice || preferred.openPrice || preferred.lastPrice;
  const merged: Quote = {
    ...fallback,
    lastPrice: preferred.lastPrice,
    openPrice: previousClose,
    priceChange: preferred.lastPrice - previousClose,
    priceChangePercent: previousClose
      ? ((preferred.lastPrice - previousClose) / previousClose) * 100
      : 0,
    // Alpaca's free IEX day bar covers one exchange. Keep the worldwide
    // fallback's listing-level range and volume, but extend the range if the
    // newer U.S. print falls outside it.
    highPrice: Math.max(fallback.highPrice, preferred.lastPrice),
    lowPrice: Math.min(fallback.lowPrice, preferred.lastPrice),
    volume: fallback.volume || preferred.volume,
    source: preferred.source,
    feed: preferred.feed,
    delaySeconds: preferred.delaySeconds,
    receivedAt: preferred.receivedAt,
    lastTime: preferred.lastTime ?? fallback.lastTime,
  };
  merged.freshness = deriveQuoteFreshness(merged, nowSeconds);
  return merged;
}

export const getStockTickers = createServerFn({ method: "GET" })
  .validator((input: { symbols?: string[] }) => ({
    symbols: [
      ...new Set(
        (input.symbols ?? []).map((s) => sanitizeMarketSymbol(s, "stocks")).filter(Boolean),
      ),
    ].slice(0, 24),
  }))
  .handler(
    async ({ data }): Promise<{ ok: true; quotes: Quote[] } | { ok: false; error: string }> => {
      try {
        await guardPublicRequest("tickers", 180);
        // The fast U.S. feed must not wait for the worldwide fallback, and a
        // fallback outage must not discard a valid provider quote.
        const [yahooResult, providerResult] = await Promise.allSettled([
          sparkQuotes(data.symbols),
          usProviderQuotes(data.symbols),
        ]);
        const yahooQuotes = yahooResult.status === "fulfilled" ? yahooResult.value : [];
        const live = providerResult.status === "fulfilled" ? providerResult.value : {};
        const byYahoo = Object.fromEntries(yahooQuotes.map((q) => [q.symbol, q]));
        const merged: Quote[] = [];
        const seen = new Set<string>();
        for (const symbol of data.symbols) {
          const y = byYahoo[symbol];
          const ix = live[symbol];
          const quote = mergeStockQuotes(y, ix);
          if (quote) merged.push(quote);
          seen.add(symbol);
        }
        for (const q of yahooQuotes) {
          if (!seen.has(q.symbol)) merged.push(q);
        }
        if (!merged.length && yahooResult.status === "rejected") throw yahooResult.reason;
        return { ok: true, quotes: merged };
      } catch (err) {
        return {
          ok: false,
          error: err instanceof Error ? err.message : "Stock quotes unavailable",
        };
      }
    },
  );

export const getStockKlines = createServerFn({ method: "GET" })
  .validator((input: { symbol: string; interval: IntervalId; span?: SpanId | null }) => ({
    symbol: sanitizeMarketSymbol(input.symbol, "stocks"),
    interval: input.interval,
    span: input.span ?? null,
  }))
  .handler(
    async ({ data }): Promise<{ ok: true; candles: Candle[] } | { ok: false; error: string }> => {
      try {
        await guardPublicRequest("klines", 120);
        const spec = rangeForSpan(data.span, data.interval);
        const chart = await fetchChartData(data.symbol, spec.interval, spec.range);
        const candles =
          data.interval === "4h" && (spec.interval === "5m" || spec.interval === "60m")
            ? aggregateStockCandles(chart.candles, 4 * 60 * 60, chart.timeZone)
            : chart.candles;
        if (!candles.length) return { ok: false, error: "No stock history for this symbol." };
        return { ok: true, candles };
      } catch (err) {
        return {
          ok: false,
          error: err instanceof Error ? err.message : "Failed to load stock chart",
        };
      }
    },
  );

export const getStockSpanReturns = createServerFn({ method: "GET" })
  .validator((input: { symbol: string }) => ({
    symbol: sanitizeMarketSymbol(input.symbol, "stocks"),
  }))
  .handler(
    async ({
      data,
    }): Promise<
      | { ok: true; last: number; returns: Partial<Record<SpanId, SpanMove | null>> }
      | { ok: false; error: string }
    > => {
      try {
        await guardPublicRequest("span", 90);
        const [daily, weekly] = await Promise.all([
          fetchChart(data.symbol, "1d", "5y"),
          fetchChart(data.symbol, "1wk", "max"),
        ]);
        const last = daily.at(-1)?.close ?? weekly.at(-1)?.close ?? 0;
        const now = Date.now();
        return {
          ok: true,
          last,
          returns: {
            "1W": moveFrom(daily, last, spanStartMs("1W", now)),
            "1M": moveFrom(daily, last, spanStartMs("1M", now)),
            "6M": moveFrom(daily, last, spanStartMs("6M", now)),
            YTD: moveFrom(daily, last, spanStartMs("YTD", now)),
            "1Y": moveFrom(daily, last, spanStartMs("1Y", now)),
            "5Y": moveFrom(weekly, last, spanStartMs("5Y", now)),
            ALL: moveFrom(weekly, last, null),
          },
        };
      } catch (err) {
        return {
          ok: false,
          error: err instanceof Error ? err.message : "Failed to load range returns",
        };
      }
    },
  );

export const getStockDeskSpanReturns = createServerFn({ method: "GET" })
  .validator((input: { symbols: string[]; span: SpanId }) => ({
    symbols: [
      ...new Set(input.symbols.map((s) => sanitizeMarketSymbol(s, "stocks")).filter(Boolean)),
    ].slice(0, 12),
    span: input.span,
  }))
  .handler(
    async ({
      data,
    }): Promise<
      | { ok: true; span: SpanId; returns: Record<string, SpanMove | null> }
      | { ok: false; error: string }
    > => {
      try {
        await guardPublicRequest("desk-span", 60);
        if (data.span === "1D") return { ok: true, span: data.span, returns: {} };
        const weekly = data.span === "5Y" || data.span === "ALL";
        const entries = await Promise.all(
          data.symbols.map(async (symbol) => {
            try {
              const candles = weekly
                ? await fetchChart(symbol, "1wk", "max")
                : await fetchChart(symbol, "1d", "5y");
              const last = candles.at(-1)?.close ?? 0;
              const start = data.span === "ALL" ? null : spanStartMs(data.span);
              return [symbol, moveFrom(candles, last, start)] as const;
            } catch {
              return [symbol, null] as const;
            }
          }),
        );
        return { ok: true, span: data.span, returns: Object.fromEntries(entries) };
      } catch (err) {
        return {
          ok: false,
          error: err instanceof Error ? err.message : "Failed to load watchlist ranges",
        };
      }
    },
  );

export const searchStocks = createServerFn({ method: "GET" })
  .validator((input: { q: string }) => ({ q: input.q.trim().slice(0, 40) }))
  .handler(
    async ({
      data,
    }): Promise<{ ok: true; symbols: SymbolInfo[] } | { ok: false; error: string }> => {
      try {
        await guardPublicRequest("search", 90);
        if (!data.q) return { ok: true, symbols: [] };
        const json = (await yahoo(
          `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(data.q)}&quotesCount=16&newsCount=0`,
        )) as {
          quotes?: Array<{
            symbol?: string;
            shortname?: string;
            longname?: string;
            quoteType?: string;
            exchDisp?: string;
            typeDisp?: string;
          }>;
        };
        const symbols: SymbolInfo[] = [];
        for (const row of json.quotes ?? []) {
          const symbol = row.symbol?.toUpperCase();
          if (!symbol) continue;
          const kind = (row.quoteType ?? "").toUpperCase();
          if (kind && !["EQUITY", "ETF", "INDEX", "MUTUALFUND"].includes(kind)) continue;
          if (!STOCK_META[symbol] && !/^[A-Z0-9.^-]{1,24}$/.test(symbol)) continue;
          symbols.push({
            symbol,
            base: row.shortname || row.longname || symbol,
            quote: row.exchDisp || "",
            status: "TRADING",
          });
        }
        const rank = (item: { symbol: string; quote: string }) => {
          const ex = item.quote.toUpperCase();
          if (ex.includes("OTC") || ex.includes("PINK") || ex.includes("GREY")) return 6;
          if (
            isUsEquity(item.symbol) &&
            (ex.includes("NASDAQ") ||
              ex.includes("NYSE") ||
              ex.includes("CBOE") ||
              ex.includes("NYSE ARCA"))
          )
            return 0;
          if (isUsEquity(item.symbol) && !item.symbol.includes(".")) return 1;
          if (
            item.symbol.endsWith(".ST") ||
            item.symbol.endsWith(".CO") ||
            item.symbol.endsWith(".HE") ||
            item.symbol.endsWith(".OL")
          )
            return 1;
          if (item.symbol.endsWith(".L") || ex.includes("LONDON") || ex.includes("LSE")) return 2;
          return 5;
        };
        symbols.sort((a, b) => rank(a) - rank(b) || a.symbol.localeCompare(b.symbol));
        const primary = symbols.filter((s) => rank(s) <= 2);
        return { ok: true, symbols: (primary.length ? primary : symbols).slice(0, 12) };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : "Search failed" };
      }
    },
  );
