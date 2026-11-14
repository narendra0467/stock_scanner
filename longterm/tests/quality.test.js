import test from "node:test";
import assert from "node:assert/strict";
import { buildFinancials, normalizeQuote } from "../data/financials.js";
import { classifyBusiness } from "../engine/profile.js";
import { scoreQuality } from "../engine/quality.js";
import { scoreValuation } from "../engine/valuation.js";
import { strongCompanyYears, weakCompanyYears, bankYears, quoteFixture, uptrendWeekly } from "./fixtures/synth.js";

test("a strong compounder grades A", () => {
  const snapshot = normalizeQuote(quoteFixture());
  const profile = classifyBusiness(snapshot);
  assert.equal(profile.mode, "software");
  const q = scoreQuality({ financials: buildFinancials({ secYears: strongCompanyYears() }), snapshot, profile });
  assert.equal(q.grade, "A", JSON.stringify(q.pillars.map((p) => [p.name, p.score])));
  assert.equal(q.redFlags.length, 0);
});

test("a shrinking, diluting loss-maker grades D with red flags", () => {
  const snapshot = normalizeQuote(quoteFixture({ sector: "Consumer Cyclical", industry: "Specialty Retail", revenueGrowth: -0.07, roe: -0.2 }));
  snapshot.currentRatio = 0.7;
  const profile = classifyBusiness(snapshot);
  assert.equal(profile.mode, "consumer");
  const q = scoreQuality({ financials: buildFinancials({ yahooYears: weakCompanyYears() }), snapshot, profile });
  assert.equal(q.grade, "D");
  assert.ok(q.redFlags.length >= 2, q.redFlags.join("; "));
});

test("bank mode uses ROE/ROA and ignores FCF", () => {
  const snapshot = normalizeQuote(quoteFixture({ sector: "Financial Services", industry: "Credit Services", roe: 0.07 }));
  const profile = classifyBusiness(snapshot);
  assert.equal(profile.mode, "bank");
  const q = scoreQuality({ financials: buildFinancials({ secYears: bankYears() }), snapshot, profile });
  const labels = q.pillars.flatMap((p) => p.metrics.map((m) => m.label));
  assert.ok(labels.includes("Return on assets"));
  assert.ok(!labels.includes("FCF margin (latest)"));
  assert.ok(["B", "C"].includes(q.grade), q.grade);
});

test("valuation scores and fair value respond to multiples", () => {
  const weekly = uptrendWeekly();
  const financials = buildFinancials({ secYears: strongCompanyYears() });
  const cheap = scoreValuation({ financials, snapshot: normalizeQuote(quoteFixture({ forwardPE: 14, trailingPE: 18, peg: 0.7, ps: 2, pb: 3 })), profile: classifyBusiness({ sector: "Technology", industry: "Software - Application" }), weekly });
  const dear = scoreValuation({ financials, snapshot: normalizeQuote(quoteFixture({ forwardPE: 70, trailingPE: 120, peg: 3.5, ps: 25, pb: 30 })), profile: classifyBusiness({ sector: "Technology", industry: "Software - Application" }), weekly });
  assert.ok(cheap.score > dear.score);
  assert.ok(cheap.fairValue && cheap.fairValue.low < cheap.fairValue.high);
  assert.equal(cheap.fairValue.methods.length, 2);
});
