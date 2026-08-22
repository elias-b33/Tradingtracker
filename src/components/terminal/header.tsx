import {
  Bell,
  ChartArea,
  ChartCandlestick,
  ChartLine,
  ChevronDown,
  Eraser,
  Minus,
  MousePointer2,
  Search,
  SlidersHorizontal,
  StickyNote,
  TrendingUp,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { INTERVALS, SPANS, type ChartType, type DrawingTool, type IndicatorsState } from "@/lib/market/types";
import { formatPct } from "@/lib/market/format";
import { pairLabel, assetName } from "@/lib/market/symbols";
import { exchangeLabel, sessionLabel, sourceLabel } from "@/lib/market/venue";
import { useTerminalStore } from "@/lib/store";
import { useLayoutMode } from "@/hooks/use-is-desktop";
import { useSpanReturns } from "@/hooks/use-span-returns";
import { LivePrice } from "./live-price";
import { Logo } from "./logo";
import { CoinIcon } from "./coin-icon";
import { VenueSwitch } from "./venue-switch";
import { AccountSlot } from "./account-slot";
import { AlertsPanel } from "./alerts-panel";
import { NotesPanel } from "./notes-panel";

const INDICATOR_ITEMS: Array<{ key: keyof IndicatorsState; label: string; group: string }> = [
  { key: "sma20", label: "SMA 20", group: "Overlay" },
  { key: "sma50", label: "SMA 50", group: "Overlay" },
  { key: "sma200", label: "SMA 200", group: "Overlay" },
  { key: "ema12", label: "EMA 12", group: "Overlay" },
  { key: "ema26", label: "EMA 26", group: "Overlay" },
  { key: "bb", label: "Bollinger Bands", group: "Overlay" },
  { key: "vwap", label: "VWAP", group: "Overlay" },
  { key: "volume", label: "Volume", group: "Pane" },
  { key: "rsi", label: "RSI 14", group: "Pane" },
  { key: "macd", label: "MACD", group: "Pane" },
];

const CHART_TYPES: Array<{ id: ChartType; label: string; icon: typeof ChartCandlestick }> = [
  { id: "candles", label: "Candles", icon: ChartCandlestick },
  { id: "line", label: "Line", icon: ChartLine },
  { id: "area", label: "Area", icon: ChartArea },
];

const DRAW_TOOLS: Array<{ id: DrawingTool; label: string; icon: typeof Minus }> = [
  { id: "cursor", label: "Cursor", icon: MousePointer2 },
  { id: "hline", label: "Price line", icon: Minus },
  { id: "trend", label: "Trend line", icon: TrendingUp },
  { id: "fib", label: "Fib retrace", icon: ChartLine },
];

export function Header() {
  const layout = useLayoutMode();
  const symbol = useTerminalStore((s) => s.symbol);
  const venue = useTerminalStore((s) => s.venue);
  const quote = useTerminalStore((s) => s.quotes[s.symbol]);
  const setSearchOpen = useTerminalStore((s) => s.setSearchOpen);
  const mobileTab = useTerminalStore((s) => s.mobileTab);
  const phone = layout !== "tablet" && layout !== "desktop";
  const desktop = layout === "desktop";
  const onChart = !phone || mobileTab === "chart";

  if (phone && (mobileTab === "watch" || mobileTab === "more")) {
    return <header className="desk-header bg-bg" />;
  }

  return (
    <header className="desk-header flex flex-col border-b border-border bg-bg">
      <div className="flex items-center gap-3 px-3 py-2">
        <Logo className="hidden items-center gap-2 text-sm text-fg sm:flex" />
        <VenueSwitch className={phone ? undefined : "hidden md:flex"} />
        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          className="flex min-h-11 items-center gap-2 rounded-md px-2 hover:bg-elevated md:min-h-8"
        >
          <CoinIcon symbol={symbol} size={28} />
          <span className="text-left">
            <span className="block font-medium leading-none">{pairLabel(symbol)}</span>
            <span className="mt-0.5 block max-w-[42vw] truncate text-xs text-muted sm:max-w-none">
              {(phone
                ? [exchangeLabel(quote?.exchange), sourceLabel(quote?.source, venue)]
                : [
                    assetName(symbol),
                    exchangeLabel(quote?.exchange),
                    sourceLabel(quote?.source, venue),
                    quote?.source !== "binance" ? sessionLabel(quote?.marketState) : null,
                  ]
              )
                .filter(Boolean)
                .join(" · ")}
            </span>
          </span>
          <ChevronDown className="size-3.5 text-muted" />
        </button>
        <LivePrice symbol={symbol} />
        <div className="ml-auto hidden md:block">
          <AccountSlot />
        </div>
      </div>

      {onChart && (
        <div className="flex min-w-0 items-stretch gap-1 border-t border-border">
          <SpanStrip />
          <div className="flex shrink-0 items-center border-l border-border px-1">
            {desktop ? <DesktopTools /> : <ChartToolsSheet />}
          </div>
        </div>
      )}
    </header>
  );
}

function SpanStrip() {
  const symbol = useTerminalStore((s) => s.symbol);
  const span = useTerminalStore((s) => s.span);
  const setSpan = useTerminalStore((s) => s.setSpan);
  const { returns } = useSpanReturns(symbol);
  const active = span ?? "1D";

  return (
    <div className="flex min-w-0 flex-1 items-stretch overflow-x-auto px-1 py-1">
      {SPANS.map((item) => {
        const move = returns[item.id];
        const on = active === item.id;
        const up = (move?.pct ?? 0) >= 0;
        return (
          <button
            key={item.id}
            type="button"
            title={item.title}
            aria-label={`${item.title}${move ? ` ${formatPct(move.pct)}` : ""}`}
            onClick={() => setSpan(item.id)}
            className={cn(
              "flex min-h-12 min-w-[4.25rem] flex-col items-center justify-center rounded-md px-2.5 py-1",
              on ? "bg-elevated" : "hover:bg-elevated/60",
            )}
          >
            <span className={cn("text-[10px] font-medium tracking-wide uppercase", on ? "text-fg" : "text-muted")}>
              {item.label}
            </span>
            <span
              className={cn(
                "font-mono text-sm font-semibold tabular-nums",
                move ? (up ? "text-up" : "text-down") : "text-subtle",
              )}
            >
              {move ? formatPct(move.pct) : "—"}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function DesktopTools() {
  const interval = useTerminalStore((s) => s.interval);
  const setInterval = useTerminalStore((s) => s.setInterval);
  const chartType = useTerminalStore((s) => s.chartType);
  const setChartType = useTerminalStore((s) => s.setChartType);
  const indicators = useTerminalStore((s) => s.indicators);
  const toggleIndicator = useTerminalStore((s) => s.toggleIndicator);
  const drawingTool = useTerminalStore((s) => s.drawingTool);
  const setDrawingTool = useTerminalStore((s) => s.setDrawingTool);
  const clearDrawings = useTerminalStore((s) => s.clearDrawings);
  const setSearchOpen = useTerminalStore((s) => s.setSearchOpen);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="xs" title="Candle size">
            {INTERVALS.find((tf) => tf.id === interval)?.label ?? interval}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Candle size</DropdownMenuLabel>
          {INTERVALS.map((tf) => (
            <DropdownMenuCheckboxItem
              key={tf.id}
              checked={interval === tf.id}
              onCheckedChange={() => setInterval(tf.id)}
            >
              {tf.label}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <div className="flex items-center rounded-md bg-bg p-0.5">
        {CHART_TYPES.map((ct) => (
          <Button
            key={ct.id}
            variant="ghost"
            size="icon-xs"
            aria-label={ct.label}
            onClick={() => setChartType(ct.id)}
            className={cn(chartType === ct.id && "bg-elevated text-fg")}
          >
            <ct.icon className="size-3.5" />
          </Button>
        ))}
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="xs">
            Indicators
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Overlays</DropdownMenuLabel>
          {INDICATOR_ITEMS.filter((i) => i.group === "Overlay").map((item) => (
            <DropdownMenuCheckboxItem
              key={item.key}
              checked={indicators[item.key]}
              onCheckedChange={() => toggleIndicator(item.key)}
            >
              {item.label}
            </DropdownMenuCheckboxItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuLabel>Panes</DropdownMenuLabel>
          {INDICATOR_ITEMS.filter((i) => i.group === "Pane").map((item) => (
            <DropdownMenuCheckboxItem
              key={item.key}
              checked={indicators[item.key]}
              onCheckedChange={() => toggleIndicator(item.key)}
            >
              {item.label}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <div className="flex items-center">
        {DRAW_TOOLS.map((tool) => (
          <Button
            key={tool.id}
            variant="ghost"
            size="icon-xs"
            aria-label={tool.label}
            onClick={() => setDrawingTool(tool.id)}
            className={cn(drawingTool === tool.id && "bg-elevated text-accent")}
          >
            <tool.icon className="size-3.5" />
          </Button>
        ))}
        <Button variant="ghost" size="icon-xs" aria-label="Clear drawings" onClick={clearDrawings}>
          <Eraser className="size-3.5" />
        </Button>
      </div>
      <AlertNoteButtons />
      <Button variant="ghost" size="icon-xs" onClick={() => setSearchOpen(true)} aria-label="Search">
        <Search className="size-3.5" />
      </Button>
    </>
  );
}

function ChartToolsSheet() {
  const interval = useTerminalStore((s) => s.interval);
  const setInterval = useTerminalStore((s) => s.setInterval);
  const chartType = useTerminalStore((s) => s.chartType);
  const setChartType = useTerminalStore((s) => s.setChartType);
  const indicators = useTerminalStore((s) => s.indicators);
  const toggleIndicator = useTerminalStore((s) => s.toggleIndicator);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="xs" className="min-h-11 md:min-h-8">
          <SlidersHorizontal className="size-3.5" />
          Tools
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[min(36rem,85dvh)] overflow-y-auto">
        <DialogTitle>Chart tools</DialogTitle>
        <DialogDescription>Candle size, type, overlays, alerts.</DialogDescription>
        <p className="mt-3 text-xs font-medium tracking-wide text-muted uppercase">Candles</p>
        <div className="mt-1 flex flex-wrap gap-1">
          {INTERVALS.map((tf) => (
            <button
              key={tf.id}
              type="button"
              onClick={() => setInterval(tf.id)}
              className={cn(
                "min-h-11 rounded-md px-3 font-mono text-xs",
                interval === tf.id ? "bg-elevated text-fg" : "bg-bg text-muted",
              )}
            >
              {tf.label}
            </button>
          ))}
        </div>
        <p className="mt-4 text-xs font-medium tracking-wide text-muted uppercase">Type</p>
        <div className="mt-1 flex gap-1">
          {CHART_TYPES.map((ct) => (
            <button
              key={ct.id}
              type="button"
              onClick={() => setChartType(ct.id)}
              className={cn(
                "flex min-h-11 items-center gap-2 rounded-md px-3 text-xs",
                chartType === ct.id ? "bg-elevated text-fg" : "bg-bg text-muted",
              )}
            >
              <ct.icon className="size-3.5" />
              {ct.label}
            </button>
          ))}
        </div>
        <p className="mt-4 text-xs font-medium tracking-wide text-muted uppercase">Overlays</p>
        <div className="mt-1 grid grid-cols-2 gap-1">
          {INDICATOR_ITEMS.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => toggleIndicator(item.key)}
              className={cn(
                "min-h-11 rounded-md px-3 text-left text-xs",
                indicators[item.key] ? "bg-elevated text-accent" : "bg-bg text-muted",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="mt-4 space-y-4">
          <AlertsPanel />
          <NotesPanel />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AlertNoteButtons() {
  const alertCount = useTerminalStore((s) => s.alerts.filter((a) => !a.triggeredAt).length);
  return (
    <>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon-xs" aria-label="Alerts" className="relative">
            <Bell className="size-3.5" />
            {alertCount > 0 && (
              <Badge variant="accent" className="absolute -top-1 -right-1 h-4 min-w-4 px-1">
                {alertCount}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-80">
          <AlertsPanel />
        </PopoverContent>
      </Popover>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon-xs" aria-label="Notes">
            <StickyNote className="size-3.5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-80">
          <NotesPanel />
        </PopoverContent>
      </Popover>
    </>
  );
}
