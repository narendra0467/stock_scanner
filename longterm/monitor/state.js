import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
export const STATE_PATH = process.env.LT_STATE || path.resolve(here, "..", "state", "alert_state.json");

export function loadState(file = STATE_PATH) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return { updated: null, symbols: {} };
  }
}

export function saveState(state, file = STATE_PATH) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify({ ...state, updated: new Date().toISOString() }, null, 2)}\n`);
}
