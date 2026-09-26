import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { AlertCircle, Menu, Plus, RefreshCw, Sparkle } from "lucide-react";

import { Sidebar } from "./Sidebar";
import { Composer } from "./Composer";
import { Message } from "./Message";
import { Welcome } from "./Welcome";
import {
  createThread,
  getSessionId,
  getServerSnapshot,
  getThreadsSnapshot,
  setThreads,
  subscribeThreads,
  titleFromMessage,
  updateThreadById,
} from "@/lib/chat-store";
import { sendToWebhook } from "@/lib/webhook";

export function ChatApp({ threadId }) {
  const navigate = useNavigate();
  const threads = useSyncExternalStore(subscribeThreads, getThreadsSnapshot, getServerSnapshot);
  const [hydrated, setHydrated] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const abortRef = useRef(null);
  const scrollRef = useRef(null);
  const sessionId = useMemo(() => (hydrated ? getSessionId() : ""), [hydrated]);

  useEffect(() => {
    setHydrated(true);
  }, []);

  const activeThread = threadId ? threads.find((t) => t.id === threadId) : null;

  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleCreate = useCallback(() => {
    const t = createThread();
    setThreads((prev) => [t, ...prev]);
    setMobileOpen(false);
    navigate({ to: "/c/$threadId", params: { threadId: t.id } });
  }, [navigate]);

  const handleDelete = useCallback((id) => {
    setThreads((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const handleRename = useCallback((id, title) => {
    setThreads((prev) => prev.map((t) => (t.id === id ? { ...t, title } : t)));
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [activeThread?.messages?.length, loading]);

  const doSend = useCallback(
    async (text, targetThreadId, sid) => {
      setError(null);
      setLoading(true);

      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const reply = await sendToWebhook({
          message: text,
          sessionId: sid,
          signal: controller.signal,
        });

        const assistantId = crypto.randomUUID();
        updateThreadById(targetThreadId, (t) => ({
          ...t,
          messages: [
            ...t.messages,
            {
              id: assistantId,
              role: "assistant",
              content: reply,
              timestamp: Date.now(),
              streaming: false,
            },
          ],
        }));
      } catch (e) {
        if (e.name !== "AbortError") {
          setError({
            message: e.message || "Couldn't reach the assistant. Please check your n8n workflow.",
            lastText: text,
            threadId: targetThreadId,
          });
        }
      } finally {
        setLoading(false);
        abortRef.current = null;
      }
    },
    []
  );

  const handledRef = useRef(new Set());

  const handleSubmit = useCallback(async () => {
    const text = input.trim();
    if (!text) return;

    const sid = getSessionId();

    if (!activeThread) {
      // Create thread + user message, then navigate. The new mounted route
      // will pick up the trailing user message and run the send itself,
      // so loading/error state lives on the correct component instance.
      const t = createThread();
      const userMsgId = crypto.randomUUID();
      t.title = titleFromMessage(text);
      t.messages = [
        { id: userMsgId, role: "user", content: text, timestamp: Date.now() },
      ];
      setInput("");
      setThreads((prev) => [t, ...prev]);
      navigate({ to: "/c/$threadId", params: { threadId: t.id } });
      return;
    }

    if (activeThread.messages.length === 0) {
      updateThreadById(threadId, (t) => ({ ...t, title: titleFromMessage(text) }));
    }
    const userMsgId = crypto.randomUUID();
    updateThreadById(threadId, (t) => ({
      ...t,
      messages: [
        ...t.messages,
        { id: userMsgId, role: "user", content: text, timestamp: Date.now() },
      ],
    }));
    handledRef.current.add(userMsgId);
    setInput("");
    doSend(text, threadId, sid);
  }, [input, activeThread, threadId, doSend, navigate]);

  // Auto-run send when we arrive at a route whose last message is a user
  // message with no assistant reply yet (e.g. right after navigating from `/`).
  useEffect(() => {
    if (!activeThread || activeThread.messages.length === 0) return;
    const last = activeThread.messages[activeThread.messages.length - 1];
    if (last.role !== "user") return;
    if (handledRef.current.has(last.id)) return;
    handledRef.current.add(last.id);
    doSend(last.content, activeThread.id, getSessionId());
  }, [activeThread, doSend]);


  const handleStop = () => {
    abortRef.current?.abort();
    setLoading(false);
  };

  const handleRetry = () => {
    if (!error) return;
    const { lastText, threadId: tid } = error;
    setError(null);
    doSend(lastText, tid, getSessionId());
  };

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-[#0B0B0B] text-foreground">
      <div className="hidden md:flex h-full">
        <Sidebar
          threads={threads}
          activeId={threadId}
          onCreate={handleCreate}
          onDelete={handleDelete}
          onRename={handleRename}
          collapsed={collapsed}
          onToggle={() => setCollapsed((c) => !c)}
        />
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute left-0 top-0 h-full">
            <Sidebar
              threads={threads}
              activeId={threadId}
              onCreate={handleCreate}
              onDelete={handleDelete}
              onRename={handleRename}
              collapsed={false}
              onToggle={() => setMobileOpen(false)}
            />
          </div>
        </div>
      )}

      <main className="relative flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-white/5 px-3 py-2.5 md:px-5">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMobileOpen(true)}
              className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-white/5 md:hidden"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-white/20 to-white/5 border border-white/10">
              <Sparkle className="h-3.5 w-3.5" />
            </div>
            <h1 className="text-sm font-semibold tracking-tight">Smart Genius Assistant</h1>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleCreate}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-xs font-medium hover:bg-white/[0.07] transition"
            >
              <Plus className="h-3.5 w-3.5" />
              New chat
            </button>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-white/25 to-white/5 border border-white/10 text-xs font-medium">
              SG
            </div>
          </div>
        </header>

        <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-thin">
          {!activeThread || activeThread.messages.length === 0 ? (
            <div className="flex min-h-full flex-col items-center justify-center px-4 py-16">
              <Welcome />
              <div className="mt-10 w-full max-w-2xl">
                <Composer
                  value={input}
                  onChange={setInput}
                  onSubmit={handleSubmit}
                  onStop={handleStop}
                  disabled={loading}
                  loading={loading}
                />
              </div>
            </div>
          ) : (
            <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 md:px-6">
              {activeThread.messages.map((m) => (
                <Message
                  key={m.id}
                  role={m.role}
                  content={m.content}
                  timestamp={m.timestamp}
                  streaming={m.streaming}
                />
              ))}
              {loading && !activeThread.messages.some((m) => m.streaming) && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center gap-3 text-muted-foreground"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-white/15 to-white/5 border border-white/10">
                    <Sparkle className="h-4 w-4" />
                  </div>
                  <div className="flex gap-1.5">
                    <span className="h-2 w-2 animate-bounce rounded-full bg-white/60 [animation-delay:-0.3s]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-white/60 [animation-delay:-0.15s]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-white/60" />
                  </div>
                </motion.div>
              )}
              {error && (
                <div className="flex items-center justify-between gap-3 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm">
                  <div className="flex items-center gap-2 text-red-300">
                    <AlertCircle className="h-4 w-4" />
                    <span>{error.message}</span>
                  </div>
                  <button
                    onClick={handleRetry}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-white text-black px-2.5 py-1.5 text-xs font-medium hover:bg-white/90 transition"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Retry
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {activeThread && activeThread.messages.length > 0 && (
          <div className="border-t border-white/5 bg-gradient-to-t from-[#0B0B0B] to-[#0B0B0B]/80 px-3 pb-4 pt-3 md:px-6">
            <div className="mx-auto w-full max-w-3xl">
              <Composer
                value={input}
                onChange={setInput}
                onSubmit={handleSubmit}
                onStop={handleStop}
                disabled={loading}
                loading={loading}
              />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
