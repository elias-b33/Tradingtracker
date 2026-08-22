import { cn } from "@/lib/utils";
import { formatPct, formatPrice } from "@/lib/market/format";
import { baseAsset } from "@/lib/market/symbols";
import { useTerminalStore } from "@/lib/store";
import { CoinIcon } from "./coin-icon";

export function TickerBar() {
  const watchlist = useTerminalStore((s) => s.watchlist);
  const quotes = useTerminalStore((s) => s.quotes);
  const symbol = useTerminalStore((s) => s.symbol);
  const setSymbol = useTerminalStore((s) => s.setSymbol);

  const movers = watchlist
    .map((s) => quotes[s])
    .filter(Boolean)
    .slice(0, 12);

  if (!movers.length) return null;

  return (
    <div className="flex h-8 items-stretch gap-px overflow-hidden border-b border-border bg-surface">
      {movers.map((q) => {
        const up = q.priceChangePercent >= 0;
        return (
          <button
            key={q.symbol}
            type="button"
            onClick={() => setSymbol(q.symbol)}
            className={cn(
              "flex min-w-0 flex-1 items-center justify-center gap-2 px-2 text-xs tabular-nums hover:bg-elevated",
              q.symbol === symbol && "bg-elevated",
            )}
          >
            <CoinIcon symbol={q.symbol} size={16} />
            <span className="font-medium text-fg">{baseAsset(q.symbol)}</span>
            <span className="hidden font-mono text-muted xl:inline">
              {formatPrice(q.lastPrice, { currency: q.currency, hint: q.priceHint })}
            </span>
            <span className={cn("font-mono", up ? "text-up" : "text-down")}>
              {formatPct(q.priceChangePercent)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
