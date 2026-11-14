import test from "node:test";
import assert from "node:assert/strict";
import { buildAnnualStatements, secTickerCandidates } from "../data/sec.js";
import { secFactsFixture } from "./fixtures/synth.js";

test("buildAnnualStatements keeps annual 10-K values, prefers restated figures, ignores quarters", () => {
  const years = buildAnnualStatements(secFactsFixture());
  assert.deepEqual(years.map((y) => y.fiscalYearEnd), ["2023-12-31", "2024-12-31", "2025-12-31"]);
  assert.equal(years[0].revenue, 1010); // restated value from the later filing
  assert.equal(years[2].revenue, 1700);
  assert.equal(years[2].freeCashFlow, 250); // 300 OCF - 50 capex
  assert.equal(years[2].capex, -50);
  assert.equal(years[2].cash, 700); // 10-Q instant on 2025-03-31 dropped
  assert.equal(years[2].totalDebt, 200);
  assert.equal(years[2].dilutedShares, 98);
  assert.equal(years[2].eps, 2.45);
});

test("secTickerCandidates maps Canadian suffixes and class shares", () => {
  assert.deepEqual(secTickerCandidates("SHOP.TO"), ["SHOP-TO", "SHOP"]);
  assert.deepEqual(secTickerCandidates("BRK.B"), ["BRK-B"]);
});
