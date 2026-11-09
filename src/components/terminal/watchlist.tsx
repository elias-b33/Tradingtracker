import { Moon, Plus, Sun, X } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatPct, formatPrice } from "@/lib/market/format";
import { assetName, baseAsset } from "@/lib/market/symbols";
import { exchangeLabel } from "@/lib/market/venue";
import { holdingPnl } from "@/lib/briefing";
import { useLayoutMode } from "@/hooks/use-is-desktop";
import { useTerminalStore } from "@/lib/store";
import type { Quote } from "@/lib/market/types";
import { CatchUpButton } from "./briefing-sheet";
import { CoinIcon } from "./coin-icon";
import { VenueSwitch } from "./venue-switch";

function ExtIcon({ session, className }: { session: "pre" | "post"; className?: string }) {
  const Icon = session === "pre" ? Sun : Moon;
  return (
    <Icon
      aria-label={session === "pre" ? "Pre-market" : "Post-market"}
      className={cn("size-3 shrink-0", session === "pre" ? "text-warn" : "text-accent", className)}
    />
  );
}

export function Watchlist() {
  const layout = useLayoutMode();
  return layout === "phone" ? <PhoneWatchlist /> : <DeskWatchlist />;
}

function useWatchlistData() {
  const watchlist = useTerminalStore((s) => s.watchlist);
  const quotes = useTerminalStore((s) => s.quotes);
  const symbol = useTerminalStore((s) => s.symbol);
  const venue = useTerminalStore((s) => s.venue);
  const names = [...new Set(watchlist)];
  const loaded = names.some((s) => quotes[s]);
  return { names, quotes, symbol, venue, loaded };
}

function EmptyWatchlist() {
  const venue = useTerminalStore((s) => s.venue);
  const setSearchOpen = useTerminalStore((s) => s.setSearchOpen);
  return (
    <div className="px-5 py-12 text-center">
      <p className="text-sm font-medium text-fg">Your watchlist is empty</p>
      <p className="mt-1 text-xs leading-5 text-muted">
        {venue === "stocks"
          ? "Add stocks, ETFs, and indices from the US, Sweden, and beyond."
          : "Add crypto pairs for quick access."}
      </p>
      <button
        type="button"
        onClick={() => setSearchOpen(true)}
        className="mt-4 min-h-10 rounded-md bg-accent px-4 text-sm font-medium text-accent-fg"
      >
        Add symbol
      </button>
    </div>
  );
}

/** Dense TradingView watchlist table (desktop / tablet right panel). */
function DeskWatchlist() {
  const { names, quotes, symbol, venue, loaded } = useWatchlistData();
  const setSymbol = useTerminalStore((s) => s.setSymbol);
  const removeFromWatchlist = useTerminalStore((s) => s.removeFromWatchlist);
  const setSearchOpen = useTerminalStore((s) => s.setSearchOpen);
  const stocks = venue === "stocks";
  const grid = stocks
    ? "grid-cols-[minmax(0,1fr)_minmax(4.5rem,auto)_4rem_4.25rem]"
    : "grid-cols-[minmax(0,1fr)_minmax(4.5rem,auto)_4.25rem]";

  return (
    <div className="flex h-full min-h-0 flex-col bg-bg">
      <div className="flex h-[46px] shrink-0 items-center justify-between px-3">
        <h2 className="text-[15px] font-semibold text-strong">Watchlist</h2>
        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          aria-label="Add symbol"
          title="Add symbol"
          className="flex size-8 items-center justify-center rounded-[4px] text-fg hover:bg-hover"
        >
          <Plus className="size-5" strokeWidth={1.5} />
        </button>
      </div>
      <div
        className={cn(
          "grid h-7 shrink-0 items-center gap-2 border-b border-border px-3 text-[12px] text-muted",
          grid,
        )}
      >
        <span>Symbol</span>
        <span className="text-right">Last</span>
        <span className="text-right">Chg%</span>
        {stocks && <span className="text-right">Ext%</span>}
      </div>
      <ScrollArea className="min-h-0 flex-1">
        {names.length > 0 && !loaded && (
          <div className="space-y-1 p-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-7 w-full" />
            ))}
          </div>
        )}
        {names.length === 0 && <EmptyWatchlist />}
        <ul>
          {names.map((item) => {
            const quote = quotes[item];
            const up = (quote?.priceChangePercent ?? 0) >= 0;
            const active = item === symbol;
            return (
              <li key={item} className="group relative">
                <button
                  type="button"
                  onClick={() => setSymbol(item)}
                  className={cn(
                    "grid h-[34px] w-full items-center gap-2 px-3 text-left text-[13px] tabular-nums hover:bg-hover",
                    grid,
                    active && "rounded-[4px] outline-1 -outline-offset-1 outline-fg",
                  )}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <CoinIcon symbol={item} size={18} />
                    <span className="truncate font-medium text-strong">
                      {stocks ? item : baseAsset(item)}
                    </span>
                  </span>
                  <span className="text-right text-fg">
                    {quote
                      ? formatPrice(quote.lastPrice, { currency: quote.currency, hint: quote.priceHint }).replace(
                          ` ${quote.currency}`,
                          "",
                        )
                      : "—"}
                  </span>
                  <span className={cn("text-right", quote ? (up ? "text-up" : "text-down") : "text-muted")}>
                    {quote ? formatPct(quote.priceChangePercent) : "—"}
                  </span>
                  {stocks && <ExtCell quote={quote} />}
                </button>
                <button
                  type="button"
                  aria-label={`Remove ${item}`}
                  onClick={() => removeFromWatchlist(item)}
                  className="absolute top-1/2 right-0.5 hidden size-6 -translate-y-1/2 items-center justify-center rounded bg-elevated text-muted group-hover:flex hover:text-fg"
                >
                  <X className="size-3.5" />
                </button>
              </li>
            );
          })}
        </ul>
      </ScrollArea>
    </div>
  );
}

function ExtCell({ quote }: { quote?: Quote }) {
  if (!quote?.extSession || quote.extChangePercent === undefined) {
    return <span className="text-right text-muted">—</span>;
  }
  const up = quote.extChangePercent >= 0;
  return (
    <span className={cn("flex items-center justify-end gap-1", up ? "text-up" : "text-down")}>
      <ExtIcon session={quote.extSession} />
      {formatPct(quote.extChangePercent)}
    </span>
  );
}

/** Touch-friendly list (phone "Watchlist" tab), modelled on TradingView mobile. */
function PhoneWatchlist() {
  const { names, quotes, symbol, venue, loaded } = useWatchlistData();
  const setSymbol = useTerminalStore((s) => s.setSymbol);
  const removeFromWatchlist = useTerminalStore((s) => s.removeFromWatchlist);
  const setSearchOpen = useTerminalStore((s) => s.setSearchOpen);
  const holdings = useTerminalStore((s) => s.holdings);
  const lastSeenAt = useTerminalStore((s) => s.lastSeenAt);
  const bySymbol = new Map(holdings.map((h) => [h.symbol, h]));

  return (
    <div className="flex h-full min-h-0 flex-col bg-bg">
      <div className="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-border px-3">
        <h2 className="text-[18px] font-semibold text-strong">Watchlist</h2>
        <div className="flex items-center gap-1">
          <VenueSwitch />
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            aria-label="Add symbol"
            className="flex size-10 items-center justify-center rounded-md text-fg"
          >
            <Plus className="size-6" strokeWidth={1.5} />
          </button>
        </div>
      </div>
      {lastSeenAt ? (
        <div className="border-b border-border px-3 py-1.5">
          <CatchUpButton />
        </div>
      ) : null}
      <ScrollArea className="min-h-0 flex-1">
        {names.length > 0 && !loaded && (
          <div className="space-y-2 p-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        )}
        {names.length === 0 && <EmptyWatchlist />}
        <ul>
          {names.map((item) => {
            const quote = quotes[item];
            const up = (quote?.priceChangePercent ?? 0) >= 0;
            const bag = bySymbol.get(item);
            const pnl = bag ? holdingPnl(bag, quote?.lastPrice) : null;
            const extUp = (quote?.extChangePercent ?? 0) >= 0;
            return (
              <li key={item} className="relative">
                <button
                  type="button"
                  onClick={() => setSymbol(item)}
                  className={cn(
                    "grid min-h-[60px] w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b border-border py-2 pr-11 pl-3 text-left tabular-nums active:bg-hover",
                    item === symbol && "bg-elevated",
                  )}
                >
                  <CoinIcon symbol={item} size={32} />
                  <span className="min-w-0">
                    <span className="block truncate text-[15px] font-semibold text-strong">
                      {venue === "stocks" ? item : baseAsset(item)}
                    </span>
                    <span className="block truncate text-[12px] text-muted">
                      {bag && pnl
                        ? `${bag.qty} · ${formatPct(pnl.pnlPct)} vs cost`
                        : [quote?.shortName || assetName(item), exchangeLabel(quote?.exchange)]
                            .filter(Boolean)
                            .join(" · ")}
                    </span>
                  </span>
                  <span className="text-right">
                    <span className="block text-[15px] text-strong">
                      {quote ? formatPrice(quote.lastPrice, { currency: quote.currency, hint: quote.priceHint }) : "—"}
                    </span>
                    <span className={cn("block text-[13px]", quote ? (up ? "text-up" : "text-down") : "text-muted")}>
                      {quote ? formatPct(quote.priceChangePercent) : "—"}
                    </span>
                    {quote?.extSession && quote.extChangePercent !== undefined && (
                      <span className={cn("flex items-center justify-end gap-1 text-[12px]", extUp ? "text-up" : "text-down")}>
                        <ExtIcon session={quote.extSession} />
                        {quote.extPrice ? formatPrice(quote.extPrice, { hint: quote.priceHint }) : ""}{" "}
                        {formatPct(quote.extChangePercent)}
                      </span>
                    )}
                  </span>
                </button>
                <button
                  type="button"
                  aria-label={`Remove ${item}`}
                  onClick={() => removeFromWatchlist(item)}
                  className="absolute top-1/2 right-0 flex size-11 -translate-y-1/2 items-center justify-center text-muted"
                >
                  <X className="size-4" />
                </button>
              </li>
            );
          })}
        </ul>
      </ScrollArea>
    </div>
  );
}
