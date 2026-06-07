// narrative.js — rule-based, plain-English research narrative built purely from
// the numbers (no LLM required). An optional LLM layer can be added later that
// consumes the same `facts` bundle; this keeps the tool free and offline-friendly.

import { pct, mult, price } from './format.js';

// trim a long business summary to the first ~2 sentences
function shortSummary(text) {
  if (!text) return null;
  const sentences = text.replace(/\s+/g, ' ').split(/(?<=[.!?])\s+/);
  return sentences.slice(0, 2).join(' ');
}

export function buildNarrative(f, scored) {
  const bull = [];
  const bear = [];
  const catalysts = [];

  // ---------- valuation read (sector-relative, derived from the scored metrics) ----------
  const valCat = scored.categories.valuation;
  if (f.fwdPE !== null && f.pe !== null && f.fwdPE < f.pe * 0.8) {
    bull.push(
      `Forward P/E (${mult(f.fwdPE)}) is well below trailing P/E (${mult(f.pe)}), implying the market expects strong earnings growth ahead.`
    );
  }
  if (f.peg !== null && f.peg > 0 && f.peg <= 1) {
    bull.push(`PEG of ${f.peg.toFixed(2)} suggests growth is cheap relative to the multiple paid for it.`);
  }
  if (valCat.score !== null && valCat.score >= 65) {
    bull.push(`Reasonably valued for its sector (valuation score ${valCat.score}/100 vs ${scored.group} peers).`);
  } else if (valCat.score !== null && valCat.score <= 35) {
    bear.push(
      `Expensive even adjusting for sector (valuation score ${valCat.score}/100) — a lot of future growth is already priced in.`
    );
  }
  if (f.fcfYield !== null && f.fcfYield >= 0.04) {
    bull.push(`Healthy FCF yield (${pct(f.fcfYield)}) — pays you back in real cash, not just accounting earnings.`);
  } else if (f.fcfYield !== null && f.fcfYield > 0 && f.fcfYield < 0.015) {
    bear.push(`Thin FCF yield (${pct(f.fcfYield)}) — little cash return at today's price (heavy capex or rich multiple).`);
  }

  // ---------- quality / health read ----------
  if (f.roic !== null && f.roic >= 0.15) {
    bull.push(
      `High ROIC (${pct(f.roic)}) — generates returns well above a typical ~8–10% cost of capital, the hallmark of a quality compounder.`
    );
    catalysts.push('Capital efficiency: ROIC comfortably above cost of capital.');
  } else if (f.roic !== null && f.roic < 0.07) {
    bear.push(`Low ROIC (${pct(f.roic)}) — may not be earning its cost of capital.`);
  }
  if (f.roe !== null && f.roe >= 0.15) {
    bull.push(`Strong return on equity (${pct(f.roe)}) — efficient use of shareholder capital.`);
  }
  if (f.grossM !== null && f.grossM >= 0.4) {
    bull.push(`High gross margin (${pct(f.grossM)}) points to pricing power / a durable moat.`);
    catalysts.push('Margin durability: high gross margin gives room to absorb cost shocks.');
  }
  if (f.netM !== null && f.netM < 0) {
    bear.push(`Currently unprofitable (net margin ${pct(f.netM)}) — watch the path to profitability.`);
  }
  if (f.fcfM !== null && f.fcfM >= 0.15) {
    bull.push(`Converts ${pct(f.fcfM)} of revenue to free cash flow — self-funding business.`);
  } else if (f.freeCashflow !== null && f.freeCashflow < 0) {
    bear.push('Negative free cash flow — relies on external capital or balance-sheet cash to operate.');
  }
  // leverage / liquidity (from the Risk pillar)
  if (f.netDebtToEbitda !== null && f.netDebtToEbitda > 3.5) {
    bear.push(`Elevated leverage (net debt ${f.netDebtToEbitda.toFixed(1)}× EBITDA) — vulnerable if rates or earnings turn.`);
  } else if (f.netDebtToEbitda !== null && f.netDebtToEbitda < 0) {
    bull.push('Net-cash balance sheet (more cash than debt) — financial flexibility and downside cushion.');
  }
  if (f.currentRatio !== null && f.currentRatio < 1 && scored.group !== 'financial') {
    bear.push(`Current ratio below 1 (${f.currentRatio.toFixed(2)}) — short-term liquidity is tight.`);
  }

  // ---------- growth read ----------
  if (f.revGrowth !== null && f.revGrowth >= 0.2) {
    bull.push(`Revenue growing ${pct(f.revGrowth)} YoY — clear top-line momentum.`);
    catalysts.push('Top-line momentum: revenue compounding above 20% YoY.');
  } else if (f.revGrowth !== null && f.revGrowth < 0) {
    bear.push(`Revenue is contracting (${pct(f.revGrowth)} YoY) — demand or pricing under pressure.`);
  }
  if (f.epsGrowthFwd !== null && f.epsGrowthFwd >= 0.2) {
    catalysts.push(`Analysts model ~${pct(f.epsGrowthFwd, 0)} EPS growth next year.`);
  }
  if (f.revCagr3 !== null && f.revCagr3 >= 0.2) {
    bull.push(`3-year revenue CAGR of ${pct(f.revCagr3)} shows the growth is sustained, not a one-off.`);
  }

  // ---------- analyst cross-check + asymmetry ----------
  let asymmetry = null;
  if (f.upside !== null && f.targetMean !== null) {
    const dir = f.upside >= 0 ? 'upside' : 'downside';
    asymmetry =
      `Analyst mean target ${price(f.targetMean, f.currency)} vs last ${price(f.price, f.currency)} ` +
      `= ${pct(Math.abs(f.upside))} ${dir}` +
      (f.targetLow !== null && f.targetHigh !== null
        ? ` (range ${price(f.targetLow, f.currency)}–${price(f.targetHigh, f.currency)}).`
        : '.');
    if (f.upside >= 0.15) {
      catalysts.push(`Street sees ${pct(f.upside)} upside to mean target.`);
    }
  }
  if (f.recKey) {
    const nice = f.recKey.replace(/_/g, ' ');
    if (['strong_buy', 'buy'].includes(f.recKey)) {
      bull.push(`Analyst consensus is "${nice}"${f.numAnalysts ? ` across ${f.numAnalysts} analysts` : ''}.`);
    } else if (['sell', 'strong_sell', 'underperform'].includes(f.recKey)) {
      bear.push(`Analyst consensus is "${nice}" — the Street is cautious.`);
    }
  }

  // ---------- business model ----------
  const bizBits = [];
  if (f.sector) bizBits.push(f.sector);
  if (f.industry && f.industry !== f.sector) bizBits.push(f.industry);
  const businessModel =
    (bizBits.length ? `${f.name} operates in ${bizBits.join(' — ')}. ` : `${f.name}. `) +
    (shortSummary(f.summary) || '');

  // ---------- verdict paragraph ----------
  const v = scored.verdict;
  const c = scored.categories;
  const verdict = buildVerdict(f, scored, c, v);

  // safety nets so a report is never empty
  if (!bull.length) bull.push('No standout fundamental strengths surfaced from the available metrics.');
  if (!bear.length) bear.push('No major fundamental red flags surfaced from the available metrics.');

  return { businessModel, bull, bear, catalysts, asymmetry, verdict };
}

function buildVerdict(f, scored, c, v) {
  const parts = [];
  parts.push(
    `Composite score ${scored.overall ?? '—'}/100 → ${v.label} ` +
      `(Valuation ${c.valuation.score ?? '—'}, Health ${c.health.score ?? '—'}, Growth ${c.growth.score ?? '—'}` +
      `${scored.risk.score !== null ? `, Risk ${scored.risk.score}` : ''}), graded against ${scored.group}-sector norms.`
  );
  if (scored.riskCapped) {
    parts.push('⚠ Headline score was capped because the balance sheet looks fragile — see the Risk panel.');
  }

  if (v.tier === 'strong' || v.tier === 'good') {
    parts.push(
      'The numbers describe a fundamentally healthy business. The main question is price discipline — define an entry, a position size, and an invalidation level before buying.'
    );
  } else if (v.tier === 'neutral') {
    parts.push(
      'A mixed picture: some categories are solid while others lag. This is a "know exactly why you own it" name, not a no-brainer. Wait for either a better price or clearer fundamental improvement.'
    );
  } else {
    parts.push(
      'The fundamentals are weak or incomplete. Treat with caution; if you are interested, it is a turnaround/speculative thesis, not a quality-at-a-fair-price one.'
    );
  }

  if (f.upside !== null) {
    parts.push(
      f.upside >= 0
        ? `Street pegs ~${pct(f.upside)} upside to mean target — a sanity check, not a guarantee.`
        : `Note the stock trades ${pct(Math.abs(f.upside))} ABOVE the mean analyst target — limited margin of safety.`
    );
  }
  return parts.join(' ');
}
