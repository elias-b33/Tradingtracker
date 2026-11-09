import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlarmClockPlus, Check, ChevronDown, ChevronLeft, Maximize, Moon, Plus, Sun } from "lucide-react";
import type { IChartApi, ISeriesApi, UTCTimestamp } from "lightweight-charts";
import { BottomSheet } from "@/components/ui/sheet";
import { getKlines } from "@/lib/market/binance";
import { getStockKlines } from "@/lib/market/stocks";
import { formatChange, formatCompact, formatPct, formatPrice } from "@/lib/market/format";
import { recommendedInterval, spanBarCount, spanStartMs } from "@/lib/market/spans";
import { pairName } from "@/lib/market/symbols";
import type { SpanId } from "@/lib/market/types";
import { chartTimeZone, exchangeLabel } from "@/lib/market/venue";
import { CHART_FONT, theme } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { useQuote, useTerminalStore } from "@/lib/store";
import { AlertsPanel } from "./alerts-panel";
import { CoinIcon } from "./coin-icon";
import { NewsPanel } from "./news-panel";

const RANGES: Array<{ id: SpanId; label: string }> = [
  { id: "1D", label: "1D" },
  { id: "1W", label: "5D" },
  { id: "1M", label: "1M" },
  { id: "3M", label: "3M" },
  { id: "YTD", label: "YTD" },
  { id: "1Y", label: "1Y" },
  { id: "5Y", label: "5Y" },
  { id: "ALL", label: "All" },
];

function MiniChart({ span }: { span: SpanId }) {
  const symbol = useTerminalStore((s) => s.symbol);
  const venue = useTerminalStore((s) => s.venue);
  const quote = useQuote(symbol);
  const stocks = venue === "stocks";
  const interval = recommendedInterval(span);
  const query = useQuery({
    queryKey: ["overview-klines", venue, symbol, span],
    queryFn: () => {
      if (stocks) return getStockKlines({ data: { symbol, interval, span, extended: true } });
      const bars = spanBarCount(span, interval);
      const startTime = bars <= 4000 ? (spanStartMs(span) ?? undefined) : undefined;
      return getKlines({ data: { symbol, interval, limit: 1000, startTime } });
    },
    refetchInterval: 30_000,
  });
  const hostRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Area"> | null>(null);
  const [ready, setReady] = useState(false);
  const tz = chartTimeZone(symbol, venue) ?? "UTC";

  useEffect(() => {
    let dead = false;
    void import("lightweight-charts").then((lc) => {
      if (dead || !hostRef.current) return;
      const chart = lc.createChart(hostRef.current, {
        autoSize: true,
        layout: {
          background: { type: lc.ColorType.Solid, color: theme.bg },
          textColor: "#8c8c8c",
          fontFamily: CHART_FONT,
          fontSize: 12,
          attributionLogo: false,
        },
        grid: { vertLines: { visible: false }, horzLines: { visible: false } },
        rightPriceScale: { visible: false },
        leftPriceScale: { visible: true, borderVisible: false, scaleMargins: { top: 0.15, bottom: 0.1 } },
        timeScale: { borderVisible: false, timeVisible: true, fixLeftEdge: true, fixRightEdge: true },
        crosshair: { horzLine: { visible: false, labelVisible: false } },
        handleScroll: false,
        handleScale: false,
      });
      seriesRef.current = chart.addSeries(lc.AreaSeries, {
        priceScaleId: "left",
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      chartRef.current = chart;
      setReady(true);
    });
    return () => {
      dead = true;
      chartRef.current?.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || !ready) return;
    chart.applyOptions({
      localization: {
        timeFormatter: (t: number) =>
          new Intl.DateTimeFormat("en-GB", { timeZone: tz, day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(t * 1000)),
      },
      timeScale: {
        tickMarkFormatter: (t: number, type: number) => {
          const d = new Date(Number(t) * 1000);
          const f = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-GB", { timeZone: tz, ...o }).format(d);
          if (type === 0) return f({ year: "numeric" });
          if (type === 1) return f({ month: "short" });
          if (type === 2) return f({ day: "numeric" });
          return f({ hour: "2-digit", minute: "2-digit", hour12: false });
        },
      },
    });
  }, [ready, tz]);

  const candles = useMemo(() => (query.data?.ok ? query.data.candles : []), [query.data]);
  useEffect(() => {
    const chart = chartRef.current;
    const series = seriesRef.current;
    if (!chart || !series || !candles.length) return;
    const start = span === "1D" && quote?.openPrice ? quote.openPrice : candles[0].open;
    const up = candles[candles.length - 1].close >= start;
    const color = up ? "#22ab94" : theme.down;
    series.applyOptions({
      lineColor: color,
      topColor: up ? "rgba(34,171,148,0.35)" : "rgba(242,54,69,0.35)",
      bottomColor: "rgba(0,0,0,0)",
    });
    series.setData(candles.map((c) => ({ time: c.time as UTCTimestamp, value: c.close })));
    for (const line of series.priceLines()) series.removePriceLine(line);
    series.createPriceLine({
      price: start,
      color: "#5d5d5d",
      lineWidth: 1,
      lineStyle: 2,
      axisLabelVisible: false,
      title: "",
    });
    chart.timeScale().fitContent();
  }, [candles, span, quote?.openPrice]);

  return <div ref={hostRef} className="absolute inset-0" />;
}

/** Phone symbol page modelled on the TradingView app's details screen. */
export function SymbolOverview() {
  const symbol = useTerminalStore((s) => s.symbol);
  const venue = useTerminalStore((s) => s.venue);
  const watchlist = useTerminalStore((s) => s.watchlist);
  const addToWatchlist = useTerminalStore((s) => s.addToWatchlist);
  const removeFromWatchlist = useTerminalStore((s) => s.removeFromWatchlist);
  const closeOverview = useTerminalStore((s) => s.closeOverview);
  const setMobileTab = useTerminalStore((s) => s.setMobileTab);
  const setSearchOpen = useTerminalStore((s) => s.setSearchOpen);
  const quote = useQuote(symbol);
  const [span, setSpan] = useState<SpanId>("1D");
  const [tab, setTab] = useState<"overview" | "news">("overview");
  const [alertsOpen, setAlertsOpen] = useState(false);
  const stocks = venue === "stocks";
  const listed = watchlist.includes(symbol);
  const name = stocks ? (quote?.shortName || symbol).replace(/\.$/, "") : pairName(symbol);
  const exchange = stocks ? exchangeLabel(quote?.exchange) : "BINANCE";
  const up = (quote?.priceChange ?? 0) >= 0;
  const extUp = (quote?.extChange ?? 0) >= 0;
  const hint = quote?.priceHint;
  const state = quote?.marketState;
  const openChart = () => setMobileTab("chart");

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-bg">
      <div className="flex h-14 shrink-0 items-center gap-2 px-2">
        <button type="button" aria-label="Back" onClick={closeOverview} className="flex size-10 items-center justify-center text-fg">
          <ChevronLeft className="size-7" strokeWidth={1.5} />
        </button>
        <CoinIcon symbol={symbol} size={40} />
        <button type="button" onClick={() => setSearchOpen(true)} className="min-w-0 flex-1 text-left">
          <span className="flex items-center gap-1 text-[17px] font-semibold text-strong">
            <span className="truncate">{name}</span>
            <ChevronDown className="size-4 shrink-0" />
          </span>
          <span className="flex items-center gap-1.5 text-[13px] text-[#8c8c8c]">
            {symbol} · {exchange}
            {stocks && (state === "pre" || state === "post") && (
              <span className={cn("flex h-4 items-center rounded-full px-1", state === "pre" ? "bg-warn/20 text-warn" : "bg-accent/25 text-[#6d8dff]")}>
                {state === "pre" ? <Sun className="size-3" /> : <Moon className="size-3" />}
              </span>
            )}
          </span>
        </button>
        <button
          type="button"
          aria-label={listed ? "Remove from watchlist" : "Add to watchlist"}
          onClick={() => (listed ? removeFromWatchlist(symbol) : addToWatchlist(symbol))}
          className="flex size-10 items-center justify-center text-fg"
        >
          {listed ? <Check className="size-6" strokeWidth={1.5} /> : <Plus className="size-7" strokeWidth={1.5} />}
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="px-4 pt-2 tabular-nums">
          <p className="flex items-baseline gap-1.5">
            <span className="text-[40px] leading-[44px] font-bold text-strong">
              {quote ? formatPrice(quote.lastPrice, { hint }) : "—"}
            </span>
            <span className="text-[15px] text-fg">{quote?.currency ?? (stocks ? "" : "USDT")}</span>
          </p>
          {quote && (
            <p className="mt-1 text-[18px]">
              <span className={up ? "text-[#22ab94]" : "text-down"}>
                {formatChange(quote.priceChange, hint)} {formatPct(quote.priceChangePercent)}
              </span>{" "}
              <span className="text-[15px] text-[#8c8c8c]">
                {stocks ? (state === "regular" ? "" : "at close") : "past 24 hours"}
              </span>
            </p>
          )}
          {stocks && quote?.extSession && quote.extPrice ? (
            <p
              className={cn(
                "mt-2 inline-flex h-7 items-center gap-1.5 rounded-[10px] px-2.5 text-[15px]",
                quote.extSession === "pre" ? "bg-[#33271a]" : "bg-[#1a2340]",
              )}
            >
              {quote.extSession === "pre" ? (
                <Sun className="size-4 text-warn" />
              ) : (
                <Moon className="size-4 text-[#6d8dff]" />
              )}
              <span className="text-fg">{formatPrice(quote.extPrice, { hint })}</span>
              <span className={extUp ? "text-[#22ab94]" : "text-down"}>
                {formatChange(quote.extChange ?? 0, hint)} {formatPct(quote.extChangePercent ?? 0)}
              </span>
            </p>
          ) : null}
        </div>

        <div className="relative mt-3 h-64">
          <MiniChart span={span} />
          <button
            type="button"
            aria-label="Create alert"
            onClick={() => setAlertsOpen(true)}
            className="absolute bottom-8 left-4 z-10 flex h-10 w-14 items-center justify-center rounded-full border border-[#3a3a3a] bg-[#1e1e1e] text-fg"
          >
            <AlarmClockPlus className="size-5" strokeWidth={1.5} />
          </button>
          <button
            type="button"
            aria-label="Open full chart"
            onClick={openChart}
            className="absolute right-4 bottom-8 z-10 flex h-10 w-14 items-center justify-center rounded-full border border-[#3a3a3a] bg-[#1e1e1e] text-fg"
          >
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden>
              <path d="M9 5v3M9 16v3M15 4v4M15 15v4" />
              <rect x="7" y="8" width="4" height="8" rx=".5" fill="currentColor" />
              <rect x="13" y="8" width="4" height="7" rx=".5" />
            </svg>
          </button>
        </div>

        <div className="flex items-center gap-1 px-3 py-2">
          {RANGES.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setSpan(r.id)}
              className={cn(
                "h-9 flex-1 rounded-[10px] text-[14px]",
                span === r.id ? "bg-[#2a2a2a] font-semibold text-strong" : "text-fg",
              )}
            >
              {r.label}
            </button>
          ))}
          <button type="button" aria-label="Open full chart" onClick={openChart} className="flex size-9 items-center justify-center text-fg">
            <Maximize className="size-5" strokeWidth={1.5} />
          </button>
        </div>

        <div className="border-t border-[#1f1f1f] px-4 py-4">
          <button
            type="button"
            onClick={openChart}
            className="h-12 w-full rounded-[12px] bg-[#e0e0e0] text-[17px] font-semibold text-black"
          >
            Full chart
          </button>
        </div>

        <div className="flex gap-1 border-t border-[#1f1f1f] px-3 py-3">
          {(["overview", "news"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={cn(
                "h-9 rounded-[10px] px-4 text-[16px] capitalize",
                tab === t ? "bg-[#2a2a2a] font-semibold text-strong" : "text-[#8c8c8c]",
              )}
            >
              {t}
            </button>
          ))}
        </div>
        {tab === "overview" ? (
          <KeyStats />
        ) : (
          <div className="min-h-80">
            <NewsPanel />
          </div>
        )}
      </div>

      <BottomSheet open={alertsOpen} onOpenChange={setAlertsOpen} title="Alerts">
        <div className="px-4 pb-4">
          <AlertsPanel />
        </div>
      </BottomSheet>
    </div>
  );
}

function KeyStats() {
  const symbol = useTerminalStore((s) => s.symbol);
  const venue = useTerminalStore((s) => s.venue);
  const quote = useQuote(symbol);
  if (!quote) return null;
  const opts = { hint: quote.priceHint };
  const rows: Array<[string, string]> = [
    [venue === "stocks" ? "Previous close" : "24h open", formatPrice(quote.openPrice, opts)],
    ["Day's high", formatPrice(quote.highPrice, opts)],
    ["Day's low", formatPrice(quote.lowPrice, opts)],
    ["Volume", formatCompact(quote.volume)],
  ];
  if (venue === "crypto" && quote.quoteVolume) rows.push(["Volume (USDT)", formatCompact(quote.quoteVolume)]);
  if (quote.exchange) rows.push(["Exchange", exchangeLabel(quote.exchange)]);
  return (
    <div className="px-4 pb-8">
      <h3 className="mb-2 text-[20px] font-semibold text-strong">Key stats</h3>
      <dl className="tabular-nums">
        {rows.map(([k, v]) => (
          <div key={k} className="flex h-11 items-center justify-between border-b border-[#1f1f1f] text-[15px]">
            <dt className="text-[#8c8c8c]">{k}</dt>
            <dd className="text-fg">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
