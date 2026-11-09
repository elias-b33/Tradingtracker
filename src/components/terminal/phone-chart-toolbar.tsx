import { useEffect, useRef, useState } from "react";
import { Check, Maximize, Minimize, Redo2, Trash2, Undo2, X } from "lucide-react";
import type { SVGProps } from "react";
import { BottomSheet, SheetRow, SheetSection } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { INTERVALS, SPANS } from "@/lib/market/types";
import { baseAsset } from "@/lib/market/symbols";
import { useTerminalStore } from "@/lib/store";
import { AlertsPanel } from "./alerts-panel";
import { CHART_TYPES } from "./chart-options";
import { ChartSettingsDialog } from "./chart-settings";
import { IndicatorsDialog } from "./chart-toolbar";
import { ChartTypeIcon, CrosshairIcon, FibIcon, HorizontalLineIcon, TrendLineIcon } from "./tv-icons";

const INTERVAL_NAMES: Record<string, string> = {
  "1m": "1 minute",
  "5m": "5 minutes",
  "15m": "15 minutes",
  "1h": "1 hour",
  "4h": "4 hours",
  "1d": "1 day",
  "1w": "1 week",
};

/** iOS-style interval text: 5m, 1H, 4H, D, W. */
function intervalShort(id: string): string {
  const label = INTERVALS.find((i) => i.id === id)?.label ?? id;
  return label.endsWith("h") ? label.toUpperCase() : label;
}

function PencilIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth={1.4} aria-hidden {...props}>
      <path d="M17.5 5.5l3 3L10 19l-4 1 1-4z" strokeLinejoin="round" />
      <path d="M15.5 7.5l3 3" />
      <path d="M5 24c2-1.5 4-1.5 5.5 0s3.5 1.5 5 0" strokeLinecap="round" />
    </svg>
  );
}

function IndicatorsZigzag(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth={1.4} aria-hidden {...props}>
      <path d="M3 17l5-5 4 4 5-6 4 4 4-4" strokeLinejoin="round" strokeLinecap="round" />
      <path d="M3 22l5-5 4 4 5-6 4 4 4-4" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function MoreCircles(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth={1.4} aria-hidden {...props}>
      <circle cx="6.5" cy="14" r="2.5" />
      <circle cx="14" cy="14" r="2.5" />
      <circle cx="21.5" cy="14" r="2.5" />
    </svg>
  );
}

/** Ticker picker: tap opens search, vertical swipe steps through the watchlist. */
function TickerPicker() {
  const symbol = useTerminalStore((s) => s.symbol);
  const venue = useTerminalStore((s) => s.venue);
  const watchlist = useTerminalStore((s) => s.watchlist);
  const setSymbol = useTerminalStore((s) => s.setSymbol);
  const setSearchOpen = useTerminalStore((s) => s.setSearchOpen);
  const start = useRef<number | null>(null);
  const list = [...new Set(watchlist)];
  const idx = list.indexOf(symbol);
  const prev = idx > 0 ? list[idx - 1] : list[list.length - 1];
  const next = idx >= 0 && idx < list.length - 1 ? list[idx + 1] : list[0];
  const label = (s?: string) => (s ? (venue === "stocks" ? s : baseAsset(s)) : "");

  return (
    <button
      type="button"
      aria-label={`Symbol ${symbol}. Tap to search, swipe up or down to change`}
      onClick={() => setSearchOpen(true)}
      onTouchStart={(e) => {
        start.current = e.touches[0].clientY;
      }}
      onTouchEnd={(e) => {
        if (start.current === null || list.length < 2) return;
        const dy = e.changedTouches[0].clientY - start.current;
        start.current = null;
        if (Math.abs(dy) < 24) return;
        e.preventDefault();
        setSymbol(dy < 0 ? next : prev);
      }}
      className="relative flex h-full w-[5.5rem] shrink-0 flex-col items-start justify-center overflow-hidden pl-4 text-left"
    >
      {list.length > 1 && (
        <span className="absolute top-[3px] left-4 max-w-full truncate text-[13px] leading-none font-semibold text-[#3a3a3a]">
          {label(prev)}
        </span>
      )}
      <span className="max-w-full truncate text-[17px] leading-none font-semibold text-fg">{label(symbol)}</span>
      {list.length > 1 && (
        <span className="absolute bottom-[3px] left-4 max-w-full truncate text-[13px] leading-none font-semibold text-[#3a3a3a]">
          {label(next)}
        </span>
      )}
    </button>
  );
}

function useFullscreen() {
  const [on, setOn] = useState(false);
  const [supported, setSupported] = useState(false);
  useEffect(() => {
    setSupported(typeof document !== "undefined" && !!document.documentElement.requestFullscreen);
    const sync = () => setOn(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);
  const toggle = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen?.().catch(() => {});
  };
  return { on, supported, toggle };
}

const iconButton =
  "flex h-full shrink-0 items-center justify-center px-2.5 text-fg active:text-strong disabled:text-[#4a4a4a]";

/** TradingView app chart toolbar (above the tab bar). */
export function PhoneChartToolbar({
  drawing,
  onToggleDrawing,
}: {
  drawing: boolean;
  onToggleDrawing: () => void;
}) {
  const interval = useTerminalStore((s) => s.interval);
  const setInterval = useTerminalStore((s) => s.setInterval);
  const undoDrawing = useTerminalStore((s) => s.undoDrawing);
  const redoDrawing = useTerminalStore((s) => s.redoDrawing);
  const canUndo = useTerminalStore((s) => (s.drawings[s.symbol] ?? []).length > 0);
  const canRedo = useTerminalStore((s) => (s.redoStack[s.symbol] ?? []).length > 0);
  const [intervalOpen, setIntervalOpen] = useState(false);
  const [indicatorsOpen, setIndicatorsOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const fullscreen = useFullscreen();

  return (
    <div className="flex h-12 min-w-0 shrink-0 items-stretch border-t border-[#1f1f1f] bg-bg">
      <TickerPicker />
      <button
        type="button"
        aria-label={`Interval ${INTERVAL_NAMES[interval]}`}
        onClick={() => setIntervalOpen(true)}
        className="flex h-full w-14 shrink-0 items-center text-[17px] text-fg"
      >
        {intervalShort(interval)}
      </button>
      <div className="flex min-w-0 flex-1 items-stretch justify-end">
        <button
          type="button"
          aria-label="Drawing tools"
          aria-pressed={drawing}
          onClick={onToggleDrawing}
          className={cn(iconButton, drawing && "text-accent")}
        >
          <PencilIcon className="size-7" />
        </button>
        <button type="button" aria-label="Indicators" onClick={() => setIndicatorsOpen(true)} className={iconButton}>
          <IndicatorsZigzag className="size-7" />
        </button>
        <button type="button" aria-label="More" onClick={() => setMoreOpen(true)} className={iconButton}>
          <MoreCircles className="size-7" />
        </button>
        <span aria-hidden className="my-3 w-px shrink-0 bg-[#2a2a2a]" />
        <button type="button" aria-label="Undo" disabled={!canUndo} onClick={undoDrawing} className={iconButton}>
          <Undo2 className="size-[22px]" strokeWidth={1.4} />
        </button>
        <button type="button" aria-label="Redo" disabled={!canRedo} onClick={redoDrawing} className={iconButton}>
          <Redo2 className="size-[22px]" strokeWidth={1.4} />
        </button>
        {fullscreen.supported && (
          <button
            type="button"
            aria-label={fullscreen.on ? "Exit fullscreen" : "Fullscreen"}
            onClick={fullscreen.toggle}
            className={cn(iconButton, "pr-3")}
          >
            {fullscreen.on ? (
              <Minimize className="size-[22px]" strokeWidth={1.4} />
            ) : (
              <Maximize className="size-[22px]" strokeWidth={1.4} />
            )}
          </button>
        )}
      </div>

      <BottomSheet open={intervalOpen} onOpenChange={setIntervalOpen} title="Interval">
        <SheetSection title="Minutes">
          {(["1m", "5m", "15m"] as const).map((id) => (
            <IntervalRow key={id} id={id} active={interval === id} onPick={() => { setInterval(id); setIntervalOpen(false); }} />
          ))}
        </SheetSection>
        <SheetSection title="Hours">
          {(["1h", "4h"] as const).map((id) => (
            <IntervalRow key={id} id={id} active={interval === id} onPick={() => { setInterval(id); setIntervalOpen(false); }} />
          ))}
        </SheetSection>
        <SheetSection title="Days">
          {(["1d", "1w"] as const).map((id) => (
            <IntervalRow key={id} id={id} active={interval === id} onPick={() => { setInterval(id); setIntervalOpen(false); }} />
          ))}
        </SheetSection>
      </BottomSheet>

      <IndicatorsDialog open={indicatorsOpen} onOpenChange={setIndicatorsOpen} />
      <MoreSheet open={moreOpen} onOpenChange={setMoreOpen} />
    </div>
  );
}

function IntervalRow({ id, active, onPick }: { id: string; active: boolean; onPick: () => void }) {
  return (
    <SheetRow active={active} onClick={onPick}>
      <span className="flex-1">{INTERVAL_NAMES[id]}</span>
      {active && <Check className="size-5 text-accent" />}
    </SheetRow>
  );
}

function MoreSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const chartType = useTerminalStore((s) => s.chartType);
  const setChartType = useTerminalStore((s) => s.setChartType);
  const span = useTerminalStore((s) => s.span);
  const setSpan = useTerminalStore((s) => s.setSpan);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [alertsOpen, setAlertsOpen] = useState(false);

  return (
    <>
      <BottomSheet open={open} onOpenChange={onOpenChange} title="Chart">
        <SheetSection title="Date range">
          <div className="flex flex-wrap gap-1.5 px-4 pt-1">
            {SPANS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setSpan(item.id);
                  onOpenChange(false);
                }}
                className={cn(
                  "h-9 min-w-12 rounded-[10px] px-3 text-[15px] text-fg",
                  span === item.id ? "bg-[#3a3a3c] font-semibold text-strong" : "bg-[#2a2a2a]",
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
        </SheetSection>
        <SheetSection title="Chart type">
          <div className="grid grid-cols-3 gap-1.5 px-4 pt-1">
            {CHART_TYPES.map((ct) => (
              <button
                key={ct.id}
                type="button"
                onClick={() => {
                  setChartType(ct.id);
                  onOpenChange(false);
                }}
                className={cn(
                  "flex h-16 flex-col items-center justify-center gap-1 rounded-[10px] text-[13px]",
                  chartType === ct.id ? "bg-[#3a3a3c] text-strong" : "bg-[#2a2a2a] text-fg",
                )}
              >
                <ChartTypeIcon type={ct.id} className="size-6" />
                {ct.label}
              </button>
            ))}
          </div>
        </SheetSection>
        <div className="mt-2 border-t border-[#2a2a2a] pb-2">
          <SheetRow
            onClick={() => {
              onOpenChange(false);
              setAlertsOpen(true);
            }}
          >
            Alerts
          </SheetRow>
          <SheetRow
            onClick={() => {
              onOpenChange(false);
              setSettingsOpen(true);
            }}
          >
            Settings
          </SheetRow>
        </div>
      </BottomSheet>
      <BottomSheet open={alertsOpen} onOpenChange={setAlertsOpen} title="Alerts">
        <div className="px-4 pb-4">
          <AlertsPanel />
        </div>
      </BottomSheet>
      <ChartSettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </>
  );
}

const DRAW_TOOLS = [
  { id: "cursor", label: "Cross", icon: CrosshairIcon },
  { id: "trend", label: "Trend line", icon: TrendLineIcon },
  { id: "hline", label: "Horizontal line", icon: HorizontalLineIcon },
  { id: "fib", label: "Fib retracement", icon: FibIcon },
] as const;

/** Floating drawing toolbar shown over the chart while drawing mode is on. */
export function FloatingDrawToolbar({ onClose }: { onClose: () => void }) {
  const drawingTool = useTerminalStore((s) => s.drawingTool);
  const setDrawingTool = useTerminalStore((s) => s.setDrawingTool);
  const clearDrawings = useTerminalStore((s) => s.clearDrawings);
  const count = useTerminalStore((s) => (s.drawings[s.symbol] ?? []).length);
  return (
    <div
      role="toolbar"
      aria-label="Drawing tools"
      className="absolute bottom-10 left-1/2 z-20 flex h-12 -translate-x-1/2 items-center gap-0.5 rounded-[10px] bg-[#1e1e1e] px-1.5 shadow-[0_4px_16px_rgba(0,0,0,0.6)]"
    >
      <span aria-hidden className="grid grid-cols-2 gap-[3px] px-1.5 opacity-50">
        {Array.from({ length: 6 }).map((_, i) => (
          <span key={i} className="size-[3px] rounded-full bg-fg" />
        ))}
      </span>
      {DRAW_TOOLS.map((tool) => (
        <button
          key={tool.id}
          type="button"
          aria-label={tool.label}
          aria-pressed={drawingTool === tool.id}
          onClick={() => setDrawingTool(tool.id)}
          className={cn(
            "flex size-10 items-center justify-center rounded-md text-fg",
            drawingTool === tool.id && "bg-[#2a2a2a] text-accent",
          )}
        >
          <tool.icon className="size-7" />
        </button>
      ))}
      <button
        type="button"
        aria-label="Remove all drawings"
        disabled={!count}
        onClick={clearDrawings}
        className="flex size-10 items-center justify-center rounded-md text-fg disabled:text-[#4a4a4a]"
      >
        <Trash2 className="size-5" strokeWidth={1.4} />
      </button>
      <button
        type="button"
        aria-label="Close drawing tools"
        onClick={() => {
          setDrawingTool("cursor");
          onClose();
        }}
        className="flex size-10 items-center justify-center rounded-md text-fg"
      >
        <X className="size-5" strokeWidth={1.4} />
      </button>
    </div>
  );
}
