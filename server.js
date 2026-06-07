// server.js — tiny zero-dependency local dashboard for the stock scanner.
// Serves public/index.html and two JSON/HTML endpoints that reuse the same engine.
//   GET /                     -> dashboard page
//   GET /api/report?ticker=MU -> { facts, scored, narrative }
//   GET /api/html?ticker=MU   -> full rendered HTML report (self-contained doc)

import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { fetchFundamentals } from './src/data.js';
import { scoreStock } from './src/scoring.js';
import { buildNarrative } from './src/narrative.js';
import { renderHtml } from './src/report.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 5050;

function dateStamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function send(res, status, body, type = 'application/json') {
  res.writeHead(status, {
    'Content-Type': type,
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(body);
}

async function analyze(ticker) {
  const f = await fetchFundamentals(ticker);
  const scored = scoreStock(f);
  const narrative = buildNarrative(f, scored);
  return { f, scored, narrative };
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const path = url.pathname;

    if (path === '/' || path === '/index.html') {
      const html = await readFile(join(__dirname, 'public', 'index.html'), 'utf8');
      return send(res, 200, html, 'text/html; charset=utf-8');
    }

    if (path === '/api/report' || path === '/api/html') {
      const ticker = (url.searchParams.get('ticker') || '').trim();
      if (!ticker) return send(res, 400, JSON.stringify({ error: 'Missing ticker' }));
      try {
        const { f, scored, narrative } = await analyze(ticker);
        if (path === '/api/html') {
          return send(res, 200, renderHtml(f, scored, narrative, dateStamp()), 'text/html; charset=utf-8');
        }
        return send(res, 200, JSON.stringify({ facts: f, scored, narrative }));
      } catch (err) {
        return send(res, 502, JSON.stringify({ error: err.message }));
      }
    }

    send(res, 404, JSON.stringify({ error: 'Not found' }));
  } catch (err) {
    send(res, 500, JSON.stringify({ error: err.message }));
  }
});

server.listen(PORT, () => {
  console.log(`\n  📊 stock-scanner dashboard running:\n     http://localhost:${PORT}\n`);
  console.log('  Educational / informational only — not financial advice.');
  console.log('  Press Ctrl+C to stop.\n');
});
