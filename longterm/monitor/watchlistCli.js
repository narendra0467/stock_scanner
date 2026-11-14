#!/usr/bin/env node
// Usage: npm run lt:watchlist -- list | add SOFI [--holding] [--note="..."] | remove SOFI
import { loadWatchlist, saveWatchlist, addSymbol, removeSymbol, WATCHLIST_PATH } from "./watchlist.js";

const [command, ...rest] = process.argv.slice(2);
const data = loadWatchlist();
const symbols = rest.filter((a) => !a.startsWith("--"));
const holding = rest.includes("--holding");
const noteArg = rest.find((a) => a.startsWith("--note="));

if (command === "add" && symbols.length) {
  for (const symbol of symbols) addSymbol(data, symbol, { holding, note: noteArg ? noteArg.slice(7) : "" });
  saveWatchlist(data);
  console.log(`Added ${symbols.join(", ")} (${data.symbols.length} total).`);
} else if (command === "remove" && symbols.length) {
  for (const symbol of symbols) removeSymbol(data, symbol);
  saveWatchlist(data);
  console.log(`Removed ${symbols.join(", ")} (${data.symbols.length} total).`);
} else {
  console.log(`Watchlist (${WATCHLIST_PATH}): ${data.symbols.length} symbols`);
  for (const entry of data.symbols) console.log(`  ${entry.symbol.padEnd(10)} ${entry.holding ? "[holding]" : "         "} ${entry.note ?? ""}`);
  if (command && command !== "list") console.log("\nUsage: lt:watchlist list | add SYMBOL... [--holding] [--note=text] | remove SYMBOL...");
}
