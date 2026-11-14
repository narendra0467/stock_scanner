# Long-Term Investor Scanner (`longterm/`)

Standalone, zero-dependency Node 22 scanner for 1–3+ year holds. It does **not** share code with the older report scanner in `src/` and `cli.js`; it has its own data fetchers, indicators, scoring, report, watchlist monitor and tests.

```
npm run lt:scan -- SOFI              # full report (Markdown printed, .md/.json saved to longterm/reports/)
npm run lt:scan -- SHOP.TO RY.TO     # Canadian tickers need .TO / .V / .NE / .CN
npm run lt:scan -- AMD --json        # machine-readable
npm run lt:scan -- AMD --telegram    # also send the summary to Telegram
npm run lt:scan -- AMD --demo        # synthetic data: see the report layout without network
npm run lt:watchlist -- add SOFI AMD --holding
npm run lt:monitor -- --dry-run      # evaluate the watchlist, print alerts instead of sending
npm run lt:test                      # offline test suite (21 tests)
```

## What a scan answers
1. **Is this a business worth owning?** Business grade A–D from 5–10 years of statements (SEC XBRL, Yahoo fallback): growth, profitability, cash flow, balance sheet, dilution, moat. Sector-aware (banks are judged on ROE/ROA/book value, software on FCF margin and dilution, etc.). Red flags cap the grade.
2. **Is the price reasonable?** Multiples vs sector bands **and** vs the stock's own 5-year history, plus a fair-value range.
3. **Is now a good time?** Weekly-chart stage (Weinstein 1–4), 50/200-day and 30/40/200-week averages, support/resistance zones from swing pivots, weekly RSI, monthly MACD, relative strength, volume. Output: Buy zone A/B, reclaim, confirmation, breakout, invalidation, tranche plan.
4. **Combined action:** BUY NOW · ACCUMULATE (DCA) · WAIT FOR $X · START SMALL · STAND ASIDE · NOT INVESTABLE.

## Telegram setup
1. In Telegram, talk to **@BotFather** → `/newbot` → copy the token.
2. Start a chat with your new bot and send it any message.
3. Get your chat id: open `https://api.telegram.org/bot<TOKEN>/getUpdates` and read `message.chat.id`.
4. GitHub → repo → Settings → Secrets and variables → Actions → add `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` (optionally `SEC_USER_AGENT` = "your name your@email", which the SEC asks for).
5. The workflow `.github/workflows/longterm-monitor.yml` runs every weekday after the close and on demand (Actions → Long-Term Watchlist Monitor → Run workflow, optionally with a ticker for a one-off scan). GitHub only runs scheduled workflows from the default branch, so merge to `main`.

## Alert rules (per ticker, 14-day cooldown per rule)
| Rule | Fires when |
|---|---|
| buy-zone | Timing verdict is BUY ZONE NOW and business grade is A/B (or a fund) |
| capitulation | Weekly RSI < 35 or daily RSI < 25 on an A/B business |
| trend-repair | Golden cross, reclaim of the 200-day, or exit from Stage 4 |
| breakout | New 52-week high with no resistance overhead on ≥1.3× volume |
| valuation-low | Multiples in the cheapest 20% of the stock's own 5-year history |
| invalidation (holdings) | Price below the plan's invalidation level |
| thesis-check | A new red flag or a business-grade downgrade since the last run |
| extended (holdings) | >35% above the 200-day with weekly RSI > 75 |

State lives in `longterm/state/alert_state.json`; the daily digest and per-ticker reports are written to `longterm/reports/`.

## Data sources
- Prices: Yahoo Finance chart API (5y weekly, 2y daily, benchmark SPY or XIU.TO).
- Fundamentals: SEC EDGAR XBRL company facts (10-K / 20-F / 40-F filers) merged with Yahoo's annual timeseries for anything SEC does not cover (most TSX/TSXV names).
- Everything is cached on disk in `longterm/cache/` (prices 6h, financials 7d).

Not financial advice. Verify key figures in the filings before investing.
