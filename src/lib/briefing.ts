import { formatPct, formatPrice } from "@/lib/market/format";
import { assetName, baseAsset } from "@/lib/market/symbols";
import type { CoinEvent, Holding, Quote } from "@/lib/market/types";

export interface MoverRow {
  symbol: string;
  last: number;
  prev: number;
  sincePct: number;
  dayPct: number;
}

export function sincePct(prev: number, last: number): number {
  if (!prev || !Number.isFinite(prev) || !Number.isFinite(last)) return 0;
  return ((last - prev) / prev) * 100;
}

export function watchlistMovers(
  watchlist: string[],
  lastQuotes: Record<string, number>,
  quotes: Record<string, Quote>,
): MoverRow[] {
  const rows: MoverRow[] = [];
  for (const symbol of [...new Set(watchlist)]) {
    const prev = lastQuotes[symbol];
    const last = quotes[symbol]?.lastPrice;
    if (!prev || !last) continue;
    rows.push({
      symbol,
      last,
      prev,
      sincePct: sincePct(prev, last),
      dayPct: quotes[symbol]?.priceChangePercent ?? 0,
    });
  }
  return rows.sort((a, b) => Math.abs(b.sincePct) - Math.abs(a.sincePct));
}

export function holdingPnl(holding: Holding, last: number | undefined) {
  if (!last || !holding.qty) {
    return { value: 0, costBasis: holding.qty * holding.cost, pnl: 0, pnlPct: 0 };
  }
  const value = holding.qty * last;
  const costBasis = holding.qty * holding.cost;
  const pnl = value - costBasis;
  const pnlPct = costBasis ? (pnl / costBasis) * 100 : 0;
  return { value, costBasis, pnl, pnlPct };
}

export function upcomingEvents(events: CoinEvent[], withinDays = 7): CoinEvent[] {
  const start = startOfDay(Date.now());
  const end = start + withinDays * 86_400_000;
  return events
    .filter((event) => {
      const t = Date.parse(`${event.date}T00:00:00`);
      return Number.isFinite(t) && t >= start && t <= end;
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function moverLine(row: MoverRow): string {
  return `${baseAsset(row.symbol)} ${formatPct(row.sincePct)} to ${formatPrice(row.last)}`;
}

export function eventLine(event: CoinEvent): string {
  return `${baseAsset(event.symbol)} · ${event.date} · ${event.label}`;
}

export function holdingLine(holding: Holding, last: number | undefined): string {
  const { pnlPct } = holdingPnl(holding, last);
  return `${assetName(holding.symbol)} ${holding.qty} · ${formatPct(pnlPct)} vs cost`;
}

function startOfDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}
