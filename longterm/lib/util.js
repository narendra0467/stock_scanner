export const isNum = (value) => typeof value === "number" && Number.isFinite(value);
export const round = (value, digits = 2) => (isNum(value) ? Number(value.toFixed(digits)) : null);
export const pct = (value, digits = 1) => (isNum(value) ? round(value * 100, digits) : null);
export const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, value));
export const mean = (values) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : null);
export const lastOf = (values) => (values.length ? values[values.length - 1] : undefined);

export function cagr(start, end, years) {
  if (!isNum(start) || !isNum(end) || start <= 0 || end <= 0 || years <= 0) return null;
  return (end / start) ** (1 / years) - 1;
}

export function percentileRank(values, target) {
  const clean = values.filter(isNum);
  if (!clean.length || !isNum(target)) return null;
  const below = clean.filter((value) => value < target).length;
  const equal = clean.filter((value) => value === target).length;
  return (below + equal * 0.5) / clean.length;
}

export function fmtMoney(value, currency = "$") {
  if (!isNum(value)) return "n/a";
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1e12) return `${sign}${currency}${(abs / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `${sign}${currency}${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}${currency}${(abs / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${sign}${currency}${(abs / 1e3).toFixed(1)}K`;
  return `${sign}${currency}${abs.toFixed(2)}`;
}

export function fmtPct(value, digits = 1) {
  return isNum(value) ? `${(value * 100).toFixed(digits)}%` : "n/a";
}

export function fmtX(value, digits = 1) {
  return isNum(value) ? `${value.toFixed(digits)}x` : "n/a";
}

export function fmtPrice(value, digits = 2) {
  return isNum(value) ? `$${value.toFixed(digits)}` : "n/a";
}

export function isCanadian(symbol) {
  return /\.(TO|V|NE|CN)$/i.test(symbol);
}

export function benchmarkFor(symbol) {
  return isCanadian(symbol) ? "XIU.TO" : "SPY";
}

export function daysBetween(a, b) {
  return Math.round((new Date(b) - new Date(a)) / 86400000);
}
