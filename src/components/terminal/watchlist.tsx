import { useState } from "react";
import { ChevronDown, Minus, Moon, MoreHorizontal, Plus, Sun, X } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatChange, formatPct, formatPrice } from "@/lib/market/format";
import { assetName, baseAsset, pairName } from "@/lib/market/symbols";
import { holdingPnl } from "@/lib/briefing";
import { useLayoutMode } from "@/hooks/use-is-desktop";
import { useTerminalStore } from "@/lib/store";
import { CatchUpButton } from "./briefing-sheet";
import { CoinIcon } from "./coin-icon";
import { Logo } from "./logo";

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
  const [collapsed, setCollapsed] = useState(false);
  const grid = "grid-cols-[minmax(0,1fr)_minmax(4.5rem,auto)_minmax(3.5rem,auto)_4rem]";

  return (
    <div className="flex h-full min-h-0 flex-col bg-bg">
      <div className="flex h-[46px] shrink-0 items-center justify-between pr-2 pl-3">
        <h2 className="flex items-center gap-1 text-[15px] font-semibold text-strong">
          Watchlist <ChevronDown className="size-4" />
        </h2>
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
      <div className={cn("grid h-7 shrink-0 items-center gap-2 border-b border-border px-3 text-[13px] text-[#b8b8b8]", grid)}>
        <span>Symbol</span>
        <span className="text-right">Last</span>
        <span className="text-right">Chg</span>
        <span className="text-right">Chg%</span>
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
        {names.length > 0 && (
          <button
            type="button"
            onClick={() => setCollapsed((v) => !v)}
            className="flex h-[30px] w-full items-center gap-1.5 px-3 text-[11px] font-medium tracking-wide text-[#b8b8b8] uppercase hover:bg-hover"
          >
            <ChevronDown className={cn("size-3.5 transition-transform", collapsed && "-rotate-90")} />
            {venue === "stocks" ? "Stocks" : "Crypto"}
          </button>
        )}
        {!collapsed && (
          <ul>
            {names.map((item) => {
              const quote = quotes[item];
              const up = (quote?.priceChange ?? 0) >= 0;
              const active = item === symbol;
              const hint = quote?.priceHint;
              const tone = quote ? (up ? "text-up" : "text-down") : "text-muted";
              return (
                <li key={item} className="group relative">
                  <button
                    type="button"
                    onClick={() => setSymbol(item)}
                    className={cn(
                      "grid h-[30px] w-full items-center gap-2 px-3 text-left text-[14px] tabular-nums hover:bg-hover",
                      grid,
                      active && "rounded-[4px] outline-1 -outline-offset-1 outline-fg",
                    )}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <CoinIcon symbol={item} size={18} />
                      <span className="truncate text-strong">{item}</span>
                      {quote?.extSession && quote.extPrice ? (
                        <span
                          title={`${quote.extSession === "pre" ? "Pre-market" : "Post-market"} ${formatPrice(quote.extPrice, { hint })} ${formatPct(quote.extChangePercent ?? 0)}`}
                          className={cn("size-1.5 shrink-0 rounded-full", quote.extSession === "pre" ? "bg-warn" : "bg-accent")}
                        />
                      ) : null}
                    </span>
                    <span className="text-right text-fg">
                      {quote ? formatPrice(quote.lastPrice, { hint }) : "—"}
                    </span>
                    <span className={cn("text-right", tone)}>
                      {quote ? formatChange(quote.priceChange, hint).replace("+", "") : "—"}
                    </span>
                    <span className={cn("text-right", tone)}>
                      {quote ? `${quote.priceChangePercent.toFixed(2).replace("-", "−")}%` : "—"}
                    </span>
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
        )}
      </ScrollArea>
    </div>
  );
}

/** Phone watchlist, modelled on the TradingView app: list chips (our Crypto | Stocks split), big rows, ext-hours line. */
function PhoneWatchlist() {
  const { names, quotes, symbol, venue, loaded } = useWatchlistData();
  const openOverview = useTerminalStore((s) => s.openOverview);
  const removeFromWatchlist = useTerminalStore((s) => s.removeFromWatchlist);
  const setSearchOpen = useTerminalStore((s) => s.setSearchOpen);
  const setVenue = useTerminalStore((s) => s.setVenue);
  const holdings = useTerminalStore((s) => s.holdings);
  const lastSeenAt = useTerminalStore((s) => s.lastSeenAt);
  const bySymbol = new Map(holdings.map((h) => [h.symbol, h]));
  const [editing, setEditing] = useState(false);

  return (
    <div className="flex h-full min-h-0 flex-col bg-bg">
      <div className="relative flex h-12 shrink-0 items-center justify-between px-2">
        <button
          type="button"
          onClick={() => setEditing((v) => !v)}
          className="flex h-10 min-w-10 items-center justify-center px-2 text-[16px] text-fg"
          aria-label={editing ? "Done editing" : "Edit list"}
        >
          {editing ? "Done" : <MoreHorizontal className="size-6" strokeWidth={1.5} />}
        </button>
        <Logo className="pointer-events-none absolute left-1/2 flex -translate-x-1/2 items-center gap-2 text-[17px] font-semibold text-strong" />
        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          aria-label="Add symbol"
          className="flex size-10 items-center justify-center text-fg"
        >
          <Plus className="size-7" strokeWidth={1.5} />
        </button>
      </div>
      <div role="tablist" aria-label="Market" className="flex shrink-0 gap-1 px-3 pt-1 pb-2">
        {(["crypto", "stocks"] as const).map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={venue === id}
            onClick={() => setVenue(id)}
            className={cn(
              "h-9 rounded-[10px] px-4 text-[17px]",
              venue === id ? "bg-[#2a2a2a] font-semibold text-strong" : "text-[#8c8c8c]",
            )}
          >
            {id === "crypto" ? "Crypto" : "Stocks"}
          </button>
        ))}
      </div>
      {lastSeenAt ? (
        <div className="px-4 pb-2">
          <CatchUpButton />
        </div>
      ) : null}
      <ScrollArea className="min-h-0 flex-1">
        {names.length > 0 && !loaded && (
          <div className="space-y-2 p-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        )}
        {names.length === 0 && <EmptyWatchlist />}
        <ul>
          {names.map((item) => {
            const quote = quotes[item];
            const up = (quote?.priceChange ?? 0) >= 0;
            const bag = bySymbol.get(item);
            const pnl = bag ? holdingPnl(bag, quote?.lastPrice) : null;
            const extUp = (quote?.extChange ?? 0) >= 0;
            const hint = quote?.priceHint;
            return (
              <li key={item} className="flex items-stretch">
                {editing && (
                  <button
                    type="button"
                    aria-label={`Remove ${item}`}
                    onClick={() => removeFromWatchlist(item)}
                    className="flex w-12 shrink-0 items-center justify-center"
                  >
                    <span className="flex size-[22px] items-center justify-center rounded-full bg-down text-white">
                      <Minus className="size-4" strokeWidth={3} />
                    </span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => openOverview(item)}
                  className={cn(
                    "grid min-h-[72px] min-w-0 flex-1 grid-cols-[40px_minmax(0,1fr)_auto] items-center gap-x-3 pl-4 text-left tabular-nums active:bg-[#141414]",
                    item === symbol && "bg-[#0d0d0d]",
                  )}
                >
                  <CoinIcon symbol={item} size={40} />
                  <span className="flex min-w-0 flex-col justify-center self-stretch border-b border-[#202020] py-3">
                    <span className="truncate text-[17px] leading-6 text-fg">
                      {venue === "stocks" ? item : baseAsset(item)}
                    </span>
                    <span className="truncate text-[15px] leading-5 text-[#707070]">
                      {bag && pnl
                        ? `${bag.qty} · ${formatPct(pnl.pnlPct)} vs cost`
                        : quote?.shortName?.replace(/\.$/, "") || (venue === "stocks" ? assetName(item) : pairName(item))}
                    </span>
                  </span>
                  <span className="flex flex-col items-end justify-center self-stretch border-b border-[#202020] py-3 pr-4 text-right">
                    <span className="text-[17px] leading-6 text-fg">
                      {quote ? formatPrice(quote.lastPrice, { hint }) : "—"}
                    </span>
                    <span className={cn("text-[15px] leading-5", quote ? (up ? "text-[#22ab94]" : "text-down") : "text-[#707070]")}>
                      {quote
                        ? `${formatChange(quote.priceChange, hint)} ${formatPct(quote.priceChangePercent).replace("-", "−")}`
                        : "—"}
                    </span>
                    {quote?.extSession && quote.extPrice ? (
                      <span className="mt-1 flex items-center gap-1.5 text-[13px] leading-4">
                        <ExtIcon session={quote.extSession} className="size-3.5" />
                        <span className="text-fg">{formatPrice(quote.extPrice, { hint })}</span>
                        <span className={extUp ? "text-[#22ab94]" : "text-down"}>
                          {formatChange(quote.extChange ?? 0, hint)}{" "}
                          {formatPct(quote.extChangePercent ?? 0).replace("-", "−")}
                        </span>
                      </span>
                    ) : null}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </ScrollArea>
    </div>
  );
}
