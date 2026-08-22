import { Search, X } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatPct, formatPrice } from "@/lib/market/format";
import { assetName, baseAsset } from "@/lib/market/symbols";
import { exchangeLabel } from "@/lib/market/venue";
import { spanLabel } from "@/lib/market/spans";
import { SPANS } from "@/lib/market/types";
import { holdingPnl } from "@/lib/briefing";
import { useLayoutMode } from "@/hooks/use-is-desktop";
import { useDeskSpanMoves } from "@/hooks/use-span-returns";
import { useTerminalStore } from "@/lib/store";
import { CatchUpButton } from "./briefing-sheet";
import { CoinIcon } from "./coin-icon";
import { VenueSwitch } from "./venue-switch";

export function Watchlist() {
  const watchlist = useTerminalStore((s) => s.watchlist);
  const quotes = useTerminalStore((s) => s.quotes);
  const symbol = useTerminalStore((s) => s.symbol);
  const setSymbol = useTerminalStore((s) => s.setSymbol);
  const removeFromWatchlist = useTerminalStore((s) => s.removeFromWatchlist);
  const setSearchOpen = useTerminalStore((s) => s.setSearchOpen);
  const setPhonePane = useTerminalStore((s) => s.setPhonePane);
  const holdings = useTerminalStore((s) => s.holdings);
  const lastSeenAt = useTerminalStore((s) => s.lastSeenAt);
  const names = [...new Set(watchlist)];
  const loaded = names.some((s) => quotes[s]);
  const bySymbol = new Map(holdings.map((h) => [h.symbol, h]));
  const { moves, span, isLoading } = useDeskSpanMoves(names);
  const layout = useLayoutMode();
  const phone = layout === "phone";
  const venue = useTerminalStore((s) => s.venue);

  return (
    <div className="flex h-full min-h-0 flex-col bg-bg">
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
        <h2
          aria-label={`${phone ? "Markets" : "Watchlist"}, ${names.length} items${phone ? "" : `, ${spanLabel(span)} performance`}`}
          className="text-xs font-medium tracking-wide text-muted uppercase"
        >
          <span aria-hidden>{phone ? "Markets" : "Watchlist"}</span>
          <span aria-hidden className="ml-1.5 font-mono text-subtle">{names.length}</span>
          {!phone && (
            <span aria-hidden className="ml-2 font-sans font-medium normal-case text-fg">{spanLabel(span)}</span>
          )}
        </h2>
        <div className="flex items-center gap-2">
          {phone && <VenueSwitch />}
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="flex min-h-11 items-center gap-1.5 px-1 text-xs text-accent hover:text-fg md:min-h-0"
          >
            <Search className="size-3.5" aria-hidden />
            {venue === "stocks" ? "Find stocks" : "Add crypto"}
          </button>
        </div>
      </div>
      {phone && <WatchlistRangePicker />}
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
        {names.length === 0 && (
          <div className="px-5 py-12 text-center">
            <Search className="mx-auto size-7 text-subtle" aria-hidden />
            <p className="mt-3 text-sm font-medium text-fg">
              {venue === "stocks" ? "Build your first stock watchlist" : "Build your crypto watchlist"}
            </p>
            <p className="mt-1 text-xs leading-5 text-muted">
              {venue === "stocks"
                ? "Discover companies, ETFs, and market indices from the US, Sweden, and beyond."
                : "Find a market and add it here for quick access."}
            </p>
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="mt-4 min-h-11 rounded-md bg-accent px-4 text-sm font-medium text-accent-fg"
            >
              {venue === "stocks" ? "Find stocks" : "Find crypto"}
            </button>
          </div>
        )}
        <ul>
          {names.map((item) => {
            const quote = quotes[item];
            const move = moves[item];
            const up = (move?.pct ?? 0) >= 0;
            const active = item === symbol;
            const bag = bySymbol.get(item);
            const pnl = bag ? holdingPnl(bag, quote?.lastPrice) : null;
            return (
              <li key={item} className="group relative">
                <button
                  type="button"
                  onClick={() => {
                    setSymbol(item);
                    setPhonePane(venue === "stocks" ? "plot" : "news");
                  }}
                  className={cn(
                    "grid min-h-14 w-full grid-cols-[auto_1fr_auto] items-center gap-3 border-b border-border py-2.5 pr-14 pl-3 text-left hover:bg-elevated lg:pr-3",
                    active && "bg-elevated",
                  )}
                >
                  <CoinIcon symbol={item} size={32} />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-fg">{baseAsset(item)}</span>
                    <span className="block truncate text-xs text-muted">
                      {bag && pnl
                        ? `${bag.qty} · ${formatPct(pnl.pnlPct)} vs cost`
                        : [quote?.shortName || assetName(item), exchangeLabel(quote?.exchange)]
                            .filter(Boolean)
                            .join(" · ")}
                    </span>
                  </span>
                  <span className="text-right">
                    <span className="block font-mono text-sm tabular-nums tracking-tight text-fg">
                      {quote ? formatPrice(quote.lastPrice, { currency: quote.currency, hint: quote.priceHint }) : "—"}
                    </span>
                    <span
                      className={cn(
                        "block font-mono text-xs tabular-nums",
                        move ? (up ? "text-up" : "text-down") : "text-subtle",
                      )}
                    >
                      {move ? formatPct(move.pct) : isLoading ? "…" : "—"}
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  aria-label={`Remove ${item}`}
                  onClick={() => removeFromWatchlist(item)}
                  className="absolute top-1/2 right-1 flex size-11 -translate-y-1/2 items-center justify-center rounded text-muted hover:text-down lg:hidden lg:size-7 lg:group-hover:flex"
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

function WatchlistRangePicker() {
  const span = useTerminalStore((s) => s.span);
  const setSpan = useTerminalStore((s) => s.setSpan);
  const active = span ?? "1D";

  return (
    <div className="flex overflow-x-auto border-b border-border px-1 py-1">
      {SPANS.map((item) => {
        const on = active === item.id;
        return (
          <button
            key={item.id}
            type="button"
            title={item.title}
            onClick={() => setSpan(item.id)}
            className={cn(
              "min-h-10 shrink-0 rounded-md px-2.5 text-xs",
              on ? "bg-elevated font-medium text-fg" : "text-muted",
            )}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
