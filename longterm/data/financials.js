// Merges SEC annual statements with the Yahoo fallback and normalizes the Yahoo quote snapshot.
import { isNum, round, cagr, daysBetween } from "../lib/util.js";

const FIELDS = [
  "revenue", "grossProfit", "operatingIncome", "netIncome", "eps", "operatingCashFlow", "capex", "freeCashFlow",
  "cash", "totalDebt", "equity", "totalAssets", "dilutedShares", "interestExpense", "buybacks", "dividendsPaid",
];

const raw = (field) => (isNum(field?.raw) ? field.raw : isNum(field) ? field : null);

function safeDiv(a, b) {
  return isNum(a) && isNum(b) && b !== 0 ? a / b : null;
}

export function mergeAnnuals(secYears = [], yahooYears = []) {
  const rows = secYears.map((row) => ({ ...row }));
  for (const yRow of yahooYears) {
    const match = rows.find((row) => Math.abs(daysBetween(row.fiscalYearEnd, yRow.fiscalYearEnd)) <= 20);
    if (match) {
      for (const field of FIELDS) if (!isNum(match[field]) && isNum(yRow[field])) match[field] = yRow[field];
      if (!isNum(match.freeCashFlow) && isNum(match.operatingCashFlow) && isNum(match.capex)) match.freeCashFlow = match.operatingCashFlow - Math.abs(match.capex);
    } else {
      const copy = { ...yRow, source: "yahoo" };
      if (isNum(copy.capex)) copy.capex = -Math.abs(copy.capex);
      if (!isNum(copy.freeCashFlow) && isNum(copy.operatingCashFlow) && isNum(copy.capex)) copy.freeCashFlow = copy.operatingCashFlow + copy.capex;
      rows.push(copy);
    }
  }
  return rows.sort((a, b) => a.fiscalYearEnd.localeCompare(b.fiscalYearEnd));
}

export function deriveYears(rows) {
  const out = rows.map((row) => ({ ...row }));
  out.forEach((row, i) => {
    const prev = out[i - 1];
    row.revenueGrowth = prev && isNum(prev.revenue) && prev.revenue > 0 && isNum(row.revenue) ? row.revenue / prev.revenue - 1 : null;
    row.netIncomeGrowth = prev && isNum(prev.netIncome) && prev.netIncome > 0 && isNum(row.netIncome) ? row.netIncome / prev.netIncome - 1 : null;
    row.grossMargin = safeDiv(row.grossProfit, row.revenue);
    row.operatingMargin = safeDiv(row.operatingIncome, row.revenue);
    row.netMargin = safeDiv(row.netIncome, row.revenue);
    row.fcfMargin = safeDiv(row.freeCashFlow, row.revenue);
    row.fcfConversion = isNum(row.netIncome) && row.netIncome > 0 ? safeDiv(row.freeCashFlow, row.netIncome) : null;
    row.ocfConversion = isNum(row.netIncome) && row.netIncome > 0 ? safeDiv(row.operatingCashFlow, row.netIncome) : null;
    const avgEquity = prev && isNum(prev.equity) && isNum(row.equity) ? (prev.equity + row.equity) / 2 : row.equity;
    row.roe = isNum(avgEquity) && avgEquity > 0 ? safeDiv(row.netIncome, avgEquity) : null;
    row.roa = isNum(row.totalAssets) && row.totalAssets > 0 ? safeDiv(row.netIncome, row.totalAssets) : null;
    row.netDebt = isNum(row.totalDebt) && isNum(row.cash) ? row.totalDebt - row.cash : null;
    row.debtToEquity = isNum(row.equity) && row.equity > 0 ? safeDiv(row.totalDebt, row.equity) : null;
    row.equityToAssets = safeDiv(row.equity, row.totalAssets);
    row.bookValuePerShare = safeDiv(row.equity, row.dilutedShares);
    row.revenuePerShare = safeDiv(row.revenue, row.dilutedShares);
    row.interestCoverage = isNum(row.interestExpense) && row.interestExpense > 0 ? safeDiv(row.operatingIncome, row.interestExpense) : null;
    row.shareChange = prev && isNum(prev.dilutedShares) && prev.dilutedShares > 0 && isNum(row.dilutedShares) ? row.dilutedShares / prev.dilutedShares - 1 : null;
  });
  return out;
}

export function summarizeYears(years) {
  const n = years.length;
  const latest = years[n - 1] ?? null;
  const yearsBack = (k) => (n > k ? years[n - 1 - k] : null);
  const rev = (row) => (row && isNum(row.revenue) ? row.revenue : null);
  const countWhere = (fn, span = 5) => years.slice(-span).filter(fn).length;
  const spanRows = years.slice(-5);
  const first = (field, span) => {
    const rows = years.slice(-span).filter((row) => isNum(row[field]));
    return rows.length ? rows[0] : null;
  };
  const sharesFirst = first("dilutedShares", 6);
  return {
    yearsAvailable: n,
    firstYear: years[0]?.fiscalYearEnd ?? null,
    latestYear: latest?.fiscalYearEnd ?? null,
    revenueCagr3: rev(latest) && rev(yearsBack(3)) ? cagr(rev(yearsBack(3)), rev(latest), 3) : null,
    revenueCagr5: rev(latest) && rev(yearsBack(5)) ? cagr(rev(yearsBack(5)), rev(latest), 5) : null,
    revenueGrowthLatest: latest?.revenueGrowth ?? null,
    revenueUpYears: countWhere((row) => isNum(row.revenueGrowth) && row.revenueGrowth > 0),
    revenueYearsWithGrowthData: countWhere((row) => isNum(row.revenueGrowth)),
    profitableYears: countWhere((row) => isNum(row.netIncome) && row.netIncome > 0),
    netIncomeYears: countWhere((row) => isNum(row.netIncome)),
    fcfPositiveYears: countWhere((row) => isNum(row.freeCashFlow) && row.freeCashFlow > 0),
    fcfYears: countWhere((row) => isNum(row.freeCashFlow)),
    epsCagr3: latest && isNum(latest.eps) && latest.eps > 0 && yearsBack(3) && isNum(yearsBack(3).eps) && yearsBack(3).eps > 0 ? cagr(yearsBack(3).eps, latest.eps, 3) : null,
    fcfCagr3: latest && isNum(latest.freeCashFlow) && latest.freeCashFlow > 0 && yearsBack(3) && isNum(yearsBack(3).freeCashFlow) && yearsBack(3).freeCashFlow > 0 ? cagr(yearsBack(3).freeCashFlow, latest.freeCashFlow, 3) : null,
    netIncomeCagr3: latest && isNum(latest.netIncome) && latest.netIncome > 0 && yearsBack(3) && isNum(yearsBack(3).netIncome) && yearsBack(3).netIncome > 0 ? cagr(yearsBack(3).netIncome, latest.netIncome, 3) : null,
    operatingMarginTrend: latest && isNum(latest.operatingMargin) && yearsBack(2) && isNum(yearsBack(2).operatingMargin) ? latest.operatingMargin - yearsBack(2).operatingMargin : null,
    grossMarginTrend: latest && isNum(latest.grossMargin) && yearsBack(2) && isNum(yearsBack(2).grossMargin) ? latest.grossMargin - yearsBack(2).grossMargin : null,
    netMarginTrend: latest && isNum(latest.netMargin) && yearsBack(2) && isNum(yearsBack(2).netMargin) ? latest.netMargin - yearsBack(2).netMargin : null,
    grossMarginStdev: (() => {
      const vals = spanRows.map((row) => row.grossMargin).filter(isNum);
      if (vals.length < 3) return null;
      const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
      return Math.sqrt(vals.reduce((a, b) => a + (b - avg) ** 2, 0) / vals.length);
    })(),
    shareChange5y: sharesFirst && latest && isNum(latest.dilutedShares) && sharesFirst !== latest && sharesFirst.dilutedShares > 0 ? latest.dilutedShares / sharesFirst.dilutedShares - 1 : null,
    shareChangeYears: sharesFirst && latest ? Math.max(1, Math.round(daysBetween(sharesFirst.fiscalYearEnd, latest.fiscalYearEnd) / 365)) : null,
    bvpsCagr3: latest && isNum(latest.bookValuePerShare) && latest.bookValuePerShare > 0 && yearsBack(3) && isNum(yearsBack(3).bookValuePerShare) && yearsBack(3).bookValuePerShare > 0 ? cagr(yearsBack(3).bookValuePerShare, latest.bookValuePerShare, 3) : null,
    buybackYears: countWhere((row) => isNum(row.buybacks) && row.buybacks > 0),
    dividendYears: countWhere((row) => isNum(row.dividendsPaid) && row.dividendsPaid > 0),
    debtTrend: latest && isNum(latest.totalDebt) && yearsBack(2) && isNum(yearsBack(2).totalDebt) && yearsBack(2).totalDebt > 0 ? latest.totalDebt / yearsBack(2).totalDebt - 1 : null,
    earningsVsCashGap: countWhere((row) => isNum(row.netIncome) && row.netIncome > 0 && isNum(row.operatingCashFlow) && row.operatingCashFlow < row.netIncome * 0.7, 3),
    latest,
  };
}

export function normalizeQuote(quote = {}) {
  const price = quote.price ?? {};
  const detail = quote.summaryDetail ?? {};
  const fin = quote.financialData ?? {};
  const stats = quote.defaultKeyStatistics ?? {};
  const profile = quote.assetProfile ?? {};
  const trend = quote.earningsTrend?.trend ?? [];
  const trend0y = trend.find((t) => t.period === "0y");
  const trend1y = trend.find((t) => t.period === "+1y");
  const history = quote.earningsHistory?.history ?? [];
  const rec = quote.recommendationTrend?.trend?.[0] ?? {};
  const marketCap = raw(price.marketCap) ?? raw(detail.marketCap);
  const fcf = raw(fin.freeCashflow);
  const ev = raw(stats.enterpriseValue);
  const ebitda = raw(fin.ebitda);
  const totalRevenue = raw(fin.totalRevenue);
  const beats = history.filter((h) => isNum(raw(h.epsActual)) && isNum(raw(h.epsEstimate)));
  return {
    symbol: price.symbol ?? null,
    name: price.longName ?? price.shortName ?? null,
    exchange: price.exchangeName ?? null,
    currency: price.currency ?? "USD",
    quoteType: price.quoteType ?? null,
    price: raw(price.regularMarketPrice) ?? raw(fin.currentPrice),
    marketCap,
    sector: profile.sector ?? null,
    industry: profile.industry ?? null,
    description: profile.longBusinessSummary ?? null,
    country: profile.country ?? null,
    employees: raw(profile.fullTimeEmployees),
    website: profile.website ?? null,
    high52: raw(detail.fiftyTwoWeekHigh),
    low52: raw(detail.fiftyTwoWeekLow),
    beta: raw(detail.beta) ?? raw(stats.beta),
    dividendYield: raw(detail.dividendYield) ?? raw(detail.trailingAnnualDividendYield),
    trailingPE: raw(detail.trailingPE) ?? raw(stats.trailingPE),
    forwardPE: raw(stats.forwardPE) ?? raw(detail.forwardPE),
    peg: raw(stats.pegRatio),
    priceToBook: raw(stats.priceToBook),
    priceToSales: raw(stats.priceToSalesTrailing12Months) ?? (isNum(marketCap) && isNum(totalRevenue) && totalRevenue > 0 ? marketCap / totalRevenue : null),
    evToEbitda: raw(stats.enterpriseToEbitda) ?? (isNum(ev) && isNum(ebitda) && ebitda > 0 ? ev / ebitda : null),
    evToRevenue: raw(stats.enterpriseToRevenue),
    priceToFcf: isNum(marketCap) && isNum(fcf) && fcf > 0 ? marketCap / fcf : null,
    fcfYield: isNum(marketCap) && isNum(fcf) && marketCap > 0 ? fcf / marketCap : null,
    revenueTTM: totalRevenue,
    ebitdaTTM: ebitda,
    fcfTTM: fcf,
    operatingCashFlowTTM: raw(fin.operatingCashflow),
    grossMarginTTM: raw(fin.grossMargins),
    operatingMarginTTM: raw(fin.operatingMargins),
    netMarginTTM: raw(fin.profitMargins) ?? raw(stats.profitMargins),
    roeTTM: raw(fin.returnOnEquity),
    roaTTM: raw(fin.returnOnAssets),
    revenueGrowthYoY: raw(fin.revenueGrowth),
    earningsGrowthYoY: raw(fin.earningsGrowth),
    cash: raw(fin.totalCash),
    debt: raw(fin.totalDebt),
    currentRatio: raw(fin.currentRatio),
    debtToEquity: isNum(raw(fin.debtToEquity)) ? raw(fin.debtToEquity) / 100 : null,
    sharesOutstanding: raw(stats.sharesOutstanding) ?? raw(price.sharesOutstanding),
    bookValuePerShare: raw(stats.bookValue),
    trailingEps: raw(stats.trailingEps),
    forwardEps: raw(stats.forwardEps),
    epsEstimateCurrentYear: raw(trend0y?.earningsEstimate?.avg),
    epsEstimateNextYear: raw(trend1y?.earningsEstimate?.avg),
    epsGrowthCurrentYear: raw(trend0y?.earningsEstimate?.growth),
    epsGrowthNextYear: raw(trend1y?.earningsEstimate?.growth),
    revenueGrowthCurrentYear: raw(trend0y?.revenueEstimate?.growth),
    revenueGrowthNextYear: raw(trend1y?.revenueEstimate?.growth),
    nextEarningsDate: quote.calendarEvents?.earnings?.earningsDate?.[0]?.fmt ?? null,
    earningsBeatRate: beats.length ? beats.filter((h) => raw(h.epsActual) >= raw(h.epsEstimate)).length / beats.length : null,
    analyst: {
      count: raw(fin.numberOfAnalystOpinions),
      targetMean: raw(fin.targetMeanPrice),
      targetLow: raw(fin.targetLowPrice),
      targetHigh: raw(fin.targetHighPrice),
      recommendation: fin.recommendationKey ?? null,
      buy: (rec.strongBuy ?? 0) + (rec.buy ?? 0),
      hold: rec.hold ?? 0,
      sell: (rec.sell ?? 0) + (rec.strongSell ?? 0),
    },
  };
}

// If SEC revenue is far below Yahoo's "Total Revenue" for most overlapping years, the XBRL tag we picked
// is a partial line (common for banks/fintechs, where us-gaap:Revenues may be one component). Use Yahoo's.
export function reconcileRevenue(rows, yahooYears = []) {
  const pairs = rows
    .map((row) => {
      const y = yahooYears.find((yr) => Math.abs(daysBetween(row.fiscalYearEnd, yr.fiscalYearEnd)) <= 20);
      return y && isNum(row.revenue) && isNum(y.revenue) && row.source === "sec" && row.revenueTag ? { row, yahoo: y.revenue } : null;
    })
    .filter(Boolean);
  if (pairs.length < 2) return rows;
  const understated = pairs.filter(({ row, yahoo }) => row.revenue < yahoo * 0.6).length;
  if (understated / pairs.length <= 0.5) return rows;
  return rows.map((row) => {
    const y = yahooYears.find((yr) => Math.abs(daysBetween(row.fiscalYearEnd, yr.fiscalYearEnd)) <= 20);
    if (!y || !isNum(y.revenue)) return row;
    return { ...row, revenue: y.revenue, revenueSource: "yahoo (SEC tag looked partial)", grossProfit: isNum(y.grossProfit) ? y.grossProfit : null, operatingIncome: isNum(y.operatingIncome) ? y.operatingIncome : row.operatingIncome };
  });
}

// Drop history from before a corporate discontinuity (SPAC shell, reverse merger, IPO recapitalisation):
// a >4x jump in share count or >15x jump in revenue in one year means the earlier rows describe a different entity.
export function trimDiscontinuities(rows) {
  let start = 0;
  for (let i = 1; i < rows.length; i += 1) {
    const prev = rows[i - 1];
    const row = rows[i];
    const shareJump = isNum(prev.dilutedShares) && prev.dilutedShares > 0 && isNum(row.dilutedShares) && row.dilutedShares / prev.dilutedShares > 4;
    const revenueJump = isNum(prev.revenue) && prev.revenue > 0 && isNum(row.revenue) && row.revenue / prev.revenue > 15;
    if (shareJump || revenueJump) start = i + 1; // the jump year itself is a partial/merged year; start after it
  }
  return start > 0 && rows.length - start >= 2 ? rows.slice(start) : rows;
}

export function buildFinancials({ secYears = [], yahooYears = [], secMeta = null }) {
  const reconciled = reconcileRevenue(mergeAnnuals(secYears, yahooYears), yahooYears);
  const trimmed = trimDiscontinuities(reconciled);
  const merged = deriveYears(trimmed).slice(-10);
  const summary = summarizeYears(merged);
  let source = secYears.length ? (yahooYears.length ? "SEC XBRL + Yahoo fallback" : "SEC XBRL") : yahooYears.length ? "Yahoo Finance (no SEC filings found)" : "none";
  const notes = [];
  if (merged.some((row) => row.revenueSource)) notes.push("Revenue taken from Yahoo: the SEC revenue tag looked like a partial line item (common for banks and fintechs).");
  if (trimmed.length < reconciled.length) notes.push(`Dropped ${reconciled.length - trimmed.length} early fiscal year(s) from before a corporate discontinuity (SPAC/merger/recapitalisation).`);
  return { years: merged, summary, source, sec: secMeta, notes };
}

export const fmtYearRow = (row) => ({
  year: row.fiscalYearEnd,
  revenue: round(row.revenue, 0),
  revenueGrowth: round(row.revenueGrowth, 4),
  grossMargin: round(row.grossMargin, 4),
  operatingMargin: round(row.operatingMargin, 4),
  netIncome: round(row.netIncome, 0),
  netMargin: round(row.netMargin, 4),
  eps: round(row.eps, 2),
  operatingCashFlow: round(row.operatingCashFlow, 0),
  freeCashFlow: round(row.freeCashFlow, 0),
  fcfMargin: round(row.fcfMargin, 4),
  cash: round(row.cash, 0),
  totalDebt: round(row.totalDebt, 0),
  equity: round(row.equity, 0),
  dilutedShares: round(row.dilutedShares, 0),
  roe: round(row.roe, 4),
  roa: round(row.roa, 4),
  source: row.source,
});
