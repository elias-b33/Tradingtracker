import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { DEFAULT_INDICATORS } from "@/lib/market/types";
import type { DeskPayload } from "@/lib/store";
import { DEFAULT_CRYPTO_SLICE, DEFAULT_STOCKS_SLICE } from "@/lib/market/venue";

const drawingSchema = z.discriminatedUnion("kind", [
  z.object({ id: z.string().max(80), kind: z.literal("hline"), price: z.number().finite() }),
  z.object({
    id: z.string().max(80),
    kind: z.literal("trend"),
    t1: z.number().finite(),
    p1: z.number().finite(),
    t2: z.number().finite(),
    p2: z.number().finite(),
  }),
  z.object({
    id: z.string().max(80),
    kind: z.literal("fib"),
    t1: z.number().finite(),
    p1: z.number().finite(),
    t2: z.number().finite(),
    p2: z.number().finite(),
  }),
]);

const venueSlice = z.object({
  symbol: z.string().min(1).max(32),
  watchlist: z.array(z.string().min(1).max(32)).max(80),
  span: z.enum(["1D", "1W", "1M", "6M", "YTD", "1Y", "5Y", "ALL"]).nullable(),
  interval: z.enum(["1m", "5m", "15m", "1h", "4h", "1d", "1w"]),
});

const deskSchema = z.object({
  venue: z.enum(["crypto", "stocks"]).optional(),
  desks: z
    .object({
      crypto: venueSlice.optional(),
      stocks: venueSlice.optional(),
    })
    .optional(),
  symbol: z.string().min(1).max(32),
  interval: z.enum(["1m", "5m", "15m", "1h", "4h", "1d", "1w"]),
  span: z.enum(["1D", "1W", "1M", "6M", "YTD", "1Y", "5Y", "ALL"]).nullable().optional(),
  chartType: z.enum(["candles", "line", "area"]),
  indicators: z.object({
    sma20: z.boolean(),
    sma50: z.boolean(),
    sma200: z.boolean(),
    ema12: z.boolean(),
    ema26: z.boolean(),
    bb: z.boolean(),
    vwap: z.boolean(),
    volume: z.boolean(),
    rsi: z.boolean(),
    macd: z.boolean(),
  }),
  drawings: z.record(z.string(), z.array(drawingSchema).max(80)),
  watchlist: z.array(z.string().min(1).max(32)).max(80),
  alerts: z
    .array(
      z.object({
        id: z.string().max(80),
        symbol: z.string().min(1).max(32),
        kind: z.enum(["level", "pct"]).optional(),
        price: z.number().finite(),
        direction: z.enum(["above", "below"]),
        percent: z.number().finite().optional(),
        createdAt: z.number().finite(),
        triggeredAt: z.number().finite().optional(),
        firedPrice: z.number().finite().optional(),
      }),
    )
    .max(200),
  notes: z.record(z.string(), z.string().max(8000)),
  events: z
    .array(
      z.object({
        id: z.string().max(80),
        symbol: z.string().min(1).max(32),
        date: z.string().max(12),
        label: z.string().max(120),
      }),
    )
    .max(80)
    .optional(),
  lastSeenAt: z.number().finite().nullable().optional(),
  lastQuotes: z.record(z.string(), z.number().finite()).optional(),
  syncHoldings: z.boolean().optional(),
  holdings: z
    .array(
      z.object({
        symbol: z.string().min(1).max(32),
        qty: z.number().finite().nonnegative(),
        cost: z.number().finite().nonnegative(),
      }),
    )
    .max(80)
    .optional(),
});

function normalizeDesk(raw: unknown): DeskPayload | null {
  const parsed = deskSchema.safeParse(raw);
  if (!parsed.success) return null;
  return {
    ...parsed.data,
    venue: parsed.data.venue === "stocks" ? "stocks" : "crypto",
    desks: {
      crypto: parsed.data.desks?.crypto ?? DEFAULT_CRYPTO_SLICE,
      stocks: parsed.data.desks?.stocks ?? DEFAULT_STOCKS_SLICE,
    },
    span: parsed.data.span ?? null,
    indicators: { ...DEFAULT_INDICATORS, ...parsed.data.indicators },
    alerts: parsed.data.alerts.map((a) => ({
      ...a,
      kind: a.kind === "pct" ? "pct" : "level",
    })),
    events: parsed.data.events ?? [],
    lastSeenAt: parsed.data.lastSeenAt ?? null,
    lastQuotes: parsed.data.lastQuotes ?? {},
    syncHoldings: parsed.data.syncHoldings ?? false,
    holdings: parsed.data.holdings,
  };
}

export const getDesk = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<DeskPayload | null> => {
    const sql = await getSql();
    const rows = await sql<{ payload: unknown }>`
      select payload from desks where user_id = ${context.userId} limit 1
    `;
    const payload = rows[0]?.payload;
    if (payload == null) return null;
    return normalizeDesk(typeof payload === "string" ? JSON.parse(payload) : payload);
  });

export const saveDesk = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => deskSchema.parse(input))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const json = JSON.stringify(data);
    await sql.query(
      `insert into desks (user_id, payload, updated_at)
       values ($1, $2::jsonb, now())
       on conflict (user_id) do update
       set payload = excluded.payload, updated_at = now()`,
      [context.userId, json],
    );
    return { ok: true as const };
  });
