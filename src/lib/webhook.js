const WEBHOOK_URL = "https://protozoan-deck-antiques.ngrok-free.dev/webhook/ca7456fb-42a7-4015-96b5-f2fb2e76b363";

export function extractResponse(data) {
  if (data == null) return "";
  if (typeof data === "string") return data;
  if (typeof data === "object") {
    if (typeof data.response === "string") return data.response;
    if (typeof data.message === "string") return data.message;
    if (typeof data.output === "string") return data.output;
    if (typeof data.text === "string") return data.text;
    if (Array.isArray(data) && data.length && typeof data[0] === "object") {
      return extractResponse(data[0]);
    }
    return JSON.stringify(data, null, 2);
  }
  return String(data);
}

export async function sendToWebhook({ message, sessionId, signal }) {
  const res = await fetch(WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      timestamp: new Date().toISOString(),
      sessionId,
    }),
    signal,
  });
  if (!res.ok) throw new Error(`Webhook error ${res.status}`);
  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const data = await res.json();
    return extractResponse(data);
  }
  const text = await res.text();
  try { return extractResponse(JSON.parse(text)); } catch { return text; }
}
