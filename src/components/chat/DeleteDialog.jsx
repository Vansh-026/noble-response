import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, Trash2 } from "lucide-react";

export function DeleteDialog({ isOpen, conversationTitle, onConfirm, onCancel, isDeleting }) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onCancel}
          className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        />

        {/* Dialog */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.15 }}
          className="relative w-full max-w-sm rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-2xl"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-500/10 text-red-500 dark:text-red-400 border border-red-500/20">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-foreground">Delete chat?</h3>
              <p className="text-xs text-muted-foreground mt-0.5">This action cannot be undone.</p>
            </div>
          </div>

          <p className="mt-3 text-xs text-muted-foreground bg-muted/40 p-2.5 rounded-xl border border-border truncate">
            "
            <span className="text-foreground font-medium">
              {conversationTitle || "Untitled chat"}
            </span>
            "
          </p>

          <div className="mt-5 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={isDeleting}
              className="rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-medium text-foreground hover:bg-accent transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={isDeleting}
              className="inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-3.5 py-2 text-xs font-medium text-white hover:bg-red-500 transition disabled:opacity-50 shadow-sm"
            >
              {isDeleting ? (
                <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <Trash2 className="h-3.5 w-3.5" />
              )}
              <span>{isDeleting ? "Deleting..." : "Delete"}</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
