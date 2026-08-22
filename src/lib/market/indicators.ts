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

export function ema(candles: Candle[], period: number): LinePoint[] {
  const out: LinePoint[] = [];
  if (!candles.length || period <= 0) return out;
  const k = 2 / (period + 1);
  let prev = candles[0].close;
  for (let i = 0; i < candles.length; i++) {
    const value = candles[i].close * k + prev * (1 - k);
    prev = value;
    if (i >= period - 1) out.push({ time: candles[i].time, value });
  }
  return out;
}

export function bollinger(candles: Candle[], period = 20, mult = 2) {
  const mid = sma(candles, period);
  const upper: LinePoint[] = [];
  const lower: LinePoint[] = [];
  for (const point of mid) {
    const idx = candles.findIndex((c) => c.time === point.time);
    if (idx < period - 1) continue;
    let variance = 0;
    for (let j = idx - period + 1; j <= idx; j++) {
      const diff = candles[j].close - point.value;
      variance += diff * diff;
    }
    const std = Math.sqrt(variance / period);
    upper.push({ time: point.time, value: point.value + mult * std });
    lower.push({ time: point.time, value: point.value - mult * std });
  }
  return { mid, upper, lower };
}

export function vwap(candles: Candle[]): LinePoint[] {
  const out: LinePoint[] = [];
  let pv = 0;
  let vol = 0;
  let day = "";
  for (const c of candles) {
    const key = new Date(c.time * 1000).toISOString().slice(0, 10);
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
  const fastEma = ema(candles, fast);
  const slowEma = ema(candles, slow);
  const slowMap = new Map(slowEma.map((p) => [p.time, p.value]));
  const macdLine: LinePoint[] = [];
  for (const p of fastEma) {
    const s = slowMap.get(p.time);
    if (s === undefined) continue;
    macdLine.push({ time: p.time, value: p.value - s });
  }
  if (!macdLine.length) return [];
  const k = 2 / (signalPeriod + 1);
  let prev = macdLine[0].value;
  const out: MacdPoint[] = [];
  for (let i = 0; i < macdLine.length; i++) {
    const macdValue = macdLine[i].value;
    const signal = macdValue * k + prev * (1 - k);
    prev = signal;
    if (i >= signalPeriod - 1) {
      out.push({
        time: macdLine[i].time,
        macd: macdValue,
        signal,
        hist: macdValue - signal,
      });
    }
  }
  return out;
}

export function volumePoints(candles: Candle[]) {
  return candles.map((c) => ({
    time: c.time,
    value: c.volume,
    color: c.close >= c.open ? "rgba(61, 201, 138, 0.45)" : "rgba(224, 90, 90, 0.45)",
  }));
}
