# Worked example: SOFI (SoFi Technologies)

> Written at the planning stage from Yahoo Finance + SEC data as of 2026-10-14. Run `npm run lt:scan -- SOFI` for the live report, or `npm run lt:scan -- SOFI --demo` to see the layout offline.

```
 SOFI · SoFi Technologies, Inc. · NasdaqGS · USD
 Price $14.22 · Market cap $18.37B · 52-wk $13.92 – $32.73 (−56.6% from high)
 Sector mode: FINANCIAL SERVICES / FINTECH (bank-style metrics apply)
 Next earnings: 2026-10-27 (13 days)

 BUSINESS VERDICT ......... B  (≈72/100)  Quality growth, still maturing
 VALUATION ................ Attractive (≈78/100)
 PRICE / TIMING VERDICT ... TREND REPAIR WATCH  (Stage 4 decline, capitulation reading)
 COMBINED ACTION .......... START SMALL — 25% of planned size in Zone A only.
```

## The business
SoFi is a US digital bank and lender: Lending (personal, student, home loans), Financial Services (checking/savings, invest, credit card) and Technology Platform (Galileo, Technisys). It holds a bank charter, so it is judged on revenue, net income, ROE, ROA and book value rather than EBITDA or FCF.

## Five-year financials

| Year | Revenue | Growth | Net income | Net margin |
|---|---|---|---|---|
| 2021 | ≈ $0.98B | — | ≈ −$0.48B | ≈ −49% |
| 2022 | $1.54B | ≈ +57% | −$0.32B | −20.8% |
| 2023 | $2.07B | +34.6% | −$0.30B | −14.5% |
| 2024 | $2.61B | +25.7% | +$0.50B | +19.1% |
| 2025 | $3.59B | +37.8% | +$0.48B | +13.4% |
| TTM | $4.27B | +42.6% | profitable | 14.9% |

3-year revenue CAGR 32.6%, every year up, growth re-accelerating. 2024 net income was helped by a one-time tax benefit (verify in the 10-K).

## Business quality (bank mode): B
Passes: 1-yr growth 42.6%, 3-yr CAGR 32.6%, consistency 4/4, EPS growth est. 58%, operating margin 17%, net margin 14.9%, ROA 1.2%, debt/equity 0.31. Fails: ROE 7.1% (ideal 12%+). Pending SEC pull: share-count change (likely a fail, SoFi diluted historically), book value per share growth.

## Valuation: Attractive
Trailing P/E 29.0x, forward P/E 17.3x, PEG 0.54x, P/B 1.66x, P/S 4.3x. Analysts (context only): 23, mean target $20.36, 10 buy / 11 hold / 4 sell. Priced like a bank, growing like software; the low ROE is why the gap exists.

## Long-term technicals
Stage 4 decline. Price below EMA20 15.94 < EMA50 16.71 < EMA150 17.88. Daily RSI 15 (extreme oversold), ADX 39 (strong downtrend), relative strength vs QQQ −22% over 60 days, sitting on the 52-week low.

| Support zones | Resistance zones |
|---|---|
| Zone A $13.35 – $13.92 (52-wk low / major) | R1 $15.94 (first reclaim) |
| Zone B $12.80 – $13.35 (invalidation shelf) | R2 $16.71 (trend confirmation) |
| | R3 $17.88 · R4 $19.28 (breakout add) · R5 $32.73 (52-wk high) |

## Entry plan

| Step | Level | Size | Why |
|---|---|---|---|
| Starter | $13.35 – $13.92 | 25% | Profitable, growing business at its 52-week low with RSI 15. Accept it may go lower. |
| Add 1 | Weekly close above $15.94 | 25% | Trend repair begins |
| Add 2 | Weekly close above $16.71 | 50% | Trend confirmed; full position |
| Breakout add | Above $19.28 on volume | — | Stage 2 restart |
| Invalidation | Weekly close below $12.80 | stop adding | Chart broken; re-verify thesis at earnings |

From Zone A midpoint ($13.65): −6% to invalidation, +31% to R3, +49% to analyst mean → reward/risk ≈ 5:1 if the business keeps growing. Earnings Oct 27: take only the starter before, or wait for the print.

## Telegram alert as the monitor would send it

```
🟡 SOFI — Capitulation on a quality business (capitulation)
Business: B (72/100) · Quality growth / durable business
Price $14.22 · -57% from 52-wk high · Stage 4: declining
Valuation: Attractive · fwd P/E 17.3x · PEG 0.54x
Weekly RSI 28 · vs 200-day -30% · RS 12m -45%

Plan: START SMALL
Zone A $13.35–$13.92 · Zone B $12.80–$13.35
Reclaim $15.94 · Confirm $16.71 · Invalidation $12.80
⚠ Earnings in 13 days (2026-10-27): size the first tranche smaller or wait for the report.
```
