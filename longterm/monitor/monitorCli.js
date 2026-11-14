#!/usr/bin/env node
// Daily watchlist monitor. Usage: npm run lt:monitor -- [--dry-run] [--digest] [--no-cache] [--demo]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { scanTicker, defaultDeps } from "../report/scan.js";
import { renderMarkdown, renderTelegramSummary, escapeHtml } from "../report/render.js";
import { loadWatchlist } from "./watchlist.js";
import { loadState, saveState } from "./state.js";
import { evaluateRules, nextState } from "./rules.js";
import { sendTelegram, telegramConfigured } from "./telegram.js";
import { fmtPrice, fmtPct } from "../lib/util.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const reportsDir = path.resolve(here, "..", "reports");
const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run") || !telegramConfigured();
if (args.has("--no-cache")) process.env.LT_NO_CACHE = "1";
const deps = args.has("--demo") ? (await import("../data/demo.js")).demoDeps : defaultDeps;
const today = new Date().toISOString().slice(0, 10);
const reportLink = process.env.LT_REPORT_BASE_URL || null;

const watchlist = loadWatchlist();
if (!watchlist.symbols.length) {
  console.error("Watchlist is empty. Add names with: npm run lt:watchlist -- add SOFI AMD SHOP.TO");
  process.exit(1);
}
const state = loadState();
fs.mkdirSync(reportsDir, { recursive: true });
if (dryRun) console.error(telegramConfigured() ? "Dry run: alerts are printed, not sent." : "Telegram is not configured (TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID): printing alerts instead.");

const statusRows = [];
const messages = [];
for (const entry of watchlist.symbols) {
  try {
    const report = await scanTicker(entry.symbol, deps);
    fs.writeFileSync(path.join(reportsDir, `${report.symbol}.md`), renderMarkdown(report));
    fs.writeFileSync(path.join(reportsDir, `${report.symbol}.json`), JSON.stringify(report, null, 2));
    const prev = state.symbols[report.symbol] ?? null;
    const { fired, suppressed } = evaluateRules(report, prev, entry, today);
    for (const alert of fired) {
      const link = reportLink ? `${reportLink.replace(/\/$/, "")}/${report.symbol}.md` : null;
      const text = renderTelegramSummary(report, { title: `${alert.title} (${alert.id})`, emoji: alert.emoji, link }) + `\n${escapeHtml(alert.detail ?? "")}`;
      messages.push({ symbol: report.symbol, alert, text });
    }
    state.symbols[report.symbol] = nextState(report, prev, fired, today);
    statusRows.push({ symbol: report.symbol, price: report.price, grade: report.verdict.businessGrade, timing: report.verdict.timing, action: report.verdict.action, stage: report.levels.stage.label, zoneA: `${fmtPrice(report.entry.zoneA.low)}-${fmtPrice(report.entry.zoneA.high)}`, from200d: fmtPct(report.levels.distanceFrom200d, 0), rsiW: report.levels.momentum.rsiWeekly, fired: fired.map((a) => a.id), suppressed: suppressed.map((a) => a.id), holding: Boolean(entry.holding) });
    console.error(`${report.symbol.padEnd(9)} ${report.verdict.businessGrade} ${report.verdict.timing.padEnd(20)} ${report.verdict.action.padEnd(28)} alerts: ${fired.map((a) => a.id).join(",") || "-"}${suppressed.length ? ` (cooldown: ${suppressed.map((a) => a.id).join(",")})` : ""}`);
    await new Promise((resolve) => setTimeout(resolve, 400));
  } catch (error) {
    statusRows.push({ symbol: entry.symbol, error: error.message });
    console.error(`${entry.symbol}: ${error.message}`);
  }
}

for (const message of messages) {
  if (dryRun) console.log(`\n--- ${message.symbol} / ${message.alert.id} ---\n${message.text}`);
  else await sendTelegram(message.text);
}

if (args.has("--digest")) {
  const lines = [`📋 <b>Watchlist digest ${today}</b>`, ...statusRows.map((row) => row.error ? `${escapeHtml(row.symbol)}: error ${escapeHtml(row.error)}` : `${row.holding ? "★ " : ""}<b>${escapeHtml(row.symbol)}</b> ${fmtPrice(row.price)} · ${row.grade} · ${escapeHtml(row.action)} · zone A ${row.zoneA}`)];
  const digest = lines.join("\n");
  if (dryRun) console.log(`\n--- digest ---\n${digest}`);
  else await sendTelegram(digest);
}

saveState(state);
fs.writeFileSync(path.join(reportsDir, "watchlist_status.json"), JSON.stringify({ updated: new Date().toISOString(), rows: statusRows, alertsSent: messages.map((m) => ({ symbol: m.symbol, rule: m.alert.id })) }, null, 2));
fs.writeFileSync(path.join(reportsDir, "watchlist_status.md"), [
  `# Watchlist status ${today}`,
  "",
  "| Symbol | Price | Grade | Timing | Action | Stage | Zone A | vs 200d | Weekly RSI | Alerts |",
  "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
  ...statusRows.map((row) => row.error ? `| ${row.symbol} | error: ${row.error} |` : `| ${row.holding ? "★ " : ""}${row.symbol} | ${fmtPrice(row.price)} | ${row.grade} | ${row.timing} | ${row.action} | ${row.stage} | ${row.zoneA} | ${row.from200d} | ${row.rsiW ?? "n/a"} | ${row.fired.join(", ") || "-"} |`),
  "",
].join("\n"));
console.error(`Done: ${statusRows.length} symbols, ${messages.length} alert(s) ${dryRun ? "printed" : "sent"}.`);
