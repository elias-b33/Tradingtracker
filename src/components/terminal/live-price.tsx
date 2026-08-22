import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { formatDelta, formatPct, formatPrice } from "@/lib/market/format";
import { spanLabel } from "@/lib/market/spans";
import { sessionLabel } from "@/lib/market/venue";
import { useSpanReturns } from "@/hooks/use-span-returns";
import { useQuote, useTerminalStore } from "@/lib/store";

export function LivePrice({ symbol }: { symbol: string }) {
  const quote = useQuote(symbol);
  const span = useTerminalStore((s) => s.span);
  const { returns } = useSpanReturns(symbol);
  const prev = useRef<number | undefined>(undefined);
  const [flash, setFlash] = useState<"up" | "down" | null>(null);

  useEffect(() => {
    if (!quote) return;
    if (prev.current !== undefined && quote.lastPrice !== prev.current) {
      setFlash(quote.lastPrice > prev.current ? "up" : "down");
    }
    prev.current = quote.lastPrice;
  }, [quote]);

  if (!quote) {
    return <span className="font-mono text-lg tabular-nums text-muted">—</span>;
  }

  const key = span ?? "1D";
  const move = returns[key];
  const pct = move?.pct;
  const up = (pct ?? 0) >= 0;
  const priceOpts = { currency: quote.currency, hint: quote.priceHint };
  const session = quote.source !== "binance" ? sessionLabel(quote.marketState) : "";

  return (
    <div className="flex min-w-0 items-baseline gap-2">
      <span
        className={cn(
          "font-mono text-xl font-semibold tabular-nums tracking-tight text-fg sm:text-2xl",
          flash === "up" && "flash-up",
          flash === "down" && "flash-down",
        )}
        onAnimationEnd={() => setFlash(null)}
      >
        {formatPrice(quote.lastPrice, priceOpts)}
      </span>
      <span className="flex min-w-0 flex-col leading-tight sm:flex-row sm:items-baseline sm:gap-1.5">
        <span className={cn("font-mono text-base font-semibold tabular-nums sm:text-lg", up ? "text-up" : "text-down")}>
          {pct == null ? "—" : formatPct(pct)}
        </span>
        <span className="font-mono text-[11px] tabular-nums text-muted sm:text-xs">
          {move ? `${formatDelta(move.delta, priceOpts)} · ` : ""}
          {spanLabel(span)}
          {session && session !== "Open" ? ` · ${session}` : ""}
        </span>
      </span>
    </div>
  );
}
