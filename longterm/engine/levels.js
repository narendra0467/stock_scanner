// Long-term technical levels: stage, moving averages, support/resistance clusters, momentum, relative strength.
import { isNum, round } from "../lib/util.js";
import { sma, rsi, atr, macd, slopePct, resampleMonthly, swingPivots, clusterLevels, fibonacci, returnOver } from "./indicators.js";

const last = (arr) => arr[arr.length - 1];

export function detectStage({ close, sma30w, slope30w, sma30wSeries, closes }) {
  if (!isNum(sma30w) || !isNum(slope30w)) return { stage: null, label: "Not enough history", reason: "Need at least 40 weeks of data." };
  const above = close > sma30w;
  const flat = Math.abs(slope30w) <= 0.015;
  const n = sma30wSeries.length;
  const priorSlope = n > 36 && isNum(sma30wSeries[n - 1 - 26]) && isNum(sma30wSeries[n - 1 - 10]) ? sma30wSeries[n - 1 - 10] / sma30wSeries[n - 1 - 26] - 1 : null;
  const sixMonthReturn = closes.length > 26 ? closes[closes.length - 1] / closes[closes.length - 27] - 1 : null;
  if (above && slope30w > 0.015) return { stage: 2, label: "Stage 2: advancing", reason: "Price above a rising 30-week average." };
  if (!above && slope30w < -0.015) return { stage: 4, label: "Stage 4: declining", reason: "Price below a falling 30-week average." };
  if (flat) {
    if (isNum(priorSlope) && priorSlope < -0.01) return { stage: 1, label: "Stage 1: basing after a decline", reason: "30-week average has flattened after falling." };
    if (isNum(priorSlope) && priorSlope > 0.01) return { stage: 3, label: "Stage 3: topping after an advance", reason: "30-week average has flattened after rising." };
    return above ? { stage: 1, label: "Stage 1/2: early base breakout", reason: "Price above a flat 30-week average." } : { stage: 1, label: "Stage 1: basing", reason: "Price below a flat 30-week average." };
  }
  if (above && slope30w < 0) return { stage: 1, label: "Stage 1/2: trying to turn up", reason: "Price has reclaimed a still-falling 30-week average." };
  if (!above && slope30w > 0) return { stage: isNum(sixMonthReturn) && sixMonthReturn < -0.15 ? 3 : 2, label: "Stage 2 pullback / possible Stage 3", reason: "Price has dipped below a rising 30-week average." };
  return { stage: 1, label: "Transitional", reason: "Mixed signals around the 30-week average." };
}

export function analyzeLevels({ weekly, daily = [], benchmarkWeekly = [] }) {
  const closesW = weekly.map((b) => b.close);
  const close = last(closesW);
  const n = weekly.length;
  const sma10w = last(sma(closesW, 10));
  const sma30wSeries = sma(closesW, 30);
  const sma30w = last(sma30wSeries);
  const sma40w = last(sma(closesW, 40));
  const sma200w = n >= 200 ? last(sma(closesW, 200)) : null;
  const slope30w = slopePct(sma30wSeries, 10);
  const rsiW = last(rsi(closesW, 14));
  const atrW = last(atr(weekly, 14));

  const closesD = daily.map((b) => b.close);
  const sma50dSeries = sma(closesD, 50);
  const sma200dSeries = sma(closesD, 200);
  const sma50d = last(sma50dSeries) ?? null;
  const sma200d = last(sma200dSeries) ?? null;
  const slope200d = sma200dSeries.length > 20 ? slopePct(sma200dSeries, 20) : null;
  const rsiD = closesD.length > 15 ? last(rsi(closesD, 14)) : null;
  const goldenCross = isNum(sma50d) && isNum(sma200d) ? sma50d > sma200d : null;
  const crossedRecently = (() => {
    const m = sma50dSeries.length;
    if (m < 25 || !isNum(sma50dSeries[m - 21]) || !isNum(sma200dSeries[m - 21])) return null;
    const before = sma50dSeries[m - 21] > sma200dSeries[m - 21];
    const now = sma50dSeries[m - 1] > sma200dSeries[m - 1];
    return before === now ? null : now ? "golden cross in the last 20 days" : "death cross in the last 20 days";
  })();

  const monthly = resampleMonthly(weekly);
  const macdM = monthly.length >= 30 ? macd(monthly.map((b) => b.close)) : null;
  const macdLast = macdM ? last(macdM) : null;
  const macdPrev = macdM && macdM.length > 1 ? macdM[macdM.length - 2] : null;

  const benchCloses = benchmarkWeekly.map((b) => b.close);
  const rs = (bars) => {
    const own = returnOver(closesW, bars);
    const bench = returnOver(benchCloses, bars);
    return isNum(own) && isNum(bench) ? own - bench : null;
  };

  const recent = weekly.slice(-26);
  const upVol = recent.filter((b) => b.close >= b.open).reduce((a, b) => a + b.volume, 0);
  const downVol = recent.filter((b) => b.close < b.open).reduce((a, b) => a + b.volume, 0);
  const volumeRatio = downVol > 0 ? upVol / downVol : null;
  const avgVol26 = recent.length ? recent.reduce((a, b) => a + b.volume, 0) / recent.length : null;
  const lastVolRatio = isNum(avgVol26) && avgVol26 > 0 ? last(weekly).volume / avgVol26 : null;

  const w52 = weekly.slice(-52);
  const w156 = weekly.slice(-156);
  const high52 = Math.max(...w52.map((b) => b.high));
  const low52 = Math.min(...w52.map((b) => b.low));
  const high3y = Math.max(...w156.map((b) => b.high));
  const low3y = Math.min(...w156.map((b) => b.low));
  const high3yIndex = w156.findIndex((b) => b.high === high3y);
  const low3yIndex = w156.findIndex((b) => b.low === low3y);

  // Support / resistance from weekly swing pivots over the full history (up to 5 years).
  const { highs, lows } = swingPivots(weekly, 3);
  const tolerance = isNum(atrW) && close > 0 ? Math.min(0.06, Math.max(0.02, (atrW / close) * 0.8)) : 0.03;
  const clusters = clusterLevels([...highs, ...lows], tolerance, n);
  const supports = clusters.filter((c) => c.high < close * 1.005 || (c.low <= close && c.center < close)).sort((a, b) => b.center - a.center).map(withDistance(close, "support", atrW));
  const resistances = clusters.filter((c) => c.low > close * 0.995 && c.center > close).sort((a, b) => a.center - b.center).map(withDistance(close, "resistance", atrW));
  const inSupportZone = clusters.find((c) => close >= c.low * 0.99 && close <= c.high * 1.01) ?? null;

  const fib = high3yIndex > low3yIndex ? { direction: "retracement of the 3-year advance", ...fibonacci(low3y, high3y) } : { direction: "retracement of the 3-year decline (bounce targets)", ...fibonacci(low3y, high3y) };

  const dynamicLevels = [
    { label: "50-day SMA", price: sma50d },
    { label: "200-day SMA", price: sma200d },
    { label: "30-week SMA", price: sma30w },
    { label: "40-week SMA", price: sma40w },
    { label: "200-week SMA", price: sma200w },
  ].filter((l) => isNum(l.price)).map((l) => ({ ...l, price: round(l.price), role: l.price < close ? "support" : "resistance", distancePct: round(l.price / close - 1, 4) }));

  return {
    asOf: last(weekly).date,
    close: round(close),
    barsWeekly: n,
    barsDaily: daily.length,
    stage: detectStage({ close, sma30w, slope30w, sma30wSeries, closes: closesW }),
    movingAverages: { sma50d: round(sma50d), sma200d: round(sma200d), slope200d20d: round(slope200d, 4), sma10w: round(sma10w), sma30w: round(sma30w), slope30w10w: round(slope30w, 4), sma40w: round(sma40w), sma200w: round(sma200w), goldenCross, crossedRecently },
    distanceFrom200d: isNum(sma200d) ? round(close / sma200d - 1, 4) : null,
    distanceFrom40w: isNum(sma40w) ? round(close / sma40w - 1, 4) : null,
    momentum: {
      rsiWeekly: round(rsiW, 1),
      rsiDaily: round(rsiD, 1),
      macdMonthlyHistogram: macdLast ? round(macdLast.histogram, 3) : null,
      macdMonthlyRising: macdLast && macdPrev ? macdLast.histogram > macdPrev.histogram : null,
      macdMonthlyAboveSignal: macdLast ? macdLast.line > macdLast.signal : null,
    },
    relativeStrength: { m6: round(rs(26), 4), m12: round(rs(52), 4) },
    volume: { upDownRatio26w: round(volumeRatio, 2), lastWeekVsAverage: round(lastVolRatio, 2) },
    range: {
      high52: round(high52), low52: round(low52), pctFromHigh52: round(close / high52 - 1, 4), pctAboveLow52: round(close / low52 - 1, 4),
      high3y: round(high3y), low3y: round(low3y), pctFromHigh3y: round(close / high3y - 1, 4),
    },
    atrWeekly: round(atrW),
    atrWeeklyPct: isNum(atrW) ? round(atrW / close, 4) : null,
    supports,
    resistances,
    inSupportZone: inSupportZone ? withDistance(close, "support", atrW)(inSupportZone) : null,
    dynamicLevels,
    fibonacci: Object.fromEntries(Object.entries(fib).map(([k, v]) => [k, isNum(v) ? round(v) : v])),
    pivotCount: highs.length + lows.length,
  };
}

function withDistance(close, type, atrW = 0) {
  const pad = isNum(atrW) ? atrW * 0.4 : 0;
  return (cluster) => ({
    type,
    low: round(Math.min(cluster.low, cluster.center - pad)),
    high: round(Math.max(cluster.high, cluster.center + pad)),
    center: round(cluster.center),
    touches: cluster.touches,
    strength: cluster.strength,
    lastTouch: cluster.lastTouch,
    distancePct: round(cluster.center / close - 1, 4),
  });
}
