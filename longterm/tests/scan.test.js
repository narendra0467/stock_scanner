import test from "node:test";
import assert from "node:assert/strict";
import { scanTicker } from "../report/scan.js";
import { renderMarkdown, renderTelegramSummary, renderOneLine } from "../report/render.js";
import { evaluateRules, nextState } from "../monitor/rules.js";
import { splitMessage } from "../monitor/telegram.js";
import { uptrendWeekly, downtrendWeekly, flatWeekly, dailyFromWeekly, strongCompanyYears, quoteFixture } from "./fixtures/synth.js";

function deps({ weekly, quote, secYears = [], yahooYears = [] }) {
  return {
    fetchBars: async (symbol, range, interval) => {
      if (symbol === "SPY" || symbol === "XIU.TO") return { bars: flatWeekly(), currency: "USD" };
      return interval === "1d" ? { bars: dailyFromWeekly(weekly), currency: "USD" } : { bars: weekly, currency: "USD", exchange: "NMS" };
    },
    fetchQuote: async () => quote,
    fetchSecAnnuals: async () => ({ facts: { cik: "0000001234" }, years: secYears }),
    fetchYahooAnnuals: async () => yahooYears,
  };
}

test("end-to-end scan of a strong company in an uptrend renders every section", async () => {
  const weekly = uptrendWeekly();
  const price = weekly.at(-1).close;
  const report = await scanTicker("test", deps({ weekly, quote: quoteFixture({ price }), secYears: strongCompanyYears() }), { today: "2026-10-15" });
  assert.equal(report.symbol, "TEST");
  assert.equal(report.verdict.businessGrade, "A");
  assert.ok(report.financials.years.length === 7);
  assert.ok(report.levels.supports.length > 0);
  assert.ok(["BUY NOW", "ACCUMULATE (DCA)"].includes(report.verdict.action) || report.verdict.action.startsWith("WAIT FOR"), report.verdict.action);
  const md = renderMarkdown(report);
  for (const heading of ["## 1. The business", "## 2. Five-year financials", "## 3. Business quality", "## 4. Valuation", "## 5. Long-term technicals", "## 6. Entry plan", "## 7. Data quality"]) assert.ok(md.includes(heading), heading);
  const tg = renderTelegramSummary(report, { title: "test" });
  assert.ok(tg.includes("<b>TEST</b>") && tg.length < 1200);
  assert.ok(renderOneLine(report).includes("TEST"));
});

test("scan degrades gracefully without fundamentals (ETF-like) and flags missing data", async () => {
  const weekly = uptrendWeekly(21);
  const quote = { price: { symbol: "FUND", longName: "Some ETF", quoteType: "ETF", regularMarketPrice: { raw: weekly.at(-1).close } } };
  const report = await scanTicker("FUND", deps({ weekly, quote }));
  assert.equal(report.business.mode, "etf");
  assert.equal(report.verdict.businessGrade, "n/a");
  assert.ok(report.verdict.action !== "NOT INVESTABLE");
  assert.ok(renderMarkdown(report).includes("Not scored for a fund"));
});

test("alert rules fire, respect cooldown and track state", async () => {
  const weekly = downtrendWeekly();
  const price = weekly.at(-1).close;
  const report = await scanTicker("DOWN", deps({ weekly, quote: quoteFixture({ price, high52: price * 2.2, low52: price * 0.98 }), secYears: strongCompanyYears() }), { today: "2026-10-15" });
  const first = evaluateRules(report, null, { symbol: "DOWN", holding: true }, "2026-10-15");
  const ids = first.fired.map((a) => a.id);
  assert.ok(ids.length > 0, "expected at least one alert in a capitulating downtrend");
  const state = nextState(report, null, first.fired, "2026-10-15");
  const again = evaluateRules(report, state, { symbol: "DOWN", holding: true }, "2026-10-20");
  assert.equal(again.fired.length, 0);
  assert.deepEqual(again.suppressed.map((a) => a.id).sort(), ids.sort());
  const later = evaluateRules(report, state, { symbol: "DOWN", holding: true }, "2026-11-05");
  assert.deepEqual(later.fired.map((a) => a.id).sort(), ids.sort());
});

test("telegram messages are split under the API limit", () => {
  const long = Array.from({ length: 300 }, (_, i) => `line ${i} ${"x".repeat(40)}`).join("\n");
  const chunks = splitMessage(long, 3900);
  assert.ok(chunks.length > 1 && chunks.every((c) => c.length <= 3900));
});
