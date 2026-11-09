import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCompact, formatPct, formatPrice } from "@/lib/market/format";
import { assetName, pairLabel } from "@/lib/market/symbols";
import { chartTimeZone, exchangeLabel, quoteFeedStatus, sourceLabel } from "@/lib/market/venue";
import { useQuote, useTerminalStore } from "@/lib/store";
import { CoinIcon } from "./coin-icon";

function clockLabel(seconds: number | undefined, timeZone: string | undefined): string {
  if (!seconds) return "";
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone,
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZoneName: "short",
    }).format(new Date(seconds * 1000));
  } catch {
    return "";
  }
}

/** TradingView-style symbol details: headline price, session state and extended hours. */
export function SymbolDetails() {
  const symbol = useTerminalStore((s) => s.symbol);
  const venue = useTerminalStore((s) => s.venue);
  const quote = useQuote(symbol);
  const stocks = venue === "stocks";
  const tz = chartTimeZone(symbol, venue);

  if (!quote) {
    return <div className="p-4 text-sm text-muted">Loading {symbol}…</div>;
  }

  const opts = { currency: quote.currency, hint: quote.priceHint };
  const up = quote.priceChange >= 0;
  const state = quote.marketState;
  const status = stocks
    ? state === "regular"
      ? { dot: "bg-up", text: "Market open" }
      : state === "pre"
        ? { dot: "bg-warn", text: "Pre-market" }
        : state === "post"
          ? { dot: "bg-accent", text: "Post-market" }
          : { dot: "bg-muted", text: "Market closed" }
    : { dot: "bg-up", text: "Market open · 24/7" };
  const feed = stocks ? quoteFeedStatus(quote) : null;
  const extUp = (quote.extChange ?? 0) >= 0;
  const lo = quote.lowPrice;
  const hi = quote.highPrice;
  const pos = Math.min(100, Math.max(0, ((quote.lastPrice - lo) / Math.max(hi - lo, 1e-12)) * 100));
  const name = quote.shortName || assetName(symbol);

  return (
    <div className="px-4 pt-3 pb-4 tabular-nums">
      <div className="flex items-center gap-2">
        <CoinIcon symbol={symbol} size={24} />
        <span className="text-[15px] font-semibold text-strong">{stocks ? symbol : pairLabel(symbol)}</span>
        <span className="truncate text-[12px] text-muted">
          {stocks ? exchangeLabel(quote.exchange) : sourceLabel(quote.source, venue)}
        </span>
      </div>
      <p className="mt-1 truncate text-[13px] text-muted">{name}</p>

      <div className="mt-3 flex flex-wrap items-baseline gap-x-2">
        <span className="text-[28px] leading-8 font-semibold text-strong">
          {formatPrice(quote.lastPrice, { hint: quote.priceHint })}
        </span>
        <span className="text-[12px] text-muted">{quote.currency ?? (stocks ? "" : "USDT")}</span>
        <span className={cn("text-[15px]", up ? "text-up" : "text-down")}>
          {up ? "+" : "−"}
          {formatPrice(Math.abs(quote.priceChange), { hint: quote.priceHint })}{" "}
          {formatPct(quote.priceChangePercent)}
        </span>
      </div>
      <p className="mt-1 flex items-center gap-1.5 text-[12px] text-muted">
        <span className={cn("size-2 rounded-full", status.dot)} />
        {status.text}
        {stocks && state !== "regular" && quote.lastTime ? (
          <span>· At close {clockLabel(quote.lastTime, tz)}</span>
        ) : null}
      </p>

      {stocks && quote.extSession && quote.extPrice ? (
        <div className="mt-3 rounded-md border border-border px-3 py-2">
          <p className="flex items-center gap-1.5 text-[12px] text-muted">
            {quote.extSession === "pre" ? (
              <Sun className="size-3.5 text-warn" />
            ) : (
              <Moon className="size-3.5 text-accent" />
            )}
            {quote.extSession === "pre" ? "Pre-market" : "Post-market"}
            {quote.extTime ? <span>· {clockLabel(quote.extTime, tz)}</span> : null}
          </p>
          <p className="mt-0.5 flex items-baseline gap-2">
            <span className="text-[18px] font-semibold text-strong">
              {formatPrice(quote.extPrice, { hint: quote.priceHint })}
            </span>
            <span className={cn("text-[13px]", extUp ? "text-up" : "text-down")}>
              {extUp ? "+" : "−"}
              {formatPrice(Math.abs(quote.extChange ?? 0), { hint: quote.priceHint })}{" "}
              {formatPct(quote.extChangePercent ?? 0)}
            </span>
          </p>
        </div>
      ) : null}

      <div className="mt-4">
        <div className="flex justify-between text-[12px] text-muted">
          <span>Day's range</span>
        </div>
        <div className="relative mt-1.5 h-1 rounded-full bg-elevated">
          <div className="absolute inset-y-0 left-0 rounded-full bg-[#3d3d3d]" style={{ width: `${pos}%` }} />
          <div
            className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-bg bg-fg"
            style={{ left: `${pos}%` }}
          />
        </div>
        <div className="mt-1 flex justify-between text-[12px] text-fg">
          <span>{formatPrice(lo, opts)}</span>
          <span>{formatPrice(hi, opts)}</span>
        </div>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[12px]">
        <dt className="text-muted">{stocks ? "Prev close" : "24h open"}</dt>
        <dd className="text-right text-fg">{formatPrice(quote.openPrice, opts)}</dd>
        <dt className="text-muted">Volume</dt>
        <dd className="text-right text-fg">{formatCompact(quote.volume)}</dd>
        {!stocks && quote.quoteVolume ? (
          <>
            <dt className="text-muted">Volume (USDT)</dt>
            <dd className="text-right text-fg">{formatCompact(quote.quoteVolume)}</dd>
          </>
        ) : null}
      </dl>
      {feed ? <p className="mt-3 text-[11px] leading-4 text-muted">{feed.label} · {feed.updatedLabel}. {feed.explanation}</p> : null}
    </div>
  );
}
