import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronUp, ChevronsRight, Moon, Settings, Sun } from "lucide-react";
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
import { intervalLegend, intervalSeconds, spanBarCount, spanStartMs } from "@/lib/market/spans";
import { bollinger, ema, macd, rsi, sma, vwap } from "@/lib/market/indicators";
import { formatCrosshairTime, formatPrice } from "@/lib/market/format";
import { connectKlineStream, type StreamConnectionStatus } from "@/lib/market/ws";
import { CHART_FONT, INDICATOR_COLORS, theme } from "@/lib/theme";
import type { Candle, IndicatorsState, StoredDrawing } from "@/lib/market/types";
import { chartTimeZone, exchangeLabel } from "@/lib/market/venue";
import { baseAsset, pairName } from "@/lib/market/symbols";
import { useTerminalStore } from "@/lib/store";
import { AxisLabel, SessionBands } from "./session-bands";
import { CoinIcon } from "./coin-icon";
import { ChartSettingsDialog } from "./chart-settings";
import { useLayoutMode } from "@/hooks/use-is-desktop";
import { cn } from "@/lib/utils";

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

function snapPrice(candles: Candle[], time: number, price: number) {
  let candle = candles.find((c) => c.time === time);
  if (!candle && candles.length) {
    candle = candles.reduce((best, c) =>
      Math.abs(c.time - time) < Math.abs(best.time - time) ? c : best,
    );
  }
  if (!candle) return price;
  const levels = [candle.open, candle.high, candle.low, candle.close];
  const near = levels.reduce((best, level) =>
    Math.abs(level - price) < Math.abs(best - price) ? level : best,
  );
  // Magnet only when the click is close to an OHLC level (within 0.4%).
  return Math.abs(near - price) / Math.max(Math.abs(price), 1e-12) < 0.004 ? near : price;
}

function formatCountdown(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const d = Math.floor(s / 86_400);
  const h = Math.floor((s % 86_400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  if (d > 0) return `${d}d ${pad(h)}h`;
  if (h > 0) return `${pad(h)}:${pad(m)}:${pad(sec)}`;
  return `${pad(m)}:${pad(sec)}`;
}

const tickFormatters = new Map<string, Intl.DateTimeFormat>();
function tickFormatter(key: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  let fmt = tickFormatters.get(key);
  if (!fmt) {
    try {
      fmt = new Intl.DateTimeFormat("en-GB", options);
    } catch {
      fmt = new Intl.DateTimeFormat("en-GB", { ...options, timeZone: "UTC" });
    }
    tickFormatters.set(key, fmt);
  }
  return fmt;
}

/** Axis labels in the exchange time zone (UTC for crypto), like TradingView's "Exchange" setting. */
function formatTick(time: number, type: number, timeZone = "UTC"): string {
  const date = new Date(time * 1000);
  switch (type) {
    case 0:
      return tickFormatter(`y:${timeZone}`, { timeZone, year: "numeric" }).format(date);
    case 1:
      return tickFormatter(`m:${timeZone}`, { timeZone, month: "short" }).format(date);
    case 2:
      return tickFormatter(`d:${timeZone}`, { timeZone, day: "numeric" }).format(date);
    case 4:
      return tickFormatter(`s:${timeZone}`, {
        timeZone,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      }).format(date);
    default:
      return tickFormatter(`t:${timeZone}`, {
        timeZone,
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(date);
  }
}

const FIBS = [
  { level: 0, color: "#787b86" },
  { level: 0.236, color: "#f23645" },
  { level: 0.382, color: "#ff9800" },
  { level: 0.5, color: "#4caf50" },
  { level: 0.618, color: "#089981" },
  { level: 0.786, color: "#00bcd4" },
  { level: 1, color: "#787b86" },
];

const EMPTY_DRAWINGS: StoredDrawing[] = [];

type OverlayKey = Exclude<keyof IndicatorsState, "volume" | "rsi" | "macd" | "bb">;
const OVERLAY_LEGEND: Array<{ key: OverlayKey; label: string; color: string }> = [
  { key: "sma20", label: "SMA 20 close", color: INDICATOR_COLORS.sma20 },
  { key: "sma50", label: "SMA 50 close", color: INDICATOR_COLORS.sma50 },
  { key: "sma200", label: "SMA 200 close", color: INDICATOR_COLORS.sma200 },
  { key: "ema12", label: "EMA 12 close", color: INDICATOR_COLORS.ema12 },
  { key: "ema26", label: "EMA 26 close", color: INDICATOR_COLORS.ema26 },
  { key: "vwap", label: "VWAP Session hlc3", color: INDICATOR_COLORS.vwap },
];

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
  const extendedHours = useTerminalStore((s) => s.extendedHours);
  const priceScaleMode = useTerminalStore((s) => s.priceScaleMode);
  const autoScale = useTerminalStore((s) => s.autoScale);
  const showGrid = useTerminalStore((s) => s.showGrid);
  const showCountdownPref = useTerminalStore((s) => s.showCountdown);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const addDrawing = useTerminalStore((s) => s.addDrawing);
  const setDrawingTool = useTerminalStore((s) => s.setDrawingTool);
  const setAutoScale = useTerminalStore((s) => s.setAutoScale);
  const layout = useLayoutMode();
  const phone = layout === "phone";
  const stocks = venue === "stocks";

  const hostRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const lcRef = useRef<Lc | null>(null);
  const mainRef = useRef<AnySeries | null>(null);
  const overlaysRef = useRef<Record<string, AnySeries>>({});
  const levelLinesRef = useRef<{ series: AnySeries; line: IPriceLine }[]>([]);
  const linesRef = useRef<IPriceLine[]>([]);
  const extLineRef = useRef<IPriceLine | null>(null);
  const regularLineRef = useRef<IPriceLine | null>(null);
  const bandsRef = useRef(new SessionBands({ pre: theme.pre, post: theme.post }));
  const countdownRef = useRef(new AxisLabel());
  const volumeLabelRef = useRef(new AxisLabel());
  const extraSeriesRef = useRef<AnySeries[]>([]);
  const fittedKey = useRef("");
  const candlesRef = useRef<Candle[]>([]);
  const toolRef = useRef(drawingTool);
  const [ready, setReady] = useState(false);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [pending, setPending] = useState<{ time: number; price: number } | null>(null);
  const pendingRef = useRef(pending);
  const [streamStatus, setStreamStatus] = useState<StreamConnectionStatus>("closed");
  const [now, setNow] = useState(() => Date.now());
  const [awayFromEdge, setAwayFromEdge] = useState(false);
  const [scaleWidth, setScaleWidth] = useState(0);
  const [paneTops, setPaneTops] = useState<number[]>([]);
  const [legendOpen, setLegendOpen] = useState(true);


  toolRef.current = drawingTool;
  pendingRef.current = pending;

  // Switching tools abandons a half-placed drawing.
  useEffect(() => {
    setPending(null);
  }, [drawingTool]);

  const query = useQuery({
    queryKey: ["klines", venue, symbol, interval, span, stocks && extendedHours],
    queryFn: () => {
      if (stocks) {
        return getStockKlines({ data: { symbol, interval, span, extended: extendedHours } });
      }
      // Binance pages 1000 bars per call (4 pages max server-side). For spans
      // that would need more, load the latest bars instead of the oldest.
      const bars = span ? spanBarCount(span, interval) : 0;
      const startTime =
        span && bars <= 4000 ? (spanStartMs(span) ?? undefined) : undefined;
      return getKlines({
        data: { symbol, interval, limit: startTime ? 1000 : span ? 1000 : 600, startTime },
      });
    },
    refetchInterval: stocks ? 20_000 : false,
  });

  const [candles, setCandles] = useState<Candle[]>([]);

  useEffect(() => {
    fittedKey.current = "";
    setStreamStatus("closed");
    setPending(null);
    setHoverTime(null);
  }, [symbol, interval, span, venue]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (query.data?.ok) setCandles(query.data.candles);
  }, [query.data]);

  // Stock bars follow the polled quote. Regular bars take the regular price,
  // extended bars take the pre/post print, so the two never overwrite each other.
  const livePrice = stocks
    ? quote?.marketState === "regular"
      ? quote.lastPrice
      : quote?.extPrice
    : undefined;
  const liveSession = quote?.marketState === "regular" ? undefined : quote?.extSession;
  useEffect(() => {
    if (!stocks || !livePrice || livePrice <= 0) return;
    setCandles((prev) => {
      if (!prev.length) return prev;
      const last = prev[prev.length - 1];
      if (last.session !== liveSession || last.close === livePrice) return prev;
      return [
        ...prev.slice(0, -1),
        {
          ...last,
          close: livePrice,
          high: Math.max(last.high, livePrice),
          low: Math.min(last.low, livePrice),
        },
      ];
    });
  }, [livePrice, liveSession, stocks]);

  candlesRef.current = candles;

  useEffect(() => {
    if (stocks) {
      setStreamStatus("closed");
      return;
    }
    const stop = connectKlineStream(
      symbol,
      interval,
      (candle) => {
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
      },
      setStreamStatus,
    );
    return stop;
  }, [symbol, interval, stocks]);

  // Create the chart once.
  useEffect(() => {
    let dead = false;
    const el = hostRef.current;
    if (!el) return;

    const pendingLc = lcReady ?? import("lightweight-charts");
    pendingLc.then((lc) => {
      if (dead || !hostRef.current) return;
      lcRef.current = lc;
      const chart = lc.createChart(hostRef.current, {
        autoSize: true,
        layout: {
          background: { type: lc.ColorType.Solid, color: theme.bg },
          textColor: theme.axis,
          fontFamily: CHART_FONT,
          fontSize: 12,
          attributionLogo: true,
          panes: { separatorColor: theme.border, separatorHoverColor: "rgba(41,98,255,0.25)" },
        },
        grid: {
          vertLines: { color: theme.grid, style: lc.LineStyle.SparseDotted },
          horzLines: { color: theme.grid, style: lc.LineStyle.SparseDotted },
        },
        crosshair: {
          mode: lc.CrosshairMode.Normal,
          vertLine: {
            color: theme.crosshair,
            width: 1,
            style: lc.LineStyle.LargeDashed,
            labelBackgroundColor: theme.crosshairLabel,
          },
          horzLine: {
            color: theme.crosshair,
            width: 1,
            style: lc.LineStyle.LargeDashed,
            labelBackgroundColor: theme.crosshairLabel,
          },
        },
        rightPriceScale: {
          borderVisible: false,
          scaleMargins: { top: 0.1, bottom: 0.08 },
          entireTextOnly: true,
        },
        timeScale: {
          borderVisible: false,
          timeVisible: true,
          secondsVisible: false,
          rightOffset: 8,
          barSpacing: 7,
          minBarSpacing: 0.5,
        },
        kineticScroll: { touch: true, mouse: false },
        handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false },
        handleScale: { axisPressedMouseMove: true, mouseWheel: true, pinch: true },
      });
      chartRef.current = chart;
      setReady(true);

      chart.subscribeCrosshairMove((param: MouseEventParams<Time>) => {
        setHoverTime(param.time ? Number(param.time) : null);
      });

      chart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
        const lastIndex = candlesRef.current.length - 1;
        setAwayFromEdge(!!range && lastIndex > 0 && range.to < lastIndex - 1);
      });

      chart.subscribeClick((param: MouseEventParams<Time>) => {
        const tool = toolRef.current;
        const series = mainRef.current;
        if (tool === "cursor" || !param.point || !param.time || !series) return;
        // Drawings live on the price pane only.
        if ((param.paneIndex ?? 0) !== 0) return;
        const raw = series.coordinateToPrice(param.point.y);
        if (raw == null) return;
        const time = Number(param.time);
        const price = snapPrice(candlesRef.current, time, raw);
        const first = pendingRef.current;
        if (tool === "hline") {
          addDrawing({ id: crypto.randomUUID(), kind: "hline", price });
          setDrawingTool("cursor");
          return;
        }
        if (!first) {
          setPending({ time, price });
          return;
        }
        if (first.time === time) return;
        addDrawing({
          id: crypto.randomUUID(),
          kind: tool === "fib" ? "fib" : "trend",
          t1: first.time,
          p1: first.price,
          t2: time,
          p2: price,
        });
        setPending(null);
        setDrawingTool("cursor");
      });
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
      levelLinesRef.current = [];
      extLineRef.current = null;
    };
  }, [addDrawing, setDrawingTool]);

  const timeZone = chartTimeZone(symbol, venue) ?? "UTC";

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || !ready) return;
    chart.applyOptions({
      localization: {
        timeFormatter: (time: number) => formatCrosshairTime(Number(time), interval, timeZone),
      },
      timeScale: {
        secondsVisible: false,
        tickMarkFormatter: (time: Time, type: number) => formatTick(Number(time), type, timeZone),
      },
    });
  }, [interval, ready, timeZone]);

  useEffect(() => {
    const chart = chartRef.current;
    const lc = lcRef.current;
    if (!chart || !lc || !ready) return;
    const mode =
      priceScaleMode === "log"
        ? lc.PriceScaleMode.Logarithmic
        : priceScaleMode === "percent"
          ? lc.PriceScaleMode.Percentage
          : lc.PriceScaleMode.Normal;
    chart.priceScale("right").applyOptions({ mode, autoScale });
  }, [priceScaleMode, autoScale, ready]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || !ready) return;
    chart.applyOptions({
      grid: { vertLines: { visible: showGrid }, horzLines: { visible: showGrid } },
    });
  }, [showGrid, ready]);

  // Leaving auto-scale when the user drags the price axis, like TradingView.
  useEffect(() => {
    const el = hostRef.current;
    if (!el || !ready) return;
    const onDown = (event: PointerEvent) => {
      const chart = chartRef.current;
      if (!chart) return;
      const width = chart.priceScale("right").width();
      const rect = el.getBoundingClientRect();
      if (event.clientX >= rect.right - width) setAutoScale(false);
    };
    el.addEventListener("pointerdown", onDown);
    return () => el.removeEventListener("pointerdown", onDown);
  }, [ready, setAutoScale]);

  const referencePrice = candles.at(-1)?.close ?? quote?.lastPrice ?? 1;
  const { precision: pricePrecision, minMove: priceMinMove } = precisionOf(referencePrice, stocks);

  // Main series.
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
      extLineRef.current = null;
      regularLineRef.current = null;
      levelLinesRef.current = [];
      linesRef.current = [];
    }
    const grouped = new Intl.NumberFormat("en-US", {
      minimumFractionDigits: pricePrecision,
      maximumFractionDigits: pricePrecision,
    });
    const priceFormat = {
      type: "custom" as const,
      minMove: priceMinMove,
      formatter: (price: number) => grouped.format(price),
    };
    const common = {
      priceFormat,
      priceLineStyle: lc.LineStyle.Dotted,
      priceLineWidth: 1 as const,
    };
    if (chartType === "candles" || chartType === "hollow") {
      const hollow = chartType === "hollow";
      mainRef.current = chart.addSeries(lc.CandlestickSeries, {
        ...common,
        upColor: hollow ? "rgba(0,0,0,0)" : theme.up,
        downColor: theme.down,
        borderVisible: true,
        borderUpColor: theme.up,
        borderDownColor: theme.down,
        wickUpColor: theme.up,
        wickDownColor: theme.down,
      });
    } else if (chartType === "bars") {
      mainRef.current = chart.addSeries(lc.BarSeries, {
        ...common,
        upColor: theme.up,
        downColor: theme.down,
        thinBars: false,
      });
    } else if (chartType === "line") {
      mainRef.current = chart.addSeries(lc.LineSeries, {
        ...common,
        color: theme.accent,
        lineWidth: 2,
        priceLineColor: theme.accent,
      });
    } else if (chartType === "baseline") {
      mainRef.current = chart.addSeries(lc.BaselineSeries, {
        ...common,
        baseValue: { type: "price", price: candlesRef.current[0]?.close ?? 0 },
        topLineColor: theme.up,
        topFillColor1: "rgba(8,153,129,0.28)",
        topFillColor2: "rgba(8,153,129,0.05)",
        bottomLineColor: theme.down,
        bottomFillColor1: "rgba(242,54,69,0.05)",
        bottomFillColor2: "rgba(242,54,69,0.28)",
        lineWidth: 2,
      });
    } else {
      mainRef.current = chart.addSeries(lc.AreaSeries, {
        ...common,
        lineColor: theme.accent,
        topColor: "rgba(41,98,255,0.28)",
        bottomColor: "rgba(41,98,255,0.02)",
        lineWidth: 2,
        priceLineColor: theme.accent,
      });
    }
    mainRef.current.attachPrimitive(bandsRef.current);
    mainRef.current.attachPrimitive(countdownRef.current);
    mainRef.current.attachPrimitive(volumeLabelRef.current);
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
      vwap: vwap(candles, stocks ? timeZone : undefined),
      rsi: rsi(candles),
      macd: macd(candles),
    };
  }, [candles, stocks, timeZone]);

  const hasExtended = useMemo(() => candles.some((c) => c.session), [candles]);

  // Series data, overlays and panes.
  useEffect(() => {
    const chart = chartRef.current;
    const lc = lcRef.current;
    const main = mainRef.current;
    if (!chart || !lc || !main || !overlayData || !candles.length) return;

    if (chartType === "candles" || chartType === "hollow" || chartType === "bars") {
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
      if (chartType === "baseline") {
        main.applyOptions({ baseValue: { type: "price", price: candles[0].close } });
      }
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

    // Extended-hours background bands behind the candles.
    bandsRef.current.setCandles(hasExtended ? candles : []);

    const line = (
      key: string,
      color: string,
      data: { time: number; value: number }[],
      width: 1 | 2 = 1,
    ) => {
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

    for (const item of OVERLAY_LEGEND) {
      if (indicators[item.key]) line(item.key, item.color, overlayData[item.key]);
      else drop(item.key);
    }

    if (indicators.bb) {
      line("bbu", INDICATOR_COLORS.bbBand, overlayData.bb.upper);
      line("bbm", INDICATOR_COLORS.bbBasis, overlayData.bb.mid);
      line("bbl", INDICATOR_COLORS.bbBand, overlayData.bb.lower);
    } else {
      drop("bbu");
      drop("bbm");
      drop("bbl");
    }

    if (indicators.volume) {
      const vol = ensure("vol", () => {
        const series = chart.addSeries(lc.HistogramSeries, {
          priceFormat: { type: "volume" },
          priceScaleId: "volume",
          lastValueVisible: false,
          priceLineVisible: false,
        });
        chart.priceScale("volume").applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });
        return series;
      });
      vol.setData(
        candles.map((c) => ({
          time: asTime(c.time),
          value: c.volume,
          color: c.close >= c.open ? "rgba(8,153,129,0.5)" : "rgba(242,54,69,0.5)",
        })),
      );
    } else drop("vol");

    // Indicator panes. Rebuild level lines each time panes may have moved.
    for (const { series, line: priceLine } of levelLinesRef.current) {
      try {
        series.removePriceLine(priceLine);
      } catch {
        /* */
      }
    }
    levelLinesRef.current = [];

    let pane = 1;
    if (indicators.rsi) {
      const series = ensure("rsi", () =>
        chart.addSeries(
          lc.LineSeries,
          {
            color: INDICATOR_COLORS.rsi,
            lineWidth: 1,
            priceLineVisible: false,
            lastValueVisible: true,
            crosshairMarkerVisible: false,
            priceFormat: { type: "price", precision: 2, minMove: 0.01 },
            autoscaleInfoProvider: () => ({ priceRange: { minValue: 0, maxValue: 100 } }),
          },
          pane,
        ),
      );
      if (series.getPane().paneIndex() !== pane) series.moveToPane(pane);
      series.setData(overlayData.rsi.map((p) => ({ time: asTime(p.time), value: p.value })));
      for (const level of [70, 50, 30]) {
        levelLinesRef.current.push({
          series,
          line: series.createPriceLine({
            price: level,
            color: level === 50 ? "rgba(120,123,134,0.5)" : "#787b86",
            lineWidth: 1,
            lineStyle: level === 50 ? lc.LineStyle.Dotted : lc.LineStyle.Dashed,
            axisLabelVisible: false,
            title: "",
          }),
        });
      }
      pane += 1;
    } else drop("rsi");

    if (indicators.macd) {
      const hist = ensure("macdH", () =>
        chart.addSeries(lc.HistogramSeries, { priceLineVisible: false, lastValueVisible: false }, pane),
      );
      const macdLine = ensure("macdM", () =>
        chart.addSeries(
          lc.LineSeries,
          {
            color: INDICATOR_COLORS.macd,
            lineWidth: 1,
            priceLineVisible: false,
            lastValueVisible: false,
            crosshairMarkerVisible: false,
          },
          pane,
        ),
      );
      const sig = ensure("macdS", () =>
        chart.addSeries(
          lc.LineSeries,
          {
            color: INDICATOR_COLORS.signal,
            lineWidth: 1,
            priceLineVisible: false,
            lastValueVisible: false,
            crosshairMarkerVisible: false,
          },
          pane,
        ),
      );
      for (const s of [hist, macdLine, sig]) {
        if (s.getPane().paneIndex() !== pane) s.moveToPane(pane);
      }
      hist.setData(
        overlayData.macd.map((p, i, all) => {
          const prev = all[i - 1]?.hist ?? p.hist;
          const color =
            p.hist >= 0
              ? p.hist >= prev
                ? INDICATOR_COLORS.histUpStrong
                : INDICATOR_COLORS.histUpWeak
              : p.hist <= prev
                ? INDICATOR_COLORS.histDownStrong
                : INDICATOR_COLORS.histDownWeak;
          return { time: asTime(p.time), value: p.hist, color };
        }),
      );
      macdLine.setData(overlayData.macd.map((p) => ({ time: asTime(p.time), value: p.macd })));
      sig.setData(overlayData.macd.map((p) => ({ time: asTime(p.time), value: p.signal })));
    } else {
      drop("macdH");
      drop("macdM");
      drop("macdS");
    }

    // Keep the price pane dominant: indicator panes take ~22% each.
    const panes = chart.panes();
    if (panes.length > 1) {
      const total = panes.reduce((sum, p) => sum + p.getHeight(), 0);
      const sub = Math.max(64, Math.round(total * (phone ? 0.2 : 0.22)));
      panes.forEach((p, i) => {
        if (i > 0) p.setHeight(sub);
      });
      panes[0].setHeight(Math.max(120, total - sub * (panes.length - 1)));
    }

    const rangeKey = `${symbol}:${interval}:${span ?? ""}:${venue}:${candles[0].time}`;
    if (fittedKey.current !== rangeKey) {
      const start = span && span !== "ALL" ? spanStartMs(span) : null;
      if (start && stocks) {
        // Yahoo returns exactly the requested range (e.g. the last session for 1D).
        chart.timeScale().fitContent();
      } else if (start) {
        // Anchor the window to the latest bar, not the wall clock, so weekends
        // and gaps still show a full range.
        const to = candles[candles.length - 1].time;
        const width = Math.floor((Date.now() - start) / 1000);
        const from = Math.max(to - width, candles[0].time);
        try {
          chart.timeScale().setVisibleRange({ from: asTime(from), to: asTime(to) });
        } catch {
          chart.timeScale().fitContent();
        }
      } else if (span === "ALL" || candles.length < 150) {
        chart.timeScale().fitContent();
      } else {
        // TradingView opens on the most recent bars at the default spacing.
        chart.timeScale().applyOptions({ barSpacing: phone ? 5 : 7, rightOffset: 8 });
        chart.timeScale().scrollToRealTime();
      }
      fittedKey.current = rangeKey;
    }
  }, [
    candles,
    overlayData,
    indicators,
    chartType,
    ready,
    symbol,
    interval,
    span,
    venue,
    hasExtended,
    phone,
    stocks,
  ]);

  // Toolbar camera button: download a PNG of the chart.
  useEffect(() => {
    const onSnap = () => {
      const chart = chartRef.current;
      if (!chart) return;
      chart.takeScreenshot().toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `${symbol}_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.png`;
        link.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      });
    };
    window.addEventListener("aether:snapshot", onSnap);
    return () => window.removeEventListener("aether:snapshot", onSnap);
  }, [symbol]);

  // "Go to date" from the bottom bar: centre the chart on the nearest bar.
  const goToTime = useTerminalStore((s) => s.goToTime);
  useEffect(() => {
    const chart = chartRef.current;
    const data = candlesRef.current;
    if (!chart || !goToTime || !data.length) return;
    let idx = data.findIndex((c) => c.time >= goToTime.at);
    if (idx < 0) idx = data.length - 1;
    const range = chart.timeScale().getVisibleLogicalRange();
    const half = range ? Math.max(10, (range.to - range.from) / 2) : 60;
    chart.timeScale().setVisibleLogicalRange({ from: idx - half, to: idx + half });
  }, [goToTime]);

  // Pane tops for indicator legends.
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || !ready) return;
    const measure = () => {
      const tops: number[] = [];
      let y = 0;
      for (const p of chart.panes()) {
        tops.push(y);
        y += p.getHeight() + 1;
      }
      setPaneTops(tops);
      setScaleWidth(chart.priceScale("right").width());
    };
    const id = window.requestAnimationFrame(measure);
    return () => window.cancelAnimationFrame(id);
  }, [ready, indicators.rsi, indicators.macd, candles.length, now]);

  // Extended hours on the price axis, TradingView style: an orange "Pre" /
  // blue "Post" tag for the latest extended print, and the regular close keeps
  // its own label even when the newest candle is an extended-hours bar.
  const lastIsExtended = !!candles.at(-1)?.session;
  useEffect(() => {
    const main = mainRef.current;
    const lc = lcRef.current;
    if (!main || !lc || !ready) return;
    for (const line of [extLineRef.current, regularLineRef.current]) {
      if (!line) continue;
      try {
        main.removePriceLine(line);
      } catch {
        /* */
      }
    }
    extLineRef.current = null;
    regularLineRef.current = null;
    const showExt = stocks && !!quote?.extPrice && !!quote.extSession;
    // With an extended bar last, the series' own label would duplicate the Pre/Post tag.
    main.applyOptions({ lastValueVisible: !(showExt && lastIsExtended), priceLineVisible: !(showExt && lastIsExtended) });
    if (!showExt || !quote?.extPrice || !quote.extSession) return;
    const color = quote.extSession === "pre" ? theme.preLine : theme.postLine;
    extLineRef.current = main.createPriceLine({
      price: quote.extPrice,
      color,
      lineWidth: 1,
      lineStyle: lc.LineStyle.Dotted,
      axisLabelVisible: true,
      axisLabelColor: color,
      axisLabelTextColor: "#ffffff",
      title: quote.extSession === "pre" ? "Pre" : "Post",
    });
    if (lastIsExtended && quote.lastPrice > 0) {
      const regularColor = quote.priceChange >= 0 ? theme.up : theme.down;
      regularLineRef.current = main.createPriceLine({
        price: quote.lastPrice,
        color: regularColor,
        lineWidth: 1,
        lineStyle: lc.LineStyle.Dashed,
        axisLabelVisible: true,
        axisLabelColor: regularColor,
        axisLabelTextColor: "#ffffff",
        title: "",
      });
    }
  }, [
    quote?.extPrice,
    quote?.extSession,
    quote?.lastPrice,
    quote?.priceChange,
    stocks,
    lastIsExtended,
    ready,
    chartType,
    pricePrecision,
  ]);

  // Drawings.
  useEffect(() => {
    const chart = chartRef.current;
    const lc = lcRef.current;
    const main = mainRef.current;
    if (!chart || !lc || !main || !ready) return;

    for (const priceLine of linesRef.current) {
      try {
        main.removePriceLine(priceLine);
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

    for (const d of drawings) {
      if (d.kind === "hline") {
        linesRef.current.push(
          main.createPriceLine({
            price: d.price,
            color: theme.accent,
            lineWidth: 1,
            lineStyle: lc.LineStyle.Solid,
            axisLabelVisible: true,
            title: "",
          }),
        );
      } else if (d.kind === "trend") {
        if (d.t1 === d.t2) continue;
        const series = chart.addSeries(lc.LineSeries, {
          color: theme.accent,
          lineWidth: 2,
          lastValueVisible: false,
          priceLineVisible: false,
          crosshairMarkerVisible: false,
          pointMarkersVisible: true,
          pointMarkersRadius: 3,
          autoscaleInfoProvider: () => null,
        });
        const a = { time: asTime(Math.min(d.t1, d.t2)), value: d.t1 <= d.t2 ? d.p1 : d.p2 };
        const b = { time: asTime(Math.max(d.t1, d.t2)), value: d.t1 <= d.t2 ? d.p2 : d.p1 };
        series.setData([a, b]);
        extraSeriesRef.current.push(series);
      } else {
        const from = d.p1;
        const to = d.p2;
        for (const fib of FIBS) {
          const price = to - (to - from) * fib.level;
          linesRef.current.push(
            main.createPriceLine({
              price,
              color: fib.color,
              lineWidth: 1,
              lineStyle: lc.LineStyle.Solid,
              axisLabelVisible: true,
              title: `${fib.level} (${formatPrice(price)})`,
            }),
          );
        }
      }
    }
  }, [drawings, ready, symbol, chartType, priceMinMove, pricePrecision]);

  const last = candles.at(-1);

  // Countdown to bar close under the last-price label.
  const step = intervalSeconds(interval);
  const nextClose = last ? last.time + step : 0;
  const remaining = nextClose - now / 1000;
  const showCountdown =
    showCountdownPref &&
    !!last &&
    remaining > 0 &&
    remaining <= step &&
    (!stocks || (interval !== "1d" && interval !== "1w" && (quote?.marketState === "regular" || !!last.session)));

  const countdownText = showCountdown ? formatCountdown(remaining) : null;
  const lastClose = last?.close;
  const lastUp = last ? last.close >= last.open : true;
  useEffect(() => {
    const main = mainRef.current;
    countdownRef.current.set(
      countdownText && lastClose !== undefined && main
        ? {
            y: () => {
              const y = main.priceToCoordinate(lastClose);
              return y === null ? null : y + 18;
            },
            text: countdownText,
            color: lastUp ? theme.up : theme.down,
            key: `${countdownText}:${lastClose}:${lastUp}`,
          }
        : null,
    );
  }, [countdownText, lastClose, lastUp, chartType, ready]);

  // Volume value on the price axis at the volume bar's height.
  const lastVolume = last?.volume;
  useEffect(() => {
    const vol = overlaysRef.current.vol;
    volumeLabelRef.current.set(
      indicators.volume && vol && lastVolume !== undefined
        ? {
            y: () => vol.priceToCoordinate(lastVolume),
            text: formatVolume(lastVolume),
            color: lastUp ? "rgba(8,153,129,0.85)" : "rgba(242,54,69,0.85)",
            key: `${lastVolume}:${lastUp}:${candles.length}`,
          }
        : null,
    );
  }, [lastVolume, lastUp, indicators.volume, ready, chartType, candles.length]);

  // Legend values.
  const hoverIndex = useMemo(() => {
    if (hoverTime === null) return candles.length - 1;
    let lo = 0;
    let hi = candles.length - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (candles[mid].time === hoverTime) return mid;
      if (candles[mid].time < hoverTime) lo = mid + 1;
      else hi = mid - 1;
    }
    return candles.length - 1;
  }, [candles, hoverTime]);
  const shown = candles[hoverIndex];
  const prevBar = candles[hoverIndex - 1];
  const barChange = shown && prevBar ? shown.close - prevBar.close : shown ? shown.close - shown.open : 0;
  const barChangePct = shown ? (barChange / (prevBar?.close || shown.open || 1)) * 100 : 0;
  const up = barChange >= 0;
  const valueAt = (data: { time: number; value: number }[] | undefined) => {
    if (!data?.length || !shown) return null;
    for (let i = data.length - 1; i >= 0; i--) {
      if (data[i].time === shown.time) return data[i].value;
      if (data[i].time < shown.time) return null;
    }
    return null;
  };
  const macdAt = overlayData?.macd.find((p) => p.time === shown?.time);
  const fmt = (n: number | null | undefined) =>
    n == null || !Number.isFinite(n)
      ? "∅"
      : n.toLocaleString("en-US", {
          minimumFractionDigits: pricePrecision,
          maximumFractionDigits: pricePrecision,
        });

  const feedDot: SessionState = (() => {
    if (stocks) {
      const state = quote?.marketState;
      if (state === "regular") return "open";
      if (state === "pre") return "pre";
      if (state === "post") return "post";
      return "closed";
    }
    if (streamStatus === "open") return "open";
    if (streamStatus === "connecting" || streamStatus === "reconnecting") return "connecting";
    return "offline";
  })();

  const hint =
    drawingTool === "hline"
      ? "Click to place a horizontal line"
      : drawingTool === "trend"
        ? pending
          ? "Click to set the second point"
          : "Click to set the first point"
        : drawingTool === "fib"
          ? pending
            ? "Click to set the end point"
            : "Click to set the start point"
          : null;

  const exchange = stocks ? exchangeLabel(quote?.exchange) : "Binance";
  const title = stocks ? (quote?.shortName || symbol).replace(/\.$/, "") : pairName(symbol);
  const volumeLabel = stocks ? "Vol" : `Vol · ${baseAsset(symbol)}`;

  return (
    <div className="relative min-h-0 flex-1 bg-bg select-none">
      <div ref={hostRef} className={cn("absolute inset-0", drawingTool !== "cursor" && "cursor-crosshair")} />

      {shown && (
        <div
          className="pointer-events-none absolute top-1.5 left-2 z-10 max-w-[calc(100%-5rem)] text-[13px] leading-[20px] tabular-nums md:top-1.5 md:left-2"
          style={{ fontFamily: CHART_FONT }}
        >
          <div className="flex min-w-0 flex-wrap items-center gap-x-1.5">
            <span className="pointer-events-none flex min-w-0 items-center gap-1.5 text-[16px] leading-6 text-fg">
              <CoinIcon symbol={symbol} size={18} />
              <span className="truncate">
                {title}
                {!phone && (
                  <>
                    <span> · </span>
                    {intervalLegend(interval)}
                    {exchange ? <span> · {exchange}</span> : null}
                  </>
                )}
              </span>
            </span>
            <SessionBadge state={feedDot} />
            {!phone && (
              <span className={cn("flex gap-x-1.5", up ? "text-up" : "text-down")}>
                <span><span className="text-fg">O</span>{fmt(shown.open)}</span>
                <span><span className="text-fg">H</span>{fmt(shown.high)}</span>
                <span><span className="text-fg">L</span>{fmt(shown.low)}</span>
                <span><span className="text-fg">C</span>{fmt(shown.close)}</span>
                <span>
                  {barChange >= 0 ? "+" : "−"}
                  {fmt(Math.abs(barChange))} ({barChangePct >= 0 ? "+" : "−"}
                  {Math.abs(barChangePct).toFixed(2)}%)
                </span>
              </span>
            )}
          </div>
          {phone && hoverTime === null && quote && (
            <div
              className={cn(
                "flex flex-wrap gap-x-1.5 text-[15px]",
                quote.priceChange >= 0 ? "text-[#22ab94]" : "text-down",
              )}
            >
              {stocks && quote.marketState !== "regular" && <span className="text-fg">At close:</span>}
              <span>{fmt(quote.lastPrice)}</span>
              <span>
                {quote.priceChange >= 0 ? "+" : "−"}
                {fmt(Math.abs(quote.priceChange))} ({quote.priceChangePercent >= 0 ? "+" : "−"}
                {Math.abs(quote.priceChangePercent).toFixed(2)}%)
              </span>
            </div>
          )}
          {phone && (hoverTime !== null || !quote) && (
            <div className={cn("flex flex-wrap gap-x-1.5 text-[15px]", up ? "text-up" : "text-down")}>
              <span><span className="text-fg">C</span>{fmt(shown.close)}</span>
              <span>
                {barChange >= 0 ? "+" : "−"}
                {fmt(Math.abs(barChange))} ({barChangePct >= 0 ? "+" : "−"}
                {Math.abs(barChangePct).toFixed(2)}%)
              </span>
            </div>
          )}
          {legendOpen && (
            <>
              {indicators.volume && (
                <div className="text-fg">
                  {volumeLabel}{" "}
                  <span className={up ? "text-up" : "text-down"}>{formatVolume(shown.volume)}</span>
                </div>
              )}
              {OVERLAY_LEGEND.filter((item) => indicators[item.key]).map((item) => (
                <div key={item.key} className="text-fg">
                  {item.label} <span style={{ color: item.color }}>{fmt(valueAt(overlayData?.[item.key]))}</span>
                </div>
              ))}
              {indicators.bb && (
                <div className="text-fg">
                  BB 20 2{" "}
                  <span style={{ color: INDICATOR_COLORS.bbBasis }}>{fmt(valueAt(overlayData?.bb.mid))}</span>{" "}
                  <span style={{ color: INDICATOR_COLORS.bbBand }}>{fmt(valueAt(overlayData?.bb.upper))}</span>{" "}
                  <span style={{ color: INDICATOR_COLORS.bbBand }}>{fmt(valueAt(overlayData?.bb.lower))}</span>
                </div>
              )}
            </>
          )}
          {(indicators.volume ||
            indicators.bb ||
            OVERLAY_LEGEND.some((item) => indicators[item.key])) && (
            <button
              type="button"
              onClick={() => setLegendOpen((v) => !v)}
              aria-label={legendOpen ? "Hide indicator legend" : "Show indicator legend"}
              className="pointer-events-auto mt-1 flex h-6 w-7 items-center justify-center rounded-[4px] border border-[#3d3d3d] bg-bg text-fg hover:bg-hover"
            >
              {legendOpen ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
            </button>
          )}
        </div>
      )}

      {indicators.rsi && paneTops[1] !== undefined && (
        <PaneLegend top={paneTops[1]}>
          RSI 14 close <span style={{ color: INDICATOR_COLORS.rsi }}>{fmt(valueAt(overlayData?.rsi))}</span>
        </PaneLegend>
      )}
      {indicators.macd && paneTops[indicators.rsi ? 2 : 1] !== undefined && (
        <PaneLegend top={paneTops[indicators.rsi ? 2 : 1]}>
          MACD 12 26 close 9{" "}
          <span style={{ color: (macdAt?.hist ?? 0) >= 0 ? INDICATOR_COLORS.histUpStrong : INDICATOR_COLORS.histDownStrong }}>
            {fmt(macdAt?.hist)}
          </span>{" "}
          <span style={{ color: INDICATOR_COLORS.macd }}>{fmt(macdAt?.macd)}</span>{" "}
          <span style={{ color: INDICATOR_COLORS.signal }}>{fmt(macdAt?.signal)}</span>
        </PaneLegend>
      )}

      <button
        type="button"
        aria-label="Chart settings"
        title="Settings"
        onClick={() => setSettingsOpen(true)}
        className="absolute right-0 bottom-0 z-10 flex h-7 items-center justify-center text-fg hover:text-strong"
        style={{ width: Math.max(scaleWidth, 28) }}
      >
        <Settings className="size-[18px]" strokeWidth={1.5} />
      </button>
      <ChartSettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />

      {awayFromEdge && (
        <button
          type="button"
          aria-label="Scroll to the most recent bar"
          onClick={() => chartRef.current?.timeScale().scrollToRealTime()}
          className="absolute bottom-9 z-10 flex size-8 items-center justify-center rounded-md bg-[#2a2a2a] text-fg hover:bg-[#363636]"
          style={{ right: scaleWidth + 8 }}
        >
          <ChevronsRight className="size-4" />
        </button>
      )}

      {hint && (
        <div className="absolute bottom-10 left-1/2 z-10 -translate-x-1/2 rounded-md bg-elevated px-3 py-1.5 text-xs text-fg shadow-border">
          {hint}
        </div>
      )}
      {query.isLoading && !candles.length && (
        <div className="absolute inset-0 z-10 flex items-center justify-center">
          <div className="size-8 animate-spin rounded-full border-2 border-border border-t-accent" />
        </div>
      )}
      {query.data && !query.data.ok && !candles.length && (
        <div className="absolute inset-0 z-10 flex items-center justify-center p-6 text-center">
          <p className="max-w-sm text-sm text-muted">
            No chart data. {query.data.error}
          </p>
        </div>
      )}
    </div>
  );
}

type SessionState = "open" | "pre" | "post" | "closed" | "connecting" | "offline";

const SESSION_TITLES: Record<SessionState, string> = {
  open: "Market open",
  pre: "Pre-market",
  post: "Post-market",
  closed: "Market closed",
  connecting: "Connecting to real-time data",
  offline: "Real-time data offline",
};

/** TradingView's market-status chip next to the legend title. */
function SessionBadge({ state }: { state: SessionState }) {
  const title = SESSION_TITLES[state];
  if (state === "pre" || state === "post") {
    const Icon = state === "pre" ? Sun : Moon;
    return (
      <span
        title={title}
        aria-label={title}
        className={cn(
          "pointer-events-auto flex h-5 items-center rounded-full px-1.5",
          state === "pre" ? "bg-warn/20 text-warn" : "bg-accent/25 text-[#6d8dff]",
        )}
      >
        <Icon className="size-3" fill="currentColor" />
      </span>
    );
  }
  const dot =
    state === "open" ? "bg-up" : state === "connecting" ? "bg-warn" : state === "offline" ? "bg-down" : "bg-muted";
  return (
    <span title={title} aria-label={title} className="pointer-events-auto flex size-5 items-center justify-center rounded-full bg-[#1e1e1e]">
      <span className={cn("size-2 rounded-full", dot)} />
    </span>
  );
}

function formatVolume(v: number): string {
  if (!Number.isFinite(v)) return "∅";
  const abs = Math.abs(v);
  if (abs >= 1e9) return `${(v / 1e9).toFixed(2)} B`;
  if (abs >= 1e6) return `${(v / 1e6).toFixed(2)} M`;
  if (abs >= 1e3) return `${(v / 1e3).toFixed(2)} K`;
  if (abs >= 100 || Number.isInteger(v)) return v.toFixed(0);
  return v.toFixed(2);
}

function PaneLegend({ top, children }: { top: number; children: React.ReactNode }) {
  return (
    <div
      className="pointer-events-none absolute left-2 z-10 text-[12px] leading-5 text-fg tabular-nums md:left-3 md:text-[13px]"
      style={{ top: top + 4, fontFamily: CHART_FONT }}
    >
      {children}
    </div>
  );
}
