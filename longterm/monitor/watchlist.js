import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
export const WATCHLIST_PATH = process.env.LT_WATCHLIST || path.resolve(here, "..", "watchlist.json");

export function loadWatchlist(file = WATCHLIST_PATH) {
  if (!fs.existsSync(file)) return { updated: null, symbols: [] };
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  data.symbols = (data.symbols ?? []).map((entry) => (typeof entry === "string" ? { symbol: entry } : entry)).map((entry) => ({ ...entry, symbol: String(entry.symbol).toUpperCase() }));
  return data;
}

export function saveWatchlist(data, file = WATCHLIST_PATH) {
  fs.writeFileSync(file, `${JSON.stringify({ ...data, updated: new Date().toISOString() }, null, 2)}\n`);
}

export function addSymbol(data, symbol, extra = {}) {
  const clean = String(symbol).toUpperCase();
  if (data.symbols.some((s) => s.symbol === clean)) return data;
  data.symbols.push({ symbol: clean, note: "", holding: false, addedOn: new Date().toISOString().slice(0, 10), ...extra });
  return data;
}

export function removeSymbol(data, symbol) {
  const clean = String(symbol).toUpperCase();
  data.symbols = data.symbols.filter((s) => s.symbol !== clean);
  return data;
}
