// Indicator math for the long-term scanner. Pure functions over arrays / bar objects.
import { isNum } from "../lib/util.js";

export function sma(values, period) {
  const out = new Array(values.length).fill(null);
  let sum = 0;
  for (let i = 0; i < values.length; i += 1) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    if (i >= period - 1) out[i] = sum / period;
  }
  return out;
}

export function ema(values, period) {
  const k = 2 / (period + 1);
  const out = [];
  let prev = null;
  for (const value of values) {
    prev = prev === null ? value : value * k + prev * (1 - k);
    out.push(prev);
  }
  return out;
}

// Wilder RSI
export function rsi(values, period = 14) {
  const out = new Array(values.length).fill(null);
  if (values.length <= period) return out;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i += 1) {
    const change = values[i] - values[i - 1];
    if (change > 0) gain += change; else loss -= change;
  }
  gain /= period;
  loss /= period;
  out[period] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
  for (let i = period + 1; i < values.length; i += 1) {
    const change = values[i] - values[i - 1];
    gain = (gain * (period - 1) + Math.max(change, 0)) / period;
    loss = (loss * (period - 1) + Math.max(-change, 0)) / period;
    out[i] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
  }
  return out;
}

export function atr(bars, period = 14) {
  const tr = bars.map((bar, i) => {
    if (i === 0) return bar.high - bar.low;
    const prevClose = bars[i - 1].close;
    return Math.max(bar.high - bar.low, Math.abs(bar.high - prevClose), Math.abs(bar.low - prevClose));
  });
  const out = new Array(bars.length).fill(null);
  if (bars.length < period) return out;
  let value = tr.slice(0, period).reduce((a, b) => a + b, 0) / period;
  out[period - 1] = value;
  for (let i = period; i < bars.length; i += 1) {
    value = (value * (period - 1) + tr[i]) / period;
    out[i] = value;
  }
  return out;
}

export function macd(values, fast = 12, slow = 26, signalPeriod = 9) {
  const fastE = ema(values, fast);
  const slowE = ema(values, slow);
  const line = values.map((_, i) => fastE[i] - slowE[i]);
  const signal = ema(line, signalPeriod);
  return line.map((value, i) => ({ line: value, signal: signal[i], histogram: value - signal[i] }));
}

export function slopePct(series, lookback) {
  const n = series.length;
  const a = series[n - 1];
  const b = series[n - 1 - lookback];
  return isNum(a) && isNum(b) && b !== 0 ? a / b - 1 : null;
}

// Weekly bars -> monthly bars (last close of each calendar month).
export function resampleMonthly(bars) {
  const months = new Map();
  for (const bar of bars) {
    const key = bar.date.slice(0, 7);
    const current = months.get(key);
    if (!current) months.set(key, { date: bar.date, open: bar.open, high: bar.high, low: bar.low, close: bar.close, volume: bar.volume });
    else {
      current.high = Math.max(current.high, bar.high);
      current.low = Math.min(current.low, bar.low);
      current.close = bar.close;
      current.date = bar.date;
      current.volume += bar.volume;
    }
  }
  return [...months.values()];
}

// Swing pivots: a high that is the highest within k bars either side (same for lows).
export function swingPivots(bars, k = 3) {
  const highs = [];
  const lows = [];
  for (let i = k; i < bars.length - k; i += 1) {
    const window = bars.slice(i - k, i + k + 1);
    const bar = bars[i];
    if (window.every((other) => other.high <= bar.high)) highs.push({ index: i, date: bar.date, price: bar.high, volume: bar.volume });
    if (window.every((other) => other.low >= bar.low)) lows.push({ index: i, date: bar.date, price: bar.low, volume: bar.volume });
  }
  return { highs, lows };
}

// Group nearby pivot prices into zones. tolerance is a fraction of price (e.g. 0.03 = 3%).
export function clusterLevels(pivots, tolerance = 0.03, totalBars = 0) {
  const sorted = [...pivots].sort((a, b) => a.price - b.price);
  const clusters = [];
  for (const pivot of sorted) {
    const current = clusters[clusters.length - 1];
    if (current && pivot.price <= current.center * (1 + tolerance)) {
      current.members.push(pivot);
      current.low = Math.min(current.low, pivot.price);
      current.high = Math.max(current.high, pivot.price);
      current.center = current.members.reduce((a, b) => a + b.price, 0) / current.members.length;
    } else {
      clusters.push({ low: pivot.price, high: pivot.price, center: pivot.price, members: [pivot] });
    }
  }
  return clusters.map((cluster) => {
    const touches = cluster.members.length;
    const lastIndex = Math.max(...cluster.members.map((m) => m.index));
    const recency = totalBars ? 1 - (totalBars - 1 - lastIndex) / totalBars : 0.5;
    const strength = Math.min(100, Math.round(touches * 22 + recency * 30));
    return {
      low: cluster.low,
      high: cluster.high,
      center: cluster.center,
      touches,
      lastTouch: cluster.members.sort((a, b) => b.index - a.index)[0].date,
      strength,
    };
  });
}

export function fibonacci(low, high) {
  const span = high - low;
  return {
    low,
    high,
    r236: high - span * 0.236,
    r382: high - span * 0.382,
    r500: high - span * 0.5,
    r618: high - span * 0.618,
    r786: high - span * 0.786,
  };
}

export function returnOver(values, bars) {
  const n = values.length;
  if (n <= bars) return null;
  const start = values[n - 1 - bars];
  return isNum(start) && start > 0 ? values[n - 1] / start - 1 : null;
}
