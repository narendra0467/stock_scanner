// Minimal HTTP helper for the long-term scanner. No dependencies.
// Node's built-in fetch is used; if you run behind a proxy set NODE_USE_ENV_PROXY=1.

const DEFAULT_HEADERS = {
  "User-Agent": "Mozilla/5.0 (long-term-scanner; research use)",
  Accept: "application/json,text/plain,*/*",
};

export class HttpError extends Error {
  constructor(message, status, url) {
    super(message);
    this.status = status;
    this.url = url;
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function fetchText(url, { headers = {}, retries = 2, timeoutMs = 20000, redirect = "follow" } = {}) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { headers: { ...DEFAULT_HEADERS, ...headers }, signal: controller.signal, redirect });
      clearTimeout(timer);
      if (response.status === 429 || response.status >= 500) {
        lastError = new HttpError(`HTTP ${response.status} for ${url}`, response.status, url);
        await sleep(600 * 2 ** attempt);
        continue;
      }
      if (!response.ok) throw new HttpError(`HTTP ${response.status} for ${url}`, response.status, url);
      return { text: await response.text(), response };
    } catch (error) {
      clearTimeout(timer);
      if (error instanceof HttpError && error.status < 500 && error.status !== 429) throw error;
      lastError = error;
      if (attempt < retries) await sleep(600 * 2 ** attempt);
    }
  }
  throw lastError ?? new Error(`request failed: ${url}`);
}

export async function fetchJson(url, options = {}) {
  const { text } = await fetchText(url, options);
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`invalid JSON from ${url}`);
  }
}
