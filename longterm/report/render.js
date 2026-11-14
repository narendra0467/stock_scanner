// Renders a scan report as Markdown (for the CLI / files) and as a short Telegram message.
import { isNum, fmtMoney, fmtPct, fmtPrice, fmtX } from "../lib/util.js";

const icon = { pass: "✅", near: "🟡", fail: "❌", unavailable: "⚪" };
const line = (s = "") => `${s}\n`;

function table(headers, rows) {
  const out = [`| ${headers.join(" | ")} |`, `| ${headers.map(() => "---").join(" | ")} |`];
  for (const row of rows) out.push(`| ${row.map((cell) => String(cell ?? "n/a")).join(" | ")} |`);
  return out.join("\n") + "\n";
}

export function renderMarkdown(r) {
  const cur = r.currency === "CAD" ? "C$" : "$";
  const money = (v) => fmtMoney(v, cur);
  const v = r.verdict;
  const e = r.entry;
  const l = r.levels;
  let md = "";
  md += line(`# ${r.symbol} · ${r.name}`);
  md += line(`${r.exchange ?? ""} · Price ${fmtPrice(r.price)} (${r.priceDate}) · Market cap ${money(r.marketCap)} · 52-wk ${fmtPrice(l.range.low52)}-${fmtPrice(l.range.high52)} (${fmtPct(l.range.pctFromHigh52, 0)} from high)`);
  md += line();
  md += line("```");
  md += line(` BUSINESS VERDICT ........ ${v.businessGrade}  (${v.businessScore ?? "n/a"}/100)  ${v.businessLabel}`);
  md += line(` VALUATION ............... ${v.valuationLabel} (${v.valuationScore ?? "n/a"}/100)`);
  md += line(` PRICE / TIMING .......... ${v.timing}  (${l.stage.label})`);
  md += line(` COMBINED ACTION ......... ${v.action}`);
  md += line("```");
  if (e.warnings.length) md += line(e.warnings.map((w) => `> ⚠ ${w}`).join("\n"));
  md += line();

  md += line("## 1. The business");
  md += line(r.business.summary ?? "");
  md += line(`Sector: ${r.business.sector ?? "n/a"} / ${r.business.industry ?? "n/a"} · Mode: **${r.business.modeLabel}** · Key metrics: ${r.business.keyMetrics.join(", ")}`);
  md += line();

  if (r.quality.applicable) {
    md += line(`## 2. Five-year financials (${r.financials.source})`);
    md += table(
      ["Fiscal year", "Revenue", "Growth", "Op. margin", "Net income", "Net margin", "EPS", "Op. cash flow", "Free cash flow", "Cash", "Debt", "Diluted shares"],
      r.financials.years.map((y) => [y.year, money(y.revenue), fmtPct(y.revenueGrowth), fmtPct(y.operatingMargin), money(y.netIncome), fmtPct(y.netMargin), isNum(y.eps) ? y.eps.toFixed(2) : "n/a", money(y.operatingCashFlow), money(y.freeCashFlow), money(y.cash), money(y.totalDebt), isNum(y.dilutedShares) ? `${(y.dilutedShares / 1e6).toFixed(0)}M` : "n/a"])
    );
    const s = r.financials.summary;
    md += line(`3-yr revenue CAGR **${fmtPct(s.revenueCagr3)}** · 5-yr **${fmtPct(s.revenueCagr5)}** · up ${s.revenueUpYears} of ${s.revenueYearsWithGrowthData} years · profitable ${s.profitableYears} of ${s.netIncomeYears} years · FCF positive ${s.fcfPositiveYears} of ${s.fcfYears} years · share count ${fmtPct(s.shareChange5y)} over ${s.shareChangeYears ?? "n/a"} yrs`);
    md += line();

    md += line(`## 3. Business quality: ${r.quality.grade} (${r.quality.score}/100) — ${r.quality.label}`);
    if (r.quality.redFlags.length) md += line(r.quality.redFlags.map((f) => `- 🚩 **Red flag:** ${f}`).join("\n"));
    if (r.quality.notes?.length) md += line(r.quality.notes.map((n) => `- ${n}`).join("\n"));
    for (const p of r.quality.pillars) {
      md += line(`\n**${p.name}** — ${p.score ?? "n/a"}/100 (weight ${p.weight}%)`);
      md += table(["Metric", "Value", "Ideal", "Status", "What it means"], p.metrics.map((m) => [m.label, m.display, m.ideal, `${icon[m.status]} ${m.status}`, m.note]));
    }
    md += line();

    md += line(`## 4. Valuation: ${r.valuation.label} (${r.valuation.score}/100)`);
    md += table(["Multiple", "Value", "Ideal", "Status", "Vs own history", "Note"], r.valuation.multiples.map((m) => [m.label, m.display, m.ideal, m.status === "unavailable" ? "⚪" : `${icon[m.status]} ${m.status}`, m.ownHistoryRead ?? "", m.note]));
    if (r.valuation.ownHistory.length) {
      md += line(`Historical multiples at fiscal year-ends (price / P/E / P/S / P/B / P/FCF):`);
      md += table(["Year", "Price", "P/E", "P/S", "P/B", "P/FCF"], r.valuation.ownHistory.map((h) => [h.year, fmtPrice(h.price), fmtX(h.pe), fmtX(h.ps), fmtX(h.pb, 2), fmtX(h.pfcf)]));
    }
    if (r.valuation.fairValue) {
      const f = r.valuation.fairValue;
      md += line(`**Fair-value range: ${fmtPrice(f.low)} – ${fmtPrice(f.high)}** (mid ${fmtPrice(f.mid)}, ${fmtPct(f.upsideToMid, 0)} vs price). ${f.read}`);
      md += line(f.methods.map((m) => `- ${m.method} → ${fmtPrice(m.low)}–${fmtPrice(m.high)}`).join("\n"));
    }
    const a = r.valuation.analyst ?? {};
    if (isNum(a.count)) md += line(`Analyst context (not a signal): ${a.count} analysts, mean target ${fmtPrice(a.targetMean)}, ${a.buy} buy / ${a.hold} hold / ${a.sell} sell.`);
    md += line();
  } else {
    md += line("## 2–4. Fundamentals\nNot scored for a fund. Judge what it tracks and its fees; use the technical section for timing.\n");
  }

  md += line("## 5. Long-term technicals");
  md += line("```");
  md += line(` Stage .................. ${l.stage.label} — ${l.stage.reason}`);
  md += line(` 50-day / 200-day SMA ... ${fmtPrice(l.movingAverages.sma50d)} / ${fmtPrice(l.movingAverages.sma200d)}  (${l.movingAverages.goldenCross === null ? "n/a" : l.movingAverages.goldenCross ? "golden cross" : "death cross"}${l.movingAverages.crossedRecently ? `, ${l.movingAverages.crossedRecently}` : ""})`);
  md += line(` 200-day slope (20d) .... ${fmtPct(l.movingAverages.slope200d20d)}   Distance from 200-day: ${fmtPct(l.distanceFrom200d)}`);
  md += line(` 30-wk / 40-wk / 200-wk . ${fmtPrice(l.movingAverages.sma30w)} / ${fmtPrice(l.movingAverages.sma40w)} / ${fmtPrice(l.movingAverages.sma200w)}`);
  md += line(` Weekly RSI / Daily RSI . ${l.momentum.rsiWeekly ?? "n/a"} / ${l.momentum.rsiDaily ?? "n/a"}`);
  md += line(` Monthly MACD ........... hist ${l.momentum.macdMonthlyHistogram ?? "n/a"} ${l.momentum.macdMonthlyRising === null ? "" : l.momentum.macdMonthlyRising ? "(rising)" : "(falling)"}`);
  md += line(` Rel. strength vs ${r.benchmark} . 6m ${fmtPct(l.relativeStrength.m6)} · 12m ${fmtPct(l.relativeStrength.m12)}`);
  md += line(` Volume up/down (26w) ... ${l.volume.upDownRatio26w ?? "n/a"}x   Last week vs avg: ${l.volume.lastWeekVsAverage ?? "n/a"}x`);
  md += line(` 3-yr range ............. ${fmtPrice(l.range.low3y)} – ${fmtPrice(l.range.high3y)}  (${fmtPct(l.range.pctFromHigh3y, 0)} from 3-yr high)`);
  md += line("```");
  md += line("**Support zones (below price)**");
  md += table(["Zone", "Touches", "Strength", "Last touch", "Distance"], l.supports.slice(0, 4).map((s) => [`${fmtPrice(s.low)} – ${fmtPrice(s.high)}`, s.touches, s.strength, s.lastTouch, fmtPct(s.distancePct)]));
  md += line("**Resistance zones (above price)**");
  md += table(["Zone", "Touches", "Strength", "Last touch", "Distance"], l.resistances.slice(0, 4).map((s) => [`${fmtPrice(s.low)} – ${fmtPrice(s.high)}`, s.touches, s.strength, s.lastTouch, fmtPct(s.distancePct)]));
  md += line(`Moving-average levels: ${l.dynamicLevels.map((d) => `${d.label} ${fmtPrice(d.price)} (${d.role})`).join(" · ")}`);
  md += line(`Fibonacci (${l.fibonacci.direction}): 38.2% ${fmtPrice(l.fibonacci.r382)} · 50% ${fmtPrice(l.fibonacci.r500)} · 61.8% ${fmtPrice(l.fibonacci.r618)}`);
  md += line();

  md += line(`## 6. Entry plan: ${e.timingVerdict} → **${e.action}**`);
  md += line(e.reasons.map((x) => `- ${x}`).join("\n"));
  md += line();
  const repairing = l.stage.stage === 4 || l.stage.stage === 1;
  md += table(["Level", "Price", "Basis"], [
    ["Buy zone A", `${fmtPrice(e.zoneA.low)} – ${fmtPrice(e.zoneA.high)}`, e.zoneA.basis + (e.zoneA.note ? ` · ${e.zoneA.note}` : "")],
    ["Buy zone B", `${fmtPrice(e.zoneB.low)} – ${fmtPrice(e.zoneB.high)}`, e.zoneB.basis],
    isNum(e.reclaim) ? [repairing ? "Reclaim level" : "Next resistance", fmtPrice(e.reclaim), repairing ? "first sign the trend is repairing" : "first overhead level to clear"] : ["Overhead resistance", "none", "price is at the top of its range"],
    isNum(e.confirm) ? [repairing ? "Confirmation" : "Second resistance", fmtPrice(e.confirm), repairing ? "trend confirmed" : "next level above"] : null,
    ["Breakout add", fmtPrice(e.breakout), "above the highest resistance / 52-week high"],
    ["Invalidation", fmtPrice(e.invalidation), "weekly close below: stop adding, re-check the thesis"],
  ].filter(Boolean));
  md += line("**Tranche plan**");
  md += table(["Size", "When", "Why"], e.tranches.map((t) => [`${t.pct}%`, t.when, t.why]));
  if (e.openEndedUpside) md += line("Price is at the top of its range with no overhead resistance: upside is open-ended, so no reward/risk ratio is given. The invalidation level is the risk.");
  else if (isNum(e.rewardRisk)) md += line(`From zone A midpoint: ${fmtPct(e.downsideToInvalidation, 0)} to invalidation vs ${fmtPct(e.upsideToConfirm, 0)} to the next upside level → reward/risk ${e.rewardRisk}:1.`);
  if (r.snapshot.nextEarningsDate) md += line(`Next earnings: ${r.snapshot.nextEarningsDate}${isNum(e.earningsInDays) && e.earningsInDays >= 0 ? ` (in ${e.earningsInDays} days)` : ""}. Beat rate ${fmtPct(r.snapshot.earningsBeatRate, 0)}.`);
  md += line();

  md += line("## 7. Data quality");
  md += line(`Financials: ${r.dataQuality.financialsSource}, ${r.dataQuality.fiscalYears} fiscal years (${r.dataQuality.firstFiscalYear ?? "n/a"} → ${r.dataQuality.latestFiscalYear ?? "n/a"}). Prices: ${r.dataQuality.weeklyBars} weekly / ${r.dataQuality.dailyBars} daily bars.`);
  if (r.dataQuality.metricsUnavailable.length) md += line(`Unavailable metrics: ${r.dataQuality.metricsUnavailable.join(", ")}.`);
  if (r.dataQuality.warnings.length) md += line(`Warnings: ${r.dataQuality.warnings.join("; ")}.`);
  md += line(`_${r.dataQuality.disclaimer}_`);
  return md;
}

export function escapeHtml(text) {
  return String(text ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function renderTelegramSummary(r, { title, emoji = "🔵", link = null } = {}) {
  const v = r.verdict;
  const e = r.entry;
  const l = r.levels;
  const rows = [
    `${emoji} <b>${escapeHtml(r.symbol)}</b> — ${escapeHtml(title ?? v.action)}`,
    `Business: <b>${v.businessGrade}</b>${isNum(v.businessScore) ? ` (${v.businessScore}/100)` : ""} · ${escapeHtml(v.businessLabel)}`,
    `Price ${fmtPrice(r.price)} · ${fmtPct(l.range.pctFromHigh52, 0)} from 52-wk high · ${escapeHtml(l.stage.label)}`,
    `Valuation: ${escapeHtml(v.valuationLabel)}${r.valuation.applicable ? ` · fwd P/E ${fmtX(r.valuation.multiples.find((m) => m.label === "Forward P/E")?.value)} · PEG ${fmtX(r.valuation.multiples.find((m) => m.label.startsWith("PEG"))?.value, 2)}` : ""}`,
    `Weekly RSI ${l.momentum.rsiWeekly ?? "n/a"} · vs 200-day ${fmtPct(l.distanceFrom200d, 0)} · RS 12m ${fmtPct(l.relativeStrength.m12, 0)}`,
    "",
    `Plan: <b>${escapeHtml(e.action)}</b>`,
    `Zone A ${fmtPrice(e.zoneA.low)}–${fmtPrice(e.zoneA.high)} · Zone B ${fmtPrice(e.zoneB.low)}–${fmtPrice(e.zoneB.high)}`,
    `Reclaim ${fmtPrice(e.reclaim)} · Confirm ${fmtPrice(e.confirm)} · Invalidation ${fmtPrice(e.invalidation)}`,
  ];
  for (const w of e.warnings.slice(0, 2)) rows.push(`⚠ ${escapeHtml(w)}`);
  if (link) rows.push(`<a href="${link}">Full report</a>`);
  return rows.join("\n");
}

export function renderOneLine(r) {
  return `${r.symbol.padEnd(8)} ${fmtPrice(r.price).padStart(10)}  grade ${r.verdict.businessGrade}  ${String(r.verdict.timing).padEnd(20)} ${r.verdict.action}`;
}
