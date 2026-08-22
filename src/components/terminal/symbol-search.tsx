import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { searchSymbols } from "@/lib/market/binance";
import { searchStocks } from "@/lib/market/stocks";
import { formatPct, formatPrice } from "@/lib/market/format";
import { assetName, LIQUID_UNIVERSE, pairLabel } from "@/lib/market/symbols";
import { STOCK_FEATURED } from "@/lib/market/venue";
import { cn } from "@/lib/utils";
import { useTerminalStore } from "@/lib/store";
import { CoinIcon } from "./coin-icon";

export function SymbolSearch() {
  const open = useTerminalStore((s) => s.searchOpen);
  const setOpen = useTerminalStore((s) => s.setSearchOpen);
  const setSymbol = useTerminalStore((s) => s.setSymbol);
  const venue = useTerminalStore((s) => s.venue);
  const quotes = useTerminalStore((s) => s.quotes);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);

  const query = useQuery({
    queryKey: ["symbols", venue, q],
    queryFn: () =>
      venue === "stocks"
        ? searchStocks({ data: { q } })
        : searchSymbols({ data: { q } }),
    enabled: open && q.trim().length > 0,
    staleTime: 60_000,
  });

  const featured = useMemo(
    () =>
      venue === "stocks"
        ? STOCK_FEATURED.map((symbol) => ({
            symbol,
            base: assetName(symbol),
            quote: "USD",
            status: "TRADING",
          }))
        : LIQUID_UNIVERSE.map((symbol) => ({
            symbol,
            base: symbol.replace(/USDT$/, ""),
            quote: "USDT",
            status: "TRADING",
          })),
    [venue],
  );

  const symbols =
    q.trim().length === 0
      ? featured
      : query.data?.ok
        ? query.data.symbols
        : featured.filter((s) => s.symbol.includes(q.trim().toUpperCase().replace("/", "")));

  useEffect(() => {
    if (open) {
      setQ("");
      setActive(0);
    }
  }, [open]);

  useEffect(() => {
    setActive(0);
  }, [q]);

  function pick(symbol: string) {
    setSymbol(symbol);
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogTitle className="sr-only">Search markets</DialogTitle>
        <DialogDescription className="sr-only">
          {venue === "stocks" ? "Search stocks and ETFs." : "Search Bitcoin and crypto pairs."}
        </DialogDescription>
        <label className="flex items-center gap-2 border-b border-border py-1 pr-12 pl-4">
          <Search className="size-4 shrink-0 text-muted" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={venue === "stocks" ? "Search AAPL, NVDA, Volvo…" : "Search BTC, ETH, SOL…"}
            className="h-12 w-full min-w-0 bg-transparent text-base text-fg outline-none placeholder:text-muted"
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((i) => Math.min(i + 1, symbols.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((i) => Math.max(i - 1, 0));
              } else if (e.key === "Enter" && symbols[active]) {
                e.preventDefault();
                pick(symbols[active].symbol);
              }
            }}
          />
        </label>
        <ScrollArea className="h-80">
          <ul className="py-1">
            {query.isFetching && q.trim().length > 0 && symbols.length === 0 && (
              <li className="px-4 py-6 text-center text-sm text-muted">Searching markets…</li>
            )}
            {query.data && !query.data.ok && q.trim().length > 0 && (
              <li className="px-4 py-6 text-center text-sm text-down">{query.data.error}</li>
            )}
            {q.trim().length > 0 && !query.isFetching && symbols.length === 0 && (
              <li className="px-4 py-6 text-center text-sm text-muted">
                {venue === "stocks" ? "No symbols match that search." : "No pairs match that search."}
              </li>
            )}
            {symbols.map((item, i) => {
              const quote = quotes[item.symbol];
              const up = (quote?.priceChangePercent ?? 0) >= 0;
              return (
                <li key={item.symbol}>
                  <button
                    type="button"
                    onMouseEnter={() => setActive(i)}
                    onClick={() => pick(item.symbol)}
                    className={cn(
                      "flex min-h-14 w-full items-center justify-between px-4 py-2.5 text-left",
                      i === active && "bg-elevated",
                    )}
                  >
                    <span className="flex min-w-0 items-center gap-3 pr-3">
                      <CoinIcon symbol={item.symbol} size={32} />
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-fg">{pairLabel(item.symbol)}</span>
                        <span className="block truncate text-xs text-muted">
                          {venue === "stocks"
                            ? [item.base, item.quote].filter(Boolean).join(" · ")
                            : assetName(item.symbol)}
                        </span>
                      </span>
                    </span>
                    {quote && (
                      <span className="shrink-0 text-right font-mono text-sm tabular-nums tracking-tight">
                        <span className="block text-fg">
                          {formatPrice(quote.lastPrice, { currency: quote.currency, hint: quote.priceHint })}
                        </span>
                        <span className={up ? "text-up" : "text-down"}>
                          {formatPct(quote.priceChangePercent)}
                        </span>
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
