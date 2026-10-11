import React, { useMemo, useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Search,
  Trash2,
  Pencil,
  MessageSquare,
  PanelLeftClose,
  PanelLeft,
  Check,
  X,
  MoreVertical,
  LogOut,
  LogIn,
  Sun,
  Moon,
  Sparkle,
  Settings,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { useSettings } from "@/context/SettingsContext";
import { DeleteDialog } from "./DeleteDialog";

export function Sidebar({
  threads,
  activeId,
  onCreate,
  onDelete,
  onRename,
  collapsed,
  onToggle,
  onCloseMobile,
}) {
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState("");
  const [menuOpenId, setMenuOpenId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const { user, isAuthenticated, logout, openAuthModal } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { openSettings } = useSettings();
  const navigate = useNavigate();
  const menuRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpenId(null);
      }
    }
    if (menuOpenId) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("touchstart", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [menuOpenId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = [...threads].sort((a, b) => {
      const timeA = new Date(a.updatedAt || a.createdAt || 0).getTime();
      const timeB = new Date(b.updatedAt || b.createdAt || 0).getTime();
      return timeB - timeA;
    });
    if (!q) return list;
    return list.filter((t) => (t.title || "").toLowerCase().includes(q));
  }, [threads, query]);

  const startRename = (t) => {
    setMenuOpenId(null);
    setEditingId(t.id);
    setEditValue(t.title || "Untitled chat");
  };

  const commitRename = () => {
    if (editingId && editValue.trim()) {
      onRename(editingId, editValue.trim());
    }
    setEditingId(null);
  };

  const promptDelete = (t) => {
    setMenuOpenId(null);
    setDeleteTarget({ id: t.id, title: t.title });
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await onDelete(deleteTarget.id);
      if (deleteTarget.id === activeId) {
        navigate({ to: "/" });
      }
      setDeleteTarget(null);
    } finally {
      setIsDeleting(false);
    }
  };

  if (collapsed) {
    return (
      <aside className="hidden md:flex h-full w-[60px] flex-col items-center justify-between border-r border-sidebar-border bg-sidebar py-4">
        <div className="flex flex-col items-center gap-3">
          <button
            onClick={onToggle}
            className="flex h-10 w-10 items-center justify-center rounded-xl text-sidebar-foreground/70 hover:bg-accent hover:text-sidebar-foreground transition"
            aria-label="Expand sidebar"
            title="Expand sidebar"
          >
            <PanelLeft className="h-5 w-5" />
          </button>
          <button
            onClick={onCreate}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition shadow-xs"
            aria-label="New chat"
            title="New chat"
          >
            <Plus className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-col items-center gap-2">
          <button
            onClick={() => openSettings("general")}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-sidebar-foreground/60 hover:bg-accent hover:text-sidebar-foreground transition"
            aria-label="Open settings"
            title="Settings"
          >
            <Settings className="h-4 w-4" />
          </button>
          <button
            onClick={toggleTheme}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-sidebar-foreground/60 hover:bg-accent hover:text-sidebar-foreground transition"
            aria-label="Toggle theme"
            title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </div>
      </aside>
    );
  }

  return (
    <>
      <aside className="flex h-full w-[280px] shrink-0 flex-col border-r border-sidebar-border bg-sidebar select-none transition-colors">
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-sidebar-border/50">
          <div className="flex items-center gap-2 px-1">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary border border-border shadow-xs">
              <Sparkle className="h-3.5 w-3.5" />
            </div>
            <span className="text-sm font-semibold tracking-tight text-sidebar-foreground">
              IntelliChat
            </span>
          </div>
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => openSettings("general")}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-sidebar-foreground/60 hover:bg-accent hover:text-sidebar-foreground transition"
              aria-label="Settings"
              title="Settings"
            >
              <Settings className="h-4 w-4" />
            </button>
            <button
              onClick={toggleTheme}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-sidebar-foreground/60 hover:bg-accent hover:text-sidebar-foreground transition"
              aria-label="Toggle theme"
              title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <button
              onClick={onCloseMobile || onToggle}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-sidebar-foreground/60 hover:bg-accent hover:text-sidebar-foreground transition"
              aria-label="Close sidebar"
            >
              <PanelLeftClose className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* New Chat Button */}
        <div className="p-3 pb-2">
          <button
            onClick={onCreate}
            className="flex w-full items-center justify-between rounded-xl border border-border bg-card px-3.5 py-2.5 text-xs font-semibold text-sidebar-foreground shadow-xs transition hover:bg-accent"
          >
            <div className="flex items-center gap-2">
              <Plus className="h-4 w-4 text-primary" />
              <span>New chat</span>
            </div>
            <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
              ⌘K
            </span>
          </button>
        </div>

        {/* Search */}
        <div className="px-3 pb-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search chats"
              className="w-full rounded-xl border border-border/60 bg-muted/40 py-1.5 pl-8 pr-7 text-xs text-sidebar-foreground placeholder:text-muted-foreground outline-none focus:border-primary/40 focus:bg-background transition"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto px-2 pb-3 scrollbar-thin">
          <div className="px-2.5 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            History
          </div>

          <AnimatePresence initial={false}>
            {filtered.length === 0 && (
              <div className="px-3 py-8 text-center text-xs text-muted-foreground">
                {query ? "No matching chats" : "No conversation history yet"}
              </div>
            )}

            {filtered.map((t) => {
              const active = t.id === activeId;
              const editing = editingId === t.id;
              const menuOpen = menuOpenId === t.id;

              return (
                <motion.div
                  key={t.id}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -6 }}
                  transition={{ duration: 0.15 }}
                  className={`group relative mx-1 mb-0.5 flex items-center gap-2 rounded-xl px-2.5 py-2 text-xs transition ${
                    active
                      ? "bg-accent text-accent-foreground font-semibold shadow-xs"
                      : "text-sidebar-foreground/80 hover:bg-accent/60 hover:text-sidebar-foreground"
                  }`}
                >
                  <MessageSquare className="h-3.5 w-3.5 shrink-0 opacity-60" />

                  {editing ? (
                    <div className="flex flex-1 items-center gap-1">
                      <input
                        autoFocus
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") commitRename();
                          if (e.key === "Escape") setEditingId(null);
                        }}
                        className="min-w-0 flex-1 rounded bg-background px-1.5 py-0.5 text-xs outline-none border border-border"
                      />
                      <button
                        onClick={commitRename}
                        className="rounded p-1 text-emerald-600 dark:text-emerald-400 hover:bg-accent"
                        aria-label="Save title"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="rounded p-1 text-muted-foreground hover:bg-accent"
                        aria-label="Cancel editing"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <Link
                        to="/c/$threadId"
                        params={{ threadId: t.id }}
                        onClick={() => onCloseMobile?.()}
                        className="min-w-0 flex-1 truncate"
                      >
                        {t.title || "Untitled chat"}
                      </Link>

                      {/* Accessible actions: Tap-friendly on touch & visible on hover */}
                      <div className="flex items-center gap-0.5">
                        <div className="relative">
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setMenuOpenId(menuOpen ? null : t.id);
                            }}
                            className={`rounded-md p-1 transition ${
                              menuOpen
                                ? "bg-accent text-foreground opacity-100"
                                : "text-muted-foreground hover:bg-accent hover:text-foreground opacity-90 md:opacity-0 md:group-hover:opacity-100"
                            }`}
                            aria-label="Options"
                            title="Options"
                          >
                            <MoreVertical className="h-3.5 w-3.5" />
                          </button>

                          {/* Dropdown Menu */}
                          {menuOpen && (
                            <div
                              ref={menuRef}
                              className="absolute right-0 top-full z-50 mt-1 w-32 rounded-xl border border-border bg-popover text-popover-foreground p-1 shadow-xl text-xs backdrop-blur-md"
                            >
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  startRename(t);
                                }}
                                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 hover:bg-accent transition"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                                <span>Rename</span>
                              </button>
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  promptDelete(t);
                                }}
                                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-red-500 hover:bg-red-500/10 transition"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                <span>Delete</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        {/* User Account & Session Footer */}
        <div className="border-t border-sidebar-border p-3">
          {isAuthenticated ? (
            <div className="flex items-center justify-between rounded-xl bg-card border border-border p-2 shadow-xs">
              <div
                onClick={() => openSettings("account")}
                className="flex items-center gap-2.5 min-w-0 cursor-pointer flex-1"
                title="Account Settings"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary border border-border text-xs font-semibold">
                  {user?.name ? user.name.slice(0, 2).toUpperCase() : "U"}
                </div>
                <div className="min-w-0">
                  <div className="truncate text-xs font-semibold text-sidebar-foreground">
                    {user?.name || "User"}
                  </div>
                  <div className="truncate text-[10px] text-muted-foreground">
                    {user?.email}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-0.5">
                <button
                  onClick={() => openSettings("general")}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition"
                  aria-label="Settings"
                  title="Settings"
                >
                  <Settings className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={logout}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-red-500 transition"
                  aria-label="Sign out"
                  title="Sign out"
                >
                  <LogOut className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2 rounded-xl bg-card border border-border p-3 shadow-xs">
              <div className="text-[11px] text-muted-foreground">
                Sign in to save and sync your conversations
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => openAuthModal("login")}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-primary py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition shadow-xs"
                >
                  <LogIn className="h-3.5 w-3.5" />
                  <span>Sign in</span>
                </button>
                <button
                  onClick={() => openSettings("general")}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-border hover:bg-accent text-muted-foreground hover:text-foreground transition"
                  title="Settings"
                >
                  <Settings className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* Confirmation Dialog for Deletion */}
      <DeleteDialog
        isOpen={!!deleteTarget}
        conversationTitle={deleteTarget?.title}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
        isDeleting={isDeleting}
      />
    </>
  );
}
