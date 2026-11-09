import { createServerFn } from "@tanstack/react-start";
import { LIQUID_UNIVERSE } from "./symbols";
import { spanStartMs } from "./spans";
import type { Candle, DepthBook, Quote, SpanId, SymbolInfo, TradePrint } from "./types";
import { TtlLruCache } from "./runtime-guards";

const BASES = [
  "https://data-api.binance.vision",
  "https://api.binance.com",
  "https://api1.binance.com",
];

const cache = new TtlLruCache<Promise<unknown>>({ maxEntries: 256 });

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
  enforcePublicRateLimit(`binance:${scope}`, limit);
}

async function fetchBinance(path: string): Promise<Response> {
  let lastError: Error | null = null;
  for (const base of BASES) {
    try {
      const res = await fetch(`${base}${path}`, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(8000),
      });
      if (res.ok) return res;
      if (res.status === 418) {
        throw new Error("Binance blocked this network. Last quotes and the live tape may still run.");
      }
      if (res.status === 451) {
        lastError = new Error("Binance blocked this network. Last quotes and the live tape may still run.");
        continue;
      }
      lastError = new Error(`Exchange returned ${res.status}`);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error("Network error");
    }
  }
  throw lastError ?? new Error("Market data unavailable");
}

function num(value: string | number): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

const INTERVAL_SET = new Set(["1m", "5m", "15m", "1h", "4h", "1d", "1w"]);

function mapKline(row: Array<string | number>): Candle {
  return {
    time: Math.floor(num(row[0]) / 1000),
    open: num(row[1]),
    high: num(row[2]),
    low: num(row[3]),
    close: num(row[4]),
    volume: num(row[5]),
  };
}

async function fetchKlinePage(symbol: string, interval: string, params: string): Promise<Candle[]> {
  const res = await fetchBinance(`/api/v3/klines?symbol=${symbol}&interval=${interval}&${params}`);
  const raw = (await res.json()) as Array<Array<string | number>>;
  return raw.map(mapKline);
}

export const getKlines = createServerFn({ method: "GET" })
  .validator((input: { symbol: string; interval: string; limit?: number; startTime?: number }) => {
    const symbol = input.symbol.replace(/[^A-Z0-9]/gi, "").toUpperCase();
    const interval = INTERVAL_SET.has(input.interval) ? input.interval : "1h";
    const limit = Math.min(Math.max(input.limit ?? 500, 50), 1000);
    const startTime =
      typeof input.startTime === "number" && Number.isFinite(input.startTime) && input.startTime > 0
        ? Math.floor(input.startTime)
        : undefined;
    return { symbol, interval, limit, startTime };
  })
  .handler(async ({ data }) => {
    try {
      await guardPublicRequest("klines", 120);
      const bucket = data.startTime ? Math.floor(data.startTime / 3_600_000) : "tail";
      const candles = await cached(
        `k:${data.symbol}:${data.interval}:${bucket}:${data.limit}`,
        data.interval === "1m" || data.interval === "5m" ? 4000 : 20_000,
        async () => {
          if (!data.startTime) {
            return fetchKlinePage(data.symbol, data.interval, `limit=${data.limit}`);
          }
          const out: Candle[] = [];
          let start = data.startTime;
          const now = Date.now();
          for (let page = 0; page < 4 && start < now && out.length < 4000; page += 1) {
            const chunk = await fetchKlinePage(
              data.symbol,
              data.interval,
              `startTime=${start}&limit=1000`,
            );
            if (!chunk.length) break;
            if (out.length && chunk[0].time <= out[out.length - 1].time) {
              const last = out[out.length - 1].time;
              out.push(...chunk.filter((c) => c.time > last));
            } else {
              out.push(...chunk);
            }
            const last = chunk[chunk.length - 1];
            if (chunk.length < 1000) break;
            start = last.time * 1000 + 1;
          }
          return out;
        },
      );
      return { ok: true as const, candles };
    } catch (err) {
      return {
        ok: false as const,
        error: err instanceof Error ? err.message : "Failed to load candles",
      };
    }
  });

export type SpanMove = { pct: number; delta: number };
export type SpanReturnMap = Partial<Record<SpanId, SpanMove | null>>;

function moveFrom(candles: Candle[], last: number, startMs: number | null): SpanMove | null {
  if (!candles.length || !last) return null;
  const startSec = startMs ? startMs / 1000 : 0;
  const first = startSec ? (candles.find((c) => c.time >= startSec) ?? candles[0]) : candles[0];
  if (!first?.open) return null;
  return { pct: ((last - first.open) / first.open) * 100, delta: last - first.open };
}

function dailyCandles(symbol: string) {
  return cached(`k1d:${symbol}`, 20_000, () => fetchKlinePage(symbol, "1d", "limit=1000"));
}

function weeklyCandles(symbol: string) {
  return cached(`k1w:${symbol}`, 20_000, () => fetchKlinePage(symbol, "1w", "limit=1000"));
}

async function spanPack(symbol: string): Promise<{ last: number; returns: SpanReturnMap }> {
  return cached(`span:${symbol}`, 20_000, async () => {
    const [daily, weekly] = await Promise.all([dailyCandles(symbol), weeklyCandles(symbol)]);
    const last = daily.at(-1)?.close ?? weekly.at(-1)?.close ?? 0;
    const now = Date.now();
    const returns: SpanReturnMap = {
      "1W": moveFrom(daily, last, spanStartMs("1W", now)),
      "1M": moveFrom(daily, last, spanStartMs("1M", now)),
      "3M": moveFrom(daily, last, spanStartMs("3M", now)),
      "6M": moveFrom(daily, last, spanStartMs("6M", now)),
      YTD: moveFrom(daily, last, spanStartMs("YTD", now)),
      "1Y": moveFrom(daily, last, spanStartMs("1Y", now)),
      "5Y": moveFrom(weekly, last, spanStartMs("5Y", now)),
      ALL: moveFrom(weekly, last, null),
    };
    return { last, returns };
  });
}

async function moveForSpan(symbol: string, span: SpanId): Promise<SpanMove | null> {
  const now = Date.now();
  if (span === "1D") return null;
  if (span === "5Y" || span === "ALL") {
    const weekly = await weeklyCandles(symbol);
    const last = weekly.at(-1)?.close ?? 0;
    return moveFrom(weekly, last, span === "ALL" ? null : spanStartMs(span, now));
  }
  const daily = await dailyCandles(symbol);
  const last = daily.at(-1)?.close ?? 0;
  return moveFrom(daily, last, spanStartMs(span, now));
}

export const getSpanReturns = createServerFn({ method: "GET" })
  .validator((input: { symbol: string }) => ({
    symbol: input.symbol.replace(/[^A-Z0-9]/gi, "").toUpperCase(),
  }))
  .handler(
    async ({
      data,
    }): Promise<
      { ok: true; last: number; returns: Partial<Record<SpanId, SpanMove | null>> } | { ok: false; error: string }
    > => {
      try {
        await guardPublicRequest("span", 90);
        const pack = await spanPack(data.symbol);
        return { ok: true as const, ...pack };
      } catch (err) {
        return {
          ok: false as const,
          error: err instanceof Error ? err.message : "Failed to load range returns",
        };
      }
    },
  );

export const getDeskSpanReturns = createServerFn({ method: "GET" })
  .validator((input: { symbols: string[]; span: SpanId }) => ({
    symbols: [...new Set(input.symbols.map((s) => s.replace(/[^A-Z0-9]/gi, "").toUpperCase()).filter(Boolean))].slice(
      0,
      12,
    ),
    span: input.span,
  }))
  .handler(
    async ({
      data,
    }): Promise<
      { ok: true; span: SpanId; returns: Record<string, SpanMove | null> } | { ok: false; error: string }
    > => {
      try {
        await guardPublicRequest("desk-span", 60);
        if (data.span === "1D") return { ok: true as const, span: data.span, returns: {} };
        const entries = await Promise.all(
          data.symbols.map(async (symbol) => {
            try {
              return [symbol, await moveForSpan(symbol, data.span)] as const;
            } catch {
              return [symbol, null] as const;
            }
          }),
        );
        return { ok: true as const, span: data.span, returns: Object.fromEntries(entries) };
      } catch (err) {
        return {
          ok: false as const,
          error: err instanceof Error ? err.message : "Failed to load watchlist ranges",
        };
      }
    },
  );

export const getTickers = createServerFn({ method: "GET" })
  .validator((input: { symbols?: string[] } | undefined) => {
    const symbols = (input?.symbols ?? [...LIQUID_UNIVERSE])
      .map((s) => s.replace(/[^A-Z0-9]/gi, "").toUpperCase())
      .filter(Boolean)
      .slice(0, 80);
    return { symbols };
  })
  .handler(async ({ data }) => {
    try {
      await guardPublicRequest("tickers", 180);
      const quotes = await cached(`td:${data.symbols.join(",")}`, 4000, async () => {
        const param = encodeURIComponent(JSON.stringify(data.symbols));
        const res = await fetchBinance(`/api/v3/ticker/tradingDay?symbols=${param}`);
        const raw = (await res.json()) as Array<Record<string, string>>;
        return raw.map(
          (row) =>
            ({
              symbol: row.symbol,
              lastPrice: num(row.lastPrice),
              priceChange: num(row.priceChange),
              priceChangePercent: num(row.priceChangePercent),
              highPrice: num(row.highPrice),
              lowPrice: num(row.lowPrice),
              volume: num(row.volume),
              quoteVolume: num(row.quoteVolume),
              openPrice: num(row.openPrice),
            }) satisfies Quote,
        );
      });
      return { ok: true as const, quotes };
    } catch (err) {
      return {
        ok: false as const,
        error: err instanceof Error ? err.message : "Failed to load tickers",
      };
    }
  });

export const getDepth = createServerFn({ method: "GET" })
  .validator((input: { symbol: string; limit?: number }) => ({
    symbol: input.symbol.replace(/[^A-Z0-9]/gi, "").toUpperCase(),
    limit: input.limit === 10 || input.limit === 20 || input.limit === 50 ? input.limit : 20,
  }))
  .handler(async ({ data }) => {
    try {
      await guardPublicRequest("depth", 180);
      const book = await cached(`d:${data.symbol}:${data.limit}`, 1200, async () => {
        const res = await fetchBinance(
          `/api/v3/depth?symbol=${data.symbol}&limit=${data.limit}`,
        );
        const raw = (await res.json()) as {
          lastUpdateId: number;
          bids: Array<[string, string]>;
          asks: Array<[string, string]>;
        };
        return {
          lastUpdateId: raw.lastUpdateId,
          bids: raw.bids.map(([price, qty]) => ({ price: num(price), qty: num(qty) })),
          asks: raw.asks.map(([price, qty]) => ({ price: num(price), qty: num(qty) })),
        } satisfies DepthBook;
      });
      return { ok: true as const, book };
    } catch (err) {
      return {
        ok: false as const,
        error: err instanceof Error ? err.message : "Failed to load order book",
      };
    }
  });

export const getTrades = createServerFn({ method: "GET" })
  .validator((input: { symbol: string; limit?: number }) => ({
    symbol: input.symbol.replace(/[^A-Z0-9]/gi, "").toUpperCase(),
    limit: Math.min(Math.max(input.limit ?? 40, 10), 100),
  }))
  .handler(async ({ data }) => {
    try {
      await guardPublicRequest("trades", 180);
      const trades = await cached(`r:${data.symbol}:${data.limit}`, 1200, async () => {
        const res = await fetchBinance(
          `/api/v3/trades?symbol=${data.symbol}&limit=${data.limit}`,
        );
        const raw = (await res.json()) as Array<{
          id: number;
          price: string;
          qty: string;
          time: number;
          isBuyerMaker: boolean;
        }>;
        return raw
          .slice()
          .reverse()
          .map(
            (t) =>
              ({
                id: t.id,
                price: num(t.price),
                qty: num(t.qty),
                time: t.time,
                isBuyerMaker: t.isBuyerMaker,
              }) satisfies TradePrint,
          );
      });
      return { ok: true as const, trades };
    } catch (err) {
      return {
        ok: false as const,
        error: err instanceof Error ? err.message : "Failed to load trades",
      };
    }
  });

export const searchSymbols = createServerFn({ method: "GET" })
  .validator((input: { q?: string } | undefined) => ({
    q: (input?.q ?? "").trim().toUpperCase().slice(0, 24),
  }))
  .handler(async ({ data }) => {
    try {
      await guardPublicRequest("search", 90);
      const symbols = await cached("exchange-usdt", 10 * 60_000, async () => {
        const res = await fetchBinance("/api/v3/exchangeInfo");
        const raw = (await res.json()) as {
          symbols: Array<{
            symbol: string;
            baseAsset: string;
            quoteAsset: string;
            status: string;
          }>;
        };
        return raw.symbols
          .filter((s) => s.status === "TRADING" && s.quoteAsset === "USDT")
          .map(
            (s) =>
              ({
                symbol: s.symbol,
                base: s.baseAsset,
                quote: s.quoteAsset,
                status: s.status,
              }) satisfies SymbolInfo,
          );
      });
      if (!data.q) {
        const featured = new Set<string>(LIQUID_UNIVERSE);
        return {
          ok: true as const,
          symbols: symbols.filter((s) => featured.has(s.symbol)),
        };
      }
      const q = data.q.replace("/", "");
      const matches = symbols
        .filter(
          (s) =>
            s.symbol.includes(q) || s.base.includes(q) || `${s.base}${s.quote}`.includes(q),
        )
        .slice(0, 40);
      return { ok: true as const, symbols: matches };
    } catch (err) {
      return {
        ok: false as const,
        error: err instanceof Error ? err.message : "Failed to search symbols",
      };
    }
  });
