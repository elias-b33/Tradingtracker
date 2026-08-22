import { useQuery } from "@tanstack/react-query";
import { getDepth, getTrades } from "@/lib/market/binance";
import {
  formatCandleTime,
  formatPct,
  formatPrice,
  formatQty,
  formatTime,
} from "@/lib/market/format";
import {
  chartTimeZone,
  exchangeLabel,
  quoteFeedStatus,
  sessionLabel,
  sourceLabel,
} from "@/lib/market/venue";
import { cn } from "@/lib/utils";
import { useQuote, useTerminalStore } from "@/lib/store";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NewsPanel } from "./news-panel";
import { AlertsPanel } from "./alerts-panel";
import { NotesPanel } from "./notes-panel";
import { HoldingsPanel } from "./holdings-panel";
import { EventsPanel } from "./events-panel";

export function MarketSide() {
  const sideTab = useTerminalStore((s) => s.sideTab);
  const setSideTab = useTerminalStore((s) => s.setSideTab);
  const venue = useTerminalStore((s) => s.venue);

  return (
    <Tabs
      value={sideTab}
      onValueChange={(value) => setSideTab(value as "news" | "book" | "tape" | "desk")}
      className="h-full min-h-0 bg-surface"
    >
      <div className="border-b border-border px-2 py-1">
        <TabsList>
          <TabsTrigger value="news">News</TabsTrigger>
          <TabsTrigger value="book">{venue === "stocks" ? "Session" : "Book"}</TabsTrigger>
          {venue === "crypto" && <TabsTrigger value="tape">Tape</TabsTrigger>}
          <TabsTrigger value="desk">Desk</TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="news" className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <NewsPanel />
      </TabsContent>
      <TabsContent value="book" className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <OrderBook />
      </TabsContent>
      <TabsContent value="tape" className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <TradesTape />
      </TabsContent>
      <TabsContent value="desk" className="min-h-0 overflow-auto p-3">
        <div className="space-y-6">
          <HoldingsPanel />
          <EventsPanel />
          <AlertsPanel />
          <NotesPanel />
        </div>
      </TabsContent>
    </Tabs>
  );
}

export function OrderBook() {
  const venue = useTerminalStore((s) => s.venue);
  if (venue === "stocks") return <StockSession />;
  return <CryptoBook />;
}

function sessionCountdown(quote: NonNullable<ReturnType<typeof useQuote>>): string | null {
  const start = quote.sessionStart;
  const end = quote.sessionEnd;
  if (!start || !end) return null;
  const now = Date.now() / 1000;
  if (now < start) {
    const min = Math.max(1, Math.round((start - now) / 60));
    if (min >= 60) return `Opens in ${Math.floor(min / 60)}h ${min % 60}m`;
    return `Opens in ${min}m`;
  }
  if (now >= start && now < end) {
    const min = Math.max(0, Math.round((end - now) / 60));
    if (min >= 60) return `Closes in ${Math.floor(min / 60)}h ${min % 60}m`;
    return `Closes in ${min}m`;
  }
  return null;
}

function StockSession() {
  const symbol = useTerminalStore((s) => s.symbol);
  const quote = useQuote(symbol);
  const state = quote?.marketState;
  const opts = quote ? { currency: quote.currency, hint: quote.priceHint } : undefined;
  const countdown = quote ? sessionCountdown(quote) : null;
  const feedStatus = quote ? quoteFeedStatus(quote) : null;
  const feedTone =
    feedStatus?.freshness === "real-time" || feedStatus?.freshness === "recent"
      ? "text-accent"
      : feedStatus?.freshness === "stale"
        ? "text-warn"
        : "text-muted";
  return (
    <div className="flex h-full min-h-0 flex-col gap-3 p-4 text-sm">
      <p className="text-xs font-medium tracking-wide text-muted uppercase">Overview</p>
      <p className="text-fg">
        {sessionLabel(state) || "Session status unavailable"}
        <span className="ml-2 text-xs text-muted">
          {[exchangeLabel(quote?.exchange), sourceLabel(quote?.source, "stocks", quote?.feed)]
            .filter(Boolean)
            .join(" · ")}
        </span>
      </p>
      {countdown ? <p className="text-xs text-muted">{countdown}</p> : null}
      {feedStatus ? (
        <div className="rounded-md border border-border bg-bg p-3">
          <p className={cn("text-xs font-medium", feedTone)}>{feedStatus.label}</p>
          <p className="mt-1 text-xs text-fg">{feedStatus.updatedLabel}</p>
          <p className="mt-1 text-xs leading-relaxed text-muted">{feedStatus.explanation}</p>
        </div>
      ) : null}
      {quote ? (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 font-mono text-xs tabular-nums">
          <dt className="text-muted">Last</dt>
          <dd className="text-right text-fg">{formatPrice(quote.lastPrice, opts)}</dd>
          <dt className="text-muted">Day</dt>
          <dd className={cn("text-right", quote.priceChangePercent >= 0 ? "text-up" : "text-down")}>
            {formatPct(quote.priceChangePercent)}
          </dd>
          <dt className="text-muted">Prev close</dt>
          <dd className="text-right text-fg">{formatPrice(quote.openPrice, opts)}</dd>
          <dt className="text-muted">High</dt>
          <dd className="text-right text-fg">{formatPrice(quote.highPrice, opts)}</dd>
          <dt className="text-muted">Low</dt>
          <dd className="text-right text-fg">{formatPrice(quote.lowPrice, opts)}</dd>
          <dt className="text-muted">Volume</dt>
          <dd className="text-right text-fg">{formatQty(quote.volume)}</dd>
          {quote.lastTime ? (
            <>
              <dt className="text-muted">Quote time</dt>
              <dd className="text-right text-fg">
                {formatCandleTime(quote.lastTime, "1m", chartTimeZone(symbol, "stocks"))}
              </dd>
            </>
          ) : null}
        </dl>
      ) : (
        <p className="text-muted">Waiting for quote…</p>
      )}
    </div>
  );
}

function CryptoBook() {
  const symbol = useTerminalStore((s) => s.symbol);
  const quote = useQuote(symbol);
  const query = useQuery({
    queryKey: ["depth", symbol],
    queryFn: () => getDepth({ data: { symbol, limit: 20 } }),
    refetchInterval: 2000,
  });
  const book = query.data?.ok ? query.data.book : null;
  const maxQty = book
    ? Math.max(...book.bids.map((l) => l.qty), ...book.asks.map((l) => l.qty), 1)
    : 1;
  const spread = book && book.asks[0] && book.bids[0] ? book.asks[0].price - book.bids[0].price : 0;
  const mid = quote?.lastPrice;

  return (
    <div className="flex h-full min-h-0 flex-col text-xs">
      <div className="grid grid-cols-3 px-3 py-1.5 font-medium text-muted">
        <span>Price</span>
        <span className="text-right">Size</span>
        <span className="text-right">Total</span>
      </div>
      <ScrollArea className="flex-1">
        <ul className="flex flex-col-reverse">
          {(book?.asks ?? []).slice(0, 12).map((level) => (
            <DepthRow key={`a-${level.price}`} side="ask" level={level} maxQty={maxQty} />
          ))}
        </ul>
        <div className="flex items-center justify-between border-y border-border bg-bg px-3 py-1.5 font-mono tabular-nums">
          <span className="text-fg">{mid ? formatPrice(mid) : "—"}</span>
          <span className="text-muted">Spread {spread ? formatPrice(spread) : "—"}</span>
        </div>
        <ul>
          {(book?.bids ?? []).slice(0, 12).map((level) => (
            <DepthRow key={`b-${level.price}`} side="bid" level={level} maxQty={maxQty} />
          ))}
        </ul>
        {query.data && !query.data.ok && (
          <p className="px-3 py-4 text-center text-muted">{query.data.error}</p>
        )}
      </ScrollArea>
    </div>
  );
}

function DepthRow({
  side,
  level,
  maxQty,
}: {
  side: "bid" | "ask";
  level: { price: number; qty: number };
  maxQty: number;
}) {
  const depth = `${Math.min(100, (level.qty / maxQty) * 100)}%`;
  return (
    <li
      className={cn(
        "grid grid-cols-3 px-3 py-0.5 font-mono tabular-nums",
        side === "bid" ? "depth-bid" : "depth-ask",
      )}
      style={{ "--depth": depth } as React.CSSProperties}
    >
      <span className={side === "bid" ? "text-up" : "text-down"}>{formatPrice(level.price)}</span>
      <span className="text-right text-fg">{formatQty(level.qty)}</span>
      <span className="text-right text-muted">{formatQty(level.price * level.qty)}</span>
    </li>
  );
}

function TradesTape() {
  const symbol = useTerminalStore((s) => s.symbol);
  const query = useQuery({
    queryKey: ["trades", symbol],
    queryFn: () => getTrades({ data: { symbol, limit: 40 } }),
    refetchInterval: 2000,
  });
  const trades = query.data?.ok ? query.data.trades : [];

  return (
    <div className="flex h-full min-h-0 flex-col text-xs">
      <div className="grid grid-cols-3 px-3 py-1.5 font-medium text-muted">
        <span>Price</span>
        <span className="text-right">Size</span>
        <span className="text-right">Time</span>
      </div>
      <ScrollArea className="flex-1">
        <ul>
          {trades.map((t) => (
            <li key={t.id} className="grid grid-cols-3 px-3 py-0.5 font-mono tabular-nums">
              <span className={t.isBuyerMaker ? "text-down" : "text-up"}>
                {formatPrice(t.price)}
              </span>
              <span className="text-right text-fg">{formatQty(t.qty)}</span>
              <span className="text-right text-muted">{formatTime(t.time)}</span>
            </li>
          ))}
        </ul>
        {query.data && !query.data.ok && (
          <p className="px-3 py-4 text-center text-muted">{query.data.error}</p>
        )}
      </ScrollArea>
    </div>
  );
}
