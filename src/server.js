import "./lib/error-capture";
import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

let serverEntryPromise;

async function getServerEntry() {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => m.default ?? m
    );
  }
  return serverEntryPromise;
}

async function handleApiChat(request) {
  try {
    const bodyText = await request.text();
    const headers = { "Content-Type": "application/json" };
    const primaryUrl = process.env.VITE_N8N_WEBHOOK_URL || "https://n8n-v3-tjln.onrender.com/webhook/mychatapp";
    const fallbackUrl = primaryUrl.includes("/webhook/")
      ? primaryUrl.replace("/webhook/", "/webhook-test/")
      : primaryUrl.replace("/webhook-test/", "/webhook/");

    let n8nRes = await fetch(primaryUrl, {
      method: "POST",
      headers,
      body: bodyText,
    });

    if (n8nRes.status === 404) {
      const altRes = await fetch(fallbackUrl, {
        method: "POST",
        headers,
        body: bodyText,
      });
      if (altRes.ok || altRes.status !== 404) {
        n8nRes = altRes;
      }
    }

    const resText = await n8nRes.text();
    return new Response(resText, {
      status: n8nRes.status,
      headers: {
        "Content-Type": n8nRes.headers.get("content-type") || "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({
        message: "Failed to connect to n8n server: " + (err.message || String(err)),
      }),
      {
        status: 502,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      }
    );
  }
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response) {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body) {
  try {
    const payload = JSON.parse(body);
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === "/api/chat" && request.method === "POST") {
      return await handleApiChat(request);
    }

    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
