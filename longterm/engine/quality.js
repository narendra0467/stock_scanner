// Business Quality engine: fundamentals only, sector-mode aware, 0-100 with grade A-D.
import { isNum, round, clamp, fmtPct, fmtX, fmtMoney } from "../lib/util.js";

function status(value, pass, near, { higherIsBetter = true } = {}) {
  if (!isNum(value)) return "unavailable";
  if (higherIsBetter) return value >= pass ? "pass" : value >= near ? "near" : "fail";
  return value <= pass ? "pass" : value <= near ? "near" : "fail";
}

function metric(label, value, display, ideal, st, max, note) {
  const points = st === "pass" ? max : st === "near" ? max * 0.5 : 0;
  return { label, value: isNum(value) ? round(value, 4) : null, display, ideal, status: st, points, max, note };
}

function pillarScore(name, weight, metrics) {
  const available = metrics.filter((m) => m.status !== "unavailable");
  const coverage = metrics.length ? available.length / metrics.length : 0;
  let score = available.length ? (available.reduce((a, m) => a + m.points, 0) / available.reduce((a, m) => a + m.max, 0)) * 100 : null;
  if (isNum(score) && coverage < 0.5) score = Math.min(score, 60);
  return { name, weight, score: isNum(score) ? Math.round(score) : null, coverage: round(coverage, 2), metrics };
}

const ratio = (count, total) => (total > 0 ? count / total : null);

export function scoreQuality({ financials, snapshot, profile }) {
  const mode = profile.mode;
  if (mode === "etf") {
    return { applicable: false, score: null, grade: "n/a", label: "Fund: fundamentals not scored", pillars: [], redFlags: [], highlights: [], concerns: [], dataCoverage: null };
  }
  const s = financials.summary;
  const latest = s.latest ?? {};
  const isBank = mode === "bank" || mode === "insurance";
  const cyclical = mode === "semis" || mode === "energy";
  const growthFloor = isBank ? [0.10, 0.05] : [0.15, 0.08];

  // ── Growth ──────────────────────────────────────────────────────────────
  const growth = [
    metric("3-yr revenue CAGR", s.revenueCagr3, fmtPct(s.revenueCagr3), `${fmtPct(growthFloor[0], 0)}+`, status(s.revenueCagr3, ...growthFloor), 7, "Compound growth over the last three fiscal years."),
    metric("5-yr revenue CAGR", s.revenueCagr5, fmtPct(s.revenueCagr5), `${fmtPct(growthFloor[0], 0)}+`, status(s.revenueCagr5, ...growthFloor), 5, s.yearsAvailable < 6 ? "Needs six fiscal years of data." : "Long-run growth rate."),
    metric("Latest year revenue growth", s.revenueGrowthLatest ?? snapshot.revenueGrowthYoY, fmtPct(s.revenueGrowthLatest ?? snapshot.revenueGrowthYoY), "10%+", status(s.revenueGrowthLatest ?? snapshot.revenueGrowthYoY, 0.10, 0.03), 5, "Is growth still alive right now?"),
    metric("Growth consistency", ratio(s.revenueUpYears, s.revenueYearsWithGrowthData), s.revenueYearsWithGrowthData ? `${s.revenueUpYears} of ${s.revenueYearsWithGrowthData} years up` : "n/a", cyclical ? "3 of 5+" : "4 of 5+", status(ratio(s.revenueUpYears, s.revenueYearsWithGrowthData), cyclical ? 0.6 : 0.8, 0.6), 4, "Steady growers are easier to hold through bad markets."),
    metric(isBank ? "3-yr net income CAGR" : "3-yr EPS CAGR", isBank ? (s.netIncomeCagr3 ?? s.epsCagr3) : (s.epsCagr3 ?? s.netIncomeCagr3), fmtPct(isBank ? (s.netIncomeCagr3 ?? s.epsCagr3) : (s.epsCagr3 ?? s.netIncomeCagr3)), "12%+", status(isBank ? (s.netIncomeCagr3 ?? s.epsCagr3) : (s.epsCagr3 ?? s.netIncomeCagr3), 0.12, 0.0), 4, "Profits should grow at least as fast as sales."),
  ];

  // ── Profitability ────────────────────────────────────────────────────────
  const gm = latest.grossMargin ?? snapshot.grossMarginTTM;
  const om = latest.operatingMargin ?? snapshot.operatingMarginTTM;
  const nm = latest.netMargin ?? snapshot.netMarginTTM;
  const roe = latest.roe ?? snapshot.roeTTM;
  const roa = latest.roa ?? snapshot.roaTTM;
  const gmPass = mode === "software" ? [0.65, 0.5] : mode === "semis" ? [0.45, 0.3] : [0.40, 0.25];
  const profitability = isBank
    ? [
        metric("Return on equity", roe, fmtPct(roe), "12%+", status(roe, 0.12, 0.08), 7, "The core profitability measure for a bank or lender."),
        metric("Return on assets", roa, fmtPct(roa, 2), "1.0%+", status(roa, 0.01, 0.007), 4, "How much profit each dollar of assets earns."),
        metric("Net margin", nm, fmtPct(nm), "15%+", status(nm, 0.15, 0.08), 4, "Profit after all costs and credit losses."),
        metric("Net margin trend (3 yrs)", s.netMarginTrend, isNum(s.netMarginTrend) ? `${(s.netMarginTrend * 100).toFixed(1)} pts` : "n/a", "Expanding", status(s.netMarginTrend, 0.01, -0.01), 3, "Is profitability improving or eroding?"),
        metric("Profitable years", ratio(s.profitableYears, s.netIncomeYears), s.netIncomeYears ? `${s.profitableYears} of ${s.netIncomeYears}` : "n/a", "4 of 5+", status(ratio(s.profitableYears, s.netIncomeYears), 0.8, 0.6), 2, "Losses in a lender usually mean credit problems."),
      ]
    : [
        metric("Gross margin", gm, fmtPct(gm), `${fmtPct(gmPass[0], 0)}+`, status(gm, ...gmPass), 4, "High gross margin usually means pricing power or a differentiated product."),
        metric("Operating margin", om, fmtPct(om), "15%+", status(om, 0.15, 0.08), 5, "Profit from the core business before interest and tax."),
        metric("Net margin", nm, fmtPct(nm), "10%+", status(nm, 0.10, 0.04), 3, "Bottom-line profitability."),
        metric("Operating margin trend (3 yrs)", s.operatingMarginTrend, isNum(s.operatingMarginTrend) ? `${(s.operatingMarginTrend * 100).toFixed(1)} pts` : "n/a", "Expanding", status(s.operatingMarginTrend, 0.01, -0.01), 4, "Operating leverage: margins should widen as the company scales."),
        metric("Return on equity", roe, fmtPct(roe), "15%+", status(roe, 0.15, 0.10), 4, "How well the company compounds shareholder capital."),
      ];

  // ── Cash flow / earnings power ──────────────────────────────────────────
  const fcfMargin = latest.fcfMargin ?? (isNum(snapshot.fcfTTM) && isNum(snapshot.revenueTTM) && snapshot.revenueTTM > 0 ? snapshot.fcfTTM / snapshot.revenueTTM : null);
  const cashflow = isBank
    ? [
        metric("Book value / share growth (3-yr)", s.bvpsCagr3, fmtPct(s.bvpsCagr3), "8%+", status(s.bvpsCagr3, 0.08, 0.03), 8, "A bank that compounds book value per share compounds your money."),
        metric("Net income growth (latest year)", latest.netIncomeGrowth ?? snapshot.earningsGrowthYoY, fmtPct(latest.netIncomeGrowth ?? snapshot.earningsGrowthYoY), "10%+", status(latest.netIncomeGrowth ?? snapshot.earningsGrowthYoY, 0.10, 0.0), 6, "Earnings momentum."),
        metric("Operating cash flow positive", isNum(latest.operatingCashFlow) ? (latest.operatingCashFlow > 0 ? 1 : 0) : null, isNum(latest.operatingCashFlow) ? fmtMoney(latest.operatingCashFlow) : "n/a", "Positive", status(isNum(latest.operatingCashFlow) ? (latest.operatingCashFlow > 0 ? 1 : 0) : null, 1, 1), 1, "Informational for banks; loan growth distorts cash flow."),
      ]
    : [
        metric("Free-cash-flow positive years", ratio(s.fcfPositiveYears, s.fcfYears), s.fcfYears ? `${s.fcfPositiveYears} of ${s.fcfYears}` : "n/a", "4 of 5+", status(ratio(s.fcfPositiveYears, s.fcfYears), 0.8, 0.6), 5, "Real cash generation, year after year."),
        metric("FCF margin (latest)", fcfMargin, fmtPct(fcfMargin), mode === "software" ? "20%+" : "12%+", status(fcfMargin, mode === "software" ? 0.20 : 0.12, 0.06), 5, "Cash left after running and reinvesting in the business, per dollar of sales."),
        metric("FCF conversion (FCF / net income)", latest.fcfConversion, fmtX(latest.fcfConversion, 2), "0.8x+", status(latest.fcfConversion, 0.8, 0.5), 4, "Accounting profit should turn into cash. Below 0.5x is a warning."),
        metric("3-yr FCF growth", s.fcfCagr3, fmtPct(s.fcfCagr3), "10%+", status(s.fcfCagr3, 0.10, 0.0), 3, "Cash flow growing with the business."),
        metric("Earnings quality (OCF vs net income, 3 yrs)", isNum(s.earningsVsCashGap) ? 3 - s.earningsVsCashGap : null, isNum(s.earningsVsCashGap) ? `${3 - s.earningsVsCashGap} of 3 years clean` : "n/a", "3 of 3", status(isNum(s.earningsVsCashGap) ? 3 - s.earningsVsCashGap : null, 3, 2), 3, "Operating cash flow should be close to or above reported profit."),
      ];

  // ── Balance sheet ───────────────────────────────────────────────────────
  const netDebtToOcf = isNum(latest.netDebt) && isNum(latest.operatingCashFlow) && latest.operatingCashFlow > 0 ? latest.netDebt / latest.operatingCashFlow : isNum(latest.netDebt) && latest.netDebt <= 0 ? 0 : null;
  const d2e = latest.debtToEquity ?? snapshot.debtToEquity;
  const balance = isBank
    ? [
        metric("Equity / assets", latest.equityToAssets, fmtPct(latest.equityToAssets), "8%+", status(latest.equityToAssets, 0.08, 0.05), 8, "Capital cushion. Thin equity means more risk in a downturn."),
        metric("Debt / equity", d2e, fmtX(d2e, 2), "Below 3x", status(d2e, 3, 5, { higherIsBetter: false }), 4, "Wholesale borrowings relative to equity (deposits excluded)."),
        metric("Debt trend (2 yrs)", s.debtTrend, fmtPct(s.debtTrend), "Below +30%", status(s.debtTrend, 0.30, 0.60, { higherIsBetter: false }), 3, "Fast-rising debt deserves a question."),
      ]
    : [
        metric("Net debt / operating cash flow", netDebtToOcf, isNum(netDebtToOcf) ? (netDebtToOcf <= 0 ? "net cash" : fmtX(netDebtToOcf)) : "n/a", "Below 1.5x", status(netDebtToOcf, 1.5, 3, { higherIsBetter: false }), 5, "Years of cash flow needed to repay debt. Net cash is best."),
        metric("Debt / equity", d2e, fmtX(d2e, 2), "Below 0.6x", status(d2e, 0.6, 1.2, { higherIsBetter: false }), 3, "Leverage relative to shareholder capital."),
        metric("Interest coverage", latest.interestCoverage, fmtX(latest.interestCoverage), "8x+", status(latest.interestCoverage, 8, 4), 3, "Operating profit divided by interest cost."),
        metric("Current ratio", snapshot.currentRatio, fmtX(snapshot.currentRatio, 2), "1.2x+", status(snapshot.currentRatio, 1.2, 1.0), 2, "Short-term liquidity."),
        metric("Debt trend (2 yrs)", s.debtTrend, fmtPct(s.debtTrend), "Below +10%", status(s.debtTrend, 0.10, 0.30, { higherIsBetter: false }), 2, "Debt should not grow faster than the business."),
      ];

  // ── Shareholder treatment ───────────────────────────────────────────────
  const dilutionPass = mode === "software" ? [0.0, 0.08] : [0.02, 0.10];
  const shareholder = [
    metric(`Share count change (${s.shareChangeYears ?? 5} yrs)`, s.shareChange5y, fmtPct(s.shareChange5y), "Flat or falling", status(s.shareChange5y, ...dilutionPass, { higherIsBetter: false }), 6, "Dilution quietly transfers your ownership to employees and acquisitions."),
    metric("Buybacks or dividends (years of 5)", Math.max(s.buybackYears ?? 0, s.dividendYears ?? 0), `${Math.max(s.buybackYears ?? 0, s.dividendYears ?? 0)} of 5`, "3+", status(Math.max(s.buybackYears ?? 0, s.dividendYears ?? 0), 3, 1), 4, "Returning cash is a sign of a mature, confident business."),
  ];

  // ── Moat / durability ───────────────────────────────────────────────────
  const marginStab = isBank ? null : s.grossMarginStdev;
  const moat = [
    isBank
      ? metric("Scale (annual revenue)", latest.revenue ?? snapshot.revenueTTM, fmtMoney(latest.revenue ?? snapshot.revenueTTM), "$1B+", status(latest.revenue ?? snapshot.revenueTTM, 1e9, 3e8), 4, "Scale lowers funding cost and spreads compliance expense.")
      : metric("Gross margin stability (5-yr std dev)", marginStab, isNum(marginStab) ? `${(marginStab * 100).toFixed(1)} pts` : "n/a", "Below 2 pts", status(marginStab, 0.02, 0.04, { higherIsBetter: false }), 4, "Stable margins suggest pricing power; swings suggest a commodity."),
    metric("Pricing power (gross margin level)", isBank ? null : gm, isBank ? "n/a (bank)" : fmtPct(gm), isBank ? "n/a" : "50%+", isBank ? "unavailable" : status(gm, 0.5, 0.35), 3, "Very high gross margin is hard to copy."),
    metric("Scale economics (op margin 20%+ with steady growth)", isNum(om) && isNum(ratio(s.revenueUpYears, s.revenueYearsWithGrowthData)) ? (om >= 0.2 && ratio(s.revenueUpYears, s.revenueYearsWithGrowthData) >= 0.8 ? 1 : om >= 0.12 ? 0.5 : 0) : null, isNum(om) ? fmtPct(om) : "n/a", "Yes", status(isNum(om) && isNum(ratio(s.revenueUpYears, s.revenueYearsWithGrowthData)) ? (om >= 0.2 && ratio(s.revenueUpYears, s.revenueYearsWithGrowthData) >= 0.8 ? 1 : om >= 0.12 ? 0.5 : 0) : null, 1, 0.5), 3, "Margins that hold while growing imply a durable advantage."),
  ];

  const pillars = [
    pillarScore("Growth", 25, growth),
    pillarScore("Profitability", isBank ? 25 : 20, profitability),
    pillarScore(isBank ? "Earnings power" : "Cash flow", isBank ? 15 : 20, cashflow),
    pillarScore("Balance sheet", 15, balance),
    pillarScore("Shareholder treatment", 10, shareholder),
    pillarScore("Moat / durability", 10, moat),
  ];
  const scored = pillars.filter((p) => isNum(p.score));
  const weightSum = scored.reduce((a, p) => a + p.weight, 0);
  let score = weightSum ? scored.reduce((a, p) => a + p.score * p.weight, 0) / weightSum : 0;
  const allMetrics = pillars.flatMap((p) => p.metrics);
  const dataCoverage = allMetrics.length ? allMetrics.filter((m) => m.status !== "unavailable").length / allMetrics.length : 0;

  // ── Red flags (hard overrides) ──────────────────────────────────────────
  const redFlags = [];
  const years = financials.years;
  const lastTwoDown = years.length >= 3 && years.slice(-2).every((row) => isNum(row.revenueGrowth) && row.revenueGrowth < 0);
  if (lastTwoDown && !cyclical) redFlags.push("Revenue fell in each of the last two fiscal years.");
  if (!isBank && mode !== "biotech" && s.netIncomeYears >= 4 && s.profitableYears <= s.netIncomeYears - 3 && s.fcfYears >= 4 && s.fcfPositiveYears <= s.fcfYears - 3) redFlags.push("Losses and negative free cash flow in most of the last five years.");
  if (isNum(s.shareChange5y) && s.shareChange5y > 0.25) redFlags.push(`Share count grew ${fmtPct(s.shareChange5y, 0)} over ${s.shareChangeYears} years (heavy dilution).`);
  if (!isBank && isNum(s.debtTrend) && s.debtTrend > 0.5 && isNum(s.fcfCagr3) && s.fcfCagr3 < 0) redFlags.push("Debt up more than 50% in two years while free cash flow is shrinking.");
  if (!isBank && isNum(s.earningsVsCashGap) && s.earningsVsCashGap >= 3) redFlags.push("Operating cash flow has trailed reported profit for three straight years (earnings quality).");
  if (isNum(latest.equity) && latest.equity < 0 && !(isNum(latest.buybacks) && latest.buybacks > 0)) redFlags.push("Negative shareholder equity.");
  if (!isBank && isNum(snapshot.currentRatio) && snapshot.currentRatio < 0.8 && isNum(latest.netDebt) && latest.netDebt > 0) redFlags.push("Current ratio below 0.8 with net debt: liquidity risk.");

  let grade = score >= 85 ? "A" : score >= 70 ? "B" : score >= 55 ? "C" : "D";
  const notes = [];
  if (redFlags.length >= 2 && grade !== "D") { grade = "D"; notes.push("Grade capped at D by multiple red flags."); }
  else if (redFlags.length === 1 && (grade === "A" || grade === "B")) { grade = "C"; notes.push("Grade capped at C by a red flag."); }
  if (dataCoverage < 0.6 && grade === "A") { grade = "B"; notes.push("Grade capped at B: less than 60% of metrics available."); }

  const labels = { A: "Core compounder", B: "Quality growth / durable business", C: "Watch list: promising but unproven", D: "Not suitable for a long-term hold" };
  const highlights = allMetrics.filter((m) => m.status === "pass" && m.max >= 4).slice(0, 6).map((m) => `${m.label}: ${m.display}`);
  const concerns = allMetrics.filter((m) => m.status === "fail" && m.max >= 3).slice(0, 6).map((m) => `${m.label}: ${m.display} (ideal ${m.ideal})`);
  return {
    applicable: true,
    score: Math.round(clamp(score)),
    grade,
    label: labels[grade],
    pillars,
    redFlags,
    notes,
    highlights,
    concerns,
    dataCoverage: round(dataCoverage, 2),
    mode,
  };
}
