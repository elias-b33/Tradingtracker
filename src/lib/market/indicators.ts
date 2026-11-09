import type { Candle, LinePoint, MacdPoint } from "./types";

export function sma(candles: Candle[], period: number): LinePoint[] {
  const out: LinePoint[] = [];
  if (period <= 0) return out;
  let sum = 0;
  for (let i = 0; i < candles.length; i++) {
    sum += candles[i].close;
    if (i >= period) sum -= candles[i - period].close;
    if (i >= period - 1) {
      out.push({ time: candles[i].time, value: sum / period });
    }
  }
  return out;
}

/** Pine-compatible EMA: seeded with the SMA of the first `period` values. */
function emaValues(values: number[], period: number): Array<number | null> {
  const out: Array<number | null> = new Array(values.length).fill(null);
  if (period <= 0 || values.length < period) return out;
  const k = 2 / (period + 1);
  let seed = 0;
  for (let i = 0; i < period; i++) seed += values[i];
  let prev = seed / period;
  out[period - 1] = prev;
  for (let i = period; i < values.length; i++) {
    prev = values[i] * k + prev * (1 - k);
    out[i] = prev;
  }
  return out;
}

export function ema(candles: Candle[], period: number): LinePoint[] {
  const values = emaValues(
    candles.map((c) => c.close),
    period,
  );
  const out: LinePoint[] = [];
  for (let i = 0; i < candles.length; i++) {
    const value = values[i];
    if (value !== null) out.push({ time: candles[i].time, value });
  }
  return out;
}

export function bollinger(candles: Candle[], period = 20, mult = 2) {
  const mid: LinePoint[] = [];
  const upper: LinePoint[] = [];
  const lower: LinePoint[] = [];
  let sum = 0;
  let sumSq = 0;
  for (let i = 0; i < candles.length; i++) {
    const v = candles[i].close;
    sum += v;
    sumSq += v * v;
    if (i >= period) {
      const old = candles[i - period].close;
      sum -= old;
      sumSq -= old * old;
    }
    if (i < period - 1) continue;
    const mean = sum / period;
    const std = Math.sqrt(Math.max(0, sumSq / period - mean * mean));
    const time = candles[i].time;
    mid.push({ time, value: mean });
    upper.push({ time, value: mean + mult * std });
    lower.push({ time, value: mean - mult * std });
  }
  return { mid, upper, lower };
}

/** Session VWAP, reset at each calendar day in `timeZone` (UTC by default). */
export function vwap(candles: Candle[], timeZone?: string): LinePoint[] {
  const out: LinePoint[] = [];
  let fmt: Intl.DateTimeFormat | null = null;
  if (timeZone) {
    try {
      fmt = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" });
    } catch {
      fmt = null;
    }
  }
  let pv = 0;
  let vol = 0;
  let day = "";
  for (const c of candles) {
    const date = new Date(c.time * 1000);
    const key = fmt ? fmt.format(date) : date.toISOString().slice(0, 10);
    if (key !== day) {
      pv = 0;
      vol = 0;
      day = key;
    }
    const typical = (c.high + c.low + c.close) / 3;
    pv += typical * c.volume;
    vol += c.volume;
    if (vol > 0) out.push({ time: c.time, value: pv / vol });
  }
  return out;
}

export function rsi(candles: Candle[], period = 14): LinePoint[] {
  const out: LinePoint[] = [];
  if (candles.length <= period) return out;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i++) {
    const diff = candles[i].close - candles[i - 1].close;
    if (diff >= 0) gain += diff;
    else loss -= diff;
  }
  gain /= period;
  loss /= period;
  const push = (time: number, g: number, l: number) => {
    const value = l === 0 ? (g === 0 ? 50 : 100) : 100 - 100 / (1 + g / l);
    out.push({ time, value });
  };
  push(candles[period].time, gain, loss);
  for (let i = period + 1; i < candles.length; i++) {
    const diff = candles[i].close - candles[i - 1].close;
    const up = diff > 0 ? diff : 0;
    const down = diff < 0 ? -diff : 0;
    gain = (gain * (period - 1) + up) / period;
    loss = (loss * (period - 1) + down) / period;
    push(candles[i].time, gain, loss);
  }
  return out;
}

export function macd(
  candles: Candle[],
  fast = 12,
  slow = 26,
  signalPeriod = 9,
): MacdPoint[] {
  const closes = candles.map((c) => c.close);
  const fastEma = emaValues(closes, fast);
  const slowEma = emaValues(closes, slow);
  const times: number[] = [];
  const line: number[] = [];
  for (let i = 0; i < candles.length; i++) {
    const f = fastEma[i];
    const s = slowEma[i];
    if (f === null || s === null) continue;
    times.push(candles[i].time);
    line.push(f - s);
  }
  const signal = emaValues(line, signalPeriod);
  const out: MacdPoint[] = [];
  for (let i = 0; i < line.length; i++) {
    const sig = signal[i];
    if (sig === null) continue;
    out.push({ time: times[i], macd: line[i], signal: sig, hist: line[i] - sig });
  }
  return out;
}

export function volumePoints(candles: Candle[]) {
  return candles.map((c) => ({
    time: c.time,
    value: c.volume,
    color: c.close >= c.open ? "rgba(8, 153, 129, 0.5)" : "rgba(242, 54, 69, 0.5)",
  }));
}
