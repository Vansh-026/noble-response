import { useMemo, useState } from "react";
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
} from "lucide-react";

export function Sidebar({
  threads,
  activeId,
  onCreate,
  onDelete,
  onRename,
  collapsed,
  onToggle,
}) {
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState("");
  const navigate = useNavigate();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = [...threads].sort((a, b) => b.updatedAt - a.updatedAt);
    if (!q) return list;
    return list.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.messages.some((m) => m.content.toLowerCase().includes(q))
    );
  }, [threads, query]);

  const startRename = (t) => {
    setEditingId(t.id);
    setEditValue(t.title);
  };
  const commitRename = () => {
    if (editingId && editValue.trim()) onRename(editingId, editValue.trim());
    setEditingId(null);
  };

  const handleDelete = (id) => {
    onDelete(id);
    if (id === activeId) navigate({ to: "/" });
  };

  if (collapsed) {
    return (
      <aside className="hidden md:flex h-full w-[60px] flex-col items-center gap-3 border-r border-white/5 bg-sidebar py-4">
        <button
          onClick={onToggle}
          className="flex h-10 w-10 items-center justify-center rounded-xl text-sidebar-foreground/70 hover:bg-white/5 hover:text-sidebar-foreground transition"
          aria-label="Expand sidebar"
        >
          <PanelLeft className="h-5 w-5" />
        </button>
        <button
          onClick={onCreate}
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-sidebar-foreground hover:bg-white/15 transition"
          aria-label="New chat"
        >
          <Plus className="h-5 w-5" />
        </button>
      </aside>
    );
  }

  return (
    <aside className="flex h-full w-[280px] shrink-0 flex-col border-r border-white/5 bg-sidebar">
      <div className="flex items-center justify-between p-3">
        <div className="flex items-center gap-2 px-1">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-white/20 to-white/5 border border-white/10">
            <div className="h-3 w-3 rounded-sm bg-white" />
          </div>
          <span className="text-sm font-semibold text-sidebar-foreground">Smart Genius</span>
        </div>
        <button
          onClick={onToggle}
          className="hidden md:flex h-8 w-8 items-center justify-center rounded-lg text-sidebar-foreground/60 hover:bg-white/5 hover:text-sidebar-foreground transition"
          aria-label="Collapse sidebar"
        >
          <PanelLeftClose className="h-4 w-4" />
        </button>
      </div>

      <div className="px-3">
        <button
          onClick={onCreate}
          className="flex w-full items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm font-medium text-sidebar-foreground transition hover:bg-white/[0.06]"
        >
          <Plus className="h-4 w-4" />
          New chat
        </button>
      </div>

      <div className="px-3 pt-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-sidebar-foreground/50" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search chats"
            className="w-full rounded-xl bg-white/[0.04] py-2 pl-9 pr-3 text-sm text-sidebar-foreground placeholder:text-sidebar-foreground/40 outline-none focus:bg-white/[0.06] transition"
          />
        </div>
      </div>

      <div className="mt-3 flex-1 overflow-y-auto px-2 pb-3 scrollbar-thin">
        <div className="px-2 pb-1 pt-2 text-[11px] font-medium uppercase tracking-wider text-sidebar-foreground/40">
          History
        </div>
        <AnimatePresence initial={false}>
          {filtered.length === 0 && (
            <div className="px-3 py-6 text-center text-xs text-sidebar-foreground/40">
              No conversations yet
            </div>
          )}
          {filtered.map((t) => {
            const active = t.id === activeId;
            const editing = editingId === t.id;
            return (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -6 }}
                transition={{ duration: 0.15 }}
                className={`group relative mx-1 mb-0.5 flex items-center gap-2 rounded-lg px-2 py-2 text-sm transition ${
                  active
                    ? "bg-white/[0.08] text-sidebar-foreground"
                    : "text-sidebar-foreground/80 hover:bg-white/[0.04]"
                }`}
              >
                <MessageSquare className="h-4 w-4 shrink-0 opacity-60" />
                {editing ? (
                  <>
                    <input
                      autoFocus
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") commitRename();
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      className="min-w-0 flex-1 rounded bg-white/10 px-1.5 py-0.5 text-sm outline-none"
                    />
                    <button
                      onClick={commitRename}
                      className="rounded p-1 hover:bg-white/10"
                      aria-label="Save"
                    >
                      <Check className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="rounded p-1 hover:bg-white/10"
                      aria-label="Cancel"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </>
                ) : (
                  <>
                    <Link
                      to="/c/$threadId"
                      params={{ threadId: t.id }}
                      className="min-w-0 flex-1 truncate"
                    >
                      {t.title}
                    </Link>
                    <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          startRename(t);
                        }}
                        className="rounded p-1 text-sidebar-foreground/60 hover:bg-white/10 hover:text-sidebar-foreground"
                        aria-label="Rename"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(t.id);
                        }}
                        className="rounded p-1 text-sidebar-foreground/60 hover:bg-white/10 hover:text-red-400"
                        aria-label="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      <div className="border-t border-white/5 p-3">
        <div className="flex items-center gap-2 rounded-lg p-1.5 hover:bg-white/[0.04] transition">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-white/25 to-white/5 text-xs font-medium">
            SG
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">You</div>
            <div className="truncate text-xs text-sidebar-foreground/50">Free plan</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
