#!/usr/bin/env node
// cli.js — entry point.
//   node cli.js MU                 -> console summary + writes reports/MU-<date>.html
//   node cli.js SHOP.TO AAPL NVDA  -> multiple tickers
//   node cli.js MU --json          -> also write reports/MU-<date>.json
//   node cli.js MU --no-html       -> console only
//   node cli.js MU --open          -> open the HTML report after generating (Windows/mac/linux)

import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

import { fetchFundamentals } from './src/data.js';
import { scoreStock } from './src/scoring.js';
import { buildNarrative } from './src/narrative.js';
import { renderHtml, renderText } from './src/report.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPORTS_DIR = join(__dirname, 'reports');

function parseArgs(argv) {
  const flags = new Set();
  const tickers = [];
  for (const a of argv) {
    if (a.startsWith('--')) flags.add(a);
    else tickers.push(a);
  }
  return { tickers, flags };
}

function openFile(path) {
  const platform = process.platform;
  const cmd = platform === 'win32' ? 'cmd' : platform === 'darwin' ? 'open' : 'xdg-open';
  const args = platform === 'win32' ? ['/c', 'start', '', path] : [path];
  spawn(cmd, args, { detached: true, stdio: 'ignore' }).unref();
}

function dateStamp() {
  // local YYYY-MM-DD
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

async function runOne(ticker, flags, stamp) {
  process.stdout.write(`Fetching ${ticker} ...\n`);
  const f = await fetchFundamentals(ticker);
  const scored = scoreStock(f);
  const narrative = buildNarrative(f, scored);

  console.log(renderText(f, scored, narrative));

  const safe = f.symbol.replace(/[^A-Z0-9.]/gi, '_');
  if (!flags.has('--no-html')) {
    mkdirSync(REPORTS_DIR, { recursive: true });
    const html = renderHtml(f, scored, narrative, stamp);
    const htmlPath = join(REPORTS_DIR, `${safe}-${stamp}.html`);
    writeFileSync(htmlPath, html, 'utf8');
    console.log(`  → report: ${htmlPath}`);
    if (flags.has('--open')) openFile(htmlPath);
  }
  if (flags.has('--json')) {
    mkdirSync(REPORTS_DIR, { recursive: true });
    const jsonPath = join(REPORTS_DIR, `${safe}-${stamp}.json`);
    writeFileSync(jsonPath, JSON.stringify({ facts: f, scored, narrative }, null, 2), 'utf8');
    console.log(`  → json:   ${jsonPath}`);
  }
}

async function main() {
  const { tickers, flags } = parseArgs(process.argv.slice(2));
  if (!tickers.length) {
    console.log(`
stock-scanner — free fundamental research reports (NASDAQ + TSX)

  Usage:
    node cli.js <TICKER> [more tickers...] [options]

  Examples:
    node cli.js MU
    node cli.js AAPL NVDA MSFT
    node cli.js SHOP.TO            (TSX names need the .TO suffix)
    node cli.js MU --json --open

  Options:
    --json      also write a JSON file with raw facts + scores
    --no-html   console summary only (skip the HTML report)
    --open      open the HTML report when done

  Reports are written to ./reports/. Educational / informational only — not financial advice.
`);
    process.exit(0);
  }

  const stamp = dateStamp();
  let failures = 0;
  for (const t of tickers) {
    try {
      await runOne(t, flags, stamp);
    } catch (err) {
      failures++;
      console.error(`\n  ⚠ ${t}: ${err.message}\n`);
    }
  }
  process.exit(failures && failures === tickers.length ? 1 : 0);
}

main();
