# 📊 stock-scanner

A **free, shareable** command-line tool that generates a clean, printable
**fundamental research report** for any **NASDAQ** or **TSX** ticker — in the style of a
BDInvesting-style scorecard (Valuation / Financial Health / Growth, with a BEAT/MISS
checklist, a 0–100 score, and a plain-English bull/bear verdict).

No API key. No paid data feed. No account. Just Node.js + free Yahoo Finance data.

> ⚠️ **Educational / informational only — not financial advice.** See the disclaimer at the bottom.

---

## What it does

For a ticker it pulls live fundamentals and produces:

- A **0–100 composite score** weighted **Valuation 35% · Financial Health 35% · Growth 30%** (risk-adjusted)
- A **BEAT / OK / MISS checklist** of ~17 metrics against *sector-relative* ideal ranges, with bar visuals
- A **rule-based narrative**: business summary, bull case, bear case, catalysts, asymmetry, and a verdict
- **🎓 Beginner mode** — plain-English explanations under every metric and category (on by default),
  an **ⓘ** button on each item, and a full **Glossary** — so a complete newcomer can understand it
- A self-contained **HTML report** with score donut + charts (open in a browser, or **Export PDF**)
- Optional **JSON** output with the raw facts + scores (for spreadsheets / further analysis)

It works for NASDAQ names (`MU`, `AAPL`, `NVDA`) and TSX names using the **`.TO` suffix** (`SHOP.TO`, `RY.TO`).

---

## Quick start

Requires **Node.js 18+** (uses built-in `fetch` and ES modules).

```bash
git clone <your-repo-url> stock-scanner
cd stock-scanner
npm install

node cli.js MU
```

You'll get a console summary and an HTML report in `./reports/`.

### Examples

```bash
node cli.js MU                  # single ticker
node cli.js AAPL NVDA MSFT      # several at once
node cli.js SHOP.TO             # TSX (note the .TO)
node cli.js MU --json --open    # also save JSON, and open the report
```

### Local web dashboard (optional)

Prefer a browser UI over the CLI? Start the bundled local server:

```bash
npm run serve        # then open http://localhost:5050
```

You get a search box (type a ticker → the full report renders in the page), a **Compare**
mode that ranks several tickers in one sortable table, and an "open in new tab" link.
It's a local-only, zero-dependency server (Node's built-in `http`) reusing the same engine.
Set a different port with `PORT=8080 npm run serve`.

### Options

| Flag | Effect |
|------|--------|
| `--json`    | also write `reports/<TICKER>-<date>.json` (raw facts + scores) |
| `--no-html` | console summary only (skip the HTML report) |
| `--open`    | open the HTML report in your default browser when done |

---

## 🌐 Share it with friends (free)

This app needs a small **Node server** (it fetches Yahoo data server-side — browsers can't call
Yahoo directly), so plain GitHub Pages can't host it. Two free ways to share:

### Option A — friends run it locally (simplest, fully free, no signup)
```bash
git clone https://github.com/narendra0467/stock_scanner.git
cd stock_scanner
npm install
npm run serve      # open http://localhost:5050
```

### Option B — one free public link via Render (a URL friends just click)

**One-click:** [![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/narendra0467/stock_scanner)

Click the button → sign in to Render with GitHub (free) → **Apply**. Render reads `render.yaml`,
runs `node server.js`, and gives you a public `https://stock-scanner-xxxx.onrender.com` link to share.

Or do it manually:
1. Sign in to **https://render.com** with your GitHub account (free).
2. **New + → Blueprint**, pick the `stock_scanner` repo, click **Apply**.
3. Wait ~2 min for the first build; copy the `.onrender.com` URL and send it to your friends.

> Render's **free tier sleeps after ~15 min idle**, so the first visit after a quiet period takes
> ~30–60s to wake up, then it's fast. Perfectly fine for a handful of friends learning. Other
> equivalent free hosts that run Node also work (Glitch, Fly.io, Railway trial).

---

## How the score works (v2 — sector-relative engine)

The scoring is deliberately closer to how an analyst actually thinks, not a one-size ruler:

- **Sector-relative thresholds.** A software compounder is judged against software multiples,
  a bank against bank multiples (banks use P/B + P/E, not EV/EBITDA or gross margin). Sector
  groups: *growth, core, defensive, cyclical, financial, real estate*.
- **Weighted metrics.** Within each category metrics carry different weights (PEG / EV-EBITDA /
  FCF-yield count more than P/B for an asset-light business).
- **Graded, not binary.** Each metric gets a continuous 0–1 grade vs its sector threshold
  (shown as a bar), labelled **BEAT / OK / MISS** — so a 28× P/E and a 39× P/E aren't treated alike.
- **A Risk pillar.** Leverage (net debt/EBITDA, debt/equity), liquidity (current ratio), and FCF
  sign produce a separate **safety score**. A fragile balance sheet *caps* the headline score.
- **ROIC & FCF-yield** are first-class metrics (ROIC vs ~8–10% cost of capital is the key quality
  test; FCF-yield replaces the misleading absolute "P/FCF < 10x").

Overall = `0.35 × Valuation + 0.35 × Health + 0.30 × Growth` (renormalized if data is missing),
then risk-adjusted.

| Category (weight) | Metrics checked |
|---|---|
| **Valuation (35%)** | P/E, Forward P/E, PEG, P/B, P/S, EV/EBITDA, **FCF yield** — *thresholds vary by sector* |
| **Financial Health & Quality (35%)** | **ROIC**, ROE, Net / Operating / Gross margin, ROA, FCF margin |
| **Growth (30%)** | Revenue growth, Earnings growth, **Forward EPS growth (est.)**, 3-yr Revenue CAGR |
| **Risk (overlay)** | Net debt/EBITDA, Debt/equity, Current ratio, FCF sign |

Verdict bands: **78+ STRONG · 62–77 GOOD · 48–61 NEUTRAL · 34–47 WEAK · <34 POOR**.

The analyst rating and price target are shown as a **cross-check** but are **not** part of the score.

### What this still is *not* (honest limits vs an institutional process)

A real fund-manager process adds, on top of the above: a **reverse-DCF / DCF** (what growth is the
price implying?), **analyst-estimate revisions** (the most predictive short-term factor),
**forensic accounting** checks (Beneish M-score, accruals, share-count dilution), **cyclical
normalization** (a memory-chip or energy name at peak earnings shows a deceptively low P/E — this
tool can flag it as "growth" but won't know it's mid-cycle), management/capital-allocation review,
and competitive/moat analysis. Treat this as a fast, transparent **first-pass screen**, not a final
underwriting model.

---

## Narrative: rule-based now, LLM optional later

The bull/bear/verdict text is generated by **deterministic rules from the numbers** — so it's
free, offline-friendly, and reproducible. The `--json` output contains the full `facts` bundle,
so a future optional step could feed that to an LLM (bring-your-own-API-key) for a richer write-up
without changing the scoring. Not required, and not included by default.

---

## Project layout

```
cli.js              entry point / argument parsing / file output
src/data.js         fetch + normalize Yahoo fundamentals (NASDAQ + TSX)
src/scoring.js      BEAT/MISS checklist + weighted 0-100 scores
src/narrative.js    rule-based bull / bear / catalysts / verdict
src/report.js       printable HTML + console renderers
src/format.js       number/percent/money formatting helpers
reports/            generated reports (git-ignored)
```

---

## Notes & limitations

- **Data source:** [`yahoo-finance2`](https://github.com/gadicc/node-yahoo-finance2). Yahoo Finance
  is **unofficial** and its data may be **delayed, incomplete, or occasionally wrong**. Some fields
  are missing for certain tickers (shown as `—` / `N/A`, and excluded from the score).
- Use is for **personal, non-commercial, educational** purposes — respect Yahoo's terms of service.
- Fundamentals are reported in the listing currency (TSX names report in CAD).
- Cyclical companies (e.g. memory, commodities) can show distorted single-year ratios — read the trend.

---

## ⚠️ Disclaimer

This software is provided for **educational and informational purposes only** and is **not financial,
investment, tax, or legal advice**, and **not a recommendation** to buy, sell, or hold any security.
Reports are generated automatically from third-party data using a fixed, generic methodology that does
not account for your personal circumstances. The authors make no guarantee of accuracy or completeness
and accept no liability for any decisions made using this tool. **Do your own research** and consult a
licensed financial professional before investing.

## License

MIT
