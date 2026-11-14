// Alert rules for the watchlist monitor. Each rule returns null or { id, level, title, emoji, detail }.
import { isNum, fmtPrice, fmtPct, daysBetween } from "../lib/util.js";

export const COOLDOWN_DAYS = 14; // calendar days ≈ 10 trading days

const goodGrade = (r) => ["A", "B", "ETF", "n/a"].includes(r.verdict.businessGrade) || !r.quality.applicable;

export const RULES = [
  {
    id: "buy-zone",
    level: "buy",
    emoji: "🟢",
    test: (r) => r.entry.timingVerdict === "BUY ZONE NOW" && goodGrade(r)
      ? { title: "Buy zone reached", detail: r.entry.reasons[0] }
      : null,
  },
  {
    id: "capitulation",
    level: "watch",
    emoji: "🟡",
    test: (r) => r.entry.capitulation && goodGrade(r) && r.entry.timingVerdict !== "BROKEN"
      ? { title: "Capitulation on a quality business", detail: `Weekly RSI ${r.levels.momentum.rsiWeekly ?? "n/a"}, daily RSI ${r.levels.momentum.rsiDaily ?? "n/a"}, ${fmtPct(r.levels.range.pctFromHigh52, 0)} from the 52-week high.` }
      : null,
  },
  {
    id: "trend-repair",
    level: "buy",
    emoji: "🟢",
    test: (r, prev) => {
      const ma = r.levels.movingAverages;
      const golden = ma.crossedRecently === "golden cross in the last 20 days" && !(prev?.flags?.goldenCrossSeen);
      const leftStage4 = prev?.lastStage === 4 && r.levels.stage.stage !== 4 && r.levels.stage.stage !== null;
      const reclaimed200 = isNum(ma.sma200d) && r.price > ma.sma200d && prev?.lastAbove200d === false;
      if (!(golden || leftStage4 || reclaimed200) || !goodGrade(r)) return null;
      return { title: "Trend repair", detail: golden ? "50-day crossed above the 200-day." : reclaimed200 ? `Price reclaimed the 200-day average (${fmtPrice(ma.sma200d)}).` : `Left Stage 4: now ${r.levels.stage.label}.` };
    },
  },
  {
    id: "breakout",
    level: "buy",
    emoji: "🚀",
    test: (r) => r.levels.resistances.length === 0 && r.price >= r.levels.range.high52 * 0.99 && isNum(r.levels.volume.lastWeekVsAverage) && r.levels.volume.lastWeekVsAverage >= 1.3 && goodGrade(r) && r.verdict.timing !== "WAIT FOR PULLBACK"
      ? { title: "Breakout to new highs on volume", detail: `Volume ${r.levels.volume.lastWeekVsAverage}x the 26-week average with no resistance overhead.` }
      : null,
  },
  {
    id: "valuation-low",
    level: "watch",
    emoji: "💰",
    test: (r) => r.valuation.applicable && isNum(r.valuation.ownHistoryAverage) && r.valuation.ownHistoryAverage <= 0.2 && r.valuation.score >= 60 && goodGrade(r)
      ? { title: "Cheapest versus its own history", detail: `Multiples are in the bottom 20% of the last five fiscal years (valuation ${r.valuation.score}/100).` }
      : null,
  },
  {
    id: "invalidation",
    level: "risk",
    emoji: "🔴",
    test: (r, prev, entry) => entry?.holding && isNum(r.entry.invalidation) && r.price < r.entry.invalidation
      ? { title: "Invalidation level broken", detail: `Price ${fmtPrice(r.price)} is below ${fmtPrice(r.entry.invalidation)}. Stop adding and re-check the thesis.` }
      : null,
  },
  {
    id: "thesis-check",
    level: "risk",
    emoji: "🟠",
    test: (r, prev) => {
      const flags = r.quality.redFlags?.length ?? 0;
      const newFlag = flags > (prev?.redFlagCount ?? 0);
      const order = { A: 4, B: 3, C: 2, D: 1 };
      const downgraded = prev?.lastGrade && order[r.verdict.businessGrade] && order[prev.lastGrade] && order[r.verdict.businessGrade] < order[prev.lastGrade];
      if (!newFlag && !downgraded) return null;
      return { title: "Fundamentals changed: review the thesis", detail: newFlag ? r.quality.redFlags[0] : `Business grade moved from ${prev.lastGrade} to ${r.verdict.businessGrade}.` };
    },
  },
  {
    id: "extended",
    level: "info",
    emoji: "⚪",
    test: (r, prev, entry) => entry?.holding && isNum(r.levels.distanceFrom200d) && r.levels.distanceFrom200d > 0.35 && isNum(r.levels.momentum.rsiWeekly) && r.levels.momentum.rsiWeekly > 75
      ? { title: "Very extended (consider trimming, not selling)", detail: `${fmtPct(r.levels.distanceFrom200d, 0)} above the 200-day with weekly RSI ${r.levels.momentum.rsiWeekly}.` }
      : null,
  },
];

export function evaluateRules(report, prevState = null, watchEntry = null, today = new Date().toISOString().slice(0, 10)) {
  const fired = [];
  const suppressed = [];
  for (const rule of RULES) {
    const result = rule.test(report, prevState, watchEntry);
    if (!result) continue;
    const lastSent = prevState?.lastSent?.[rule.id];
    const alert = { id: rule.id, level: rule.level, emoji: rule.emoji, ...result };
    if (lastSent && daysBetween(lastSent, today) < COOLDOWN_DAYS) suppressed.push(alert);
    else fired.push(alert);
  }
  return { fired, suppressed };
}

export function nextState(report, prevState, firedAlerts, today = new Date().toISOString().slice(0, 10)) {
  const lastSent = { ...(prevState?.lastSent ?? {}) };
  for (const alert of firedAlerts) lastSent[alert.id] = today;
  const ma = report.levels.movingAverages;
  return {
    lastSent,
    lastGrade: report.verdict.businessGrade,
    lastStage: report.levels.stage.stage,
    lastClose: report.price,
    lastAbove200d: isNum(ma.sma200d) ? report.price > ma.sma200d : null,
    lastTiming: report.verdict.timing,
    lastAction: report.verdict.action,
    redFlagCount: report.quality.redFlags?.length ?? 0,
    flags: { goldenCrossSeen: ma.crossedRecently === "golden cross in the last 20 days" || Boolean(prevState?.flags?.goldenCrossSeen && ma.goldenCross) },
    checkedOn: today,
  };
}
