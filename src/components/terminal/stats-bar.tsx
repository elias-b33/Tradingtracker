import { formatCompact, formatDelta, formatPct, formatPrice } from "@/lib/market/format";
import { spanLabel } from "@/lib/market/spans";
import { cn } from "@/lib/utils";
import { useSpanReturns } from "@/hooks/use-span-returns";
import { useQuote, useTerminalStore } from "@/lib/store";

export function StatsBar() {
  const symbol = useTerminalStore((s) => s.symbol);
  const span = useTerminalStore((s) => s.span);
  const quote = useQuote(symbol);
  const { returns } = useSpanReturns(symbol);

  if (!quote) {
    return (
      <div className="hidden h-8 items-center gap-4 border-t border-border bg-bg px-3 text-xs text-muted md:flex">
        Range loading…
      </div>
    );
  }

  const move = returns[span ?? "1D"];
  const up = (move?.pct ?? 0) >= 0;
  const lo = quote.lowPrice;
  const hi = quote.highPrice;
  const band = Math.max(hi - lo, 1e-12);
  const pos = Math.min(100, Math.max(0, ((quote.lastPrice - lo) / band) * 100));

  return (
    <div className="hidden h-9 items-center gap-5 overflow-hidden border-t border-border bg-bg px-3 font-mono text-xs tabular-nums md:flex">
      <span className={cn("text-sm font-semibold", up ? "text-up" : "text-down")}>
        {move ? formatPct(move.pct) : "—"}
        <span className="ml-1.5 text-[11px] font-normal text-muted">
          {move ? formatDelta(move.delta) : ""} · {spanLabel(span)}
        </span>
      </span>
      <Stat label="High" value={formatPrice(quote.highPrice)} />
      <Stat label="Low" value={formatPrice(quote.lowPrice)} />
      <div className="flex min-w-36 flex-1 items-center gap-2">
        <span className="text-muted">Day</span>
        <div className="relative h-1 flex-1 rounded-full bg-elevated">
          <div className="absolute inset-y-0 left-0 rounded-full bg-accent/40" style={{ width: `${pos}%` }} />
          <div
            className="absolute top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent"
            style={{ left: `${pos}%` }}
          />
        </div>
      </div>
      <Stat label="Vol" value={formatCompact(quote.volume)} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <span className="flex items-baseline gap-1.5 whitespace-nowrap">
      <span className="text-muted">{label}</span>
      <span className="text-fg">{value}</span>
    </span>
  );
}