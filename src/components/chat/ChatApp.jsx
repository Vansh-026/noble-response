import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertCircle,
  Menu,
  Plus,
  RefreshCw,
  Sparkle,
  LogIn,
  Sun,
  Moon,
  LogOut,
  Settings,
} from "lucide-react";

import { Sidebar } from "./Sidebar";
import { Composer } from "./Composer";
import { Message } from "./Message";
import { Welcome } from "./Welcome";
import { AuthModal } from "@/components/auth/AuthModal";
import { SettingsModal } from "@/components/settings/SettingsModal";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { useSettings } from "@/context/SettingsContext";
import { conversationsApi, messagesApi } from "@/lib/api";
import {
  loadThreads,
  saveThreads,
  createThread,
  getSessionId,
  titleFromMessage,
} from "@/lib/chat-store";

export function ChatApp({ threadId }) {
  const navigate = useNavigate();
  const { user, isAuthenticated, openAuthModal, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { settings, openSettings } = useSettings();

  const [threads, setThreads] = useState(() =>
    typeof window !== "undefined" ? loadThreads() : [],
  );
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [currentGenerationId, setCurrentGenerationId] = useState(null);
  const [error, setError] = useState(null);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const abortRef = useRef(null);
  const scrollRef = useRef(null);

  // 1. Load threads from Server if authenticated, otherwise fallback to local storage
  const fetchThreads = useCallback(async () => {
    if (isAuthenticated) {
      try {
        const serverThreads = await conversationsApi.list();
        setThreads(serverThreads);
        saveThreads(serverThreads);
      } catch (err) {
        console.warn("Failed to load server conversations:", err);
      }
    } else {
      setThreads(loadThreads());
    }
  }, [isAuthenticated]);

  useEffect(() => {
    fetchThreads();
  }, [fetchThreads]);

  // Active thread lookup
  const activeThread = useMemo(() => {
    return threadId ? threads.find((t) => t.id === threadId) : null;
  }, [threads, threadId]);

  // 2. Load messages for active thread
  useEffect(() => {
    let active = true;
    async function loadConversationMessages() {
      if (!threadId) {
        setMessages([]);
        return;
      }

      if (isAuthenticated) {
        try {
          const remoteMsgs = await messagesApi.list(threadId);
          if (active) setMessages(remoteMsgs);
        } catch (err) {
          console.warn("Failed to load messages from server, falling back:", err);
          const local = threads.find((t) => t.id === threadId);
          if (active && local?.messages) setMessages(local.messages);
        }
      } else {
        const local = threads.find((t) => t.id === threadId);
        if (active) setMessages(local?.messages || []);
      }
    }

    loadConversationMessages();
    return () => {
      active = false;
    };
  }, [threadId, isAuthenticated]);

  // Auto-scroll on new messages or during generation
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages.length, loading]);

  // Create new thread
  const handleCreate = useCallback(async () => {
    setError(null);
    setMobileOpen(false);

    if (isAuthenticated) {
      try {
        const newConv = await conversationsApi.create({ title: "New chat" });
        setThreads((prev) => [newConv, ...prev.filter((t) => t.id !== newConv.id)]);
        navigate({ to: "/c/$threadId", params: { threadId: newConv.id } });
        return;
      } catch (err) {
        console.warn("Server conversation create failed, using local fallback:", err);
      }
    }

    const localT = createThread();
    setThreads((prev) => [localT, ...prev]);
    saveThreads([localT, ...threads]);
    navigate({ to: "/c/$threadId", params: { threadId: localT.id } });
  }, [isAuthenticated, navigate, threads]);

  // Delete thread
  const handleDelete = useCallback(
    async (id) => {
      setThreads((prev) => prev.filter((t) => t.id !== id));
      if (isAuthenticated) {
        try {
          await conversationsApi.delete(id);
        } catch (err) {
          console.warn("Server delete failed:", err);
        }
      } else {
        saveThreads(threads.filter((t) => t.id !== id));
      }
    },
    [isAuthenticated, threads],
  );

  // Rename thread
  const handleRename = useCallback(
    async (id, title) => {
      setThreads((prev) =>
        prev.map((t) => (t.id === id ? { ...t, title, titleSource: "user" } : t)),
      );
      if (isAuthenticated) {
        try {
          await conversationsApi.rename(id, title);
        } catch (err) {
          console.warn("Server rename failed:", err);
        }
      } else {
        saveThreads(threads.map((t) => (t.id === id ? { ...t, title, titleSource: "user" } : t)));
      }
    },
    [isAuthenticated, threads],
  );

  // Stop ongoing generation
  const handleStop = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
    }
    if (currentGenerationId && isAuthenticated) {
      messagesApi.cancelGeneration(currentGenerationId);
    }
    setLoading(false);
  }, [currentGenerationId, isAuthenticated]);

  // Submit user message and stream assistant reply
  const handleSubmit = useCallback(
    async (text, attachments = []) => {
      const content = text.trim();
      if (!content && attachments.length === 0) return;

      setError(null);
      let targetThreadId = threadId;

      // 1. If currently on '/' without a thread, create one first
      if (!targetThreadId) {
        if (isAuthenticated) {
          try {
            const newConv = await conversationsApi.create({
              title: titleFromMessage(content || attachments[0]?.originalName),
            });
            targetThreadId = newConv.id;
            setThreads((prev) => [newConv, ...prev]);
            navigate({ to: "/c/$threadId", params: { threadId: newConv.id } });
          } catch (err) {
            console.warn("Failed creating remote thread:", err);
            const localT = createThread();
            localT.title = titleFromMessage(content || attachments[0]?.originalName);
            targetThreadId = localT.id;
            setThreads((prev) => [localT, ...prev]);
            navigate({ to: "/c/$threadId", params: { threadId: localT.id } });
          }
        } else {
          const localT = createThread();
          localT.title = titleFromMessage(content || attachments[0]?.originalName);
          targetThreadId = localT.id;
          setThreads((prev) => [localT, ...prev]);
          navigate({ to: "/c/$threadId", params: { threadId: localT.id } });
        }
      }

      // 2. Append optimistic user message
      const userMessageId = crypto.randomUUID();
      const userMessage = {
        id: userMessageId,
        role: "user",
        content: content || "[Attached files]",
        attachments,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setInput("");
      setLoading(true);

      const controller = new AbortController();
      abortRef.current = controller;

      // Temporary assistant streaming placeholder
      const assistantMessageId = crypto.randomUUID();
      setMessages((prev) => [
        ...prev,
        {
          id: assistantMessageId,
          role: "assistant",
          content: "",
          streaming: true,
          timestamp: Date.now(),
        },
      ]);

      try {
        await messagesApi.sendStream(
          targetThreadId,
          {
            content,
            attachmentIds: attachments.map((a) => a.id),
            customInstructions: settings.customInstructions || undefined,
            userBio: settings.userBio || undefined,
            stream: settings.streamingEnabled !== false,
          },
          {
            signal: controller.signal,
            onStart: ({ generationId }) => {
              setCurrentGenerationId(generationId);
            },
            onDelta: (delta, accumulated) => {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMessageId ? { ...m, content: accumulated, streaming: true } : m,
                ),
              );
            },
            onComplete: (finalContent, savedMessage) => {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMessageId
                    ? {
                        ...m,
                        id: savedMessage?.id || assistantMessageId,
                        content: finalContent,
                        streaming: false,
                      }
                    : m,
                ),
              );
              // Update thread preview and title in sidebar
              setThreads((prev) =>
                prev.map((t) =>
                  t.id === targetThreadId
                    ? {
                        ...t,
                        title:
                          t.titleSource === "default" || t.title === "New chat"
                            ? titleFromMessage(content || attachments[0]?.originalName)
                            : t.title,
                        lastMessagePreview: finalContent.slice(0, 80),
                        updatedAt: Date.now(),
                      }
                    : t,
                ),
              );
            },
            onError: (err) => {
              setError({
                message: err.message || "Failed to generate AI response.",
                lastText: content,
                threadId: targetThreadId,
              });
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMessageId
                    ? {
                        ...m,
                        content:
                          m.content ||
                          "⚠️ Error reaching the AI assistant. Please check your connection or n8n workflow.",
                        streaming: false,
                      }
                    : m,
                ),
              );
            },
          },
        );
      } catch (err) {
        if (err.name !== "AbortError") {
          setError({
            message: err.message || "Network error. Please try again.",
            lastText: content,
            threadId: targetThreadId,
          });
        }
      } finally {
        setLoading(false);
        abortRef.current = null;
        setCurrentGenerationId(null);
      }
    },
    [threadId, isAuthenticated, navigate],
  );

  // Regenerate assistant reply
  const handleRegenerate = useCallback(async (messageId) => {
    setError(null);
    setLoading(true);

    const controller = new AbortController();
    abortRef.current = controller;

    // Add fresh assistant response
    const assistantId = crypto.randomUUID();
    setMessages((prev) => [
      ...prev,
      {
        id: assistantId,
        role: "assistant",
        content: "",
        streaming: true,
        timestamp: Date.now(),
      },
    ]);

    try {
      await messagesApi.regenerate(messageId, {
        signal: controller.signal,
        onStart: ({ generationId }) => {
          setCurrentGenerationId(generationId);
        },
        onDelta: (delta, accumulated) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, content: accumulated, streaming: true } : m,
            ),
          );
        },
        onComplete: (finalContent, savedMsg) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? {
                    ...m,
                    id: savedMsg?.id || assistantId,
                    content: finalContent,
                    streaming: false,
                  }
                : m,
            ),
          );
        },
        onError: (err) => {
          setError({ message: err.message });
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, content: "⚠️ Regeneration failed.", streaming: false }
                : m,
            ),
          );
        },
      });
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  }, []);

  // Edit user message
  const handleEdit = useCallback(
    async (messageId, newContent) => {
      if (!newContent) return;
      try {
        if (isAuthenticated) {
          await messagesApi.edit(messageId, newContent);
        }
        setMessages((prev) =>
          prev.map((m) => (m.id === messageId ? { ...m, content: newContent } : m)),
        );
        // Automatically regenerate response for the updated message
        await handleRegenerate(messageId);
      } catch (err) {
        setError({ message: err.message || "Failed to update message." });
      }
    },
    [isAuthenticated, handleRegenerate],
  );

  // Message feedback (thumbs up / thumbs down)
  const handleFeedback = useCallback(
    async (messageId, rating) => {
      try {
        if (isAuthenticated) {
          await messagesApi.feedback(messageId, rating);
        }
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId ? { ...m, feedback: { rating, updatedAt: Date.now() } } : m,
          ),
        );
      } catch (err) {
        console.warn("Feedback error:", err);
      }
    },
    [isAuthenticated],
  );

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-background text-foreground transition-colors">
      {/* Desktop Sidebar */}
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

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute left-0 top-0 h-full shadow-2xl">
            <Sidebar
              threads={threads}
              activeId={threadId}
              onCreate={handleCreate}
              onDelete={handleDelete}
              onRename={handleRename}
              collapsed={false}
              onToggle={() => setMobileOpen(false)}
              onCloseMobile={() => setMobileOpen(false)}
            />
          </div>
        </div>
      )}

      {/* Main Chat Workspace */}
      <main className="relative flex min-w-0 flex-1 flex-col">
        {/* Top Header */}
        <header className="flex items-center justify-between border-b border-border bg-background/80 px-3 py-2.5 backdrop-blur-md md:px-5">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMobileOpen(true)}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-foreground hover:bg-accent md:hidden transition"
              aria-label="Open conversation history menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary border border-border shadow-xs">
              <Sparkle className="h-3.5 w-3.5" />
            </div>
            <h1 className="text-sm font-semibold tracking-tight truncate max-w-[200px] md:max-w-md text-foreground">
              {activeThread?.title || "IntelliChat Assistant"}
            </h1>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* New Chat Button */}
            <button
              onClick={handleCreate}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-medium hover:bg-accent text-foreground transition shadow-xs"
            >
              <Plus className="h-3.5 w-3.5 text-primary" />
              <span className="hidden sm:inline">New chat</span>
            </button>

            {/* Manage Settings Button */}
            <button
              onClick={() => openSettings("general")}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition"
              aria-label="Settings"
              title="Manage Settings"
            >
              <Settings className="h-4 w-4" />
            </button>

            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition"
              aria-label="Toggle theme"
              title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            >
              {theme === "dark" ? <Sun className="h-4 w-4 text-amber-500" /> : <Moon className="h-4 w-4 text-indigo-500" />}
            </button>

            {/* Account Info / Sign in button */}
            {isAuthenticated ? (
              <div
                onClick={() => openSettings("account")}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary border border-border text-xs font-semibold cursor-pointer hover:bg-primary/20 transition shadow-xs"
                title={`Signed in as ${user?.email} (Click for Settings)`}
              >
                {user?.name ? user.name.slice(0, 2).toUpperCase() : "U"}
              </div>
            ) : (
              <button
                onClick={() => openAuthModal("login")}
                className="flex items-center gap-1.5 rounded-lg bg-primary px-2.5 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition shadow-xs"
              >
                <LogIn className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Sign In</span>
              </button>
            )}
          </div>
        </header>

        {/* Message Scroll Container */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-thin">
          {!threadId || messages.length === 0 ? (
            <div className="flex min-h-full flex-col items-center justify-center px-4 py-12">
              <Welcome onSelectPrompt={(p) => setInput(p)} />
              <div className="mt-8 w-full max-w-2xl">
                <Composer
                  value={input}
                  onChange={setInput}
                  onSubmit={handleSubmit}
                  onStop={handleStop}
                  disabled={loading}
                  loading={loading}
                  sendOnEnter={settings.sendOnEnter}
                />
              </div>
            </div>
          ) : (
            <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 md:px-6">
              {messages.map((m) => (
                <Message
                  key={m.id}
                  id={m.id}
                  role={m.role}
                  content={m.content}
                  timestamp={m.timestamp || m.createdAt}
                  streaming={m.streaming}
                  attachments={m.attachments || []}
                  feedback={m.feedback}
                  fontSize={settings.fontSize}
                  onFeedback={handleFeedback}
                  onRegenerate={handleRegenerate}
                  onEdit={handleEdit}
                />
              ))}

              {loading && !messages.some((m) => m.streaming) && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center gap-3 text-muted-foreground"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary border border-border shadow-xs">
                    <Sparkle className="h-4 w-4" />
                  </div>
                  <div className="flex gap-1.5">
                    <span className="h-2 w-2 animate-bounce rounded-full bg-primary/60 [animation-delay:-0.3s]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-primary/60 [animation-delay:-0.15s]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-primary/60" />
                  </div>
                </motion.div>
              )}

              {error && (
                <div className="flex items-center justify-between gap-3 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm">
                  <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{error.message}</span>
                  </div>
                  {error.lastText && (
                    <button
                      onClick={() => handleSubmit(error.lastText)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-accent transition shadow-xs"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      Retry
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Bottom Composer (when thread has messages) */}
        {threadId && messages.length > 0 && (
          <div className="border-t border-border bg-gradient-to-t from-background to-background/80 px-3 pb-4 pt-3 md:px-6">
            <div className="mx-auto w-full max-w-3xl">
              <Composer
                value={input}
                onChange={setInput}
                onSubmit={handleSubmit}
                onStop={handleStop}
                disabled={loading}
                loading={loading}
                sendOnEnter={settings.sendOnEnter}
              />
            </div>
          </div>
        )}
      </main>

      {/* Auth Modal */}
      <AuthModal />

      {/* Settings Modal */}
      <SettingsModal threads={threads} onClearHistory={fetchThreads} />
    </div>
  );
}
