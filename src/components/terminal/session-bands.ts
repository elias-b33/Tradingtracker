import type {
  IChartApiBase,
  IPrimitivePaneRenderer,
  IPrimitivePaneView,
  ISeriesPrimitive,
  Logical,
  SeriesAttachedParameter,
  Time,
} from "lightweight-charts";
import type { CanvasRenderingTarget2D } from "fancy-canvas";
import type { Candle, MarketSession } from "@/lib/market/types";

type Run = { from: number; to: number; session: MarketSession };

/**
 * Full-height pre-market / post-market background bands, drawn behind the
 * series like TradingView's extended-hours highlighting.
 */
export class SessionBands implements ISeriesPrimitive<Time> {
  private runs: Run[] = [];
  private chart: IChartApiBase<Time> | null = null;
  private requestUpdate: (() => void) | null = null;
  private readonly colors: Record<MarketSession, string>;
  private readonly view: IPrimitivePaneView;

  constructor(colors: Record<MarketSession, string>) {
    this.colors = colors;
    const renderer: IPrimitivePaneRenderer = {
      draw: () => {},
      drawBackground: (target: CanvasRenderingTarget2D) => this.drawBackground(target),
    };
    this.view = { zOrder: () => "bottom", renderer: () => renderer };
  }

  attached(param: SeriesAttachedParameter<Time>) {
    this.chart = param.chart;
    this.requestUpdate = param.requestUpdate;
  }

  detached() {
    this.chart = null;
    this.requestUpdate = null;
  }

  /** Bar indexes must match the main series data. */
  setCandles(candles: Candle[]) {
    const runs: Run[] = [];
    for (let i = 0; i < candles.length; i++) {
      const session = candles[i].session;
      if (!session) continue;
      const last = runs[runs.length - 1];
      if (last && last.session === session && last.to === i - 1) last.to = i;
      else runs.push({ from: i, to: i, session });
    }
    this.runs = runs;
    this.requestUpdate?.();
  }

  paneViews() {
    return [this.view];
  }

  private drawBackground(target: CanvasRenderingTarget2D) {
    const chart = this.chart;
    if (!chart || !this.runs.length) return;
    const ts = chart.timeScale();
    const half = ts.options().barSpacing / 2;
    target.useBitmapCoordinateSpace(({ context, horizontalPixelRatio, bitmapSize }) => {
      for (const run of this.runs) {
        const a = ts.logicalToCoordinate(run.from as Logical);
        const b = ts.logicalToCoordinate(run.to as Logical);
        if (a === null || b === null) continue;
        const x1 = Math.round((a - half) * horizontalPixelRatio);
        const x2 = Math.round((b + half) * horizontalPixelRatio);
        if (x2 < 0 || x1 > bitmapSize.width) continue;
        context.fillStyle = this.colors[run.session];
        context.fillRect(x1, 0, x2 - x1, bitmapSize.height);
      }
    });
  }
}

type AxisLabelState = {
  /** Pixel y on the price axis, evaluated on every redraw. */
  y: () => number | null;
  text: string;
  color: string;
  key: string;
} | null;

/**
 * Extra price-axis label (bar-close countdown, volume value) drawn with the
 * axis' own label style, like TradingView's secondary axis labels.
 */
export class AxisLabel implements ISeriesPrimitive<Time> {
  private state: AxisLabelState = null;
  private requestUpdate: (() => void) | null = null;
  private readonly axisView = {
    coordinate: () => this.state?.y() ?? -100,
    text: () => this.state?.text ?? "",
    textColor: () => "#ffffff",
    backColor: () => this.state?.color ?? "transparent",
    visible: () => !!this.state && this.state.y() !== null,
    tickVisible: () => false,
  };
  private readonly views = [this.axisView];

  attached(param: SeriesAttachedParameter<Time>) {
    this.requestUpdate = param.requestUpdate;
  }

  detached() {
    this.requestUpdate = null;
  }

  set(state: AxisLabelState) {
    if (this.state?.key === state?.key && (this.state === null) === (state === null)) return;
    this.state = state;
    this.requestUpdate?.();
  }

  priceAxisViews() {
    return this.views;
  }
}
