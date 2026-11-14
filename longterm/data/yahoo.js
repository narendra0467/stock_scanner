// Yahoo Finance fetchers written for the long-term scanner (independent of the rest of the repo).
import { fetchJson, fetchText } from "../lib/http.js";
import { cached, TTL } from "../lib/cache.js";
import { isNum } from "../lib/util.js";

const CHART = "https://query1.finance.yahoo.com/v8/finance/chart";
const QUOTE_SUMMARY = "https://query2.finance.yahoo.com/v10/finance/quoteSummary";
const TIMESERIES = "https://query1.finance.yahoo.com/ws/fundamentals-timeseries/v1/finance/timeseries";
const SEARCH = "https://query1.finance.yahoo.com/v1/finance/search";

let auth = null;

async function getAuth() {
  if (auth) return auth;
  const probe = await fetch("https://fc.yahoo.com", { headers: { "User-Agent": "Mozilla/5.0" }, redirect: "manual" });
  const cookie = probe.headers.get("set-cookie")?.split(";")[0] ?? "";
  const { text: crumb } = await fetchText("https://query1.finance.yahoo.com/v1/test/getcrumb", { headers: { Cookie: cookie, "User-Agent": "Mozilla/5.0" } });
  if (!crumb || crumb.length > 40) throw new Error("Yahoo crumb handshake failed");
  auth = { cookie, crumb };
  return auth;
}

export function parseChart(payload) {
  const result = payload?.chart?.result?.[0];
  const quote = result?.indicators?.quote?.[0];
  if (!result?.timestamp || !quote) return { meta: result?.meta ?? {}, bars: [] };
  const adj = result.indicators?.adjclose?.[0]?.adjclose;
  const bars = result.timestamp
    .map((ts, i) => ({
      date: new Date(ts * 1000).toISOString().slice(0, 10),
      open: quote.open?.[i],
      high: quote.high?.[i],
      low: quote.low?.[i],
      close: quote.close?.[i],
      adjClose: adj?.[i] ?? quote.close?.[i],
      volume: quote.volume?.[i] ?? 0,
    }))
    .filter((bar) => [bar.open, bar.high, bar.low, bar.close].every(isNum));
  return { meta: result.meta ?? {}, bars };
}

export async function fetchBars(symbol, range = "5y", interval = "1wk") {
  const key = `${symbol}_${range}_${interval}`;
  return cached("prices", key, TTL.prices, async () => {
    const url = `${CHART}/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}&events=div%2Csplit`;
    const payload = await fetchJson(url);
    const { meta, bars } = parseChart(payload);
    if (!bars.length) throw new Error(`${symbol}: no price history returned (check the ticker, Canadian names need .TO/.V)`);
    return { symbol, range, interval, currency: meta.currency ?? null, exchange: meta.exchangeName ?? null, bars };
  });
}

export const QUOTE_MODULES = [
  "price",
  "summaryDetail",
  "financialData",
  "defaultKeyStatistics",
  "assetProfile",
  "earningsTrend",
  "earningsHistory",
  "calendarEvents",
  "recommendationTrend",
];

export async function fetchQuote(symbol, modules = QUOTE_MODULES) {
  return cached("quote", symbol, TTL.quote, async () => {
    const { cookie, crumb } = await getAuth();
    const url = `${QUOTE_SUMMARY}/${encodeURIComponent(symbol)}?modules=${encodeURIComponent(modules.join(","))}&crumb=${encodeURIComponent(crumb)}`;
    const payload = await fetchJson(url, { headers: { Cookie: cookie } });
    const result = payload?.quoteSummary?.result?.[0];
    if (!result) throw new Error(`${symbol}: ${payload?.quoteSummary?.error?.description ?? "no quote summary"}`);
    return result;
  });
}

// Annual fundamentals via Yahoo's timeseries endpoint (no crumb needed). Used as the
// fallback for companies without SEC XBRL data (most TSX / TSXV names).
export const TIMESERIES_FIELDS = {
  annualTotalRevenue: "revenue",
  annualGrossProfit: "grossProfit",
  annualOperatingIncome: "operatingIncome",
  annualNetIncome: "netIncome",
  annualDilutedEPS: "eps",
  annualOperatingCashFlow: "operatingCashFlow",
  annualCapitalExpenditure: "capex",
  annualFreeCashFlow: "freeCashFlow",
  annualCashAndCashEquivalents: "cash",
  annualTotalDebt: "totalDebt",
  annualStockholdersEquity: "equity",
  annualTotalAssets: "totalAssets",
  annualDilutedAverageShares: "dilutedShares",
  annualInterestExpense: "interestExpense",
  annualRepurchaseOfCapitalStock: "buybacks",
  annualCashDividendsPaid: "dividendsPaid",
};

export function parseTimeseries(payload) {
  const years = new Map();
  for (const series of payload?.timeseries?.result ?? []) {
    const type = series?.meta?.type?.[0];
    const field = TIMESERIES_FIELDS[type];
    if (!field || !Array.isArray(series[type])) continue;
    for (const point of series[type]) {
      const date = point?.asOfDate;
      const value = point?.reportedValue?.raw;
      if (!date || !isNum(value)) continue;
      if (!years.has(date)) years.set(date, { fiscalYearEnd: date, source: "yahoo" });
      years.get(date)[field] = value;
    }
  }
  return [...years.values()].sort((a, b) => a.fiscalYearEnd.localeCompare(b.fiscalYearEnd));
}

export async function fetchYahooAnnuals(symbol) {
  return cached("financials", `${symbol}_yahoo`, TTL.financials, async () => {
    const period2 = Math.floor(Date.now() / 1000);
    const period1 = period2 - 11 * 365 * 86400;
    const types = Object.keys(TIMESERIES_FIELDS).join(",");
    const url = `${TIMESERIES}/${encodeURIComponent(symbol)}?type=${types}&period1=${period1}&period2=${period2}&merge=false`;
    const payload = await fetchJson(url);
    return parseTimeseries(payload);
  });
}

export async function searchSymbols(query, count = 8) {
  const url = `${SEARCH}?q=${encodeURIComponent(query)}&quotesCount=${count}&newsCount=0`;
  const payload = await fetchJson(url);
  return (payload?.quotes ?? [])
    .filter((q) => q.symbol && !String(q.symbol).includes("="))
    .map((q) => ({ symbol: String(q.symbol).toUpperCase(), name: q.longname || q.shortname || q.symbol, exchange: q.exchDisp || q.exchange, type: q.quoteType }));
}
