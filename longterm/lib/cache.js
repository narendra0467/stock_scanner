// Tiny disk cache so repeated scans (and the daily monitor) do not hammer free data sources.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
export const CACHE_DIR = process.env.LT_CACHE_DIR || path.resolve(here, "..", "cache");

const HOUR = 60 * 60 * 1000;
export const TTL = {
  prices: 6 * HOUR,
  quote: 6 * HOUR,
  financials: 7 * 24 * HOUR,
  secMap: 30 * 24 * HOUR,
};

function fileFor(kind, key) {
  const safe = String(key).replace(/[^A-Za-z0-9._-]/g, "_");
  return path.join(CACHE_DIR, kind, `${safe}.json`);
}

export function readCache(kind, key, ttlMs) {
  if (process.env.LT_NO_CACHE) return null;
  const file = fileFor(kind, key);
  try {
    const stat = fs.statSync(file);
    if (Date.now() - stat.mtimeMs > ttlMs) return null;
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

export function writeCache(kind, key, value) {
  if (process.env.LT_NO_CACHE) return;
  const file = fileFor(kind, key);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value), "utf8");
}

export async function cached(kind, key, ttlMs, loader) {
  const hit = readCache(kind, key, ttlMs);
  if (hit !== null) return hit;
  const value = await loader();
  if (value !== null && value !== undefined) writeCache(kind, key, value);
  return value;
}
