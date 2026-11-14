// Deterministic synthetic data for offline tests.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function addDays(date, days) {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// drift = expected return per bar, vol = per-bar volatility. phases lets you chain regimes.
export function generateBars({ start = "2021-10-15", bars = 260, stepDays = 7, price = 100, phases = [{ bars, drift: 0.002, vol: 0.03 }], seed = 7, baseVolume = 1e6 }) {
  const rand = mulberry32(seed);
  const out = [];
  let close = price;
  let date = start;
  for (const phase of phases) {
    for (let i = 0; i < phase.bars; i += 1) {
      const shock = (rand() - 0.5) * 2 * phase.vol;
      const open = close;
      close = Math.max(1, open * (1 + phase.drift + shock));
      const high = Math.max(open, close) * (1 + rand() * phase.vol * 0.5);
      const low = Math.min(open, close) * (1 - rand() * phase.vol * 0.5);
      const volume = Math.round(baseVolume * (0.6 + rand() * 0.8) * (close < open ? (phase.downVolMult ?? 1) : 1));
      out.push({ date, open: +open.toFixed(2), high: +high.toFixed(2), low: +low.toFixed(2), close: +close.toFixed(2), adjClose: +close.toFixed(2), volume });
      date = addDays(date, stepDays);
    }
  }
  return out;
}

export function uptrendWeekly(seed = 3) {
  return generateBars({ seed, phases: [{ bars: 80, drift: 0.001, vol: 0.03 }, { bars: 120, drift: 0.006, vol: 0.03 }, { bars: 60, drift: 0.004, vol: 0.025 }] });
}

export function downtrendWeekly(seed = 5) {
  return generateBars({ seed, price: 60, phases: [{ bars: 120, drift: 0.006, vol: 0.03 }, { bars: 80, drift: -0.004, vol: 0.035 }, { bars: 60, drift: -0.008, vol: 0.04, downVolMult: 1.6 }] });
}

export function flatWeekly(seed = 9) {
  return generateBars({ seed, phases: [{ bars: 260, drift: 0.0003, vol: 0.02 }] });
}

export function dailyFromWeekly(weekly, seed = 11) {
  // 2 years of daily bars approximated from the last ~104 weeks with 5 bars each.
  const rand = mulberry32(seed);
  const out = [];
  const recent = weekly.slice(-104);
  for (const w of recent) {
    for (let d = 0; d < 5; d += 1) {
      const frac = (d + 1) / 5;
      const close = w.open + (w.close - w.open) * frac + (rand() - 0.5) * (w.high - w.low) * 0.3;
      out.push({ date: addDays(w.date, d - 4), open: close * 0.995, high: close * 1.01, low: close * 0.99, close: +close.toFixed(2), adjClose: +close.toFixed(2), volume: Math.round(w.volume / 5) });
    }
  }
  return out;
}

export function strongCompanyYears() {
  const years = [];
  let revenue = 2.0e9;
  let shares = 500e6;
  for (let i = 0; i < 7; i += 1) {
    const fy = `${2019 + i}-12-31`;
    revenue *= 1.22;
    shares *= 0.995;
    const grossProfit = revenue * 0.68;
    const operatingIncome = revenue * (0.18 + i * 0.01);
    const netIncome = operatingIncome * 0.8;
    const operatingCashFlow = netIncome * 1.2;
    const capex = -(revenue * 0.05);
    years.push({ fiscalYearEnd: fy, source: "sec", revenue, grossProfit, operatingIncome, netIncome, eps: netIncome / shares, operatingCashFlow, capex, freeCashFlow: operatingCashFlow + capex, cash: 3e9 + i * 5e8, totalDebt: 1e9, equity: 5e9 + i * 1.2e9, totalAssets: 9e9 + i * 1.5e9, dilutedShares: shares, interestExpense: 4e7, buybacks: 4e8, dividendsPaid: 2e8 });
  }
  return years;
}

export function weakCompanyYears() {
  const years = [];
  let revenue = 1.5e9;
  let shares = 200e6;
  for (let i = 0; i < 6; i += 1) {
    const fy = `${2020 + i}-12-31`;
    revenue *= i >= 4 ? 0.93 : 1.02;
    shares *= 1.09;
    const netIncome = -revenue * 0.08;
    const operatingCashFlow = -revenue * 0.03;
    const capex = -(revenue * 0.06);
    years.push({ fiscalYearEnd: fy, source: "yahoo", revenue, grossProfit: revenue * 0.22, operatingIncome: -revenue * 0.07, netIncome, eps: netIncome / shares, operatingCashFlow, capex, freeCashFlow: operatingCashFlow + capex, cash: 4e8 - i * 5e7, totalDebt: 1.5e9 + i * 3e8, equity: 1e9 - i * 1.5e8, totalAssets: 4e9, dilutedShares: shares, interestExpense: 1.2e8 });
  }
  return years;
}

export function bankYears() {
  const years = [];
  let revenue = 1.0e9;
  let shares = 900e6;
  for (let i = 0; i < 5; i += 1) {
    const fy = `${2021 + i}-12-31`;
    revenue *= 1.35;
    shares *= 1.04;
    const netIncome = i < 2 ? -3e8 : revenue * 0.14;
    years.push({ fiscalYearEnd: fy, source: "sec", revenue, netIncome, eps: netIncome / shares, operatingCashFlow: netIncome * 0.5, cash: 3e9, totalDebt: 3.4e9, equity: 5e9 + i * 1e9, totalAssets: 25e9 + i * 8e9, dilutedShares: shares });
  }
  return years;
}

export function quoteFixture(overrides = {}) {
  const raw = (v) => (v === null || v === undefined ? undefined : { raw: v, fmt: String(v) });
  return {
    price: { symbol: "TEST", longName: "Test Corp", exchangeName: "NasdaqGS", currency: "USD", quoteType: "EQUITY", regularMarketPrice: raw(overrides.price ?? 100), marketCap: raw(overrides.marketCap ?? 50e9) },
    summaryDetail: { fiftyTwoWeekHigh: raw(overrides.high52 ?? 120), fiftyTwoWeekLow: raw(overrides.low52 ?? 70), trailingPE: raw(overrides.trailingPE ?? 28), dividendYield: raw(0.005), beta: raw(1.2) },
    financialData: {
      currentPrice: raw(overrides.price ?? 100), totalRevenue: raw(overrides.revenueTTM ?? 9e9), freeCashflow: raw(overrides.fcfTTM ?? 1.8e9), operatingCashflow: raw(2.2e9), ebitda: raw(2.5e9),
      grossMargins: raw(0.68), operatingMargins: raw(0.24), profitMargins: raw(0.19), returnOnEquity: raw(overrides.roe ?? 0.22), returnOnAssets: raw(0.09),
      revenueGrowth: raw(overrides.revenueGrowth ?? 0.21), earningsGrowth: raw(0.3), totalCash: raw(6e9), totalDebt: raw(1e9), currentRatio: raw(2.1), debtToEquity: raw(15),
      numberOfAnalystOpinions: raw(30), targetMeanPrice: raw(130), recommendationKey: "buy",
    },
    defaultKeyStatistics: { forwardPE: raw(overrides.forwardPE ?? 22), pegRatio: raw(overrides.peg ?? 1.1), priceToBook: raw(overrides.pb ?? 4.5), priceToSalesTrailing12Months: raw(overrides.ps ?? 5.5), enterpriseValue: raw(46e9), enterpriseToEbitda: raw(18), sharesOutstanding: raw(500e6), bookValue: raw(22), trailingEps: raw(3.6), forwardEps: raw(4.5) },
    assetProfile: { sector: overrides.sector ?? "Technology", industry: overrides.industry ?? "Software - Application", longBusinessSummary: overrides.description ?? "Test Corp sells subscription software to enterprises. It makes money from recurring licences.", country: "United States", fullTimeEmployees: raw(12000) },
    earningsTrend: { trend: [{ period: "0y", earningsEstimate: { avg: raw(4.2), growth: raw(0.25) }, revenueEstimate: { growth: raw(0.2) } }, { period: "+1y", earningsEstimate: { avg: raw(5.1), growth: raw(0.21) }, revenueEstimate: { growth: raw(0.18) } }] },
    earningsHistory: { history: [{ epsActual: raw(1.0), epsEstimate: raw(0.9) }, { epsActual: raw(1.1), epsEstimate: raw(1.0) }, { epsActual: raw(0.9), epsEstimate: raw(1.0) }, { epsActual: raw(1.2), epsEstimate: raw(1.1) }] },
    calendarEvents: { earnings: { earningsDate: [{ fmt: overrides.nextEarnings ?? "2026-11-05" }] } },
    recommendationTrend: { trend: [{ strongBuy: 10, buy: 12, hold: 6, sell: 2, strongSell: 0 }] },
  };
}

// A small SEC companyfacts-shaped fixture: two fiscal years + a restatement + quarterly noise.
export function secFactsFixture() {
  const usd = (val, start, end, form, filed, fy, fp = "FY") => ({ val, start, end, form, filed, fy, fp, accn: `${filed}-x` });
  return {
    cik: 1234,
    entityName: "Fixture Inc",
    facts: {
      "us-gaap": {
        Revenues: { units: { USD: [
          usd(1000, "2023-01-01", "2023-12-31", "10-K", "2024-02-20", 2023),
          usd(1300, "2024-01-01", "2024-12-31", "10-K", "2025-02-18", 2024),
          usd(1010, "2023-01-01", "2023-12-31", "10-K", "2025-02-18", 2024), // restated prior year, later filing wins
          usd(300, "2024-01-01", "2024-03-31", "10-Q", "2024-05-01", 2024, "Q1"), // quarterly, ignored
          usd(1700, "2025-01-01", "2025-12-31", "10-K", "2026-02-19", 2025),
        ] } },
        NetIncomeLoss: { units: { USD: [
          usd(100, "2023-01-01", "2023-12-31", "10-K", "2024-02-20", 2023),
          usd(160, "2024-01-01", "2024-12-31", "10-K", "2025-02-18", 2024),
          usd(240, "2025-01-01", "2025-12-31", "10-K", "2026-02-19", 2025),
        ] } },
        NetCashProvidedByUsedInOperatingActivities: { units: { USD: [
          usd(150, "2024-01-01", "2024-12-31", "10-K", "2025-02-18", 2024),
          usd(300, "2025-01-01", "2025-12-31", "10-K", "2026-02-19", 2025),
        ] } },
        PaymentsToAcquirePropertyPlantAndEquipment: { units: { USD: [
          usd(40, "2024-01-01", "2024-12-31", "10-K", "2025-02-18", 2024),
          usd(50, "2025-01-01", "2025-12-31", "10-K", "2026-02-19", 2025),
        ] } },
        CashAndCashEquivalentsAtCarryingValue: { units: { USD: [
          { val: 500, end: "2024-12-31", form: "10-K", filed: "2025-02-18", fy: 2024, fp: "FY" },
          { val: 520, end: "2025-03-31", form: "10-Q", filed: "2025-05-01", fy: 2025, fp: "Q1" },
          { val: 700, end: "2025-12-31", form: "10-K", filed: "2026-02-19", fy: 2025, fp: "FY" },
        ] } },
        LongTermDebtNoncurrent: { units: { USD: [
          { val: 200, end: "2025-12-31", form: "10-K", filed: "2026-02-19", fy: 2025, fp: "FY" },
        ] } },
        StockholdersEquity: { units: { USD: [
          { val: 2000, end: "2024-12-31", form: "10-K", filed: "2025-02-18", fy: 2024, fp: "FY" },
          { val: 2300, end: "2025-12-31", form: "10-K", filed: "2026-02-19", fy: 2025, fp: "FY" },
        ] } },
        WeightedAverageNumberOfDilutedSharesOutstanding: { units: { shares: [
          usd(100, "2024-01-01", "2024-12-31", "10-K", "2025-02-18", 2024),
          usd(98, "2025-01-01", "2025-12-31", "10-K", "2026-02-19", 2025),
        ] } },
        EarningsPerShareDiluted: { units: { "USD/shares": [
          usd(1.6, "2024-01-01", "2024-12-31", "10-K", "2025-02-18", 2024),
          usd(2.45, "2025-01-01", "2025-12-31", "10-K", "2026-02-19", 2025),
        ] } },
      },
    },
  };
}
