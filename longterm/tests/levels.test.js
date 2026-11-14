import test from "node:test";
import assert from "node:assert/strict";
import { analyzeLevels } from "../engine/levels.js";
import { buildEntryPlan } from "../engine/entry.js";
import { uptrendWeekly, downtrendWeekly, flatWeekly, dailyFromWeekly } from "./fixtures/synth.js";

const etfQuality = { applicable: false, grade: "n/a", redFlags: [] };
const goodQuality = { applicable: true, grade: "B", redFlags: [] };

test("uptrend is Stage 2 with supports below and a sensible plan", () => {
  const weekly = uptrendWeekly();
  const levels = analyzeLevels({ weekly, daily: dailyFromWeekly(weekly), benchmarkWeekly: flatWeekly() });
  assert.equal(levels.stage.stage, 2, levels.stage.label);
  assert.ok(levels.supports.length >= 1);
  assert.ok(levels.supports.every((s) => s.center < levels.close));
  assert.ok(levels.resistances.every((r) => r.center > levels.close));
  assert.ok(levels.relativeStrength.m12 > 0);
  const plan = buildEntryPlan({ levels, quality: goodQuality, valuation: {}, snapshot: {}, today: "2026-10-15" });
  assert.ok(["BUY ZONE NOW", "ACCUMULATE", "WAIT FOR PULLBACK"].includes(plan.timingVerdict), plan.timingVerdict);
  assert.ok(plan.zoneA.low < plan.zoneA.high && plan.zoneA.high <= levels.close * 1.02);
  assert.ok(plan.invalidation < plan.zoneA.low);
  assert.ok(plan.tranches.reduce((a, t) => a + t.pct, 0) === 100);
});

test("downtrend is Stage 4 and the plan says start small or stand aside", () => {
  const weekly = downtrendWeekly();
  const levels = analyzeLevels({ weekly, daily: dailyFromWeekly(weekly), benchmarkWeekly: flatWeekly() });
  assert.equal(levels.stage.stage, 4, levels.stage.label);
  const plan = buildEntryPlan({ levels, quality: goodQuality, valuation: {}, snapshot: { nextEarningsDate: "2026-10-20" }, today: "2026-10-15" });
  assert.ok(["TREND REPAIR WATCH", "BROKEN"].includes(plan.timingVerdict), plan.timingVerdict);
  assert.ok(["START SMALL", "STAND ASIDE"].includes(plan.action), plan.action);
  assert.ok(plan.warnings.some((w) => w.includes("Earnings in 5 days")));
  assert.ok(plan.reclaim === null || plan.reclaim > levels.close);
});

test("grade D is never investable; ETFs use technicals only", () => {
  const weekly = uptrendWeekly();
  const levels = analyzeLevels({ weekly, daily: dailyFromWeekly(weekly) });
  const bad = buildEntryPlan({ levels, quality: { applicable: true, grade: "D", redFlags: ["x"] }, valuation: {}, snapshot: {} });
  assert.equal(bad.action, "NOT INVESTABLE");
  const etf = buildEntryPlan({ levels, quality: etfQuality, valuation: {}, snapshot: {} });
  assert.notEqual(etf.action, "NOT INVESTABLE");
});
