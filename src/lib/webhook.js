export function extractResponse(data) {
  if (data == null) return "";
  if (typeof data === "string") return data;
  if (typeof data === "object") {
    if (typeof data.response === "string") return data.response;
    if (typeof data.message === "string") return data.message;
    if (typeof data.output === "string") return data.output;
    if (typeof data.text === "string") return data.text;
    if (Array.isArray(data) && data.length) {
      if (typeof data[0] === "string") return data[0];
      if (typeof data[0] === "object") return extractResponse(data[0]);
    }
    if (data.hint && data.message) {
      return `${data.message}\n\nHint: ${data.hint}`;
    }
    return JSON.stringify(data, null, 2);
  }
  return String(data);
}

export async function sendToWebhook({ message, sessionId, signal }) {
  const payload = JSON.stringify({
    message,
    timestamp: new Date().toISOString(),
    sessionId,
  });

  let res;
  try {
    // Post to local /api/chat endpoint to eliminate browser CORS / "Failed to fetch"
    res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
      signal,
    });
  } catch (err) {
    // Fallback direct URL if local route is unavailable
    const directUrl =
      (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_N8N_WEBHOOK_URL) ||
      "https://n8n-v3-tjln.onrender.com/webhook/mychatapp";
    res = await fetch(directUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
      signal,
    });
  }

  const contentType = res.headers.get("content-type") || "";
  let bodyText = await res.text();
  let parsedData;
  try {
    parsedData = JSON.parse(bodyText);
  } catch {
    parsedData = bodyText;
  }

  if (!res.ok) {
    if (typeof parsedData === "object" && parsedData !== null && parsedData.message) {
      const hintMsg = parsedData.hint ? `\n\nHint: ${parsedData.hint}` : "";
      throw new Error(`${parsedData.message}${hintMsg}`);
    }
    throw new Error(`n8n webhook error ${res.status}: ${res.statusText || "Not Found"}`);
  }

  return extractResponse(parsedData);
}
