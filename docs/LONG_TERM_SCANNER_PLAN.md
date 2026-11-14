# Long-Term Investor Scanner — Design

> **Status (2026-11-14): built as an independent system in `longterm/`** (no shared code with the older report scanner in `src/`). See `longterm/README.md` for usage. This document is the design reference.

Goal: scan **any US or Canadian ticker** and answer two separate questions the way a fundamentals-first, 1–3+ year investor would:

1. **Is this a business worth owning?** (fundamentals only: business model, 5–10-year statements, revenue, cash flow, margins, balance sheet, valuation)
2. **Is now a good price to get in?** (long-term technicals: trend stage, 200-day / 40-week averages, support and resistance zones, weekly RSI, relative strength)

Plus a **watchlist monitor** for 20–25 tickers that sends a **Telegram message** when one of them reaches a good long-term entry.

This is a decision-support tool, not financial advice.

---

## 1. Two verdicts, not one blended score

| Verdict | Source | Output |
|---|---|---|
| Business grade | fundamentals only | A core compounder · B quality growth · C unproven · D not for a long-term hold |
| Valuation | multiples vs sector bands and vs own 5-year history | Attractive · Fair · Rich · Expensive, plus a fair-value range |
| Price / timing | weekly-chart technicals | BUY ZONE NOW · ACCUMULATE · WAIT FOR PULLBACK · TREND REPAIR WATCH · BROKEN |
| Combined action | grade × timing | BUY NOW · ACCUMULATE (DCA) · WAIT FOR $X · START SMALL · STAND ASIDE · NOT INVESTABLE |

A great business in a temporary downtrend says "START SMALL at zone A, add on reclaim"; a weak business in a buy zone says "NOT INVESTABLE, cheap for a reason".

## 2. Architecture (`longterm/`)

```
lib/        http (retry/timeout), disk cache, formatting helpers
data/       yahoo.js (5y weekly + 2y daily bars, quote snapshot, annual timeseries fallback)
            sec.js   (EDGAR XBRL company facts -> 10-year annual statements, 10-K/20-F/40-F)
            financials.js (merge SEC + Yahoo, derived ratios, quote normalization)
            demo.js  (synthetic provider for --demo)
engine/     indicators.js, profile.js (sector mode), quality.js, valuation.js, levels.js, entry.js
report/     scan.js (orchestrator, injectable data deps), render.js (Markdown + Telegram)
monitor/    watchlist, rules (8 alerts + cooldown), state, telegram, monitorCli
tests/      21 offline tests on deterministic synthetic fixtures
cli.js      npm run lt:scan
```

Zero npm dependencies, Node 22, runs in GitHub Actions for free.

## 3. Fundamental engine

**Business profile.** Sector mode decides which metrics matter: bank/fintech (revenue, net income, ROE, ROA, book value per share, equity/assets, P/B), software (revenue growth, gross margin, FCF margin, dilution, P/S, P/FCF), semis/energy (cyclical tolerance, EV/EBITDA), REIT, insurance, consumer, general, ETF (fundamentals not scored).

**Statements.** SEC XBRL gives audited annual data back 10 years for US filers and Canadian 40-F filers, with restated figures preferred and quarterly data filtered out. Yahoo's annual timeseries fills gaps and covers TSX names without SEC filings.

**Business Quality score (0–100 → grade).**

| Pillar | Weight | Measures |
|---|---|---|
| Growth | 25 | 3-yr and 5-yr revenue CAGR, latest growth, consistency (years up), EPS or net income CAGR |
| Profitability | 20 (bank 25) | margin levels and 3-year direction, ROE (bank: ROE, ROA, net margin, profitable years) |
| Cash flow / earnings power | 20 (bank 15) | FCF positive years, FCF margin, FCF conversion, FCF growth, earnings quality (bank: book value/share growth, net income growth) |
| Balance sheet | 15 | net debt / operating cash flow, debt/equity, interest coverage, current ratio, debt trend (bank: equity/assets) |
| Shareholder treatment | 10 | 5-year share-count change, buybacks/dividends |
| Moat / durability | 10 | gross-margin stability, pricing power, scale economics |

Every metric reports value, ideal range, PASS / NEAR / FAIL / UNAVAILABLE and a one-line explanation. Red flags (revenue down two years, chronic losses and negative FCF, dilution > 25%, debt up while FCF falls, earnings quality, negative equity, liquidity) cap the grade at C (one flag) or D (two or more). Low data coverage caps A at B.

**Valuation.** P/E, forward P/E, PEG, P/S, P/B, EV/EBITDA, P/FCF, FCF yield against sector bands, each also ranked against the stock's own multiples at the last five fiscal year-ends. Fair value from forward EPS × growth-adjusted P/E, FCF yield (non-banks) and book value × ROE-adjusted P/B (banks); shown as a range, never a single target. Analyst consensus is context only.

## 4. Long-term technical engine

From 5 years of weekly bars and 2 years of daily bars: Weinstein stage from the 30-week average and its slope; 50/200-day and 10/30/40/200-week SMAs; golden/death cross detection; swing pivots (3-bar) clustered into support/resistance zones with touch counts, recency and strength; 52-week and 3-year range; Fibonacci of the dominant 3-year swing; weekly RSI, daily RSI, monthly MACD; 6- and 12-month relative strength vs SPY or XIU.TO; up-week vs down-week volume.

**Entry plan.** Zone A (tested support, or the rising 200-day in a healthy uptrend), Zone B (next support), reclaim and confirmation levels (for repairing trends) or next resistances (for uptrends), breakout level, invalidation (below zone A by 0.75 weekly ATR, tighter in Stage 4), a tranche plan per verdict, reward/risk, and a warning when earnings are within 14 days.

## 5. Watchlist monitor and Telegram

`longterm/watchlist.json` holds 20–25 names with notes and a `holding` flag. The monitor runs weekdays after the close in GitHub Actions, scans each name, evaluates eight rules (buy zone, capitulation, trend repair, breakout, valuation low, invalidation, thesis check, extended), applies a 14-day cooldown per rule from `longterm/state/alert_state.json`, sends HTML-formatted Telegram messages plus an optional digest, and commits the refreshed reports and state. Secrets: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, optional `SEC_USER_AGENT`.

## 6. Worked example

See `docs/examples/SOFI_scan_example.md`.
