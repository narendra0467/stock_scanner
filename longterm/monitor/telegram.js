// Telegram Bot API sender. Needs TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID.
export async function sendTelegram(text, { token = process.env.TELEGRAM_BOT_TOKEN, chatId = process.env.TELEGRAM_CHAT_ID, fetchImpl = fetch } = {}) {
  if (!token || !chatId) throw new Error("TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID must be set");
  const chunks = splitMessage(text, 3900);
  for (const chunk of chunks) {
    const response = await fetchImpl(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: chunk, parse_mode: "HTML", disable_web_page_preview: true }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.ok === false) throw new Error(`Telegram error ${response.status}: ${payload.description ?? "unknown"}`);
  }
  return chunks.length;
}

export function splitMessage(text, limit) {
  if (text.length <= limit) return [text];
  const out = [];
  let current = "";
  for (const line of text.split("\n")) {
    if ((current + line).length + 1 > limit) { out.push(current); current = ""; }
    current += (current ? "\n" : "") + line;
  }
  if (current) out.push(current);
  return out;
}

export function telegramConfigured() {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID);
}
