import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  Check,
  ChevronDown,
  Camera,
  Maximize,
  Menu,
  Minimize,
  Plus,
  Redo2,
  Search,
  Settings,
  Undo2,
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
import { useTerminalStore } from "@/lib/store";
import { AccountSlot } from "./account-slot";
import { AlertsPanel } from "./alerts-panel";
import { VenueSwitch } from "./venue-switch";
import { ChartSettingsDialog } from "./chart-settings";
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

/** TradingView symbol pill: full ticker plus a round search badge. */
function SymbolButton() {
  const symbol = useTerminalStore((s) => s.symbol);
  const setSearchOpen = useTerminalStore((s) => s.setSearchOpen);
  return (
    <button
      type="button"
      onClick={() => setSearchOpen(true)}
      aria-label={`Symbol search. Current symbol ${symbol}`}
      className="ml-1 flex h-[30px] min-w-32 shrink-0 items-center justify-between gap-2 rounded-full bg-[#2a2a2a] pr-1 pl-3 text-[14px] font-semibold text-strong hover:bg-[#363636]"
    >
      <span className="truncate">{symbol}</span>
      <span className="flex size-[22px] items-center justify-center rounded-full bg-bg text-fg">
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

function useFullscreen() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const sync = () => setOn(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);
  const toggle = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen?.().catch(() => {});
  };
  return { on, toggle };
}

function MainMenu({ onSettings }: { onSettings: () => void }) {
  const drawingRail = useTerminalStore((s) => s.drawingRail);
  const setDrawingRail = useTerminalStore((s) => s.setDrawingRail);
  const setBriefingOpen = useTerminalStore((s) => s.setBriefingOpen);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" aria-label="Main menu" className={cn(tbButton, "px-1.5")}>
          <Menu className="size-[22px]" strokeWidth={1.5} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-60">
        <DropdownMenuItem onSelect={() => setBriefingOpen(true)}>Catch up on moves</DropdownMenuItem>
        <DropdownMenuItem onSelect={onSettings}>Chart settings…</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => setDrawingRail(!drawingRail)} className="justify-between">
          Drawings toolbar
          {drawingRail && <Check className="size-4" />}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Desktop/tablet top toolbar, TradingView layout. */
export function ChartToolbar() {
  const setSearchOpen = useTerminalStore((s) => s.setSearchOpen);
  const undoDrawing = useTerminalStore((s) => s.undoDrawing);
  const redoDrawing = useTerminalStore((s) => s.redoDrawing);
  const canUndo = useTerminalStore((s) => (s.drawings[s.symbol] ?? []).length > 0);
  const canRedo = useTerminalStore((s) => (s.redoStack[s.symbol] ?? []).length > 0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const fullscreen = useFullscreen();
  return (
    <div className="flex h-[38px] min-w-0 shrink-0 items-center bg-bg px-1.5">
      <MainMenu onSettings={() => setSettingsOpen(true)} />
      <SymbolButton />
      <ToolbarDivider />
      <IntervalMenu />
      <ToolbarDivider />
      <ChartTypeMenu />
      <ToolbarDivider />
      <IndicatorsButton />
      <ToolbarDivider />
      <AlertButton />
      <ToolbarDivider />
      <button type="button" aria-label="Undo" title="Undo (Ctrl Z)" disabled={!canUndo} onClick={undoDrawing} className={cn(tbButton, "px-1.5")}>
        <Undo2 className="size-[18px]" strokeWidth={1.5} />
      </button>
      <button type="button" aria-label="Redo" title="Redo" disabled={!canRedo} onClick={redoDrawing} className={cn(tbButton, "px-1.5")}>
        <Redo2 className="size-[18px]" strokeWidth={1.5} />
      </button>
      <div className="ml-auto flex items-center gap-0.5 pl-2">
        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          className={cn(tbButton, "px-1.5")}
          aria-label="Search (Ctrl K)"
          title="Search (Ctrl K)"
        >
          <Search className="size-[18px]" strokeWidth={1.5} />
        </button>
        <button type="button" aria-label="Settings" title="Settings" onClick={() => setSettingsOpen(true)} className={cn(tbButton, "px-1.5")}>
          <Settings className="size-[18px]" strokeWidth={1.5} />
        </button>
        <button
          type="button"
          aria-label={fullscreen.on ? "Exit fullscreen" : "Fullscreen"}
          title="Fullscreen"
          onClick={fullscreen.toggle}
          className={cn(tbButton, "px-1.5")}
        >
          {fullscreen.on ? <Minimize className="size-[18px]" strokeWidth={1.5} /> : <Maximize className="size-[18px]" strokeWidth={1.5} />}
        </button>
        <button
          type="button"
          aria-label="Take a snapshot"
          title="Take a snapshot"
          onClick={() => window.dispatchEvent(new Event("aether:snapshot"))}
          className={cn(tbButton, "px-1.5")}
        >
          <Camera className="size-[18px]" strokeWidth={1.5} />
        </button>
        <span className="mx-1.5"><VenueSwitch /></span>
        <AccountSlot />
      </div>
      <ChartSettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  );
}
