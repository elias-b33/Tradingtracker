/** Chart palette. Mirrors the CSS tokens in styles.css (canvas cannot read CSS vars). */
export const theme = {
  bg: "#000000",
  surface: "#000000",
  elevated: "#1e1e1e",
  fg: "#dbdbdb",
  axis: "#b2b5be",
  muted: "#8c8c8c",
  subtle: "#5d606b",
  border: "#222222",
  accent: "#2962ff",
  up: "#089981",
  down: "#f23645",
  warn: "#ff9800",
  grid: "rgba(255, 255, 255, 0.12)",
  crosshair: "#9598a1",
  crosshairLabel: "#363a45",
  pre: "rgba(255, 152, 0, 0.08)",
  post: "rgba(41, 98, 255, 0.08)",
  preLine: "#ff9800",
  postLine: "#2962ff",
} as const;

export const CHART_FONT =
  '-apple-system, BlinkMacSystemFont, "Trebuchet MS", Roboto, Ubuntu, sans-serif';

/** TradingView default indicator colours. */
export const INDICATOR_COLORS = {
  sma20: "#2962ff",
  sma50: "#ff9800",
  sma200: "#e91e63",
  ema12: "#26c6da",
  ema26: "#ab47bc",
  vwap: "#b2b5be",
  bbBasis: "#ff6d00",
  bbBand: "#2962ff",
  rsi: "#7e57c2",
  macd: "#2962ff",
  signal: "#ff6d00",
  histUpStrong: "#26a69a",
  histUpWeak: "#b2dfdb",
  histDownStrong: "#ff5252",
  histDownWeak: "#ffcdd2",
} as const;
