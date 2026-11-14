import test from "node:test";
import assert from "node:assert/strict";
import { buildFinancials, trimDiscontinuities, reconcileRevenue } from "../data/financials.js";
import { normalizeQuote } from "../data/financials.js";
import { classifyBusiness } from "../engine/profile.js";
import { scoreQuality } from "../engine/quality.js";
import { scoreValuation } from "../engine/valuation.js";
import { evaluateRules } from "../monitor/rules.js";
import { strongCompanyYears, quoteFixture, uptrendWeekly } from "./fixtures/synth.js";

test("SPAC-shell years before a share-count jump are dropped", () => {
  const rows = [
    { fiscalYearEnd: "2019-12-31", revenue: 4.5e6, netIncome: -2e8, dilutedShares: 65e6 },
    { fiscalYearEnd: "2020-12-31", revenue: 1e8, netIncome: -2e8, dilutedShares: 74e6 },
    { fiscalYearEnd: "2021-12-31", revenue: 9.8e8, netIncome: -4.8e8, dilutedShares: 527e6 }, // merger year
    { fiscalYearEnd: "2022-12-31", revenue: 1.54e9, netIncome: -3.2e8, dilutedShares: 900e6 },
    { fiscalYearEnd: "2023-12-31", revenue: 2.07e9, netIncome: -3.0e8, dilutedShares: 945e6 },
    { fiscalYearEnd: "2024-12-31", revenue: 2.61e9, netIncome: 5.0e8, dilutedShares: 1101e6 },
  ];
  const trimmed = trimDiscontinuities(rows);
  assert.deepEqual(trimmed.map((r) => r.fiscalYearEnd), ["2022-12-31", "2023-12-31", "2024-12-31"]);
  assert.equal(trimDiscontinuities(strongCompanyYears()).length, 7); // untouched when there is no jump
});

test("partial SEC revenue tag is replaced by Yahoo total revenue", () => {
  const sec = [
    { fiscalYearEnd: "2023-12-31", source: "sec", revenue: 4.2e8, revenueTag: "us-gaap:Revenues", netIncome: -3e8 },
    { fiscalYearEnd: "2024-12-31", source: "sec", revenue: 5.0e8, revenueTag: "us-gaap:Revenues", netIncome: 5e8 },
    { fiscalYearEnd: "2025-12-31", source: "sec", revenue: 6.2e8, revenueTag: "us-gaap:Revenues", netIncome: 4.8e8 },
  ];
  const yahoo = [
    { fiscalYearEnd: "2023-12-31", revenue: 2.07e9 },
    { fiscalYearEnd: "2024-12-31", revenue: 2.61e9 },
    { fiscalYearEnd: "2025-12-31", revenue: 3.59e9 },
  ];
  const fixed = reconcileRevenue(sec, yahoo);
  assert.equal(fixed[2].revenue, 3.59e9);
  assert.ok(fixed[2].revenueSource);
  const fin = buildFinancials({ secYears: sec, yahooYears: yahoo });
  assert.ok(fin.notes.some((n) => n.includes("Revenue taken from Yahoo")));
  assert.ok(Math.abs(fin.summary.revenueGrowthLatest - 0.375) < 0.01);
  // agreeing data is left alone
  const ok = reconcileRevenue(sec.map((r) => ({ ...r, revenue: r.revenue * 5 })), yahoo);
  assert.equal(ok[2].revenueSource, undefined);
});

test("dilution is not a red flag when the company buys back stock every year", () => {
  const years = strongCompanyYears().map((y, i) => ({ ...y, dilutedShares: 500e6 * (1 + i * 0.08) })); // +48% over the span
  const snapshot = normalizeQuote(quoteFixture());
  const q = scoreQuality({ financials: buildFinancials({ secYears: years }), snapshot, profile: classifyBusiness(snapshot) });
  assert.equal(q.redFlags.length, 0, q.redFlags.join("; "));
  const noBuybacks = years.map((y) => ({ ...y, buybacks: 0 }));
  const q2 = scoreQuality({ financials: buildFinancials({ secYears: noBuybacks }), snapshot, profile: classifyBusiness(snapshot) });
  assert.ok(q2.redFlags.some((f) => f.includes("dilution")));
});

test("fair value does not blend methods that disagree by more than 2.5x", () => {
  const financials = buildFinancials({ secYears: strongCompanyYears() });
  const snapshot = normalizeQuote(quoteFixture({ price: 500, marketCap: 900e9, fcfTTM: 1e9 }));
  const v = scoreValuation({ financials, snapshot, profile: classifyBusiness(snapshot), weekly: uptrendWeekly() });
  assert.equal(v.fairValue.blended, false);
  assert.equal(v.fairValue.methods[0].role, "primary");
  assert.ok(v.fairValue.read.includes("disagree"));
  assert.ok(v.fairValue.low > 50); // earnings-based, not dragged to the FCF-yield range
});

test("thesis-check does not fire on the first run", () => {
  const report = { price: 10, verdict: { businessGrade: "C", timing: "WAIT" }, quality: { applicable: true, redFlags: ["x"] }, valuation: { applicable: false }, entry: { timingVerdict: "WAIT FOR PULLBACK", capitulation: false, invalidation: 5 }, levels: { resistances: [{}], range: { high52: 20, pctFromHigh52: -0.5 }, volume: {}, momentum: {}, movingAverages: {}, stage: { stage: 2 }, distanceFrom200d: 0 } };
  assert.equal(evaluateRules(report, null, null, "2026-11-14").fired.length, 0);
  const prev = { lastSent: {}, redFlagCount: 0, lastGrade: "C" };
  assert.deepEqual(evaluateRules(report, prev, null, "2026-11-14").fired.map((a) => a.id), ["thesis-check"]);
});
