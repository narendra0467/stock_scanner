// data.js — fetch + normalize fundamentals from Yahoo Finance (free, no API key).
// Covers NASDAQ (plain ticker) and TSX (.TO suffix). Returns one flat object
// with every metric the scoring + narrative layers need.

import YahooFinance from 'yahoo-finance2';

const yf = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

const MODULES = [
  'price',
  'summaryDetail',
  'defaultKeyStatistics',
  'financialData',
  'summaryProfile',
  'earningsTrend',
  'recommendationTrend',
];

// safe number: returns the number, or null for undefined/NaN/Infinity
function num(v) {
  if (v === null || v === undefined) return null;
  const n = typeof v === 'object' && 'raw' in v ? v.raw : v;
  return Number.isFinite(n) ? n : null;
}

// null if exactly zero — Yahoo returns 0 for fields it doesn't compute for a
// sector (e.g. gross/EBITDA margin for banks); a true 0% is implausible there.
function nz(v) {
  const n = num(v);
  return n === 0 ? null : n;
}

// divide guarding against null / zero denominator
function ratio(a, b) {
  a = num(a);
  b = num(b);
  if (a === null || b === null || b === 0) return null;
  return a / b;
}

// Revenue CAGR from annual fundamentalsTimeSeries (oldest -> newest).
// Uses up to the last 4 fiscal years (≈3-year span). Yahoo deprecated the old
// incomeStatementHistory module, so this is the supported path.
async function fetchRevenueCagr(symbol) {
  try {
    const now = new Date();
    const p = (n) => String(n).padStart(2, '0');
    const period2 = `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
    const period1 = `${now.getFullYear() - 6}-01-01`;
    const rows = await yf.fundamentalsTimeSeries(symbol, {
      period1,
      period2,
      type: 'annual',
      module: 'financials',
    });
    const revs = (rows || [])
      .map((r) => num(r.totalRevenue))
      .filter((x) => x && x > 0);
    if (revs.length < 2) return null;
    const window = revs.slice(-4); // last ≤4 annual points
    const earliest = window[0];
    const latest = window[window.length - 1];
    const years = window.length - 1;
    if (earliest <= 0 || years <= 0) return null;
    return Math.pow(latest / earliest, 1 / years) - 1;
  } catch {
    return null; // never fail the whole report over the CAGR
  }
}

// forward EPS growth estimate (+1y) from earningsTrend, as a decimal
function forwardEpsGrowth(earningsTrend) {
  const trend = earningsTrend?.trend || [];
  const next = trend.find((t) => t.period === '+1y') || trend.find((t) => t.period === '0y');
  return num(next?.growth);
}

export async function fetchFundamentals(rawSymbol) {
  const symbol = rawSymbol.trim().toUpperCase();
  let q, revCagr3;
  try {
    [q, revCagr3] = await Promise.all([
      yf.quoteSummary(symbol, { modules: MODULES }),
      fetchRevenueCagr(symbol),
    ]);
  } catch (err) {
    throw new Error(
      `Could not fetch "${symbol}" from Yahoo Finance. ` +
        `Check the ticker (TSX names need a .TO suffix, e.g. SHOP.TO). ` +
        `Underlying error: ${err.message}`
    );
  }

  const price = q.price || {};

  // Guard: this tool analyzes individual company fundamentals. ETFs / funds /
  // indices / currencies have no income statement, so refuse them clearly
  // instead of emitting a meaningless score off one or two stray fields.
  const qt = (price.quoteType || '').toUpperCase();
  const NICE = {
    ETF: 'an ETF',
    MUTUALFUND: 'a mutual fund',
    INDEX: 'an index',
    CURRENCY: 'a currency',
    CRYPTOCURRENCY: 'a cryptocurrency',
    FUTURE: 'a futures contract',
    OPTION: 'an option',
  };
  if (qt && qt !== 'EQUITY') {
    const what = NICE[qt] || `a ${qt.toLowerCase()}`;
    throw new Error(
      `"${symbol}" is ${what}${price.longName ? ` (${price.longName})` : ''}. ` +
        `This tool analyzes individual company stocks — fundamentals don't apply to funds/ETFs/indices.`
    );
  }

  const sd = q.summaryDetail || {};
  const ks = q.defaultKeyStatistics || {};
  const fd = q.financialData || {};
  const prof = q.summaryProfile || {};

  const marketCap = num(price.marketCap) ?? num(sd.marketCap);
  const last = num(price.regularMarketPrice);
  const freeCashflow = num(fd.freeCashflow);
  const totalRevenue = num(fd.totalRevenue);
  const targetMean = num(fd.targetMeanPrice);

  const f = {
    // ---- identity ----
    symbol,
    name: price.longName || price.shortName || symbol,
    exchange: price.exchangeName || price.fullExchangeName || null,
    currency: price.currency || sd.currency || 'USD',
    sector: prof.sector || null,
    industry: prof.industry || null,
    country: prof.country || null,
    website: prof.website || null,
    employees: num(prof.fullTimeEmployees),
    summary: prof.longBusinessSummary || null,

    // ---- price / size ----
    price: last,
    marketCap,
    beta: num(sd.beta) ?? num(ks.beta),
    divYield: num(sd.dividendYield), // already a fraction in v3 (e.g. 0.012)
    week52Change: num(ks['52WeekChange']),

    // ---- valuation ----
    pe: num(sd.trailingPE),
    fwdPE: num(sd.forwardPE),
    peg: num(ks.pegRatio) ?? num(ks.trailingPegRatio),
    pb: num(ks.priceToBook),
    ps: num(sd.priceToSalesTrailing12Months) ?? num(ks.priceToSalesTrailing12Months),
    evEbitda: num(ks.enterpriseToEbitda),
    evRev: num(ks.enterpriseToRevenue),
    pfcf: ratio(marketCap, freeCashflow), // null if FCF <= 0

    // ---- financial health / quality ----
    grossM: nz(fd.grossMargins),
    opM: num(fd.operatingMargins),
    netM: num(fd.profitMargins) ?? num(ks.profitMargins),
    ebitdaM: nz(fd.ebitdaMargins),
    roe: num(fd.returnOnEquity),
    roa: num(fd.returnOnAssets),
    fcfM: ratio(freeCashflow, totalRevenue),
    debtToEquity: num(fd.debtToEquity), // Yahoo gives this as a percentage number (e.g. 45.3)
    currentRatio: num(fd.currentRatio),
    quickRatio: num(fd.quickRatio),
    totalCash: num(fd.totalCash),
    totalDebt: num(fd.totalDebt),
    freeCashflow,

    // ---- growth ----
    revGrowth: num(fd.revenueGrowth),
    epsGrowth: num(fd.earningsGrowth) ?? num(ks.earningsQuarterlyGrowth),
    epsGrowthFwd: forwardEpsGrowth(q.earningsTrend),
    revCagr3,
    totalRevenue,

    // ---- analyst view (cross-check, not part of the score) ----
    eps: num(ks.trailingEps),
    fwdEps: num(ks.forwardEps),
    targetMean,
    targetHigh: num(fd.targetHighPrice),
    targetLow: num(fd.targetLowPrice),
    recKey: fd.recommendationKey || null,
    numAnalysts: num(fd.numberOfAnalystOpinions),
    upside: ratio(targetMean, last) !== null ? ratio(targetMean, last) - 1 : null,
  };

  // ---- derived "pro" metrics (computed from the above) ----
  const TAX = 0.21; // generic effective tax assumption for NOPAT

  // book equity ≈ market cap / price-to-book
  const bookEquity = marketCap !== null && f.pb ? marketCap / f.pb : null;
  // EBIT ≈ operating margin × revenue; NOPAT = EBIT × (1 − tax)
  const ebit = f.opM !== null && totalRevenue !== null ? f.opM * totalRevenue : null;
  const nopat = ebit !== null ? ebit * (1 - TAX) : null;
  // invested capital ≈ book equity + total debt − cash
  const invested =
    bookEquity !== null ? bookEquity + (f.totalDebt || 0) - (f.totalCash || 0) : null;

  // Return on Invested Capital — the quality metric pros lean on most
  f.roic = nopat !== null && invested && invested > 0 ? nopat / invested : null;

  f.ebitda = f.ebitdaM !== null && totalRevenue !== null ? f.ebitdaM * totalRevenue : null;
  f.netDebt =
    f.totalDebt !== null || f.totalCash !== null ? (f.totalDebt || 0) - (f.totalCash || 0) : null;
  // leverage: net debt / EBITDA (a core balance-sheet risk gauge)
  f.netDebtToEbitda =
    f.netDebt !== null && f.ebitda && f.ebitda > 0 ? f.netDebt / f.ebitda : null;

  // FCF yield (replaces the broken absolute P/FCF) and earnings yield
  f.fcfYield = freeCashflow !== null && marketCap ? freeCashflow / marketCap : null;
  f.earningsYield = f.pe && f.pe > 0 ? 1 / f.pe : null;

  return f;
}
