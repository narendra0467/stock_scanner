// SEC EDGAR XBRL "company facts" -> clean annual statements (10 years when available).
// Works for US filers (10-K) and foreign filers (20-F / 40-F, including many Canadian large caps).
import { fetchJson } from "../lib/http.js";
import { cached, TTL } from "../lib/cache.js";
import { isNum, daysBetween } from "../lib/util.js";

const TICKER_MAP_URL = "https://www.sec.gov/files/company_tickers.json";
const FACTS_URL = "https://data.sec.gov/api/xbrl/companyfacts";
const SEC_HEADERS = { "User-Agent": process.env.SEC_USER_AGENT || "long-term-scanner research contact@example.com" };
const ANNUAL_FORMS = new Set(["10-K", "10-K/A", "10-KT", "20-F", "20-F/A", "40-F", "40-F/A"]);

// Ordered fallbacks per field: first concept with data wins (per fiscal year).
export const CONCEPTS = {
  revenue: {
    kind: "duration",
    tags: [
      "us-gaap:Revenues",
      "us-gaap:RevenueFromContractWithCustomerExcludingAssessedTax",
      "us-gaap:RevenueFromContractWithCustomerIncludingAssessedTax",
      "us-gaap:SalesRevenueNet",
      "us-gaap:RevenuesNetOfInterestExpense",
      "us-gaap:InterestAndDividendIncomeOperating",
      "ifrs-full:Revenue",
      "ifrs-full:RevenueFromContractsWithCustomers",
    ],
  },
  grossProfit: { kind: "duration", tags: ["us-gaap:GrossProfit", "ifrs-full:GrossProfit"] },
  operatingIncome: { kind: "duration", tags: ["us-gaap:OperatingIncomeLoss", "ifrs-full:ProfitLossFromOperatingActivities"] },
  netIncome: {
    kind: "duration",
    tags: ["us-gaap:NetIncomeLoss", "us-gaap:ProfitLoss", "us-gaap:NetIncomeLossAvailableToCommonStockholdersBasic", "ifrs-full:ProfitLossAttributableToOwnersOfParent", "ifrs-full:ProfitLoss"],
  },
  eps: { kind: "duration", tags: ["us-gaap:EarningsPerShareDiluted", "us-gaap:EarningsPerShareBasic", "ifrs-full:DilutedEarningsLossPerShare", "ifrs-full:BasicEarningsLossPerShare"] },
  operatingCashFlow: {
    kind: "duration",
    tags: ["us-gaap:NetCashProvidedByUsedInOperatingActivities", "us-gaap:NetCashProvidedByUsedInOperatingActivitiesContinuingOperations", "ifrs-full:CashFlowsFromUsedInOperatingActivities"],
  },
  capex: {
    kind: "duration",
    tags: ["us-gaap:PaymentsToAcquirePropertyPlantAndEquipment", "us-gaap:PaymentsToAcquireProductiveAssets", "us-gaap:PaymentsForCapitalImprovements", "ifrs-full:PurchaseOfPropertyPlantAndEquipmentClassifiedAsInvestingActivities"],
  },
  interestExpense: { kind: "duration", tags: ["us-gaap:InterestExpense", "us-gaap:InterestExpenseNonoperating", "us-gaap:InterestExpenseDebt", "ifrs-full:InterestExpense"] },
  buybacks: { kind: "duration", tags: ["us-gaap:PaymentsForRepurchaseOfCommonStock", "ifrs-full:PaymentsToAcquireOrRedeemEntitysShares"] },
  dividendsPaid: { kind: "duration", tags: ["us-gaap:PaymentsOfDividendsCommonStock", "us-gaap:PaymentsOfDividends", "ifrs-full:DividendsPaidClassifiedAsFinancingActivities"] },
  dilutedShares: { kind: "duration", tags: ["us-gaap:WeightedAverageNumberOfDilutedSharesOutstanding", "us-gaap:WeightedAverageNumberOfShareOutstandingBasicAndDiluted", "ifrs-full:AdjustedWeightedAverageShares", "ifrs-full:WeightedAverageShares"] },
  cash: {
    kind: "instant",
    tags: ["us-gaap:CashAndCashEquivalentsAtCarryingValue", "us-gaap:CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents", "us-gaap:CashAndDueFromBanks", "ifrs-full:CashAndCashEquivalents"],
  },
  longTermDebt: { kind: "instant", tags: ["us-gaap:LongTermDebtNoncurrent", "us-gaap:LongTermDebt", "us-gaap:LongTermDebtAndCapitalLeaseObligations", "ifrs-full:NoncurrentBorrowingsAndNoncurrentLeaseLiabilities", "ifrs-full:Borrowings"] },
  shortTermDebt: { kind: "instant", tags: ["us-gaap:LongTermDebtCurrent", "us-gaap:DebtCurrent", "us-gaap:ShortTermBorrowings", "ifrs-full:CurrentBorrowingsAndCurrentPortionOfNoncurrentBorrowings"] },
  equity: { kind: "instant", tags: ["us-gaap:StockholdersEquity", "us-gaap:StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest", "ifrs-full:EquityAttributableToOwnersOfParent", "ifrs-full:Equity"] },
  totalAssets: { kind: "instant", tags: ["us-gaap:Assets", "ifrs-full:Assets"] },
  sharesOutstanding: { kind: "instant", tags: ["dei:EntityCommonStockSharesOutstanding", "us-gaap:CommonStockSharesOutstanding", "ifrs-full:NumberOfSharesOutstanding"] },
};

export async function fetchTickerMap() {
  return cached("secMap", "tickers", TTL.secMap, async () => {
    const payload = await fetchJson(TICKER_MAP_URL, { headers: SEC_HEADERS });
    const map = {};
    for (const row of Object.values(payload)) {
      map[String(row.ticker).toUpperCase()] = { cik: String(row.cik_str).padStart(10, "0"), title: row.title };
    }
    return map;
  });
}

export function secTickerCandidates(symbol) {
  const clean = String(symbol).toUpperCase();
  const base = clean.replace(/\.(TO|V|NE|CN)$/, "");
  const candidates = [clean.replace(".", "-")];
  if (base !== clean) candidates.push(base, base.replace(".", "-"));
  return [...new Set(candidates)];
}

export async function fetchCompanyFacts(symbol) {
  const map = await fetchTickerMap();
  const match = secTickerCandidates(symbol).map((candidate) => map[candidate]).find(Boolean);
  if (!match) return null;
  const facts = await cached("financials", `cik_${match.cik}`, TTL.financials, () =>
    fetchJson(`${FACTS_URL}/CIK${match.cik}.json`, { headers: SEC_HEADERS })
  );
  return { ...facts, cik: match.cik, matchedTitle: match.title };
}

function entriesFor(facts, tag) {
  const [taxonomy, concept] = tag.split(":");
  const units = facts?.facts?.[taxonomy]?.[concept]?.units;
  if (!units) return [];
  // Prefer plain currency / share units; EPS uses USD/shares.
  const unitKey = Object.keys(units).find((u) => /^(USD|CAD|EUR|GBP|shares|USD\/shares|CAD\/shares|pure)$/i.test(u)) ?? Object.keys(units)[0];
  return units[unitKey] ?? [];
}

function isAnnualDuration(entry) {
  if (!entry.start || !entry.end) return false;
  const days = daysBetween(entry.start, entry.end);
  return days >= 340 && days <= 380;
}

// Pick one value per fiscal-year-end, preferring the most recently filed (restated) figure.
function annualSeries(facts, tag, kind) {
  const chosen = new Map();
  for (const entry of entriesFor(facts, tag)) {
    if (!ANNUAL_FORMS.has(entry.form) || !isNum(entry.val)) continue;
    if (kind === "duration" ? !isAnnualDuration(entry) : Boolean(entry.start)) continue;
    const current = chosen.get(entry.end);
    if (!current || String(entry.filed) > String(current.filed)) chosen.set(entry.end, entry);
  }
  return chosen;
}

export function buildAnnualStatements(facts) {
  if (!facts?.facts) return [];
  const byYear = new Map();
  for (const [field, spec] of Object.entries(CONCEPTS)) {
    for (const tag of spec.tags) {
      const series = annualSeries(facts, tag, spec.kind);
      if (!series.size) continue;
      for (const [end, entry] of series) {
        if (!byYear.has(end)) byYear.set(end, { fiscalYearEnd: end, source: "sec", form: entry.form });
        const row = byYear.get(end);
        if (!isNum(row[field])) {
          row[field] = entry.val;
          row[`${field}Tag`] = tag;
        }
      }
      // Keep going through every tag: companies switched tags over the years (e.g. Revenues ->
      // RevenueFromContractWithCustomer in 2018), so each tag may cover a different span.
    }
  }
  // Only keep year-ends that have revenue or net income (drops stray balance-sheet instants from 10-Qs).
  const rows = [...byYear.values()]
    .filter((row) => isNum(row.revenue) || isNum(row.netIncome))
    .sort((a, b) => a.fiscalYearEnd.localeCompare(b.fiscalYearEnd));
  for (const row of rows) {
    const lt = isNum(row.longTermDebt) ? row.longTermDebt : 0;
    const st = isNum(row.shortTermDebt) ? row.shortTermDebt : 0;
    row.totalDebt = isNum(row.longTermDebt) || isNum(row.shortTermDebt) ? lt + st : null;
    if (isNum(row.capex)) row.capex = -Math.abs(row.capex);
    row.freeCashFlow = isNum(row.operatingCashFlow) && isNum(row.capex) ? row.operatingCashFlow + row.capex : null;
    if (isNum(row.buybacks)) row.buybacks = Math.abs(row.buybacks);
    if (isNum(row.dividendsPaid)) row.dividendsPaid = Math.abs(row.dividendsPaid);
  }
  // Drop any year that is a duplicate fiscal year (e.g. 52/53-week calendars ending a few days apart).
  const deduped = [];
  for (const row of rows) {
    const prev = deduped[deduped.length - 1];
    if (prev && daysBetween(prev.fiscalYearEnd, row.fiscalYearEnd) < 300) {
      deduped[deduped.length - 1] = { ...prev, ...row };
    } else {
      deduped.push(row);
    }
  }
  return deduped;
}

export async function fetchSecAnnuals(symbol) {
  const facts = await fetchCompanyFacts(symbol);
  if (!facts) return { facts: null, years: [] };
  return { facts: { cik: facts.cik, entityName: facts.entityName, matchedTitle: facts.matchedTitle }, years: buildAnnualStatements(facts) };
}
