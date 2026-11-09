import type { ChartType, IndicatorsState } from "@/lib/market/types";

export const CHART_TYPES: Array<{ id: ChartType; label: string }> = [
  { id: "bars", label: "Bars" },
  { id: "candles", label: "Candles" },
  { id: "hollow", label: "Hollow candles" },
  { id: "line", label: "Line" },
  { id: "area", label: "Area" },
  { id: "baseline", label: "Baseline" },
];

export const INDICATOR_ITEMS: Array<{
  key: keyof IndicatorsState;
  label: string;
  short: string;
  group: "Moving averages" | "Bands & volume" | "Oscillators";
}> = [
  { key: "sma20", label: "Moving Average 20", short: "SMA 20", group: "Moving averages" },
  { key: "sma50", label: "Moving Average 50", short: "SMA 50", group: "Moving averages" },
  { key: "sma200", label: "Moving Average 200", short: "SMA 200", group: "Moving averages" },
  { key: "ema12", label: "Moving Average Exponential 12", short: "EMA 12", group: "Moving averages" },
  { key: "ema26", label: "Moving Average Exponential 26", short: "EMA 26", group: "Moving averages" },
  { key: "bb", label: "Bollinger Bands", short: "BB", group: "Bands & volume" },
  { key: "vwap", label: "Volume Weighted Average Price", short: "VWAP", group: "Bands & volume" },
  { key: "volume", label: "Volume", short: "Vol", group: "Bands & volume" },
  { key: "rsi", label: "Relative Strength Index", short: "RSI", group: "Oscillators" },
  { key: "macd", label: "MACD", short: "MACD", group: "Oscillators" },
];
