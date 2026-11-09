import { useEffect, useState } from "react";
import { Settings2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { SPANS } from "@/lib/market/types";
import { chartTimeZone } from "@/lib/market/venue";
import { useTerminalStore } from "@/lib/store";

function useClock(timeZone: string) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);
  if (!now) return "";
  try {
    const time = new Intl.DateTimeFormat("en-GB", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(now);
    const offset =
      new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "shortOffset" })
        .formatToParts(now)
        .find((p) => p.type === "timeZoneName")
        ?.value.replace("GMT", "UTC") ?? "UTC";
    return `${time} (${offset === "UTC" ? "UTC" : offset})`;
  } catch {
    return now.toISOString().slice(11, 19) + " (UTC)";
  }
}

const barButton =
  "flex h-7 shrink-0 items-center rounded-[4px] px-2 text-[13px] text-fg hover:bg-hover";

function RangeButtons({ phone = false }: { phone?: boolean }) {
  const span = useTerminalStore((s) => s.span);
  const setSpan = useTerminalStore((s) => s.setSpan);
  return (
    <div className="flex min-w-0 items-center overflow-x-auto [scrollbar-width:none]">
      {SPANS.map((item) => (
        <button
          key={item.id}
          type="button"
          title={item.title}
          onClick={() => setSpan(item.id)}
          className={cn(
            barButton,
            phone && "h-9 px-2.5",
            span === item.id && "text-accent",
          )}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

function ScaleToggles() {
  const venue = useTerminalStore((s) => s.venue);
  const extendedHours = useTerminalStore((s) => s.extendedHours);
  const setExtendedHours = useTerminalStore((s) => s.setExtendedHours);
  const mode = useTerminalStore((s) => s.priceScaleMode);
  const setMode = useTerminalStore((s) => s.setPriceScaleMode);
  const autoScale = useTerminalStore((s) => s.autoScale);
  const setAutoScale = useTerminalStore((s) => s.setAutoScale);
  return (
    <>
      {venue === "stocks" && (
        <button
          type="button"
          title={extendedHours ? "Extended trading hours on" : "Regular trading hours only"}
          onClick={() => setExtendedHours(!extendedHours)}
          className={cn(barButton, extendedHours && "text-accent")}
        >
          {extendedHours ? "ETH" : "RTH"}
        </button>
      )}
      <span aria-hidden className="mx-0.5 h-4 w-px bg-border" />
      <button
        type="button"
        title="Toggle percentage scale"
        onClick={() => setMode(mode === "percent" ? "normal" : "percent")}
        className={cn(barButton, mode === "percent" && "text-accent")}
      >
        %
      </button>
      <button
        type="button"
        title="Toggle log scale"
        onClick={() => setMode(mode === "log" ? "normal" : "log")}
        className={cn(barButton, mode === "log" && "text-accent")}
      >
        log
      </button>
      <button
        type="button"
        title="Toggle auto (fits data to screen)"
        onClick={() => setAutoScale(!autoScale)}
        className={cn(barButton, autoScale && "text-accent")}
      >
        auto
      </button>
    </>
  );
}

/** TradingView-style bottom toolbar: date ranges, clock, and scale toggles. */
export function ChartBottomBar() {
  const symbol = useTerminalStore((s) => s.symbol);
  const venue = useTerminalStore((s) => s.venue);
  const clock = useClock(chartTimeZone(symbol, venue) ?? "UTC");
  return (
    <div className="flex h-[38px] min-w-0 shrink-0 items-center gap-1 border-t border-gap bg-bg px-1.5">
      <RangeButtons />
      <div className="ml-auto flex shrink-0 items-center gap-0.5">
        <span className="hidden px-2 text-[13px] text-fg tabular-nums lg:inline">{clock}</span>
        <ScaleToggles />
      </div>
    </div>
  );
}

export function PhoneBottomBar() {
  const venue = useTerminalStore((s) => s.venue);
  const extendedHours = useTerminalStore((s) => s.extendedHours);
  const setExtendedHours = useTerminalStore((s) => s.setExtendedHours);
  const mode = useTerminalStore((s) => s.priceScaleMode);
  const setMode = useTerminalStore((s) => s.setPriceScaleMode);
  const autoScale = useTerminalStore((s) => s.autoScale);
  const setAutoScale = useTerminalStore((s) => s.setAutoScale);
  return (
    <div className="flex h-10 min-w-0 shrink-0 items-center border-t border-border bg-bg pl-1">
      <RangeButtons phone />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Chart settings"
            className="ml-auto flex size-10 shrink-0 items-center justify-center border-l border-border text-fg"
          >
            <Settings2 className="size-[18px]" strokeWidth={1.5} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" side="top" className="min-w-56">
          <DropdownMenuLabel className="text-[11px] tracking-wide text-muted uppercase">
            Scale
          </DropdownMenuLabel>
          <DropdownMenuCheckboxItem checked={autoScale} onCheckedChange={(v) => setAutoScale(!!v)}>
            Auto (fit data to screen)
          </DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem
            checked={mode === "log"}
            onCheckedChange={(v) => setMode(v ? "log" : "normal")}
          >
            Logarithmic
          </DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem
            checked={mode === "percent"}
            onCheckedChange={(v) => setMode(v ? "percent" : "normal")}
          >
            Percent
          </DropdownMenuCheckboxItem>
          {venue === "stocks" && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuCheckboxItem
                checked={extendedHours}
                onCheckedChange={(v) => setExtendedHours(!!v)}
              >
                Extended trading hours
              </DropdownMenuCheckboxItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
