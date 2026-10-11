import { config } from "../config.js";

// Active generations map: generationId -> AbortController
const activeGenerations = new Map();

export function registerGeneration(generationId, controller) {
  activeGenerations.set(generationId, controller);
}

export function cancelGeneration(generationId) {
  const controller = activeGenerations.get(generationId);
  if (controller) {
    controller.abort();
    activeGenerations.delete(generationId);
    return true;
  }
  return false;
}

export function removeGeneration(generationId) {
  activeGenerations.delete(generationId);
}

export function generateTitle(text) {
  const clean = (text || "").replace(/\s+/g, " ").trim();
  if (!clean) return "New chat";
  if (clean.length <= 40) return clean;
  return clean.slice(0, 40) + "…";
}

export async function callAiBackend({
  message,
  sessionId,
  attachments = [],
  customInstructions,
  userBio,
  signal,
}) {
  // Build composite prompt if instructions or attachments are present
  let promptText = message;
  let instructionsPrefix = "";
  if (userBio && userBio.trim()) {
    instructionsPrefix += `[User Profile]:\n${userBio.trim()}\n\n`;
  }
  if (customInstructions && customInstructions.trim()) {
    instructionsPrefix += `[Custom Instructions]:\n${customInstructions.trim()}\n\n`;
  }
  if (instructionsPrefix) {
    promptText = `${instructionsPrefix}${promptText}`;
  }

  if (attachments && attachments.length > 0) {
    const attachmentContext = attachments
      .map((att) => {
        const textContent = att.extractedText
          ? `\n--- Content of ${att.originalName} ---\n${att.extractedText}\n--- End of file ---\n`
          : `\n[Attached File: ${att.originalName} (${att.mimeType}, ${(att.size / 1024).toFixed(1)} KB)]`;
        return textContent;
      })
      .join("\n");

    promptText = `${promptText}\n\n[Attached Files & Context]:\n${attachmentContext}`;
  }

  const primaryUrl = config.VITE_N8N_WEBHOOK_URL;
  const fallbackUrl = primaryUrl.includes("/webhook/")
    ? primaryUrl.replace("/webhook/", "/webhook-test/")
    : primaryUrl.replace("/webhook-test/", "/webhook/");

  const payload = JSON.stringify({
    message: promptText,
    sessionId: sessionId || "default-session",
    timestamp: new Date().toISOString(),
  });

  const headers = { "Content-Type": "application/json" };

  let res;
  try {
    res = await fetch(primaryUrl, {
      method: "POST",
      headers,
      body: payload,
      signal,
    });

    if (res.status === 404) {
      const altRes = await fetch(fallbackUrl, {
        method: "POST",
        headers,
        body: payload,
        signal,
      });
      if (altRes.ok || altRes.status !== 404) {
        res = altRes;
      }
    }
  } catch (fetchErr) {
    if (fetchErr.name === "AbortError") throw fetchErr;
    console.warn(`[AiService] Primary webhook fetch error: ${fetchErr.message}`);
    // Provide a smart conversational fallback if n8n is temporarily unreachable
    return `I received your message: "${message}". Note: The n8n automation webhook reported: "${fetchErr.message}". Please verify your n8n workflow status or connectivity.`;
  }

  const bodyText = await res.text();
  let parsed;
  try {
    parsed = JSON.parse(bodyText);
  } catch {
    parsed = bodyText;
  }

  if (!res.ok) {
    const msg =
      typeof parsed === "object" && parsed !== null
        ? parsed.message || parsed.error || JSON.stringify(parsed)
        : `Server returned status ${res.status}`;
    throw new Error(`AI Provider error (${res.status}): ${msg}`);
  }

  return extractOutputText(parsed);
}

function extractOutputText(data) {
  if (data == null) return "";
  if (typeof data === "string") return data;
  if (typeof data === "object") {
    if (typeof data.output === "string") return data.output;
    if (typeof data.response === "string") return data.response;
    if (typeof data.message === "string") return data.message;
    if (typeof data.text === "string") return data.text;
    if (Array.isArray(data) && data.length) {
      if (typeof data[0] === "string") return data[0];
      if (typeof data[0] === "object") return extractOutputText(data[0]);
    }
    if (data.hint && data.message) {
      return `${data.message}\n\nHint: ${data.hint}`;
    }
    return JSON.stringify(data, null, 2);
  }
  return String(data);
}

/**
 * Stream text as SSE chunks to response stream
 */
export async function streamTextToSSE(res, fullText, { generationId, messageId, onComplete }) {
  // Helper to send SSE event
  const sendEvent = (event, data) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  sendEvent("message.start", { generationId, messageId });

  // Stream in realistic word/character chunks with micro-delays
  const words = fullText.split(/(\s+)/);
  let accumulated = "";

  for (let i = 0; i < words.length; i++) {
    const chunk = words[i];
    accumulated += chunk;
    sendEvent("message.delta", { delta: chunk, accumulated });

    // Micro-delay between tokens for smooth streaming effect
    if (i % 3 === 0 && i < words.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 15));
    }
  }

  const completedMessage = await onComplete(accumulated);
  sendEvent("message.complete", {
    content: accumulated,
    message: completedMessage,
  });
  res.end();
}
