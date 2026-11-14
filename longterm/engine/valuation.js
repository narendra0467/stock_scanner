// Valuation engine: multiples vs sector bands AND vs the stock's own history, plus a fair-value range.
import { isNum, round, clamp, percentileRank, fmtX, fmtPct } from "../lib/util.js";

function status(value, pass, near, lowOk = 0) {
  if (!isNum(value)) return "unavailable";
  if (value < lowOk) return "unavailable"; // negative multiples are meaningless
  return value <= pass ? "pass" : value <= near ? "near" : "fail";
}

function priceAt(weekly, date) {
  if (!weekly?.length) return null;
  const target = new Date(date).getTime();
  let best = null;
  for (const bar of weekly) {
    const diff = Math.abs(new Date(bar.date).getTime() - target);
    if (!best || diff < best.diff) best = { diff, close: bar.close };
  }
  return best && best.diff < 21 * 86400000 ? best.close : null;
}

export function ownHistoryMultiples(financials, weekly) {
  const rows = [];
  for (const year of financials.years) {
    const price = priceAt(weekly, year.fiscalYearEnd);
    if (!isNum(price)) continue;
    rows.push({
      year: year.fiscalYearEnd,
      price,
      pe: isNum(year.eps) && year.eps > 0 ? price / year.eps : null,
      ps: isNum(year.revenuePerShare) && year.revenuePerShare > 0 ? price / year.revenuePerShare : null,
      pb: isNum(year.bookValuePerShare) && year.bookValuePerShare > 0 ? price / year.bookValuePerShare : null,
      pfcf: isNum(year.freeCashFlow) && year.freeCashFlow > 0 && isNum(year.dilutedShares) ? price / (year.freeCashFlow / year.dilutedShares) : null,
    });
  }
  return rows;
}

function historyRead(pct) {
  if (!isNum(pct)) return null;
  if (pct <= 0.2) return "cheapest 20% of its own history";
  if (pct <= 0.4) return "below its usual range";
  if (pct < 0.7) return "middle of its own range";
  if (pct < 0.9) return "upper part of its range";
  return "most expensive it has been";
}

export function scoreValuation({ financials, snapshot, profile, weekly }) {
  const mode = profile.mode;
  if (mode === "etf") return { applicable: false, score: null, label: "Fund: valuation not scored", multiples: [], fairValue: null, ownHistory: [], analyst: snapshot.analyst };
  const isBank = mode === "bank" || mode === "insurance";
  const s = financials.summary;
  const growth = s.revenueCagr3 ?? snapshot.revenueGrowthYoY ?? 0;
  const highGrowth = growth >= 0.2;
  const hist = ownHistoryMultiples(financials, weekly);
  const pctOf = (key, current) => {
    const past = hist.map((h) => h[key]).filter(isNum);
    return past.length >= 3 && isNum(current) ? percentileRank([...past, current], current) : null;
  };

  const bands = {
    trailingPE: isBank ? [15, 20] : highGrowth ? [40, 50] : mode === "software" ? [45, 60] : [25, 32],
    forwardPE: isBank ? [13, 17] : highGrowth ? [30, 38] : mode === "software" ? [35, 45] : [22, 28],
    peg: [1.5, 2.2],
    priceToSales: isBank ? [4, 6] : mode === "software" ? [8, 12] : mode === "semis" ? [6, 9] : [3, 5],
    priceToBook: isBank ? ((snapshot.roeTTM ?? 0) >= 0.15 ? [2.5, 3.5] : [1.5, 2.2]) : [6, 10],
    evToEbitda: mode === "semis" ? [18, 25] : [14, 20],
    priceToFcf: mode === "software" ? [30, 45] : [22, 32],
  };
  const pePct = pctOf("pe", snapshot.trailingPE);
  const psPct = pctOf("ps", snapshot.priceToSales);
  const pbPct = pctOf("pb", snapshot.priceToBook);
  const pfcfPct = pctOf("pfcf", snapshot.priceToFcf);

  const row = (label, value, band, weight, note, pct = null, digits = 1) => ({
    label,
    value: round(value, 2),
    display: fmtX(value, digits),
    ideal: band ? `Below ${band[0]}x` : "context",
    status: band ? status(value, band[0], band[1]) : "unavailable",
    weight,
    ownHistoryPercentile: isNum(pct) ? round(pct, 2) : null,
    ownHistoryRead: historyRead(pct),
    note,
  });

  const multiples = [
    row("Trailing P/E", snapshot.trailingPE, bands.trailingPE, isBank ? 3 : 2, "Price divided by the last 12 months of earnings per share.", pePct),
    row("Forward P/E", snapshot.forwardPE, bands.forwardPE, 3, "Price divided by next year's expected earnings. The most-watched number for a growth stock."),
    row("PEG (P/E to growth)", snapshot.peg, bands.peg, 2, "Below 1.5x means you pay a fair price for the growth rate.", null, 2),
    row("Price / sales", snapshot.priceToSales, bands.priceToSales, isBank ? 1 : 2, "Useful when profits are small or volatile.", psPct),
    row("Price / book", snapshot.priceToBook, bands.priceToBook, isBank ? 3 : 1, isBank ? "For a bank, book value is the anchor. Higher ROE justifies a higher multiple." : "Less relevant outside banks and asset-heavy companies.", pbPct, 2),
    ...(isBank ? [] : [
      row("EV / EBITDA", snapshot.evToEbitda, bands.evToEbitda, 2, "Whole-company value versus cash operating profit; ignores capital structure."),
      row("Price / free cash flow", snapshot.priceToFcf, bands.priceToFcf, 3, "What you pay for each dollar of real cash generated.", pfcfPct),
    ]),
    { label: "Free-cash-flow yield", value: round(snapshot.fcfYield, 4), display: fmtPct(snapshot.fcfYield), ideal: "4%+", status: isBank ? "unavailable" : isNum(snapshot.fcfYield) ? (snapshot.fcfYield >= 0.04 ? "pass" : snapshot.fcfYield >= 0.025 ? "near" : "fail") : "unavailable", weight: isBank ? 0 : 2, note: "Inverse of P/FCF. Compare with bond yields." },
    { label: "Dividend yield", value: round(snapshot.dividendYield, 4), display: fmtPct(snapshot.dividendYield), ideal: "context", status: "unavailable", weight: 0, note: "Income component, if any." },
  ];

  const scored = multiples.filter((m) => m.status !== "unavailable" && m.weight > 0);
  let score = scored.length ? scored.reduce((a, m) => a + (m.status === "pass" ? 100 : m.status === "near" ? 55 : 10) * m.weight, 0) / scored.reduce((a, m) => a + m.weight, 0) : 50;
  const histPcts = [pePct, psPct, pbPct, pfcfPct].filter(isNum);
  const avgHist = histPcts.length ? histPcts.reduce((a, b) => a + b, 0) / histPcts.length : null;
  if (isNum(avgHist)) score += (0.5 - avgHist) * 30; // cheap vs own history adds up to +15, expensive subtracts up to -15
  score = clamp(Math.round(score));

  // ── Fair value range ────────────────────────────────────────────────────
  const eps = snapshot.epsEstimateNextYear ?? snapshot.epsEstimateCurrentYear ?? snapshot.forwardEps ?? (isNum(snapshot.trailingEps) && snapshot.trailingEps > 0 ? snapshot.trailingEps : null);
  const g = snapshot.epsGrowthNextYear ?? snapshot.epsGrowthCurrentYear ?? s.epsCagr3 ?? s.revenueCagr3 ?? 0.05;
  const gClamped = clamp(g, -0.1, 0.5);
  const methods = [];
  if (isNum(eps) && eps > 0) {
    const lowPE = isBank ? clamp(8 + gClamped * 50, 7, 14) : clamp(8 + gClamped * 80, 8, 30);
    const highPE = isBank ? clamp(10 + gClamped * 80, 9, 20) : clamp(10 + gClamped * 130, 12, 45);
    methods.push({ method: `Earnings: ${fmtX(eps, 2).replace("x", "")} forward EPS x ${lowPE.toFixed(0)}-${highPE.toFixed(0)} P/E for ${fmtPct(gClamped, 0)} growth`, low: eps * lowPE, high: eps * highPE });
  }
  if (!isBank && isNum(snapshot.fcfTTM) && snapshot.fcfTTM > 0 && isNum(snapshot.sharesOutstanding) && snapshot.sharesOutstanding > 0) {
    const fcfPerShare = snapshot.fcfTTM / snapshot.sharesOutstanding;
    const yields = gClamped >= 0.10 ? [0.035, 0.06] : [0.05, 0.08];
    methods.push({ method: `Cash flow: ${fmtX(fcfPerShare, 2).replace("x", "")} FCF/share at a ${fmtPct(yields[0], 1)}-${fmtPct(yields[1], 1)} yield`, low: fcfPerShare / yields[1], high: fcfPerShare / yields[0] });
  }
  if (isBank && isNum(snapshot.bookValuePerShare) && snapshot.bookValuePerShare > 0 && isNum(snapshot.roeTTM)) {
    const pbLow = clamp(snapshot.roeTTM / 0.10, 0.6, 2.5);
    const pbHigh = clamp(snapshot.roeTTM / 0.07, 0.8, 3.5);
    methods.push({ method: `Book value: ${fmtX(snapshot.bookValuePerShare, 2).replace("x", "")} BVPS x ${pbLow.toFixed(1)}-${pbHigh.toFixed(1)} P/B for ${fmtPct(snapshot.roeTTM, 0)} ROE`, low: snapshot.bookValuePerShare * pbLow, high: snapshot.bookValuePerShare * pbHigh });
  }
  let fairValue = null;
  if (methods.length) {
    const low = methods.reduce((a, m) => a + m.low, 0) / methods.length;
    const high = methods.reduce((a, m) => a + m.high, 0) / methods.length;
    const mid = (low + high) / 2;
    fairValue = {
      low: round(low), high: round(high), mid: round(mid),
      upsideToMid: isNum(snapshot.price) && snapshot.price > 0 ? round(mid / snapshot.price - 1, 4) : null,
      methods: methods.map((m) => ({ ...m, low: round(m.low), high: round(m.high) })),
      read: isNum(snapshot.price) ? (snapshot.price < low ? "Price is below the fair-value range." : snapshot.price > high ? "Price is above the fair-value range." : "Price is inside the fair-value range.") : null,
    };
  }

  const label = score >= 75 ? "Attractive" : score >= 55 ? "Fair" : score >= 35 ? "Rich" : "Expensive";
  return {
    applicable: true,
    score,
    label,
    multiples,
    ownHistory: hist.map((h) => ({ year: h.year, price: round(h.price), pe: round(h.pe), ps: round(h.ps), pb: round(h.pb), pfcf: round(h.pfcf) })),
    ownHistoryAverage: isNum(avgHist) ? round(avgHist, 2) : null,
    ownHistoryRead: historyRead(avgHist),
    fairValue,
    analyst: snapshot.analyst,
    growthUsed: round(growth, 4),
  };
}
