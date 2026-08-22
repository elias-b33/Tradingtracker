import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Clock3, Globe2, LoaderCircle, Search } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { searchSymbols } from "@/lib/market/binance";
import { getStockProfiles, searchStocks } from "@/lib/market/stocks";
import { formatPct, formatPrice } from "@/lib/market/format";
import { assetName, LIQUID_UNIVERSE, pairLabel } from "@/lib/market/symbols";
import type { Quote, SymbolInfo, VenueId } from "@/lib/market/types";
import { cn } from "@/lib/utils";
import { useTerminalStore } from "@/lib/store";
import { CoinIcon } from "./coin-icon";
import {
  STOCK_DISCOVERY_SECTIONS,
  dedupeStockItems,
  filterStockItems,
  kindLabel,
  matchesStockQuery,
  parseRecentStocks,
  stockDiscoveryItem,
  type DiscoverySection,
  type StockDiscoveryItem,
  type StockKindFilter,
  type StockRegionFilter,
} from "./stock-discovery";

const RECENT_STOCKS_KEY = "aether.recent-stocks.v1";
const KIND_FILTERS: Array<{ id: StockKindFilter; label: string }> = [
  { id: "all", label: "All types" },
  { id: "stock", label: "Stocks" },
  { id: "etf", label: "ETFs" },
  { id: "index", label: "Indices" },
];
const REGION_FILTERS: Array<{ id: StockRegionFilter; label: string }> = [
  { id: "all", label: "All markets" },
  { id: "usa", label: "USA" },
  { id: "sweden", label: "Sweden" },
];

export function SymbolSearch() {
  const open = useTerminalStore((s) => s.searchOpen);
  const setOpen = useTerminalStore((s) => s.setSearchOpen);
  const setSymbol = useTerminalStore((s) => s.setSymbol);
  const venue = useTerminalStore((s) => s.venue);
  const setVenue = useTerminalStore((s) => s.setVenue);
  const quotes = useTerminalStore((s) => s.quotes);
  const [q, setQ] = useState("");
  const [requestQ, setRequestQ] = useState("");
  const [active, setActive] = useState(0);
  const [kindFilter, setKindFilter] = useState<StockKindFilter>("all");
  const [regionFilter, setRegionFilter] = useState<StockRegionFilter>("all");
  const [recentStocks, setRecentStocks] = useState<StockDiscoveryItem[]>([]);
  const term = q.trim();

  useEffect(() => {
    const timer = window.setTimeout(() => setRequestQ(term), 220);
    return () => window.clearTimeout(timer);
  }, [term]);

  useEffect(() => {
    if (!open) return;
    setQ("");
    setRequestQ("");
    setActive(0);
    setKindFilter("all");
    setRegionFilter("all");
    setRecentStocks(parseRecentStocks(window.localStorage.getItem(RECENT_STOCKS_KEY)));
  }, [open]);

  useEffect(() => {
    setQ("");
    setRequestQ("");
    setActive(0);
  }, [venue]);

  const query = useQuery({
    queryKey: ["symbols", venue, requestQ],
    queryFn: () =>
      venue === "stocks"
        ? searchStocks({ data: { q: requestQ } })
        : searchSymbols({ data: { q: requestQ } }),
    enabled: open && requestQ.length > 0,
    staleTime: 60_000,
  });

  const stockSections = useMemo(() => {
    if (venue !== "stocks") return [];
    const matching =
      requestQ === term && query.data?.ok
        ? query.data.symbols.map(stockDiscoveryItem)
        : STOCK_DISCOVERY_SECTIONS.flatMap((section) => section.items).filter((item) =>
            matchesStockQuery(item, term),
          );

    if (term) {
      return [
        {
          id: "results",
          title: "Search results",
          description: "Companies, funds, and indices from global exchanges",
          items: filterStockItems(dedupeStockItems(matching), kindFilter, regionFilter),
        },
      ];
    }

    const sections: DiscoverySection[] = [];
    const recent = filterStockItems(recentStocks, kindFilter, regionFilter);
    if (recent.length) {
      sections.push({ id: "recent", title: "Recent searches", description: "Continue where you left off", items: recent });
    }
    for (const section of STOCK_DISCOVERY_SECTIONS) {
      const items = filterStockItems(section.items, kindFilter, regionFilter);
      if (items.length) sections.push({ ...section, items });
    }
    return sections;
  }, [kindFilter, query.data, recentStocks, regionFilter, requestQ, term, venue]);

  const stockItems = useMemo(
    () => dedupeStockItems(stockSections.flatMap((section) => section.items)),
    [stockSections],
  );
  const profileSymbols = useMemo(
    () => (venue === "stocks" && term.length === 0 ? stockItems.slice(0, 8).map((item) => item.symbol) : []),
    [stockItems, term.length, venue],
  );
  const profiles = useQuery({
    queryKey: ["stock-profiles", profileSymbols.join(",")],
    queryFn: () => getStockProfiles({ data: { symbols: profileSymbols } }),
    enabled: open && profileSymbols.length > 0,
    staleTime: 12 * 60 * 60 * 1000,
  });
  const stockLogos = useMemo(
    () =>
      profiles.data?.ok
        ? Object.fromEntries(profiles.data.profiles.flatMap((profile) =>
            profile.logoUrl ? [[profile.symbol, profile.logoUrl]] : [],
          ))
        : {},
    [profiles.data],
  );
  const cryptoFeatured = useMemo<SymbolInfo[]>(
    () =>
      LIQUID_UNIVERSE.map((symbol) => ({
        symbol,
        base: symbol.replace(/USDT$/, ""),
        quote: "USDT",
        status: "TRADING",
      })),
    [],
  );
  const cryptoItems =
    term.length === 0
      ? cryptoFeatured
      : requestQ === term && query.data?.ok
        ? query.data.symbols
        : cryptoFeatured.filter((item) =>
            [item.symbol, assetName(item.symbol)].join(" ").toLowerCase().includes(term.toLowerCase()),
          );
  const keyboardItems = venue === "stocks" ? stockItems : cryptoItems;
  const searchPending = term.length > 0 && (requestQ !== term || query.isFetching);
  const activeItem = keyboardItems[active];

  useEffect(() => setActive(0), [q, kindFilter, regionFilter, venue]);

  useEffect(() => {
    if (!activeItem) return;
    document.getElementById(optionId(activeItem.symbol))?.scrollIntoView({ block: "nearest" });
  }, [activeItem]);

  function rememberStock(item: StockDiscoveryItem) {
    const next = dedupeStockItems([item, ...recentStocks]).slice(0, 8);
    setRecentStocks(next);
    window.localStorage.setItem(RECENT_STOCKS_KEY, JSON.stringify(next));
  }

  function clearRecent() {
    setRecentStocks([]);
    window.localStorage.removeItem(RECENT_STOCKS_KEY);
  }

  function pickStock(item: StockDiscoveryItem) {
    setSymbol(item.symbol);
    rememberStock(item);
    setOpen(false);
  }

  function pickCrypto(symbol: string) {
    setSymbol(symbol);
    setOpen(false);
  }

  function chooseActive() {
    if (!activeItem) return;
    if (venue === "stocks") pickStock(activeItem as StockDiscoveryItem);
    else pickCrypto(activeItem.symbol);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="top-[3dvh] max-h-[94dvh] gap-0 overflow-hidden p-0 sm:top-[6dvh] sm:max-w-2xl">
        <DialogTitle className="sr-only">Find a market</DialogTitle>
        <DialogDescription className="sr-only">
          Search global stocks, ETFs, indices, or cryptocurrency pairs. Use arrow keys to move and Enter to select.
        </DialogDescription>

        <div className="border-b border-border px-4 pt-3 pr-12">
          <div className="flex w-fit rounded-lg bg-bg p-1" aria-label="Market type">
            {(["stocks", "crypto"] as VenueId[]).map((id) => (
              <button
                key={id}
                type="button"
                aria-pressed={venue === id}
                onClick={() => setVenue(id)}
                className={cn(
                  "min-h-10 rounded-md px-4 text-sm font-medium",
                  venue === id ? "bg-elevated text-fg" : "text-muted hover:text-fg",
                )}
              >
                {id === "stocks" ? "Stocks" : "Crypto"}
              </button>
            ))}
          </div>
        </div>

        <label className="flex items-center gap-3 border-b border-border py-1 pr-4 pl-4">
          {searchPending ? (
            <LoaderCircle className="size-5 shrink-0 animate-spin text-accent" aria-hidden />
          ) : (
            <Search className="size-5 shrink-0 text-muted" aria-hidden />
          )}
          <span className="sr-only">Search markets</span>
          <input
            autoFocus
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder={
              venue === "stocks"
                ? "Search company or ticker — Apple, AAPL, Volvo…"
                : "Search Bitcoin, BTC, ETH, SOL…"
            }
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={keyboardItems.length > 0}
            aria-controls="market-search-results"
            aria-activedescendant={activeItem ? optionId(activeItem.symbol) : undefined}
            className="h-14 w-full min-w-0 bg-transparent text-base text-fg outline-none placeholder:text-muted"
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setActive((index) => Math.min(index + 1, keyboardItems.length - 1));
              } else if (event.key === "ArrowUp") {
                event.preventDefault();
                setActive((index) => Math.max(index - 1, 0));
              } else if (event.key === "Enter") {
                event.preventDefault();
                chooseActive();
              }
            }}
          />
          <kbd className="hidden shrink-0 rounded border border-border px-1.5 py-0.5 font-mono text-[10px] text-subtle sm:block">
            ↑↓ Enter
          </kbd>
        </label>

        {venue === "stocks" && (
          <div className="space-y-2 border-b border-border bg-bg/50 px-4 py-3">
            <FilterRow label="Type">
              {KIND_FILTERS.map((filter) => (
                <FilterButton key={filter.id} active={kindFilter === filter.id} onClick={() => setKindFilter(filter.id)}>
                  {filter.label}
                </FilterButton>
              ))}
            </FilterRow>
            <FilterRow label="Market">
              {REGION_FILTERS.map((filter) => (
                <FilterButton key={filter.id} active={regionFilter === filter.id} onClick={() => setRegionFilter(filter.id)}>
                  {filter.id === "all" && <Globe2 className="size-3.5" aria-hidden />}
                  {filter.label}
                </FilterButton>
              ))}
            </FilterRow>
          </div>
        )}

        <ScrollArea className="h-[min(31rem,58dvh)]">
          <div id="market-search-results" role="listbox" aria-label="Market search results" className="py-2">
            {query.data && !query.data.ok && term.length > 0 && requestQ === term && (
              <p role="status" className="mx-4 mb-2 rounded-md bg-down/10 px-3 py-2 text-sm text-down">
                Live search is unavailable. Showing matching popular markets.
              </p>
            )}

            {venue === "stocks" ? (
              <StockResults
                sections={stockSections}
                activeSymbol={activeItem?.symbol}
                logos={stockLogos}
                quotes={quotes}
                recentVisible={!term && recentStocks.length > 0}
                onClearRecent={clearRecent}
                onHover={(symbol) => setActive(stockItems.findIndex((item) => item.symbol === symbol))}
                onPick={pickStock}
              />
            ) : (
              <ul>
                {cryptoItems.map((item, index) => {
                  const quote = quotes[item.symbol];
                  const up = (quote?.priceChangePercent ?? 0) >= 0;
                  return (
                    <li key={item.symbol} role="none">
                      <button
                        id={optionId(item.symbol)}
                        role="option"
                        aria-selected={item.symbol === activeItem?.symbol}
                        type="button"
                        onMouseEnter={() => setActive(index)}
                        onClick={() => pickCrypto(item.symbol)}
                        className={cn(
                          "flex min-h-14 w-full items-center justify-between px-4 py-2.5 text-left",
                          item.symbol === activeItem?.symbol && "bg-elevated",
                        )}
                      >
                        <span className="flex min-w-0 items-center gap-3 pr-3">
                          <CoinIcon symbol={item.symbol} size={34} />
                          <span className="min-w-0">
                            <span className="block truncate font-medium text-fg">{pairLabel(item.symbol)}</span>
                            <span className="block truncate text-xs text-muted">{assetName(item.symbol)}</span>
                          </span>
                        </span>
                        {quote && (
                          <span className="shrink-0 text-right font-mono text-sm tabular-nums tracking-tight">
                            <span className="block text-fg">{formatPrice(quote.lastPrice)}</span>
                            <span className={up ? "text-up" : "text-down"}>{formatPct(quote.priceChangePercent)}</span>
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            {!searchPending && keyboardItems.length === 0 && (
              <div className="px-6 py-12 text-center">
                <Search className="mx-auto size-7 text-subtle" aria-hidden />
                <p className="mt-3 text-sm font-medium text-fg">No matching markets</p>
                <p className="mt-1 text-sm text-muted">Try a company name, ticker, or choose broader filters.</p>
                {venue === "stocks" && (kindFilter !== "all" || regionFilter !== "all") && (
                  <button
                    type="button"
                    onClick={() => {
                      setKindFilter("all");
                      setRegionFilter("all");
                    }}
                    className="mt-4 min-h-11 rounded-md bg-elevated px-4 text-sm text-accent"
                  >
                    Reset filters
                  </button>
                )}
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-2 text-xs text-subtle">
          <span>{venue === "stocks" ? "Global results · prices may be delayed" : "Crypto pairs via Binance"}</span>
          <span className="hidden sm:inline">Press / or Ctrl K anytime</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function FilterRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-12 shrink-0 text-[10px] font-medium tracking-wide text-subtle uppercase">{label}</span>
      <div className="flex min-w-0 gap-1 overflow-x-auto">{children}</div>
    </div>
  );
}

function FilterButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "flex min-h-9 shrink-0 items-center gap-1.5 rounded-md px-3 text-xs font-medium",
        active ? "bg-elevated text-fg" : "text-muted hover:bg-elevated/60 hover:text-fg",
      )}
    >
      {children}
    </button>
  );
}

function StockResults({
  sections,
  activeSymbol,
  logos,
  quotes,
  recentVisible,
  onClearRecent,
  onHover,
  onPick,
}: {
  sections: DiscoverySection[];
  activeSymbol?: string;
  logos: Record<string, string>;
  quotes: Record<string, Quote>;
  recentVisible: boolean;
  onClearRecent: () => void;
  onHover: (symbol: string) => void;
  onPick: (item: StockDiscoveryItem) => void;
}) {
  const seen = new Set<string>();
  return (
    <>
      {sections.map((section) => {
        const items = section.items.filter((item) => {
          if (seen.has(item.symbol)) return false;
          seen.add(item.symbol);
          return true;
        });
        if (!items.length) return null;
        return (
          <section key={section.id} aria-labelledby={`search-section-${section.id}`} className="pb-3">
            <div className="flex items-end justify-between gap-3 px-4 pt-2 pb-1.5">
              <div className="min-w-0">
                <h3 id={`search-section-${section.id}`} className="text-xs font-semibold text-fg">{section.title}</h3>
                <p className="truncate text-[11px] text-subtle">{section.description}</p>
              </div>
              {section.id === "recent" && recentVisible && (
                <button type="button" onClick={onClearRecent} className="min-h-8 shrink-0 px-2 text-xs text-muted hover:text-fg">
                  Clear
                </button>
              )}
            </div>
            <ul>
              {items.map((item) => (
                <StockResultRow
                  key={item.symbol}
                  item={item}
                  logoUrl={logos[item.symbol]}
                  quote={quotes[item.symbol]}
                  active={item.symbol === activeSymbol}
                  recent={section.id === "recent"}
                  onHover={() => onHover(item.symbol)}
                  onPick={() => onPick(item)}
                />
              ))}
            </ul>
          </section>
        );
      })}
    </>
  );
}

function StockResultRow({
  item,
  logoUrl,
  quote,
  active,
  recent,
  onHover,
  onPick,
}: {
  item: StockDiscoveryItem;
  logoUrl?: string;
  quote?: Quote;
  active: boolean;
  recent: boolean;
  onHover: () => void;
  onPick: () => void;
}) {
  const up = (quote?.priceChangePercent ?? 0) >= 0;
  return (
    <li role="none">
      <button
        id={optionId(item.symbol)}
        role="option"
        aria-selected={active}
        type="button"
        onMouseEnter={onHover}
        onFocus={onHover}
        onClick={onPick}
        className={cn(
          "grid min-h-[4.25rem] w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-2 text-left",
          active && "bg-elevated",
        )}
      >
        <span className="relative">
          <CoinIcon symbol={item.symbol} name={item.name} logoUrl={logoUrl} size={38} />
          {recent && (
            <span className="absolute -right-1 -bottom-1 flex size-4 items-center justify-center rounded-full bg-surface text-subtle">
              <Clock3 className="size-3" aria-hidden />
            </span>
          )}
        </span>
        <span className="min-w-0">
          <span className="flex min-w-0 items-baseline gap-2">
            <span className="shrink-0 font-mono text-sm font-semibold text-fg">{item.symbol}</span>
            <span className="truncate text-sm text-muted">{item.name}</span>
          </span>
          <span className="mt-1 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] text-subtle">
            <span className="rounded bg-bg px-1.5 py-0.5 font-medium text-muted">{kindLabel(item.kind)}</span>
            <span>{item.exchange}</span><span aria-hidden>·</span><span>{item.market}</span><span aria-hidden>·</span><span>{item.currency}</span>
          </span>
        </span>
        <span className="min-w-16 shrink-0 text-right font-mono text-xs tabular-nums">
          {quote ? (
            <>
              <span className="block text-fg">
                {formatPrice(quote.lastPrice, { currency: quote.currency ?? item.currency, hint: quote.priceHint })}
              </span>
              <span className={up ? "text-up" : "text-down"}>{formatPct(quote.priceChangePercent)}</span>
            </>
          ) : (
            <span className="font-sans text-[11px] text-subtle">Open chart</span>
          )}
        </span>
      </button>
    </li>
  );
}

function optionId(symbol: string): string {
  return `market-option-${symbol.replace(/[^a-z0-9]/gi, "-")}`;
}
