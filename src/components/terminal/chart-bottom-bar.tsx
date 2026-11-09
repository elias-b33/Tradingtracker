import { useEffect, useState } from "react";
import { CalendarRange } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
    return `${time} ${offset}`;
  } catch {
    return now.toISOString().slice(11, 19) + " UTC";
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

function GoToDate({ compact = false }: { compact?: boolean }) {
  const setGoToTime = useTerminalStore((s) => s.setGoToTime);
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" aria-label="Go to date" title="Go to" className={cn(barButton, compact && "h-9")}>
          <CalendarRange className="size-[18px]" strokeWidth={1.5} />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" side="top" className="w-64">
        <p className="mb-2 text-[14px] font-medium text-strong">Go to</p>
        <input
          type="date"
          className="h-9 w-full rounded-md border border-[#3d3d3d] bg-bg px-2 text-[14px] text-fg [color-scheme:dark]"
          onChange={(e) => {
            const at = Date.parse(`${e.target.value}T00:00:00Z`);
            if (Number.isFinite(at)) {
              setGoToTime(at / 1000);
              setOpen(false);
            }
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

function SessionToggle() {
  const venue = useTerminalStore((s) => s.venue);
  const extendedHours = useTerminalStore((s) => s.extendedHours);
  const setExtendedHours = useTerminalStore((s) => s.setExtendedHours);
  if (venue !== "stocks") return null;
  return (
    <>
      <span aria-hidden className="mx-0.5 h-4 w-px bg-border" />
      <button
        type="button"
        title={extendedHours ? "Extended trading hours (click for regular)" : "Regular trading hours (click for extended)"}
        onClick={() => setExtendedHours(!extendedHours)}
        className={barButton}
      >
        {extendedHours ? "ETH" : "RTH"}
      </button>
    </>
  );
}

/** TradingView-style bottom toolbar: date ranges, go-to-date, clock and session. */
export function ChartBottomBar() {
  const symbol = useTerminalStore((s) => s.symbol);
  const venue = useTerminalStore((s) => s.venue);
  const clock = useClock(chartTimeZone(symbol, venue) ?? "UTC");
  return (
    <div className="flex h-[38px] min-w-0 shrink-0 items-center gap-1 border-t border-gap bg-bg px-1.5">
      <RangeButtons />
      <span aria-hidden className="mx-0.5 h-4 w-px bg-border" />
      <GoToDate />
      <div className="ml-auto flex shrink-0 items-center gap-0.5">
        <span className="hidden px-2 text-[13px] text-fg tabular-nums sm:inline">{clock}</span>
        <SessionToggle />
      </div>
    </div>
  );
}
