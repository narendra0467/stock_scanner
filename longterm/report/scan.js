// Orchestrates one full scan. Data fetchers are injectable so the engine can be tested offline.
import { fetchBars, fetchQuote, fetchYahooAnnuals } from "../data/yahoo.js";
import { fetchSecAnnuals } from "../data/sec.js";
import { buildFinancials, normalizeQuote, fmtYearRow } from "../data/financials.js";
import { classifyBusiness, describeBusiness } from "../engine/profile.js";
import { scoreQuality } from "../engine/quality.js";
import { scoreValuation } from "../engine/valuation.js";
import { analyzeLevels } from "../engine/levels.js";
import { buildEntryPlan } from "../engine/entry.js";
import { benchmarkFor, isNum, round } from "../lib/util.js";

export const defaultDeps = { fetchBars, fetchQuote, fetchSecAnnuals, fetchYahooAnnuals };

export const VERSION = "1.0.0";

export async function scanTicker(symbolInput, deps = defaultDeps, { today } = {}) {
  const symbol = String(symbolInput ?? "").trim().toUpperCase();
  if (!symbol) throw new Error("ticker is required");
  const benchmark = benchmarkFor(symbol);
  const warnings = [];
  const soft = (promise, label, fallback) => promise.catch((error) => { warnings.push(`${label}: ${error.message}`); return fallback; });

  const [weeklyData, dailyData, benchData, quoteRaw, sec, yahooYears] = await Promise.all([
    deps.fetchBars(symbol, "5y", "1wk"),
    soft(deps.fetchBars(symbol, "2y", "1d"), "daily history", { bars: [] }),
    soft(deps.fetchBars(benchmark, "5y", "1wk"), `benchmark ${benchmark}`, { bars: [] }),
    soft(deps.fetchQuote(symbol), "quote summary", {}),
    soft(deps.fetchSecAnnuals(symbol), "SEC filings", { facts: null, years: [] }),
    soft(deps.fetchYahooAnnuals(symbol), "Yahoo annual statements", []),
  ]);
  const weekly = weeklyData.bars;
  if (weekly.length < 40) throw new Error(`${symbol}: only ${weekly.length} weeks of history; need at least 40.`);

  const snapshot = normalizeQuote(quoteRaw);
  snapshot.symbol = snapshot.symbol ?? symbol;
  snapshot.name = snapshot.name ?? symbol;
  snapshot.currency = snapshot.currency ?? weeklyData.currency ?? "USD";
  snapshot.exchange = snapshot.exchange ?? weeklyData.exchange ?? null;
  if (!isNum(snapshot.price)) snapshot.price = weekly[weekly.length - 1].close;

  const profile = classifyBusiness(snapshot);
  const financials = buildFinancials({ secYears: sec.years ?? [], yahooYears: yahooYears ?? [], secMeta: sec.facts });
  const quality = scoreQuality({ financials, snapshot, profile });
  const valuation = scoreValuation({ financials, snapshot, profile, weekly });
  const levels = analyzeLevels({ weekly, daily: dailyData.bars, benchmarkWeekly: benchData.bars });
  const entry = buildEntryPlan({ levels, quality, valuation, snapshot, today });

  const unavailable = quality.pillars.flatMap((p) => p.metrics).filter((m) => m.status === "unavailable").map((m) => m.label);
  return {
    version: VERSION,
    symbol,
    name: snapshot.name,
    exchange: snapshot.exchange,
    currency: snapshot.currency,
    benchmark,
    asOf: new Date().toISOString(),
    priceDate: levels.asOf,
    price: round(snapshot.price),
    marketCap: snapshot.marketCap,
    business: {
      sector: snapshot.sector,
      industry: snapshot.industry,
      country: snapshot.country,
      employees: snapshot.employees,
      website: snapshot.website,
      mode: profile.mode,
      modeLabel: profile.label,
      modeExplain: profile.explain,
      keyMetrics: profile.keyMetrics,
      summary: describeBusiness(snapshot, profile),
    },
    verdict: {
      businessGrade: quality.grade,
      businessScore: quality.score,
      businessLabel: quality.label,
      valuationScore: valuation.score,
      valuationLabel: valuation.label,
      timing: entry.timingVerdict,
      timingScore: entry.timingScore,
      action: entry.action,
    },
    financials: {
      source: financials.source,
      sec: financials.sec,
      years: financials.years.map(fmtYearRow),
      summary: Object.fromEntries(Object.entries(financials.summary).filter(([k]) => k !== "latest").map(([k, v]) => [k, isNum(v) ? round(v, 4) : v])),
    },
    quality,
    valuation,
    levels,
    entry,
    snapshot: {
      high52: snapshot.high52, low52: snapshot.low52, beta: snapshot.beta, dividendYield: snapshot.dividendYield,
      revenueTTM: snapshot.revenueTTM, fcfTTM: snapshot.fcfTTM, cash: snapshot.cash, debt: snapshot.debt,
      grossMarginTTM: snapshot.grossMarginTTM, operatingMarginTTM: snapshot.operatingMarginTTM, netMarginTTM: snapshot.netMarginTTM,
      roeTTM: snapshot.roeTTM, roaTTM: snapshot.roaTTM, revenueGrowthYoY: snapshot.revenueGrowthYoY, earningsGrowthYoY: snapshot.earningsGrowthYoY,
      epsEstimateCurrentYear: snapshot.epsEstimateCurrentYear, epsEstimateNextYear: snapshot.epsEstimateNextYear,
      revenueGrowthNextYear: snapshot.revenueGrowthNextYear, nextEarningsDate: snapshot.nextEarningsDate, earningsBeatRate: snapshot.earningsBeatRate,
      analyst: snapshot.analyst,
    },
    dataQuality: {
      financialsSource: financials.source,
      fiscalYears: financials.years.length,
      firstFiscalYear: financials.summary.firstYear,
      latestFiscalYear: financials.summary.latestYear,
      weeklyBars: weekly.length,
      dailyBars: dailyData.bars.length,
      benchmarkBars: benchData.bars.length,
      metricsUnavailable: unavailable,
      warnings,
      disclaimer: "Research tool, not financial advice. Verify key numbers in the company's filings before investing.",
    },
  };
}
