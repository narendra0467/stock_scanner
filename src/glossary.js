// glossary.js — 101-level, plain-English explanations for a complete beginner.
// Keyed to match the metric keys used in scoring.js, plus category + concept keys.
// Each entry: { short: a one-line "what it is", body: friendly explanation + rule of thumb }.

export const GLOSSARY = {
  // ---------- the big picture ----------
  overall: {
    short: 'The headline 0–100 grade for the company.',
    body: 'It blends three things — is the price fair (Valuation 35%), is it a good business (Health 35%), and is it growing (Growth 30%) — then adjusts for balance-sheet Risk. Higher = fundamentally stronger and more reasonably priced. It is NOT a prediction of the share price.',
  },
  valuation: {
    short: 'Are you paying a fair price?',
    body: 'These ratios compare the share price to the company’s earnings, sales, cash flow and assets. A cheaper-looking stock scores higher. We compare each company against others in its OWN sector, because what counts as "normal" is very different for a bank vs a software firm.',
  },
  health: {
    short: 'Is this actually a good, profitable business?',
    body: 'Margins show how much of each sales dollar becomes profit. ROIC/ROE show how well management turns money into more money. Higher = a stronger, more efficient company that keeps more of what it earns.',
  },
  growth: {
    short: 'Is the company getting bigger?',
    body: 'How fast sales and profits are growing — recently, over a few years, and what analysts expect next year. Faster growth can justify paying a higher price today.',
  },
  risk: {
    short: 'Can it survive a bad year?',
    body: 'Looks at how much debt the company carries and whether it has enough cash for the short term. A safe balance sheet scores high; a fragile, heavily-indebted one scores low — and can drag the headline score down.',
  },
  beatmiss: {
    short: 'What BEAT / OK / MISS means.',
    body: 'BEAT = better than a healthy benchmark for its sector. OK = close. MISS = falls short. The colored bar shows how close the number is to "ideal" — fuller and greener is better.',
  },
  sector: {
    short: 'Why "sector-relative"?',
    body: 'A bank, a software company and an oil producer have totally different "normal" numbers. We grade each company against its own sector’s norms, so a tech firm isn’t punished for not looking like a bank.',
  },

  // ---------- valuation metrics ----------
  pe: {
    short: 'Price ÷ last year’s profit per share.',
    body: '"How many years of today’s profit am I paying for one share?" A P/E of 20 means $20 of price for every $1 of yearly profit. Lower can mean cheaper; very high can mean expensive (or fast-growing); very low can mean a bargain (or a troubled company).',
  },
  fwdPE: {
    short: 'P/E using NEXT year’s expected profit.',
    body: 'Same idea as P/E, but based on analysts’ forecast for the year ahead. Useful when profits are expected to change a lot. A forward P/E well below the trailing P/E hints that earnings are expected to grow.',
  },
  peg: {
    short: 'P/E adjusted for how fast the company grows.',
    body: 'It puts the price in the context of growth — a high P/E can be fair if growth is high. Rule of thumb: around 1 is reasonable; well under 1 is "cheap for the growth"; well above 2 is getting pricey.',
  },
  pb: {
    short: 'Price ÷ the company’s net assets on paper (book value).',
    body: 'Most useful for banks and asset-heavy businesses. Less meaningful for asset-light tech companies, which can trade at a high P/B and still be perfectly healthy — that’s why we weight it lightly for them.',
  },
  ps: {
    short: 'Price ÷ yearly sales.',
    body: 'Handy when a company has little or no profit yet (e.g. young growth firms). Lower = you’re paying less per dollar of sales. "Normal" varies hugely by industry, so judge it against peers.',
  },
  evEbitda: {
    short: 'Debt-aware "takeover price" vs core operating profit.',
    body: 'Enterprise Value (market value + debt − cash) divided by EBITDA. It lets you compare companies that carry different amounts of debt on a fair footing. Lower = cheaper.',
  },
  fcfYield: {
    short: 'The real cash the business throws off, as a % of its price.',
    body: 'Free cash flow ÷ market value — a bit like the interest rate you earn just for owning it. Higher = more cash return for your money. A few percent is healthy; very low can mean heavy spending or an expensive stock.',
  },

  // ---------- health / quality ----------
  roic: {
    short: 'Profit earned per dollar invested in the business.',
    body: 'Return On Invested Capital — the single best quality test. If ROIC is above the ~8–10% it costs to fund the business, it’s creating value with every dollar. Above ~15% is excellent and a sign of a high-quality "compounder".',
  },
  roe: {
    short: 'Profit as a % of shareholders’ money.',
    body: 'Return on Equity — higher means management is more efficient with owners’ capital. One caution: lots of borrowed money can artificially inflate it, so read it alongside debt.',
  },
  roa: {
    short: 'Profit as a % of everything the company owns.',
    body: 'Return on Assets — shows how well the company squeezes profit out of its total assets. Useful for comparing how productively different firms use what they have.',
  },
  grossM: {
    short: 'Sales minus the direct cost of the product, as a % of sales.',
    body: 'Gross margin. A high gross margin often signals pricing power — a strong brand, patent, or "moat" that lets the company charge more than it costs to make.',
  },
  opM: {
    short: 'Profit from core operations, as a % of sales.',
    body: 'Operating margin — what’s left after the day-to-day running costs (but before interest and tax). Shows how profitable the actual business is.',
  },
  netM: {
    short: 'The bottom line: final profit as a % of sales.',
    body: 'Net margin — what’s left of each sales dollar after absolutely everything, including interest and tax. Higher = more of every sale ends up as profit.',
  },
  fcfM: {
    short: 'Spendable cash generated, as a % of sales.',
    body: 'FCF margin — how much of each sales dollar becomes actual free cash (after running and investing in the business). Cash is harder to fake than accounting profit, so this is a quality signal.',
  },

  // ---------- growth ----------
  revGrowth: {
    short: 'How fast sales grew vs a year ago.',
    body: 'The "top line." Growing sales is the foundation of everything — a company usually can’t grow profits for long without growing sales.',
  },
  epsGrowth: {
    short: 'How fast profit-per-share grew vs a year ago.',
    body: 'Earnings per share growth. Profit growth per share is ultimately what drives a stock higher over time.',
  },
  epsGrowthFwd: {
    short: 'Analysts’ estimate for next year’s profit growth.',
    body: 'Forward-looking, so treat it as an expectation, not a fact — estimates change. Still useful for sensing the direction the market expects.',
  },
  revCagr3: {
    short: 'Average yearly sales growth over ~3 years.',
    body: 'Smooths out one-off spikes or dips so you can see whether growth is sustained and consistent, rather than a single lucky year.',
  },

  // ---------- risk / balance sheet ----------
  netDebtToEbitda: {
    short: 'Roughly: years of operating profit needed to pay off debt.',
    body: 'Net debt (debt minus cash) ÷ EBITDA. Under ~1–2x is comfortable; over ~4x is heavy and risky if business slows. Negative means the company has more cash than debt — a "net cash" balance sheet, which is a strength.',
  },
  debtToEquity: {
    short: 'How much borrowed money vs owners’ money funds the business.',
    body: 'Higher = more leverage = more risk if things go wrong (debt still has to be repaid in bad times). Note: banks normally run high here, which is why we judge them on a different scale.',
  },
  currentRatio: {
    short: 'Short-term assets vs short-term bills.',
    body: 'Above 1 means the company can cover the next year’s obligations from short-term assets; below 1 means liquidity is tight and it may need to borrow or raise cash.',
  },
  freeCashflow: {
    short: 'Cash left after running and investing in the business.',
    body: 'Positive = the company funds itself and can pay debt, dividends or buybacks. Negative = it’s burning cash and must raise money or dip into reserves — fine for a young grower, riskier for a mature firm.',
  },

  // ---------- snapshot / other terms ----------
  marketCap: {
    short: 'The company’s total stock-market value.',
    body: 'Share price × number of shares. This is the "size" of the company — e.g. mega-cap (>$200B), large, mid, small, micro.',
  },
  beta: {
    short: 'How jumpy the stock is vs the overall market.',
    body: '1.0 = moves roughly with the market. Above 1 = swings more (more volatile); below 1 = calmer than the market.',
  },
  divYield: {
    short: 'Annual dividend as a % of the price.',
    body: 'The cash you’re paid just for holding the stock, before any price change. Not all companies pay one — many growth firms reinvest instead.',
  },
  ebitda: {
    short: 'A rough proxy for core operating cash profit.',
    body: 'Earnings Before Interest, Taxes, Depreciation & Amortization. It strips out financing and accounting differences so you can compare the raw earning power of different companies.',
  },
  analystRating: {
    short: 'The average buy / hold / sell view of professional analysts.',
    body: 'A crowd cross-check on sentiment. We show it for context but it is NOT part of the score — analysts are often late and can be wrong together.',
  },
  priceTarget: {
    short: 'Analysts’ average estimate of fair value in ~12 months.',
    body: 'We show the gap to today’s price as "upside." Treat it as an opinion, not a promise — the range between the most and least optimistic analyst is often very wide.',
  },
  upside: {
    short: 'How far today’s price sits below analysts’ average target.',
    body: 'Positive = they think there’s room to rise; negative = the stock already trades above what they think it’s worth (less margin of safety).',
  },

  // ---------- concepts (used in the narrative) ----------
  moat: {
    short: 'A durable competitive advantage.',
    body: 'Something that protects a company’s profits from competitors for years — a strong brand, network effects, huge scale, patents, or high switching costs. A "wide moat" means profits are hard for rivals to erode.',
  },
  costOfCapital: {
    short: 'The return investors require to fund a business (~8–10%).',
    body: 'Think of it as the hurdle rate. A company only truly creates value when its ROIC clears this hurdle — earning more than it costs to raise the money.',
  },
  marginOfSafety: {
    short: 'Buying enough below fair value to be wrong and still OK.',
    body: 'The core idea of careful investing: leave room for error, because your estimate of "fair value" is never exact and the future is uncertain.',
  },
  asymmetry: {
    short: 'When the potential reward is much bigger than the risk.',
    body: 'An "asymmetric" setup is one where you could make a lot if right but lose comparatively little if wrong — the kind of risk/reward investors hunt for.',
  },
};

// groups used to render the full glossary section at the bottom of the report
export const GLOSSARY_GROUPS = [
  { title: 'The big picture', keys: ['overall', 'valuation', 'health', 'growth', 'risk', 'beatmiss', 'sector'] },
  { title: 'Valuation — am I paying a fair price?', keys: ['pe', 'fwdPE', 'peg', 'pb', 'ps', 'evEbitda', 'fcfYield'] },
  { title: 'Health & quality — is it a good business?', keys: ['roic', 'roe', 'roa', 'grossM', 'opM', 'netM', 'fcfM'] },
  { title: 'Growth — is it getting bigger?', keys: ['revGrowth', 'epsGrowth', 'epsGrowthFwd', 'revCagr3'] },
  { title: 'Risk — can it survive a downturn?', keys: ['netDebtToEbitda', 'debtToEquity', 'currentRatio', 'freeCashflow'] },
  { title: 'Other terms on the page', keys: ['marketCap', 'beta', 'divYield', 'ebitda', 'analystRating', 'priceTarget', 'upside'] },
  { title: 'Useful investing concepts', keys: ['moat', 'costOfCapital', 'marginOfSafety', 'asymmetry'] },
];
