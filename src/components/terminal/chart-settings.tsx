import { useState } from "react";
import { CandlestickChart, Check, Grid3x3, Ruler } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { PriceScaleMode } from "@/lib/market/types";
import { useTerminalStore } from "@/lib/store";

type Tab = "symbol" | "scales" | "canvas";

const TABS: Array<{ id: Tab; label: string; icon: typeof Ruler }> = [
  { id: "symbol", label: "Symbol", icon: CandlestickChart },
  { id: "scales", label: "Scales and lines", icon: Ruler },
  { id: "canvas", label: "Canvas", icon: Grid3x3 },
];

function Checkbox({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center gap-3 text-[15px] text-fg md:min-h-9">
      <span
        className={cn(
          "flex size-[18px] items-center justify-center rounded-[3px] border",
          checked ? "border-fg bg-fg text-bg" : "border-[#5d5d5d]",
        )}
      >
        {checked && <Check className="size-3.5" strokeWidth={3} />}
      </span>
      <input
        type="checkbox"
        className="sr-only"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  );
}

function Select<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <label className="flex min-h-11 items-center justify-between gap-4 text-[15px] text-fg md:min-h-10">
      <span>{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="h-9 w-40 rounded-md border border-[#3d3d3d] bg-bg px-2 text-[14px] text-fg outline-none focus:border-accent"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <p className="mt-4 mb-1 text-[11px] font-medium tracking-wide text-muted uppercase first:mt-0">{children}</p>;
}

export function ChartSettingsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [tab, setTab] = useState<Tab>("symbol");
  const venue = useTerminalStore((s) => s.venue);
  const extendedHours = useTerminalStore((s) => s.extendedHours);
  const setExtendedHours = useTerminalStore((s) => s.setExtendedHours);
  const mode = useTerminalStore((s) => s.priceScaleMode);
  const setMode = useTerminalStore((s) => s.setPriceScaleMode);
  const autoScale = useTerminalStore((s) => s.autoScale);
  const setAutoScale = useTerminalStore((s) => s.setAutoScale);
  const showCountdown = useTerminalStore((s) => s.showCountdown);
  const setShowCountdown = useTerminalStore((s) => s.setShowCountdown);
  const showGrid = useTerminalStore((s) => s.showGrid);
  const setShowGrid = useTerminalStore((s) => s.setShowGrid);
  const drawingRail = useTerminalStore((s) => s.drawingRail);
  const setDrawingRail = useTerminalStore((s) => s.setDrawingRail);
  const indicators = useTerminalStore((s) => s.indicators);
  const toggleIndicator = useTerminalStore((s) => s.toggleIndicator);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="top-0 h-dvh max-h-none w-full max-w-none rounded-none border-0 p-0 md:top-[12vh] md:h-[min(520px,80dvh)] md:w-[min(100%-2rem,720px)] md:rounded-lg md:border">
        <div className="flex h-14 shrink-0 items-center px-5">
          <DialogTitle className="text-[20px] font-semibold text-strong">Settings</DialogTitle>
          <DialogDescription className="sr-only">Chart settings</DialogDescription>
        </div>
        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          <nav className="flex shrink-0 gap-1 overflow-x-auto border-b border-border px-3 pb-2 md:w-52 md:flex-col md:border-0 md:px-3">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={cn(
                  "flex h-10 shrink-0 items-center gap-3 rounded-md px-3 text-[15px] text-fg hover:bg-hover",
                  tab === t.id && "bg-hover font-medium text-strong",
                )}
              >
                <t.icon className="size-[18px]" strokeWidth={1.5} />
                {t.label}
              </button>
            ))}
          </nav>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3">
            {tab === "symbol" && (
              <>
                <SectionTitle>Data modification</SectionTitle>
                {venue === "stocks" ? (
                  <Select
                    label="Session"
                    value={extendedHours ? "extended" : "regular"}
                    options={[
                      { value: "regular", label: "Regular" },
                      { value: "extended", label: "Extended" },
                    ]}
                    onChange={(v) => setExtendedHours(v === "extended")}
                  />
                ) : (
                  <p className="text-[14px] text-muted">Crypto trades 24/7, so there is no session setting.</p>
                )}
                <SectionTitle>Status line</SectionTitle>
                <Checkbox checked={indicators.volume} onChange={() => toggleIndicator("volume")} label="Volume" />
              </>
            )}
            {tab === "scales" && (
              <>
                <SectionTitle>Price scale</SectionTitle>
                <Select<PriceScaleMode>
                  label="Scale type"
                  value={mode}
                  options={[
                    { value: "normal", label: "Regular" },
                    { value: "percent", label: "Percent" },
                    { value: "log", label: "Logarithmic" },
                  ]}
                  onChange={setMode}
                />
                <Checkbox checked={autoScale} onChange={setAutoScale} label="Auto (fits data to screen)" />
                <Checkbox
                  checked={showCountdown}
                  onChange={setShowCountdown}
                  label="Countdown to bar close"
                />
              </>
            )}
            {tab === "canvas" && (
              <>
                <SectionTitle>Chart basic styles</SectionTitle>
                <Checkbox checked={showGrid} onChange={setShowGrid} label="Grid lines" />
                <SectionTitle>Toolbars</SectionTitle>
                <Checkbox checked={drawingRail} onChange={setDrawingRail} label="Drawings toolbar" />
              </>
            )}
          </div>
        </div>
        <div className="flex h-16 shrink-0 items-center justify-end gap-2 border-t border-border px-5">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="h-9 rounded-md bg-strong px-5 text-[14px] font-medium text-bg"
          >
            Ok
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
