// Entry engine: turns levels + business grade into a timing verdict, buy zones, invalidation and a tranche plan.
import { isNum, round, fmtPrice, daysBetween } from "../lib/util.js";

const STRONG = 40;

export function buildEntryPlan({ levels, quality, valuation, snapshot, today = new Date().toISOString().slice(0, 10) }) {
  const close = levels.close;
  const ma = levels.movingAverages;
  const stage = levels.stage.stage;
  const rsiW = levels.momentum.rsiWeekly;
  const rsiD = levels.momentum.rsiDaily;
  const reasons = [];
  const warnings = [];

  const strongSupports = levels.supports.filter((s) => s.strength >= STRONG);
  const nearestSupport = strongSupports[0] ?? levels.supports[0] ?? null;
  const secondSupport = strongSupports[1] ?? levels.supports[1] ?? null;
  // Ignore resistance noise within 3% of the price; a reclaim/next-resistance level must be meaningfully above.
  const meaningfulResistances = levels.resistances.filter((r) => r.center > close * 1.03);
  const nearestResistance = meaningfulResistances[0] ?? null;
  const secondResistance = meaningfulResistances[1] ?? null;
  const rising200d = isNum(ma.slope200d20d) && ma.slope200d20d > 0;
  const near200d = isNum(levels.distanceFrom200d) && levels.distanceFrom200d >= -0.03 && levels.distanceFrom200d <= 0.05;
  const near40w = isNum(levels.distanceFrom40w) && levels.distanceFrom40w >= -0.03 && levels.distanceFrom40w <= 0.04 && isNum(ma.slope30w10w) && ma.slope30w10w > 0;
  const extended = (isNum(levels.distanceFrom200d) && levels.distanceFrom200d > 0.20) || (isNum(rsiW) && rsiW > 72);
  const capitulation = (isNum(rsiW) && rsiW < 35) || (isNum(rsiD) && rsiD < 25);
  const broken = stage === 4 && close <= levels.range.low3y * 1.02 && isNum(levels.volume.upDownRatio26w) && levels.volume.upDownRatio26w < 0.8;
  const inZone = Boolean(levels.inSupportZone && levels.inSupportZone.strength >= STRONG);

  let verdict;
  let timingScore;
  if (broken) {
    verdict = "BROKEN"; timingScore = 5;
    reasons.push("Price is at multi-year lows in a Stage 4 decline with sellers dominating volume.");
  } else if (stage === 4) {
    verdict = "TREND REPAIR WATCH"; timingScore = capitulation ? 30 : 20;
    reasons.push(levels.stage.reason);
    if (capitulation) reasons.push(`Capitulation reading (weekly RSI ${rsiW ?? "n/a"}, daily RSI ${rsiD ?? "n/a"}): bounces are likely, but the trend is still down.`);
  } else if (stage === 3 && !inZone) {
    verdict = "WAIT FOR PULLBACK"; timingScore = 35;
    reasons.push("Stage 3 topping pattern: the long-term average has flattened after an advance.");
  } else if (extended) {
    verdict = "WAIT FOR PULLBACK"; timingScore = 30;
    reasons.push(isNum(levels.distanceFrom200d) && levels.distanceFrom200d > 0.2 ? `Price is ${(levels.distanceFrom200d * 100).toFixed(0)}% above the 200-day average: extended.` : `Weekly RSI ${rsiW} is overbought.`);
  } else if (inZone || (near200d && rising200d) || near40w) {
    verdict = "BUY ZONE NOW"; timingScore = 85;
    if (inZone) reasons.push(`Price is inside a tested support zone ${fmtPrice(levels.inSupportZone.low)}-${fmtPrice(levels.inSupportZone.high)} (${levels.inSupportZone.touches} touches).`);
    if (near200d && rising200d) reasons.push("Price is sitting on a rising 200-day average: the classic long-term pullback entry.");
    if (near40w) reasons.push("Price is at a rising 40-week average.");
  } else if (stage === 1) {
    verdict = "ACCUMULATE"; timingScore = 60;
    reasons.push(`${levels.stage.label}. Bases are where long-term positions are built.`);
  } else {
    verdict = "ACCUMULATE"; timingScore = 65;
    reasons.push("Healthy Stage 2 uptrend, not extended. Buy in tranches rather than all at once.");
  }
  if (isNum(ma.goldenCross) && ma.goldenCross === false && verdict === "BUY ZONE NOW") warnings.push("50-day is still below the 200-day: trend has not fully confirmed.");
  if (ma.crossedRecently) reasons.push(`Note: ${ma.crossedRecently}.`);
  if (isNum(levels.relativeStrength.m12) && levels.relativeStrength.m12 < -0.15) warnings.push(`Lagging the index by ${(Math.abs(levels.relativeStrength.m12) * 100).toFixed(0)} points over 12 months.`);
  if (isNum(levels.relativeStrength.m12) && levels.relativeStrength.m12 > 0.15) reasons.push(`Leading the index by ${(levels.relativeStrength.m12 * 100).toFixed(0)} points over 12 months.`);
  if (levels.momentum.macdMonthlyRising === true && levels.momentum.macdMonthlyAboveSignal === false) reasons.push("Monthly MACD is turning up from below its signal line (early).");

  // ── Zones ───────────────────────────────────────────────────────────────
  const atrW = levels.atrWeekly ?? close * 0.04;
  let zoneA = inZone
    ? { low: levels.inSupportZone.low, high: levels.inSupportZone.high, basis: `tested support zone (${levels.inSupportZone.touches} touches)` }
    : nearestSupport
      ? { low: nearestSupport.low, high: nearestSupport.high, basis: `nearest ${nearestSupport.strength >= STRONG ? "strong" : "minor"} support (${nearestSupport.touches} touches, last ${nearestSupport.lastTouch})` }
      : isNum(ma.sma200d) && ma.sma200d < close
        ? { low: round(ma.sma200d * 0.97), high: round(ma.sma200d * 1.02), basis: "200-day average" }
        : { low: round(close - 2 * atrW), high: round(close - atrW), basis: "volatility fallback (no pivots below)" };
  let pivotZoneAsB = null;
  if (!inZone && isNum(ma.sma200d) && ma.sma200d < close && rising200d && ma.sma200d > zoneA.high && stage !== 4) {
    // In a healthy uptrend the rising 200-day is usually the first place buyers step in; the pivot below becomes zone B.
    pivotZoneAsB = nearestSupport ? { low: nearestSupport.low, high: nearestSupport.high, touches: nearestSupport.touches, lastTouch: nearestSupport.lastTouch } : null;
    zoneA = { low: round(ma.sma200d * 0.97), high: round(ma.sma200d * 1.02), basis: `rising 200-day average (${fmtPrice(ma.sma200d)})` };
  }
  const zoneB = pivotZoneAsB ?? (inZone ? (strongSupports.find((s) => s.high < zoneA.low) ?? levels.supports.find((s) => s.high < zoneA.low)) : secondSupport) ?? null;
  const zoneBOut = zoneB ? { low: zoneB.low, high: zoneB.high, basis: `next support (${zoneB.touches} touches, last ${zoneB.lastTouch})` } : { low: round(zoneA.low * 0.92), high: round(zoneA.low * 0.97), basis: "8% below zone A (no deeper pivots)" };
  let invalidation = round(Math.min(zoneA.low - 0.75 * atrW, close * 0.97));
  if (stage === 4) invalidation = round(Math.min(invalidation, levels.range.low52 - 0.5 * atrW));
  invalidation = round(Math.max(invalidation, close * 0.7));
  const reclaim = stage === 4 || stage === 1
    ? [nearestResistance?.center, ma.sma30w, ma.sma200d].filter((v) => isNum(v) && v > close).sort((a, b) => a - b)[0] ?? null
    : nearestResistance?.center ?? null;
  const confirm = [secondResistance?.center, ma.sma200d, ma.sma40w, nearestResistance?.center].filter((v) => isNum(v) && v > (reclaim ?? close) * 1.01).sort((a, b) => a - b)[0] ?? null;
  const breakout = levels.resistances.length ? round(Math.max(levels.range.high52, levels.resistances[levels.resistances.length - 1].high) * 1.005) : round(levels.range.high52 * 1.005);

  // ── Tranche plan ────────────────────────────────────────────────────────
  const grade = quality.applicable ? quality.grade : "ETF";
  const good = grade === "A" || grade === "B" || grade === "ETF";
  let tranches;
  if (verdict === "BUY ZONE NOW") tranches = [
    { pct: good ? 50 : 25, when: `now, ${fmtPrice(zoneA.low)}-${fmtPrice(zoneA.high)}`, why: "price is in the zone" },
    { pct: 25, when: `zone B ${fmtPrice(zoneBOut.low)}-${fmtPrice(zoneBOut.high)}`, why: "if the market gives a deeper dip" },
    { pct: good ? 25 : 50, when: `after the next earnings report or on a weekly close above ${fmtPrice(reclaim ?? breakout)}`, why: "confirmation" },
  ];
  else if (verdict === "ACCUMULATE") tranches = [
    { pct: 34, when: "now", why: "trend is healthy" },
    { pct: 33, when: `zone A ${fmtPrice(zoneA.low)}-${fmtPrice(zoneA.high)}`, why: "first pullback" },
    { pct: 33, when: `zone B ${fmtPrice(zoneBOut.low)}-${fmtPrice(zoneBOut.high)} or 2 months later`, why: "time or price diversification" },
  ];
  else if (verdict === "WAIT FOR PULLBACK") tranches = [
    { pct: 0, when: "now", why: "price is extended; patience is the edge" },
    { pct: 50, when: `zone A ${fmtPrice(zoneA.low)}-${fmtPrice(zoneA.high)}`, why: "first real pullback" },
    { pct: 50, when: `zone B ${fmtPrice(zoneBOut.low)}-${fmtPrice(zoneBOut.high)}`, why: "deeper pullback" },
  ];
  else if (verdict === "TREND REPAIR WATCH") tranches = [
    { pct: 25, when: `zone A ${fmtPrice(zoneA.low)}-${fmtPrice(zoneA.high)} only`, why: "starter in a downtrend; accept it may go lower" },
    { pct: 25, when: `weekly close above ${fmtPrice(reclaim)}`, why: "trend repair begins" },
    { pct: 50, when: `weekly close above ${fmtPrice(confirm ?? breakout)}`, why: "trend confirmed" },
  ];
  else tranches = [{ pct: 0, when: "not now", why: "chart is broken; wait for a base to form over months" }];

  // ── Combined action ─────────────────────────────────────────────────────
  let action;
  if (grade === "D") action = "NOT INVESTABLE";
  else if (grade === "C") action = verdict === "BUY ZONE NOW" || verdict === "ACCUMULATE" ? "START SMALL (quality unproven)" : verdict === "BROKEN" ? "STAND ASIDE" : "WAIT";
  else if (verdict === "BUY ZONE NOW") action = "BUY NOW";
  else if (verdict === "ACCUMULATE") action = "ACCUMULATE (DCA)";
  else if (verdict === "WAIT FOR PULLBACK") action = `WAIT FOR ${fmtPrice(zoneA.high)}`;
  else if (verdict === "TREND REPAIR WATCH") action = "START SMALL";
  else action = "STAND ASIDE";
  if (quality.applicable && quality.redFlags?.length) warnings.push(`Red flag: ${quality.redFlags[0]}`);

  const earningsDays = snapshot.nextEarningsDate ? daysBetween(today, snapshot.nextEarningsDate) : null;
  if (isNum(earningsDays) && earningsDays >= 0 && earningsDays <= 14) warnings.push(`Earnings in ${earningsDays} days (${snapshot.nextEarningsDate}): size the first tranche smaller or wait for the report.`);

  const zoneMid = (zoneA.low + zoneA.high) / 2;
  const upsideTarget = [reclaim, confirm, breakout].filter((v) => isNum(v) && v > zoneMid * 1.05).sort((a, b) => a - b)[0] ?? breakout;
  const upside = isNum(upsideTarget) ? round(upsideTarget / zoneMid - 1, 4) : null;
  const downside = round(invalidation / zoneMid - 1, 4);
  return {
    timingVerdict: verdict,
    timingScore,
    action,
    zoneA: { ...zoneA, low: round(zoneA.low), high: round(zoneA.high) },
    zoneB: { ...zoneBOut, low: round(zoneBOut.low), high: round(zoneBOut.high) },
    reclaim: round(reclaim),
    confirm: round(confirm),
    breakout,
    invalidation,
    rewardRisk: isNum(upside) && isNum(downside) && downside < 0 && upside >= 0.05 ? round(upside / Math.abs(downside), 1) : null,
    openEndedUpside: !isNum(upside) || upside < 0.05,
    upsideToConfirm: upside,
    upsideTarget: round(upsideTarget),
    downsideToInvalidation: downside,
    tranches,
    reasons,
    warnings,
    earningsInDays: earningsDays,
    capitulation,
  };
}
