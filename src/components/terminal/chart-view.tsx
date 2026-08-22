import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type {
  IChartApi,
  IPriceLine,
  ISeriesApi,
  MouseEventParams,
  SeriesType,
  Time,
  UTCTimestamp,
} from "lightweight-charts";
import { getKlines } from "@/lib/market/binance";
import { getStockKlines } from "@/lib/market/stocks";
import { spanStartMs } from "@/lib/market/spans";
import {
  bollinger,
  ema,
  macd,
  rsi,
  sma,
  volumePoints,
  vwap,
} from "@/lib/market/indicators";
import { formatCandleTime, formatCompact, formatPrice } from "@/lib/market/format";
import { connectKlineStream, type StreamConnectionStatus } from "@/lib/market/ws";
import { theme } from "@/lib/theme";
import type { Candle, StoredDrawing } from "@/lib/market/types";
import { chartTimeZone, quoteFeedStatus } from "@/lib/market/venue";
import { useTerminalStore } from "@/lib/store";

type Lc = typeof import("lightweight-charts");
type AnySeries = ISeriesApi<SeriesType>;

const lcReady: Promise<Lc> | null =
  typeof window === "undefined" ? null : import("lightweight-charts");

function asTime(n: number): UTCTimestamp {
  return n as UTCTimestamp;
}

function precisionOf(price: number, stocks = false) {
  if (stocks || price >= 1000) return { precision: 2, minMove: 0.01 };
  if (price >= 1) return { precision: 4, minMove: 0.0001 };
  if (price >= 0.01) return { precision: 6, minMove: 0.000001 };
  return { precision: 8, minMove: 0.00000001 };
}

function formatUpdateAge(ageMs: number): string {
  const seconds = Math.max(0, Math.floor(ageMs / 1000));
  if (seconds < 5) return "now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.floor(minutes / 60)}h ago`;
}

function snapPrice(candles: Candle[], time: number, price: number) {
  let candle = candles.find((c) => c.time === time);
  if (!candle && candles.length) {
    candle = candles.reduce((best, c) =>
      Math.abs(c.time - time) < Math.abs(best.time - time) ? c : best,
    );
  }
  if (!candle) return price;
  const levels = [candle.open, candle.high, candle.low, candle.close];
  return levels.reduce((best, level) =>
    Math.abs(level - price) < Math.abs(best - price) ? level : best,
  );
}

const FIBS = [
  { level: 0, color: "rgba(41,98,255,0.55)" },
  { level: 0.236, color: "rgba(120,123,134,0.55)" },
  { level: 0.382, color: "rgba(120,123,134,0.55)" },
  { level: 0.5, color: "rgba(41,98,255,0.8)" },
  { level: 0.618, color: "rgba(8,153,129,0.7)" },
  { level: 0.786, color: "rgba(120,123,134,0.55)" },
  { level: 1, color: "rgba(41,98,255,0.55)" },
];

const EMPTY_DRAWINGS: StoredDrawing[] = [];

export function ChartView() {
  const symbol = useTerminalStore((s) => s.symbol);
  const venue = useTerminalStore((s) => s.venue);
  const interval = useTerminalStore((s) => s.interval);
  const span = useTerminalStore((s) => s.span);
  const chartType = useTerminalStore((s) => s.chartType);
  const indicators = useTerminalStore((s) => s.indicators);
  const drawingTool = useTerminalStore((s) => s.drawingTool);
  const drawings = useTerminalStore((s) => s.drawings[s.symbol] ?? EMPTY_DRAWINGS);
  const quote = useTerminalStore((s) => s.quotes[s.symbol]);
  const lastPrice = quote?.lastPrice;
  const addDrawing = useTerminalStore((s) => s.addDrawing);
  const setDrawingTool = useTerminalStore((s) => s.setDrawingTool);

  const hostRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const lcRef = useRef<Lc | null>(null);
  const mainRef = useRef<AnySeries | null>(null);
  const overlaysRef = useRef<Record<string, AnySeries>>({});
  const linesRef = useRef<IPriceLine[]>([]);
  const extraSeriesRef = useRef<AnySeries[]>([]);
  const pendingRef = useRef<{ time: number; price: number } | null>(null);
  const fittedKey = useRef("");
  const candlesRef = useRef<Candle[]>([]);
  const toolRef = useRef(drawingTool);
  const [ready, setReady] = useState(false);
  const [hover, setHover] = useState<Candle | null>(null);
  const [streamStatus, setStreamStatus] = useState<StreamConnectionStatus>("closed");
  const [lastUpdateAt, setLastUpdateAt] = useState<number | null>(null);
  const [clock, setClock] = useState(() => Date.now());

  toolRef.current = drawingTool;

  const query = useQuery({
    queryKey: ["klines", venue, symbol, interval, span],
    queryFn: () => {
      if (venue === "stocks") {
        return getStockKlines({ data: { symbol, interval, span } });
      }
      const startTime = span ? (spanStartMs(span) ?? undefined) : undefined;
      return getKlines({
        data: {
          symbol,
          interval,
          limit: span ? 1000 : 500,
          startTime,
        },
      });
    },
    refetchInterval: venue === "stocks" ? 20_000 : false,
  });

  const [candles, setCandles] = useState<Candle[]>([]);

  useEffect(() => {
    fittedKey.current = "";
    setLastUpdateAt(null);
    setStreamStatus("closed");
  }, [symbol, interval, span, venue]);

  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 5000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (query.data?.ok) {
      setCandles(query.data.candles);
      setHover(query.data.candles.at(-1) ?? null);
      const now = Date.now();
      setLastUpdateAt(now);
      setClock(now);
    }
  }, [query.data]);

  useEffect(() => {
    if (venue !== "stocks" || !lastPrice || lastPrice <= 0) return;
    setCandles((prev) => {
      if (!prev.length) return prev;
      const last = prev[prev.length - 1];
      if (last.close === lastPrice) return prev;
      return [
        ...prev.slice(0, -1),
        {
          ...last,
          close: lastPrice,
          high: Math.max(last.high, lastPrice),
          low: Math.min(last.low, lastPrice),
        },
      ];
    });
  }, [lastPrice, venue]);

  candlesRef.current = candles;

  useEffect(() => {
    if (venue === "stocks") {
      setStreamStatus("closed");
      return;
    }
    const stop = connectKlineStream(symbol, interval, (candle) => {
      const now = Date.now();
      setLastUpdateAt(now);
      setClock(now);
      setCandles((prev) => {
        if (!prev.length) return [candle];
        const last = prev[prev.length - 1];
        if (candle.time === last.time) {
          const next = prev.slice(0, -1);
          next.push(candle);
          return next;
        }
        if (candle.time > last.time) return [...prev, candle];
        return prev;
      });
    }, setStreamStatus);
    return stop;
  }, [symbol, interval, venue]);

  useEffect(() => {
    let dead = false;
    const el = hostRef.current;
    if (!el) return;

    const pending = lcReady ?? import("lightweight-charts");
    pending.then((lc) => {
      if (dead || !hostRef.current) return;
      lcRef.current = lc;
      const chart = lc.createChart(hostRef.current, {
        autoSize: true,
        layout: {
          background: { type: lc.ColorType.Solid, color: theme.bg },
          textColor: theme.muted,
          fontFamily: "IBM Plex Sans, sans-serif",
          fontSize: 11,
          attributionLogo: true,
        },
        grid: {
          vertLines: { color: theme.grid },
          horzLines: { color: theme.grid },
        },
        crosshair: {
          mode: lc.CrosshairMode.Normal,
          vertLine: { color: "rgba(209,212,220,0.35)", width: 1, style: lc.LineStyle.Dashed },
          horzLine: { color: "rgba(209,212,220,0.35)", width: 1, style: lc.LineStyle.Dashed },
        },
        rightPriceScale: {
          borderColor: theme.border,
          scaleMargins: { top: 0.08, bottom: 0.18 },
        },
        timeScale: {
          borderColor: theme.border,
          timeVisible: true,
          secondsVisible: false,
        },
        handleScroll: { mouseWheel: true, pressedMouseMove: true },
        handleScale: { axisPressedMouseMove: true, mouseWheel: true, pinch: true },
      });
      chartRef.current = chart;
      setReady(true);

      const onMove = (param: MouseEventParams<Time>) => {
        if (!param.time) return;
        const match = candlesRef.current.find((c) => c.time === Number(param.time));
        if (match) setHover(match);
      };
      chart.subscribeCrosshairMove(onMove);

      const onClick = (param: MouseEventParams<Time>) => {
        const tool = toolRef.current;
        const chartApi = chartRef.current;
        const series = mainRef.current;
        if (tool === "cursor" || !param.point || !param.time || !chartApi || !series) return;
        const raw = series.coordinateToPrice(param.point.y);
        if (raw == null) return;
        const time = Number(param.time);
        const price = snapPrice(candlesRef.current, time, raw);
        const pending = pendingRef.current;
        if (tool === "hline") {
          addDrawing({ id: crypto.randomUUID(), kind: "hline", price });
          setDrawingTool("cursor");
          return;
        }
        if (!pending) {
          pendingRef.current = { time, price };
          return;
        }
        addDrawing({
          id: crypto.randomUUID(),
          kind: tool === "fib" ? "fib" : "trend",
          t1: pending.time,
          p1: pending.price,
          t2: time,
          p2: price,
        });
        pendingRef.current = null;
        setDrawingTool("cursor");
      };
      chart.subscribeClick(onClick);
    });

    return () => {
      dead = true;
      setReady(false);
      chartRef.current?.remove();
      chartRef.current = null;
      mainRef.current = null;
      overlaysRef.current = {};
      extraSeriesRef.current = [];
      linesRef.current = [];
    };
  }, [addDrawing, setDrawingTool]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || !ready) return;
    const tz = chartTimeZone(symbol, venue);
    chart.applyOptions({
      localization: {
        timeFormatter: (time: number) => formatCandleTime(Number(time), interval, tz),
      },
      timeScale: {
        secondsVisible: interval === "1m" || interval === "5m",
      },
    });
  }, [interval, ready, symbol, venue]);

  const referencePrice = candles.at(-1)?.close ?? lastPrice ?? 1;
  const { precision: pricePrecision, minMove: priceMinMove } = precisionOf(
    referencePrice,
    venue === "stocks",
  );

  useEffect(() => {
    const chart = chartRef.current;
    const lc = lcRef.current;
    if (!chart || !lc || !ready) return;
    if (mainRef.current) {
      try {
        chart.removeSeries(mainRef.current);
      } catch {
        /* already gone */
      }
    }
    if (chartType === "candles") {
      mainRef.current = chart.addSeries(lc.CandlestickSeries, {
        upColor: theme.up,
        downColor: theme.down,
        wickUpColor: theme.up,
        wickDownColor: theme.down,
        borderVisible: false,
        priceLineColor: theme.accent,
        priceFormat: { type: "price", precision: pricePrecision, minMove: priceMinMove },
      });
    } else if (chartType === "line") {
      mainRef.current = chart.addSeries(lc.LineSeries, {
        color: theme.accent,
        lineWidth: 2,
        priceLineColor: theme.accent,
        priceFormat: { type: "price", precision: pricePrecision, minMove: priceMinMove },
      });
    } else {
      mainRef.current = chart.addSeries(lc.AreaSeries, {
        lineColor: theme.accent,
        topColor: "rgba(142, 200, 212, 0.28)",
        bottomColor: "rgba(142, 200, 212, 0.02)",
        lineWidth: 2,
        priceFormat: { type: "price", precision: pricePrecision, minMove: priceMinMove },
      });
    }
  }, [chartType, priceMinMove, pricePrecision, ready]);

  const overlayData = useMemo(() => {
    if (!candles.length) return null;
    return {
      sma20: sma(candles, 20),
      sma50: sma(candles, 50),
      sma200: sma(candles, 200),
      ema12: ema(candles, 12),
      ema26: ema(candles, 26),
      bb: bollinger(candles),
      vwap: vwap(candles),
      volume: volumePoints(candles),
      rsi: rsi(candles),
      macd: macd(candles),
    };
  }, [candles]);

  useEffect(() => {
    const chart = chartRef.current;
    const lc = lcRef.current;
    const main = mainRef.current;
    if (!chart || !lc || !main || !overlayData || !candles.length) return;

    if (chartType === "candles") {
      (main as ISeriesApi<"Candlestick">).setData(
        candles.map((c) => ({
          time: asTime(c.time),
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
        })),
      );
    } else {
      (main as ISeriesApi<"Line">).setData(
        candles.map((c) => ({ time: asTime(c.time), value: c.close })),
      );
    }

    const overlays = overlaysRef.current;
    const ensure = (key: string, create: () => AnySeries) => {
      if (!overlays[key]) overlays[key] = create();
      return overlays[key];
    };
    const drop = (key: string) => {
      if (overlays[key]) {
        try {
          chart.removeSeries(overlays[key]);
        } catch {
          /* */
        }
        delete overlays[key];
      }
    };

    const line = (
      key: string,
      color: string,
      data: { time: number; value: number }[],
      width: 1 | 2 = 1,
    ) => {
      if (!data.length) return;
      const series = ensure(key, () =>
        chart.addSeries(lc.LineSeries, {
          color,
          lineWidth: width,
          priceLineVisible: false,
          lastValueVisible: false,
          crosshairMarkerVisible: false,
        }),
      );
      series.setData(data.map((p) => ({ time: asTime(p.time), value: p.value })));
    };

    const toggleLine = (
      on: boolean,
      key: string,
      color: string,
      data: { time: number; value: number }[],
    ) => {
      if (on) line(key, color, data);
      else drop(key);
    };

    toggleLine(indicators.sma20, "sma20", "#2962ff", overlayData.sma20);
    toggleLine(indicators.sma50, "sma50", "#9aa7b8", overlayData.sma50);
    toggleLine(indicators.sma200, "sma200", "#c4c8d0", overlayData.sma200);
    toggleLine(indicators.ema12, "ema12", "#7eb0ea", overlayData.ema12);
    toggleLine(indicators.ema26, "ema26", "#b48ec8", overlayData.ema26);
    toggleLine(indicators.vwap && venue !== "stocks", "vwap", "#e8eaee", overlayData.vwap);

    if (indicators.bb) {
      line("bbu", "rgba(41,98,255,0.45)", overlayData.bb.upper);
      line("bbm", "rgba(41,98,255,0.7)", overlayData.bb.mid);
      line("bbl", "rgba(41,98,255,0.45)", overlayData.bb.lower);
    } else {
      drop("bbu");
      drop("bbm");
      drop("bbl");
    }

    if (indicators.volume) {
      const vol = ensure("vol", () =>
        chart.addSeries(lc.HistogramSeries, {
          priceFormat: { type: "volume" },
          priceScaleId: "volume",
          lastValueVisible: false,
          priceLineVisible: false,
        }),
      );
      chart.priceScale("volume").applyOptions({
        scaleMargins: { top: 0.82, bottom: 0 },
      });
      vol.setData(
        overlayData.volume.map((p) => ({
          time: asTime(p.time),
          value: p.value,
          color: p.color,
        })),
      );
    } else drop("vol");

    let pane = 1;
    if (indicators.rsi) {
      const series = ensure("rsi", () =>
        chart.addSeries(
          lc.LineSeries,
          {
            color: theme.accent,
            lineWidth: 1,
            priceLineVisible: false,
            lastValueVisible: true,
            priceFormat: { type: "price", precision: 2, minMove: 0.01 },
          },
          pane,
        ),
      );
      series.setData(overlayData.rsi.map((p) => ({ time: asTime(p.time), value: p.value })));
      pane += 1;
    } else drop("rsi");

    if (indicators.macd) {
      const hist = ensure("macdH", () =>
        chart.addSeries(
          lc.HistogramSeries,
          { priceLineVisible: false, lastValueVisible: false },
          pane,
        ),
      );
      const macdLine = ensure("macdM", () =>
        chart.addSeries(
          lc.LineSeries,
          { color: theme.accent, lineWidth: 1, priceLineVisible: false, lastValueVisible: false },
          pane,
        ),
      );
      const sig = ensure("macdS", () =>
        chart.addSeries(
          lc.LineSeries,
          { color: theme.warn, lineWidth: 1, priceLineVisible: false, lastValueVisible: false },
          pane,
        ),
      );
      hist.setData(
        overlayData.macd.map((p) => ({
          time: asTime(p.time),
          value: p.hist,
          color: p.hist >= 0 ? "rgba(61,201,138,0.55)" : "rgba(224,90,90,0.55)",
        })),
      );
      macdLine.setData(overlayData.macd.map((p) => ({ time: asTime(p.time), value: p.macd })));
      sig.setData(overlayData.macd.map((p) => ({ time: asTime(p.time), value: p.signal })));
    } else {
      drop("macdH");
      drop("macdM");
      drop("macdS");
    }

    const rangeKey = `${symbol}:${interval}:${span ?? ""}:${venue}:${candles[0].time}`;
    if (fittedKey.current !== rangeKey) {
      const start = span && span !== "ALL" ? spanStartMs(span) : null;
      if (venue === "stocks" && (span === "1D" || !span)) {
        chart.timeScale().fitContent();
      } else if (start) {
        const from = Math.max(Math.floor(start / 1000), candles[0].time);
        const to = candles[candles.length - 1].time;
        try {
          chart.timeScale().setVisibleRange({
            from: asTime(from),
            to: asTime(to),
          });
        } catch {
          chart.timeScale().fitContent();
        }
      } else {
        chart.timeScale().fitContent();
      }
      fittedKey.current = rangeKey;
    }
  }, [candles, overlayData, indicators, chartType, ready, symbol, interval, span, venue]);

  useEffect(() => {
    const chart = chartRef.current;
    const lc = lcRef.current;
    const main = mainRef.current;
    if (!chart || !lc || !main || !ready) return;

    for (const line of linesRef.current) {
      try {
        main.removePriceLine(line);
      } catch {
        /* */
      }
    }
    linesRef.current = [];
    for (const series of extraSeriesRef.current) {
      try {
        chart.removeSeries(series);
      } catch {
        /* */
      }
    }
    extraSeriesRef.current = [];

    const apply = (d: StoredDrawing) => {
      if (d.kind === "hline") {
        const line = main.createPriceLine({
          price: d.price,
          color: theme.accent,
          lineWidth: 1,
          lineStyle: lc.LineStyle.Dashed,
          axisLabelVisible: true,
          title: formatPrice(d.price),
        });
        linesRef.current.push(line);
      } else if (d.kind === "trend") {
        const series = chart.addSeries(lc.LineSeries, {
          color: theme.accent,
          lineWidth: 2,
          lastValueVisible: false,
          priceLineVisible: false,
          crosshairMarkerVisible: false,
        });
        const a = { time: asTime(Math.min(d.t1, d.t2)), value: d.t1 <= d.t2 ? d.p1 : d.p2 };
        const b = { time: asTime(Math.max(d.t1, d.t2)), value: d.t1 <= d.t2 ? d.p2 : d.p1 };
        series.setData([a, b]);
        extraSeriesRef.current.push(series);
      } else {
        const lo = Math.min(d.p1, d.p2);
        const hi = Math.max(d.p1, d.p2);
        const span = hi - lo || 1;
        for (const fib of FIBS) {
          const price = hi - span * fib.level;
          const line = main.createPriceLine({
            price,
            color: fib.color,
            lineWidth: 1,
            lineStyle: lc.LineStyle.SparseDotted,
            axisLabelVisible: true,
            title: `${fib.level}`,
          });
          linesRef.current.push(line);
        }
      }
    };
    drawings.forEach(apply);
  }, [drawings, ready, symbol, chartType, priceMinMove, pricePrecision]);

  const last = candles.at(-1);
  const shown = hover ?? last;
  const up = shown ? shown.close >= shown.open : true;
  const updateAge = lastUpdateAt === null ? null : Math.max(0, clock - lastUpdateAt);
  const stale = updateAge !== null && updateAge > 15_000;
  const updateLabel = updateAge === null ? null : formatUpdateAge(updateAge);
  const feed = (() => {
    if (venue === "stocks") {
      if (!quote) return { label: "Updating", className: "text-subtle" };
      const status = quoteFeedStatus(quote, clock / 1000);
      const className =
        status.freshness === "real-time" || status.freshness === "recent"
          ? "text-accent"
          : status.freshness === "stale"
            ? "text-warn"
            : "text-subtle";
      return {
        label: `${status.label} · ${status.updatedLabel.toLowerCase()}`,
        className,
      };
    }
    if (streamStatus === "open" && !stale) {
      return {
        label: `Live${updateLabel ? ` · updated ${updateLabel}` : ""}`,
        className: "text-accent",
      };
    }
    if (streamStatus === "connecting") {
      return { label: "Connecting", className: "text-subtle" };
    }
    if (streamStatus === "reconnecting") {
      return {
        label: `Reconnecting${updateLabel ? ` · updated ${updateLabel}` : ""}`,
        className: "text-warn",
      };
    }
    return {
      label: `Offline${updateLabel ? ` · updated ${updateLabel}` : ""}`,
      className: "text-warn",
    };
  })();
  const hint =
    drawingTool === "hline"
      ? "Click the chart to place a price line"
      : drawingTool === "trend"
        ? pendingRef.current
          ? "Click the second point"
          : "Click two points for a trend line"
        : drawingTool === "fib"
          ? pendingRef.current
            ? "Click the second point"
            : "Click swing low, then swing high"
          : null;

  return (
    <div className="relative min-h-0 flex-1 bg-bg">
      <div ref={hostRef} className="absolute inset-0" />
      <div className="pointer-events-none absolute inset-0 hidden items-center justify-center md:flex">
        <span className="text-5xl font-medium tracking-tight text-fg/5">{symbol}</span>
      </div>
      {shown && (
        <div className="pointer-events-none absolute top-2 left-3 z-10 font-mono text-xs tabular-nums">
          <span className="text-muted md:hidden">
            {interval.toUpperCase()}
            <span className={`ml-2 ${feed.className}`}>{feed.label}</span>
          </span>
          <span className="hidden md:inline">
            <span className="text-muted">{symbol} · {span ? `${span} · ` : ""}{interval.toUpperCase()} · </span>
            <span className={up ? "text-up" : "text-down"}>
              O {formatPrice(shown.open)} H {formatPrice(shown.high)} L {formatPrice(shown.low)} C{" "}
              {formatPrice(shown.close)}
            </span>
            <span className="text-muted"> · Vol {formatCompact(shown.volume)}</span>
            {shown.time && (
              <span className="ml-2 text-subtle">
                {formatCandleTime(shown.time, interval, chartTimeZone(symbol, venue))}
              </span>
            )}
            <span className={`ml-2 ${feed.className}`}>{feed.label}</span>
          </span>
        </div>
      )}
      {hint && (
        <div className="absolute bottom-3 left-1/2 z-10 -translate-x-1/2 rounded-md bg-elevated px-3 py-1 text-xs text-fg shadow-border">
          {hint}
        </div>
      )}
      {(query.isFetching || query.isLoading) && !candles.length && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-6 bg-bg/80 p-6">
          <div className="flex h-40 items-end gap-1.5">
            {[40, 62, 48, 78, 55, 88, 70, 96, 64, 84, 58, 92].map((h, i) => (
              <span
                key={i}
                className="w-2.5 rounded-sm"
                style={{
                  height: `${h}%`,
                  background: i % 3 === 0 ? "var(--color-down)" : "var(--color-up)",
                  opacity: 0.85,
                }}
              />
            ))}
          </div>
          <p className="font-sans text-sm text-muted">Loading {symbol}</p>
        </div>
      )}
      {query.data && !query.data.ok && !candles.length && (
        <div className="absolute inset-0 z-10 flex items-center justify-center p-6 text-center">
          <p className="max-w-sm text-sm text-muted">
            Candles paused. {query.data.error} Last {lastPrice ? formatPrice(lastPrice) : "print"}{" "}
            still follows the live tape when it can.
          </p>
        </div>
      )}
    </div>
  );
}
