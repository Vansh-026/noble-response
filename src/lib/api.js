// API Client for IntelliChat v1 with JWT token refresh rotation and SSE streaming support

let currentAccessToken = null;

export function setAccessToken(token) {
  currentAccessToken = token;
}

export function getAccessToken() {
  return currentAccessToken;
}

let isRefreshing = false;
let refreshSubscribers = [];

function subscribeTokenRefresh(cb) {
  refreshSubscribers.push(cb);
}

function onRefreshed(token) {
  refreshSubscribers.forEach((cb) => cb(token));
  refreshSubscribers = [];
}

async function refreshAccessToken() {
  try {
    const res = await fetch("/api/v1/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    });

    if (!res.ok) {
      setAccessToken(null);
      return null;
    }

    const data = await res.json();
    if (data.success && data.data?.accessToken) {
      setAccessToken(data.data.accessToken);
      return data.data.accessToken;
    }
    return null;
  } catch (err) {
    setAccessToken(null);
    return null;
  }
}

export async function apiFetch(endpoint, options = {}) {
  const url = endpoint.startsWith("/api") ? endpoint : `/api/v1${endpoint}`;
  const headers = { ...options.headers };

  // If not FormData, default to application/json
  if (!(options.body instanceof FormData) && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  // Attach Authorization header if access token exists
  if (currentAccessToken && !headers["Authorization"]) {
    headers["Authorization"] = `Bearer ${currentAccessToken}`;
  }

  const config = {
    ...options,
    headers,
    credentials: "include", // Ensure refreshToken cookie is sent
  };

  let res = await fetch(url, config);

  // If unauthorized (401), attempt token refresh rotation and retry request
  if (res.status === 401 && !url.includes("/auth/login") && !url.includes("/auth/refresh")) {
    if (!isRefreshing) {
      isRefreshing = true;
      const newToken = await refreshAccessToken();
      isRefreshing = false;
      onRefreshed(newToken);

      if (newToken) {
        headers["Authorization"] = `Bearer ${newToken}`;
        return await fetch(url, { ...config, headers });
      }
    } else {
      // Wait for existing refresh to resolve
      const retryPromise = new Promise((resolve) => {
        subscribeTokenRefresh((newToken) => {
          if (newToken) {
            headers["Authorization"] = `Bearer ${newToken}`;
            resolve(fetch(url, { ...config, headers }));
          } else {
            resolve(res);
          }
        });
      });
      res = await retryPromise;
    }
  }

  // Parse JSON response or throw formatted error
  const contentType = res.headers.get("content-type") || "";
  let json;
  if (contentType.includes("application/json")) {
    json = await res.json();
  } else {
    const text = await res.text();
    try {
      json = JSON.parse(text);
    } catch {
      json = { success: res.ok, message: text };
    }
  }

  if (!res.ok) {
    const errMessage =
      json?.error?.message || json?.message || `Request failed with status ${res.status}`;
    const err = new Error(errMessage);
    err.code = json?.error?.code || "REQUEST_FAILED";
    err.status = res.status;
    err.details = json?.error?.details || [];
    throw err;
  }

  return json;
}

// Auth API
export const authApi = {
  async register({ name, email, password }) {
    const res = await apiFetch("/auth/register", {
      method: "POST",
      body: JSON.stringify({ name, email, password }),
    });
    if (res.data?.accessToken) setAccessToken(res.data.accessToken);
    return res.data;
  },

  async login({ email, password }) {
    const res = await apiFetch("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    if (res.data?.accessToken) setAccessToken(res.data.accessToken);
    return res.data;
  },

  async getMe() {
    // If no token in memory, try refreshing first from cookie
    if (!currentAccessToken) {
      const newToken = await refreshAccessToken();
      if (!newToken) return null;
    }
    const res = await apiFetch("/auth/me");
    return res.data?.user || null;
  },

  async logout() {
    try {
      await apiFetch("/auth/logout", { method: "POST" });
    } catch {
      // Ignore network errors on logout
    }
    setAccessToken(null);
  },

  async forgotPassword(email) {
    return await apiFetch("/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
  },

  async resetPassword({ token, newPassword }) {
    return await apiFetch("/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ token, newPassword }),
    });
  },
};

// Conversations API
export const conversationsApi = {
  async list({ cursor, limit = 40, search = "", trash = false } = {}) {
    const params = new URLSearchParams();
    if (cursor) params.set("cursor", cursor);
    if (limit) params.set("limit", limit.toString());
    if (search) params.set("search", search);
    if (trash) params.set("trash", "true");

    const res = await apiFetch(`/conversations?${params.toString()}`);
    return res.data?.items || [];
  },

  async get(id) {
    const res = await apiFetch(`/conversations/${id}`);
    return res.data;
  },

  async create({ title = "New chat", model = "n8n-genius" } = {}) {
    const res = await apiFetch("/conversations", {
      method: "POST",
      body: JSON.stringify({ title, model }),
    });
    return res.data;
  },

  async rename(id, title) {
    const res = await apiFetch(`/conversations/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ title }),
    });
    return res.data;
  },

  async delete(id, { permanent = false } = {}) {
    const query = permanent ? "?permanent=true" : "";
    const res = await apiFetch(`/conversations/${id}${query}`, {
      method: "DELETE",
    });
    return res.data;
  },

  async restore(id) {
    const res = await apiFetch(`/conversations/${id}/restore`, {
      method: "POST",
    });
    return res.data;
  },

  async emptyTrash() {
    const res = await apiFetch("/conversations/trash", {
      method: "DELETE",
    });
    return res.data;
  },
};

// Messages API
export const messagesApi = {
  async list(conversationId, { cursor, limit = 50 } = {}) {
    const params = new URLSearchParams();
    if (cursor) params.set("cursor", cursor);
    if (limit) params.set("limit", limit.toString());

    const res = await apiFetch(`/conversations/${conversationId}/messages?${params.toString()}`);
    return res.data?.items || [];
  },

  /**
   * Submit message with Server-Sent Events (SSE) streaming support
   */
  async sendStream(
    conversationId,
    { content, attachmentIds = [], model = "n8n-genius" },
    { onStart, onDelta, onComplete, onError, signal },
  ) {
    const url = `/api/v1/conversations/${conversationId}/messages`;
    const headers = {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    };

    if (currentAccessToken) {
      headers["Authorization"] = `Bearer ${currentAccessToken}`;
    }

    try {
      const response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify({
          content,
          attachmentIds,
          model,
          stream: true,
        }),
        credentials: "include",
        signal,
      });

      if (!response.ok) {
        let errJson;
        try {
          errJson = await response.json();
        } catch {
          errJson = { error: { message: response.statusText } };
        }
        throw new Error(errJson?.error?.message || `HTTP error ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const block of lines) {
          if (!block.trim()) continue;

          let eventName = "message";
          let dataStr = "";

          const blockLines = block.split("\n");
          for (const line of blockLines) {
            if (line.startsWith("event:")) {
              eventName = line.replace("event:", "").trim();
            } else if (line.startsWith("data:")) {
              dataStr = line.replace("data:", "").trim();
            }
          }

          if (dataStr) {
            try {
              const parsedData = JSON.parse(dataStr);
              if (eventName === "message.start") {
                onStart?.(parsedData);
              } else if (eventName === "message.delta") {
                onDelta?.(parsedData.delta, parsedData.accumulated);
              } else if (eventName === "message.complete") {
                onComplete?.(parsedData.content, parsedData.message);
              } else if (eventName === "message.error") {
                onError?.(new Error(parsedData.error || "Generation error"));
              }
            } catch (pErr) {
              console.warn("Failed to parse SSE line:", pErr);
            }
          }
        }
      }
    } catch (err) {
      if (err.name !== "AbortError") {
        onError?.(err);
      }
    }
  },

  async edit(messageId, content) {
    const res = await apiFetch(`/messages/${messageId}`, {
      method: "PATCH",
      body: JSON.stringify({ content }),
    });
    return res.data;
  },

  async regenerate(messageId, { onStart, onDelta, onComplete, onError, signal }) {
    const url = `/api/v1/messages/${messageId}/regenerate?stream=true`;
    const headers = {
      Accept: "text/event-stream",
    };
    if (currentAccessToken) {
      headers["Authorization"] = `Bearer ${currentAccessToken}`;
    }

    try {
      const response = await fetch(url, {
        method: "POST",
        headers,
        credentials: "include",
        signal,
      });

      if (!response.ok) {
        throw new Error(`Regenerate failed (${response.status})`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const block of lines) {
          if (!block.trim()) continue;
          let eventName = "message";
          let dataStr = "";
          for (const line of block.split("\n")) {
            if (line.startsWith("event:")) eventName = line.replace("event:", "").trim();
            if (line.startsWith("data:")) dataStr = line.replace("data:", "").trim();
          }

          if (dataStr) {
            try {
              const parsed = JSON.parse(dataStr);
              if (eventName === "message.start") onStart?.(parsed);
              if (eventName === "message.delta") onDelta?.(parsed.delta, parsed.accumulated);
              if (eventName === "message.complete") onComplete?.(parsed.content, parsed.message);
              if (eventName === "message.error") onError?.(new Error(parsed.error));
            } catch {}
          }
        }
      }
    } catch (err) {
      if (err.name !== "AbortError") onError?.(err);
    }
  },

  async feedback(messageId, rating) {
    const res = await apiFetch(`/messages/${messageId}/feedback`, {
      method: "POST",
      body: JSON.stringify({ rating }),
    });
    return res.data;
  },

  async cancelGeneration(generationId) {
    const res = await apiFetch(`/generations/${generationId}/cancel`, {
      method: "POST",
    });
    return res.data;
  },
};

// Files API
export const filesApi = {
  async upload(file) {
    const formData = new FormData();
    formData.append("file", file);

    const res = await apiFetch("/files/upload", {
      method: "POST",
      body: formData,
    });
    return res.data;
  },

  async get(fileId) {
    const res = await apiFetch(`/files/${fileId}`);
    return res.data;
  },

  async delete(fileId) {
    const res = await apiFetch(`/files/${fileId}`, {
      method: "DELETE",
    });
    return res.data;
  },

  getDownloadUrl(fileId) {
    return `/api/v1/files/${fileId}/download`;
  },
};
