import test from "node:test";
import assert from "node:assert/strict";
import { mergeAnnuals, buildFinancials, normalizeQuote } from "../data/financials.js";
import { strongCompanyYears, quoteFixture } from "./fixtures/synth.js";

test("mergeAnnuals fills SEC gaps from Yahoo and appends missing years", () => {
  const sec = [{ fiscalYearEnd: "2024-12-31", source: "sec", revenue: 100, netIncome: 10 }];
  const yahoo = [
    { fiscalYearEnd: "2024-12-31", source: "yahoo", revenue: 99, operatingCashFlow: 15, capex: 3 },
    { fiscalYearEnd: "2023-12-31", source: "yahoo", revenue: 80, netIncome: 5, operatingCashFlow: 9, capex: 2 },
  ];
  const merged = mergeAnnuals(sec, yahoo);
  assert.equal(merged.length, 2);
  assert.equal(merged[1].revenue, 100); // SEC wins when present
  assert.equal(merged[1].operatingCashFlow, 15); // gap filled from Yahoo
  assert.equal(merged[1].freeCashFlow, 12);
  assert.equal(merged[0].freeCashFlow, 7);
});

test("buildFinancials derives growth, margins, CAGR and dilution", () => {
  const fin = buildFinancials({ secYears: strongCompanyYears() });
  assert.equal(fin.years.length, 7);
  assert.ok(Math.abs(fin.summary.revenueCagr3 - 0.22) < 0.001);
  assert.ok(Math.abs(fin.summary.revenueCagr5 - 0.22) < 0.001);
  assert.equal(fin.summary.revenueUpYears, 5);
  assert.equal(fin.summary.fcfPositiveYears, 5);
  assert.ok(fin.summary.shareChange5y < 0);
  assert.ok(fin.years.at(-1).operatingMargin > 0.2);
  assert.equal(fin.source, "SEC XBRL");
});

test("normalizeQuote flattens Yahoo raw fields", () => {
  const snap = normalizeQuote(quoteFixture({ price: 50 }));
  assert.equal(snap.price, 50);
  assert.equal(snap.sector, "Technology");
  assert.equal(snap.epsEstimateNextYear, 5.1);
  assert.equal(snap.analyst.buy, 22);
  assert.ok(Math.abs(snap.priceToFcf - 50e9 / 1.8e9) < 0.01);
  assert.equal(snap.earningsBeatRate, 0.75);
});
