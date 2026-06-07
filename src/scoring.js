// scoring.js (v2 "pro" engine)
// Upgrades over a naive screener:
//   • SECTOR-RELATIVE valuation thresholds (a software compounder is judged
//     against software multiples, a bank against bank multiples).
//   • WEIGHTED metrics inside each category (PEG/EV-EBITDA/FCF-yield matter
//     more than P/B for an asset-light business, etc.).
//   • GRADED (continuous) scoring instead of binary BEAT/MISS.
//   • A 4th RISK pillar (leverage / liquidity) shown alongside the score.
//   • ROIC and FCF-yield as first-class quality/value metrics.
//
// Still generic and rule-based — see README for what a true institutional
// process adds on top (reverse-DCF, estimate revisions, forensic accounting).

// ---------- sector grouping ----------
function sectorGroup(sector) {
  const s = (sector || '').toLowerCase();
  if (s.includes('financial')) return 'financial';
  if (s.includes('real estate')) return 'realestate';
  if (s.includes('utilit')) return 'defensive';
  if (s.includes('energy') || s.includes('basic material')) return 'cyclical';
  if (s.includes('technology') || s.includes('communication') || s.includes('health'))
    return 'growth';
  if (s.includes('consumer defensive')) return 'defensive';
  if (s.includes('industrial') || s.includes('consumer cyclical')) return 'core';
  return 'core';
}

// ---------- per-group valuation thresholds (ceilings; null = not applicable) ----------
// hi = the multiple at/under which a name earns full credit for that sector.
const VAL = {
  growth:     { pe: 45, fwdPE: 35, peg: 1.8, pb: 15, ps: 12, evEbitda: 28, fcfYield: 0.025 },
  core:       { pe: 30, fwdPE: 24, peg: 1.5, pb: 6,  ps: 4,  evEbitda: 16, fcfYield: 0.04 },
  defensive:  { pe: 28, fwdPE: 24, peg: 2.0, pb: 6,  ps: 3,  evEbitda: 14, fcfYield: 0.04 },
  cyclical:   { pe: 18, fwdPE: 14, peg: 1.3, pb: 3,  ps: 3,  evEbitda: 8,  fcfYield: 0.06 },
  financial:  { pe: 18, fwdPE: 16, peg: 1.5, pb: 2.0, ps: 5, evEbitda: null, fcfYield: null },
  realestate: { pe: 40, fwdPE: 35, peg: 2.5, pb: 3,  ps: 10, evEbitda: 22, fcfYield: null },
};

// valuation metric weights per group (only keys with a threshold are used)
const VAL_W = {
  growth:     { peg: 0.22, fwdPE: 0.20, evEbitda: 0.18, fcfYield: 0.15, ps: 0.12, pe: 0.08, pb: 0.05 },
  core:       { peg: 0.20, fwdPE: 0.20, evEbitda: 0.20, fcfYield: 0.15, pe: 0.12, ps: 0.08, pb: 0.05 },
  defensive:  { peg: 0.18, fwdPE: 0.20, evEbitda: 0.20, fcfYield: 0.17, pe: 0.13, ps: 0.07, pb: 0.05 },
  cyclical:   { evEbitda: 0.25, fcfYield: 0.20, pe: 0.18, peg: 0.15, ps: 0.12, pb: 0.10 },
  financial:  { pb: 0.35, pe: 0.30, ps: 0.20, peg: 0.15 },
  realestate: { pb: 0.30, pe: 0.25, ps: 0.20, evEbitda: 0.15, peg: 0.10 },
};

const VAL_META = {
  pe:       { label: 'P/E (trailing)', kind: 'lowerBetter', fmt: 'mult' },
  fwdPE:    { label: 'P/E (forward)',  kind: 'lowerBetter', fmt: 'mult' },
  peg:      { label: 'PEG ratio',      kind: 'lowerBetter', fmt: 'mult2' },
  pb:       { label: 'Price / Book',   kind: 'lowerBetter', fmt: 'mult' },
  ps:       { label: 'Price / Sales',  kind: 'lowerBetter', fmt: 'mult' },
  evEbitda: { label: 'EV / EBITDA',    kind: 'lowerBetter', fmt: 'mult' },
  fcfYield: { label: 'FCF yield',      kind: 'higherBetter', fmt: 'pct' },
};

// ---------- health / quality (mostly universal; financials drop a few) ----------
const HEALTH = [
  { key: 'roic',   label: 'ROIC',             kind: 'higherBetter', lo: 0.12, fmt: 'pct', w: 0.25, skip: ['financial'] },
  { key: 'roe',    label: 'Return on equity', kind: 'higherBetter', lo: 0.15, fmt: 'pct', w: 0.20 },
  { key: 'netM',   label: 'Net margin',       kind: 'higherBetter', lo: 0.10, fmt: 'pct', w: 0.15 },
  { key: 'opM',    label: 'Operating margin', kind: 'higherBetter', lo: 0.12, fmt: 'pct', w: 0.13 },
  { key: 'grossM', label: 'Gross margin',     kind: 'higherBetter', lo: 0.30, fmt: 'pct', w: 0.10, skip: ['financial'] },
  { key: 'roa',    label: 'Return on assets', kind: 'higherBetter', lo: 0.06, fmt: 'pct', w: 0.10 },
  { key: 'fcfM',   label: 'FCF margin',       kind: 'higherBetter', lo: 0.10, fmt: 'pct', w: 0.07, skip: ['financial'] },
];

// ---------- growth ----------
const GROWTH = [
  { key: 'revGrowth',   label: 'Revenue growth (YoY)', kind: 'higherBetter', lo: 0.15, fmt: 'pct', w: 0.30 },
  { key: 'epsGrowth',   label: 'Earnings growth (YoY)', kind: 'higherBetter', lo: 0.15, fmt: 'pct', w: 0.25 },
  { key: 'epsGrowthFwd', label: 'Fwd EPS growth (est.)', kind: 'higherBetter', lo: 0.12, fmt: 'pct', w: 0.20 },
  { key: 'revCagr3',    label: 'Revenue CAGR (3y)',    kind: 'higherBetter', lo: 0.12, fmt: 'pct', w: 0.25 },
];

const WEIGHTS = { valuation: 0.35, health: 0.35, growth: 0.30 };

// ---------- graded scorer: returns 0..1 ----------
function grade(value, kind, bound) {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  if (kind === 'lowerBetter') {
    if (value <= 0) return 0; // negative ratio = no earnings, not "cheap"
    if (value <= bound) return 1;
    const cap = bound * 2;
    return value >= cap ? 0 : 1 - (value - bound) / (cap - bound);
  }
  // higherBetter, bound = target for full credit
  if (value >= bound) return 1;
  const floor = bound * 0.4;
  if (value <= floor) return 0;
  return (value - floor) / (bound - floor);
}

function statusFor(s) {
  if (s === null) return 'N/A';
  if (s >= 0.8) return 'BEAT';
  if (s >= 0.4) return 'OK';
  return 'MISS';
}

function buildMetric({ key, label, kind, fmt, bound, weight, value }) {
  const s = grade(value, kind, bound);
  return {
    key,
    label,
    kind,
    fmt,
    value,
    bound, // the sector-adjusted threshold (for the visual bullet bar)
    weight,
    score: s,
    status: statusFor(s),
    idealText: idealText(kind, bound, fmt),
  };
}

function idealText(kind, bound, fmt) {
  const b = fmt === 'pct' ? `${Math.round(bound * 100)}%` : fmt === 'mult2' ? `${bound}` : `${bound}x`;
  return kind === 'lowerBetter' ? `≤ ${b}` : `≥ ${b}`;
}

function aggregate(metrics) {
  const ev = metrics.filter((m) => m.score !== null);
  if (!ev.length) return { score: null, beats: 0, total: metrics.length, evaluated: 0 };
  const wsum = ev.reduce((a, m) => a + m.weight, 0);
  const acc = ev.reduce((a, m) => a + m.weight * m.score, 0);
  return {
    score: Math.round((acc / wsum) * 100),
    beats: metrics.filter((m) => m.status === 'BEAT').length,
    total: metrics.length,
    evaluated: ev.length,
  };
}

// ---------- valuation category (sector-aware) ----------
function scoreValuation(f, group) {
  const thr = VAL[group] || VAL.core;
  const w = VAL_W[group] || VAL_W.core;
  const metrics = Object.keys(w)
    .filter((k) => thr[k] !== null && thr[k] !== undefined)
    .map((k) => {
      const meta = VAL_META[k];
      return buildMetric({
        key: k,
        label: meta.label,
        kind: meta.kind,
        fmt: meta.fmt,
        bound: thr[k],
        weight: w[k],
        value: f[k],
      });
    });
  return { metrics, ...aggregate(metrics) };
}

function scoreList(specs, f, group) {
  const metrics = specs
    .filter((sp) => !(sp.skip && sp.skip.includes(group)))
    .map((sp) =>
      buildMetric({
        key: sp.key,
        label: sp.label,
        kind: sp.kind,
        fmt: sp.fmt,
        bound: sp.lo,
        weight: sp.w,
        value: f[sp.key],
      })
    );
  return { metrics, ...aggregate(metrics) };
}

// ---------- risk pillar (balance sheet / liquidity) ----------
function scoreRisk(f, group) {
  const flags = [];
  const parts = []; // {label, value, score 0..1, good, bad}
  const isFin = group === 'financial';

  // net debt / EBITDA: lower is safer
  if (f.netDebtToEbitda !== null && !isFin) {
    const v = f.netDebtToEbitda;
    const s = v <= 1 ? 1 : v >= 4 ? 0 : 1 - (v - 1) / 3;
    parts.push({ key: 'netDebtToEbitda', label: 'Net debt / EBITDA', value: `${v.toFixed(1)}x`, score: s });
    if (v > 3.5) flags.push(`Elevated leverage (net debt ${v.toFixed(1)}× EBITDA).`);
  }
  // debt / equity (%)
  if (f.debtToEquity !== null) {
    const v = f.debtToEquity;
    const hi = isFin ? 400 : 150; // banks run structurally higher
    const s = v <= hi * 0.33 ? 1 : v >= hi ? 0 : 1 - (v - hi * 0.33) / (hi - hi * 0.33);
    parts.push({ key: 'debtToEquity', label: 'Debt / equity', value: `${v.toFixed(0)}%`, score: s });
    if (v > hi) flags.push(`High debt/equity (${v.toFixed(0)}%).`);
  }
  // current ratio: liquidity (skip for banks)
  if (f.currentRatio !== null && !isFin) {
    const v = f.currentRatio;
    const s = v >= 1.5 ? 1 : v <= 0.8 ? 0 : (v - 0.8) / 0.7;
    parts.push({ key: 'currentRatio', label: 'Current ratio', value: v.toFixed(2), score: s });
    if (v < 1) flags.push(`Tight liquidity (current ratio ${v.toFixed(2)}).`);
  }
  // free cash flow sign
  if (f.freeCashflow !== null) {
    const s = f.freeCashflow > 0 ? 1 : 0;
    parts.push({ key: 'freeCashflow', label: 'Free cash flow', value: f.freeCashflow > 0 ? 'positive' : 'negative', score: s });
    if (f.freeCashflow < 0) flags.push('Negative free cash flow.');
  }

  const ev = parts.filter((p) => p.score !== null);
  const score = ev.length ? Math.round((ev.reduce((a, p) => a + p.score, 0) / ev.length) * 100) : null;
  return { parts, flags, score };
}

function verdictFromScore(score) {
  if (score === null) return { label: 'INSUFFICIENT DATA', tier: 'na' };
  if (score >= 78) return { label: 'STRONG', tier: 'strong' };
  if (score >= 62) return { label: 'GOOD', tier: 'good' };
  if (score >= 48) return { label: 'NEUTRAL', tier: 'neutral' };
  if (score >= 34) return { label: 'WEAK', tier: 'weak' };
  return { label: 'POOR', tier: 'poor' };
}

export function scoreStock(f) {
  const group = sectorGroup(f.sector);
  const categories = {
    valuation: scoreValuation(f, group),
    health: scoreList(HEALTH, f, group),
    growth: scoreList(GROWTH, f, group),
  };
  const risk = scoreRisk(f, group);

  let wSum = 0;
  let acc = 0;
  for (const k of Object.keys(WEIGHTS)) {
    if (categories[k].score !== null) {
      acc += categories[k].score * WEIGHTS[k];
      wSum += WEIGHTS[k];
    }
  }
  let overall = wSum > 0 ? Math.round(acc / wSum) : null;

  // coverage guard: a confident score needs enough real metrics. If Yahoo
  // returned almost nothing (thin micro-cap, brand-new listing), don't pretend.
  const coverage =
    categories.valuation.evaluated + categories.health.evaluated + categories.growth.evaluated;
  if (coverage < 5) overall = null;

  // risk overlay: a fragile balance sheet caps the headline (quality gate)
  let riskCapped = false;
  if (overall !== null && risk.score !== null && risk.score < 35) {
    const capped = Math.round(overall * 0.85);
    if (capped < overall) {
      overall = Math.max(capped, 30);
      riskCapped = true;
    }
  }

  return {
    group,
    categories,
    risk,
    riskCapped,
    overall,
    coverage,
    weights: WEIGHTS,
    verdict: verdictFromScore(overall),
  };
}

export { WEIGHTS, sectorGroup };
