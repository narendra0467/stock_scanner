// format.js — display helpers shared by narrative + report.

export function pct(x, dp = 1) {
  if (x === null || x === undefined || !Number.isFinite(x)) return '—';
  return `${(x * 100).toFixed(dp)}%`;
}

export function mult(x, dp = 1) {
  if (x === null || x === undefined || !Number.isFinite(x)) return '—';
  return `${x.toFixed(dp)}x`;
}

export function numf(x, dp = 2) {
  if (x === null || x === undefined || !Number.isFinite(x)) return '—';
  return x.toFixed(dp);
}

// big money with B/M/K suffix
export function money(x, currency = 'USD') {
  if (x === null || x === undefined || !Number.isFinite(x)) return '—';
  const sym = currency === 'CAD' ? 'C$' : currency === 'USD' ? '$' : '';
  const abs = Math.abs(x);
  let s;
  if (abs >= 1e12) s = `${(x / 1e12).toFixed(2)}T`;
  else if (abs >= 1e9) s = `${(x / 1e9).toFixed(2)}B`;
  else if (abs >= 1e6) s = `${(x / 1e6).toFixed(2)}M`;
  else if (abs >= 1e3) s = `${(x / 1e3).toFixed(2)}K`;
  else s = x.toFixed(2);
  return `${sym}${s}`;
}

export function price(x, currency = 'USD') {
  if (x === null || x === undefined || !Number.isFinite(x)) return '—';
  const sym = currency === 'CAD' ? 'C$' : currency === 'USD' ? '$' : '';
  return `${sym}${x.toFixed(2)}`;
}

// metric value formatted per spec (m.fmt: 'pct' | 'mult' | 'mult2' | 'num')
export function metricValue(m) {
  if (m.value === null || m.value === undefined) return '—';
  switch (m.fmt) {
    case 'pct': return pct(m.value);
    case 'mult': return mult(m.value, 1);
    case 'mult2': return numf(m.value, 2);
    default: return numf(m.value);
  }
}
