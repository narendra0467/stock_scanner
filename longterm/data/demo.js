// Demo data provider: synthetic prices + fundamentals so the CLIs can be tried without network access.
// Enabled with --demo. Symbols containing "DOWN" get a downtrend, "FLAT" a base, everything else an uptrend.
import { uptrendWeekly, downtrendWeekly, flatWeekly, dailyFromWeekly, strongCompanyYears, bankYears, quoteFixture } from "../tests/fixtures/synth.js";

function weeklyFor(symbol) {
  if (/DOWN/.test(symbol)) return downtrendWeekly();
  if (/FLAT/.test(symbol)) return flatWeekly();
  return uptrendWeekly(symbol.split("").reduce((a, c) => a + c.charCodeAt(0), 3));
}

export const demoDeps = {
  fetchBars: async (symbol, range, interval) => {
    const weekly = /^(SPY|XIU\.TO)$/.test(symbol) ? flatWeekly() : weeklyFor(symbol);
    return { bars: interval === "1d" ? dailyFromWeekly(weekly) : weekly, currency: "USD", exchange: "DEMO" };
  },
  fetchQuote: async (symbol) => {
    const weekly = weeklyFor(symbol);
    const price = weekly.at(-1).close;
    const bank = /BANK|SOFI/.test(symbol);
    const quote = quoteFixture({ price, high52: Math.max(...weekly.slice(-52).map((b) => b.high)), low52: Math.min(...weekly.slice(-52).map((b) => b.low)), sector: bank ? "Financial Services" : "Technology", industry: bank ? "Credit Services" : "Software - Application", roe: bank ? 0.07 : 0.22 });
    quote.price.symbol = symbol;
    quote.price.longName = `${symbol} Demo Corp`;
    return quote;
  },
  fetchSecAnnuals: async (symbol) => ({ facts: { cik: "0000000000" }, years: /BANK|SOFI/.test(symbol) ? bankYears() : strongCompanyYears() }),
  fetchYahooAnnuals: async () => [],
};
