const KEY = "sga.threads.v1";
const SESSION_KEY = "sga.sessionId.v1";

function safeParse(str, fallback) {
  try { return JSON.parse(str) ?? fallback; } catch { return fallback; }
}

export function loadThreads() {
  if (typeof window === "undefined") return [];
  return safeParse(window.localStorage.getItem(KEY), []);
}

export function saveThreads(threads) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(threads));
}

export function getSessionId() {
  if (typeof window === "undefined") return "server";
  let id = window.localStorage.getItem(SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID();
    window.localStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

export function createThread() {
  return {
    id: crypto.randomUUID(),
    title: "New chat",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    messages: [],
  };
}

export function titleFromMessage(text) {
  const t = text.trim().replace(/\s+/g, " ");
  return t.length > 42 ? t.slice(0, 42) + "…" : t || "New chat";
}

// Module-level store so async work survives route remounts.
let _threads = typeof window === "undefined" ? [] : loadThreads();
const _listeners = new Set();
const _serverSnap = [];

export function getThreadsSnapshot() {
  return _threads;
}
export function getServerSnapshot() {
  return _serverSnap;
}
export function subscribeThreads(fn) {
  _listeners.add(fn);
  return () => _listeners.delete(fn);
}
export function setThreads(updater) {
  const next = typeof updater === "function" ? updater(_threads) : updater;
  _threads = next;
  saveThreads(next);
  _listeners.forEach((l) => l());
}
export function updateThreadById(id, updater) {
  setThreads((prev) =>
    prev.map((t) => (t.id === id ? { ...updater(t), updatedAt: Date.now() } : t))
  );
}
