import { useMemo, useState } from "react";
import {
  Bell,
  Check,
  ChevronDown,
  MoreHorizontal,
  Plus,
  Search,
  Sun,
  Moon,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { INTERVALS } from "@/lib/market/types";
import { CHART_TYPES, INDICATOR_ITEMS } from "./chart-options";
import { formatPct, formatPrice } from "@/lib/market/format";
import { baseAsset } from "@/lib/market/symbols";
import { useTerminalStore } from "@/lib/store";
import { AccountSlot } from "./account-slot";
import { AlertsPanel } from "./alerts-panel";
import { CoinIcon } from "./coin-icon";
import { VenueSwitch } from "./venue-switch";
import { ChartTypeIcon, IndicatorsIcon } from "./tv-icons";

const INTERVAL_GROUPS: Array<{ label: string; ids: string[] }> = [
  { label: "Minutes", ids: ["1m", "5m", "15m"] },
  { label: "Hours", ids: ["1h", "4h"] },
  { label: "Days", ids: ["1d", "1w"] },
];

const INTERVAL_NAMES: Record<string, string> = {
  "1m": "1 minute",
  "5m": "5 minutes",
  "15m": "15 minutes",
  "1h": "1 hour",
  "4h": "4 hours",
  "1d": "1 day",
  "1w": "1 week",
};

function ToolbarDivider() {
  return <span aria-hidden className="mx-1 h-5 w-px shrink-0 bg-border" />;
}

const tbButton =
  "flex h-[30px] shrink-0 items-center gap-1.5 rounded-[4px] px-2 text-[14px] text-fg hover:bg-hover disabled:opacity-40";

function SymbolButton({ compact = false }: { compact?: boolean }) {
  const symbol = useTerminalStore((s) => s.symbol);
  const venue = useTerminalStore((s) => s.venue);
  const setSearchOpen = useTerminalStore((s) => s.setSearchOpen);
  const label = venue === "stocks" ? symbol : baseAsset(symbol);
  return (
    <button
      type="button"
      onClick={() => setSearchOpen(true)}
      aria-label={`Symbol search. Current symbol ${symbol}`}
      className={cn(
        tbButton,
        "rounded-full bg-[#2a2a2a] pr-1 pl-1.5 font-semibold text-strong hover:bg-[#363636]",
        compact && "min-w-0",
      )}
    >
      <CoinIcon symbol={symbol} size={compact ? 22 : 20} />
      <span className="truncate">{label}</span>
      {venue === "crypto" && !compact && (
        <span className="font-normal text-muted">{symbol.slice(label.length)}</span>
      )}
      <span className="ml-0.5 flex size-[22px] items-center justify-center rounded-full bg-bg text-fg">
        <Search className="size-3" />
      </span>
    </button>
  );
}

function IntervalMenu({ triggerClassName }: { triggerClassName?: string }) {
  const interval = useTerminalStore((s) => s.interval);
  const setInterval = useTerminalStore((s) => s.setInterval);
  const label = INTERVALS.find((i) => i.id === interval)?.label ?? interval;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className={cn(tbButton, triggerClassName)} aria-label="Interval">
          {label}
          <ChevronDown className="size-3 text-muted" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-48">
        {INTERVAL_GROUPS.map((group, gi) => (
          <div key={group.label}>
            {gi > 0 && <DropdownMenuSeparator />}
            <DropdownMenuLabel className="text-[11px] tracking-wide text-muted uppercase">
              {group.label}
            </DropdownMenuLabel>
            {group.ids.map((id) => (
              <DropdownMenuItem
                key={id}
                onSelect={() => setInterval(id as (typeof INTERVALS)[number]["id"])}
                className={cn("justify-between", interval === id && "text-accent")}
              >
                {INTERVAL_NAMES[id]}
                {interval === id && <Check className="size-4" />}
              </DropdownMenuItem>
            ))}
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function IntervalFavorites() {
  const interval = useTerminalStore((s) => s.interval);
  const setInterval = useTerminalStore((s) => s.setInterval);
  return (
    <div className="flex items-center">
      {INTERVALS.map((tf) => (
        <button
          key={tf.id}
          type="button"
          title={`${INTERVAL_NAMES[tf.id]} (${tf.key})`}
          onClick={() => setInterval(tf.id)}
          className={cn(tbButton, "px-1.5", interval === tf.id && "text-accent")}
        >
          {tf.label}
        </button>
      ))}
    </div>
  );
}

function ChartTypeMenu() {
  const chartType = useTerminalStore((s) => s.chartType);
  const setChartType = useTerminalStore((s) => s.setChartType);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(tbButton, "px-1.5")}
          aria-label={`Chart type: ${CHART_TYPES.find((c) => c.id === chartType)?.label}`}
        >
          <ChartTypeIcon type={chartType} className="size-[22px]" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-52">
        {CHART_TYPES.map((ct) => (
          <DropdownMenuItem
            key={ct.id}
            onSelect={() => setChartType(ct.id)}
            className={cn("gap-3", chartType === ct.id && "text-accent")}
          >
            <ChartTypeIcon type={ct.id} className="size-[22px]" />
            {ct.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function IndicatorsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const indicators = useTerminalStore((s) => s.indicators);
  const toggleIndicator = useTerminalStore((s) => s.toggleIndicator);
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return INDICATOR_ITEMS.filter(
      (item) =>
        !needle ||
        item.label.toLowerCase().includes(needle) ||
        item.short.toLowerCase().includes(needle),
    );
  }, [q]);
  const groups = ["Moving averages", "Bands & volume", "Oscillators"] as const;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="top-0 h-dvh max-h-none w-full max-w-none translate-x-[-50%] rounded-none border-0 p-0 md:top-[10vh] md:h-[min(560px,80dvh)] md:w-[min(100%-2rem,560px)] md:rounded-lg md:border">
        <div className="border-b border-border px-5 pt-4 pb-3">
          <DialogTitle className="text-[20px] font-semibold text-strong">Indicators</DialogTitle>
          <DialogDescription className="sr-only">Add or remove chart indicators</DialogDescription>
          <label className="mt-3 flex h-9 items-center gap-2 rounded-md border border-border px-3 focus-within:border-accent">
            <Search className="size-4 text-muted" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search"
              className="min-w-0 flex-1 bg-transparent text-[14px] text-fg outline-none placeholder:text-muted"
            />
          </label>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto py-2">
          {groups.map((group) => {
            const items = filtered.filter((i) => i.group === group);
            if (!items.length) return null;
            return (
              <div key={group} className="pb-2">
                <p className="px-5 py-1.5 text-[11px] font-medium tracking-wide text-muted uppercase">
                  {group}
                </p>
                {items.map((item) => {
                  const on = indicators[item.key];
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => toggleIndicator(item.key)}
                      className="flex min-h-11 w-full items-center gap-3 px-5 text-left text-[14px] text-fg hover:bg-hover md:min-h-9"
                    >
                      <span className="flex-1">{item.label}</span>
                      {on ? (
                        <Check className="size-4 text-accent" />
                      ) : (
                        <Plus className="size-4 text-muted" />
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
          {!filtered.length && <p className="px-5 py-8 text-center text-sm text-muted">No matches</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function IndicatorsButton({ compact = false }: { compact?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(tbButton, compact && "px-1.5")}
        aria-label="Indicators"
      >
        <IndicatorsIcon className="size-[22px]" />
        {!compact && <span>Indicators</span>}
      </button>
      <IndicatorsDialog open={open} onOpenChange={setOpen} />
    </>
  );
}

function AlertButton({ compact = false }: { compact?: boolean }) {
  const alertCount = useTerminalStore((s) => s.alerts.filter((a) => !a.triggeredAt).length);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className={cn(tbButton, "relative", compact && "px-1.5")} aria-label="Alerts">
          <Bell className="size-[18px]" />
          {!compact && <span>Alert</span>}
          {alertCount > 0 && (
            <span className="absolute top-0.5 left-5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-accent px-1 text-[9px] font-semibold text-white">
              {alertCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(20rem,calc(100vw-1rem))]">
        <AlertsPanel />
      </PopoverContent>
    </Popover>
  );
}

/** Desktop/tablet top toolbar, TradingView layout. */
export function ChartToolbar() {
  const setSearchOpen = useTerminalStore((s) => s.setSearchOpen);
  return (
    <div className="flex h-[38px] min-w-0 shrink-0 items-center bg-bg px-1.5">
      <SymbolButton />
      <ToolbarDivider />
      <div className="hidden xl:flex">
        <IntervalFavorites />
      </div>
      <div className="xl:hidden">
        <IntervalMenu />
      </div>
      <ToolbarDivider />
      <ChartTypeMenu />
      <ToolbarDivider />
      <IndicatorsButton />
      <ToolbarDivider />
      <AlertButton />
      <div className="ml-auto flex items-center gap-1.5 pl-2">
        <VenueSwitch />
        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          className={cn(tbButton, "px-1.5")}
          aria-label="Search (Ctrl K)"
          title="Search (Ctrl K)"
        >
          <Search className="size-[18px]" />
        </button>
        <AccountSlot />
      </div>
    </div>
  );
}

/** Phone top toolbar. */
export function PhoneChartToolbar() {
  const setSearchOpen = useTerminalStore((s) => s.setSearchOpen);
  const venue = useTerminalStore((s) => s.venue);
  const setVenue = useTerminalStore((s) => s.setVenue);
  return (
    <div className="flex h-11 min-w-0 shrink-0 items-center gap-0.5 border-b border-border bg-bg px-1">
      <SymbolButton compact />
      <ToolbarDivider />
      <IntervalMenu triggerClassName="h-9 px-2" />
      <ChartTypeMenu />
      <IndicatorsButton compact />
      <div className="ml-auto flex items-center">
        <AlertButton compact />
        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          className={cn(tbButton, "h-9 px-2")}
          aria-label="Search"
        >
          <Search className="size-[18px]" />
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className={cn(tbButton, "h-9 px-2")} aria-label="More">
              <MoreHorizontal className="size-5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-48">
            <DropdownMenuLabel className="text-[11px] tracking-wide text-muted uppercase">
              Market
            </DropdownMenuLabel>
            {(["crypto", "stocks"] as const).map((id) => (
              <DropdownMenuItem
                key={id}
                onSelect={() => setVenue(id)}
                className={cn("justify-between", venue === id && "text-accent")}
              >
                {id === "crypto" ? "Crypto" : "Stocks"}
                {venue === id && <Check className="size-4" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

/** Headline price with pre/post-market line (phone chart screen). */
export function QuoteStrip() {
  const symbol = useTerminalStore((s) => s.symbol);
  const quote = useTerminalStore((s) => s.quotes[s.symbol]);
  const venue = useTerminalStore((s) => s.venue);
  if (!quote) return <div className="h-8 shrink-0 border-b border-border bg-bg" />;
  const opts = { currency: quote.currency, hint: quote.priceHint };
  const up = quote.priceChange >= 0;
  const state = quote.marketState;
  const stateLabel =
    venue === "crypto"
      ? "24h"
      : state === "regular"
        ? "Market open"
        : state === "pre" || state === "post" || state === "closed"
          ? "At close"
          : "";
  return (
    <div
      className="flex h-8 shrink-0 items-center gap-2 overflow-x-auto border-b border-border bg-bg px-3 text-[13px] whitespace-nowrap tabular-nums"
      aria-label={`${symbol} price`}
    >
      <span className="font-semibold text-strong">{formatPrice(quote.lastPrice, opts)}</span>
      <span className={up ? "text-up" : "text-down"}>
        {up ? "+" : "−"}
        {formatPrice(Math.abs(quote.priceChange), opts)} ({formatPct(quote.priceChangePercent)})
      </span>
      {stateLabel && <span className="text-muted">{stateLabel}</span>}
      {quote.extSession && quote.extPrice ? <ExtendedQuote quote={quote} /> : null}
    </div>
  );
}

export function ExtendedQuote({
  quote,
  className,
}: {
  quote: { extSession?: "pre" | "post"; extPrice?: number; extChange?: number; extChangePercent?: number; currency?: string; priceHint?: number };
  className?: string;
}) {
  if (!quote.extSession || !quote.extPrice) return null;
  const up = (quote.extChange ?? 0) >= 0;
  const Icon = quote.extSession === "pre" ? Sun : Moon;
  const opts = { currency: quote.currency, hint: quote.priceHint };
  return (
    <span className={cn("flex items-center gap-1.5", className)}>
      <Icon
        className={cn("size-3.5", quote.extSession === "pre" ? "text-warn" : "text-accent")}
        aria-label={quote.extSession === "pre" ? "Pre-market" : "Post-market"}
      />
      <span className="text-muted">{quote.extSession === "pre" ? "Pre" : "Post"}</span>
      <span className="text-fg">{formatPrice(quote.extPrice, opts)}</span>
      <span className={up ? "text-up" : "text-down"}>{formatPct(quote.extChangePercent ?? 0)}</span>
    </span>
  );
}
