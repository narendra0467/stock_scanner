#!/usr/bin/env node
// Usage: node longterm/cli.js SOFI [AMD SHOP.TO ...] [--json] [--no-cache] [--telegram] [--demo] [--out=longterm/reports]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { scanTicker, defaultDeps } from "./report/scan.js";
import { renderMarkdown, renderTelegramSummary, renderOneLine } from "./report/render.js";
import { sendTelegram } from "./monitor/telegram.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith("--")));
const outArg = args.find((a) => a.startsWith("--out="));
const outDir = outArg ? outArg.slice(6) : path.join(here, "reports");
const symbols = args.filter((a) => !a.startsWith("--"));
if (flags.has("--no-cache")) process.env.LT_NO_CACHE = "1";
const deps = flags.has("--demo") ? (await import("./data/demo.js")).demoDeps : defaultDeps;

if (!symbols.length) {
  console.error("Usage: npm run lt:scan -- SOFI [AMD SHOP.TO ...] [--json] [--telegram] [--no-cache] [--demo]");
  process.exit(1);
}

fs.mkdirSync(outDir, { recursive: true });
let failed = 0;
for (const symbol of symbols) {
  try {
    const report = await scanTicker(symbol, deps);
    const md = renderMarkdown(report);
    const base = path.join(outDir, report.symbol.replace(/[^A-Z0-9.-]/gi, "_"));
    fs.writeFileSync(`${base}.json`, JSON.stringify(report, null, 2));
    fs.writeFileSync(`${base}.md`, md);
    if (flags.has("--json")) console.log(JSON.stringify(report, null, 2));
    else if (flags.has("--brief")) console.log(renderOneLine(report));
    else console.log(md);
    if (flags.has("--telegram")) {
      await sendTelegram(renderTelegramSummary(report, { title: `On-demand scan: ${report.verdict.action}` }));
      console.error(`Telegram summary sent for ${report.symbol}.`);
    }
    console.error(`Wrote ${base}.md and ${base}.json`);
  } catch (error) {
    failed += 1;
    console.error(`${symbol}: ${error.message}`);
  }
}
process.exitCode = failed && failed === symbols.length ? 1 : 0;
