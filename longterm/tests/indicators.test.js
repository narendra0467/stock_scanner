import test from "node:test";
import assert from "node:assert/strict";
import { sma, rsi, atr, macd, swingPivots, clusterLevels, resampleMonthly } from "../engine/indicators.js";

test("sma computes trailing averages", () => {
  assert.deepEqual(sma([1, 2, 3, 4, 5], 3), [null, null, 2, 3, 4]);
});

test("rsi is 100 on a straight rise and ~0 on a straight fall", () => {
  const up = Array.from({ length: 30 }, (_, i) => 100 + i);
  const down = Array.from({ length: 30 }, (_, i) => 100 - i);
  assert.equal(rsi(up, 14).at(-1), 100);
  assert.ok(rsi(down, 14).at(-1) < 1);
});

test("atr is positive and macd returns histogram", () => {
  const bars = Array.from({ length: 40 }, (_, i) => ({ open: 100 + i, high: 102 + i, low: 99 + i, close: 101 + i, volume: 1 }));
  assert.ok(atr(bars, 14).at(-1) > 0);
  assert.ok(typeof macd(bars.map((b) => b.close)).at(-1).histogram === "number");
});

test("swing pivots and clustering find repeated levels", () => {
  const pattern = [10, 11, 12, 11, 10, 9, 10, 11, 12, 11, 10, 9, 10, 11, 12, 11, 10, 9, 10];
  const bars = pattern.map((p, i) => ({ date: `2024-01-${String(i + 1).padStart(2, "0")}`, open: p, high: p + 0.2, low: p - 0.2, close: p, volume: 1 }));
  const { highs, lows } = swingPivots(bars, 2);
  assert.ok(highs.length >= 2 && lows.length >= 2);
  const clusters = clusterLevels([...highs, ...lows], 0.03, bars.length);
  const top = clusters.find((c) => Math.abs(c.center - 12.2) < 0.3);
  assert.ok(top && top.touches >= 2);
});

test("resampleMonthly collapses weekly bars", () => {
  const bars = [
    { date: "2024-01-05", open: 1, high: 2, low: 1, close: 1.5, volume: 10 },
    { date: "2024-01-12", open: 1.5, high: 3, low: 1, close: 2.5, volume: 10 },
    { date: "2024-02-02", open: 2.5, high: 3, low: 2, close: 2.8, volume: 10 },
  ];
  const monthly = resampleMonthly(bars);
  assert.equal(monthly.length, 2);
  assert.equal(monthly[0].close, 2.5);
  assert.equal(monthly[0].volume, 20);
});
