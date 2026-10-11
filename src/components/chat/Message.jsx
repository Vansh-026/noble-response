import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { motion } from "framer-motion";
import {
  Check,
  Copy,
  User,
  Sparkle,
  ThumbsUp,
  ThumbsDown,
  RefreshCw,
  Pencil,
  FileText,
  Image as ImageIcon,
  Download,
  File,
} from "lucide-react";
import { CodeBlock } from "./CodeBlock";
import { filesApi } from "@/lib/api";

function formatTime(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatBytes(bytes) {
  if (!bytes) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

export function Message({
  id,
  role,
  content,
  timestamp,
  streaming,
  attachments = [],
  feedback,
  fontSize = "md",
  onFeedback,
  onRegenerate,
  onEdit,
}) {
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(content);
  const isUser = role === "user";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  const handleSaveEdit = () => {
    if (editText.trim() && editText.trim() !== content) {
      onEdit?.(id, editText.trim());
    }
    setEditing(false);
  };

  const textSizeClass =
    fontSize === "sm" ? "text-[0.88rem]" : fontSize === "lg" ? "text-[1.04rem]" : "text-[0.95rem]";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className={`group flex w-full gap-3 md:gap-4 ${
        isUser ? "justify-end" : "justify-start"
      }`}
    >
      {/* Assistant Avatar */}
      {!isUser && (
        <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary border border-border shadow-xs">
          <Sparkle className="h-4 w-4" />
        </div>
      )}

      {/* Message Content Container */}
      <div className={`flex max-w-[92%] md:max-w-[85%] flex-col ${isUser ? "items-end" : "items-start"}`}>
        {/* Attachments Display */}
        {attachments && attachments.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {attachments.map((att, idx) => {
              const isImg = att.mimeType?.startsWith("image/");
              const downloadUrl = att.id ? filesApi.getDownloadUrl(att.id) : null;

              return (
                <div
                  key={att.id || idx}
                  className="overflow-hidden rounded-xl border border-border bg-card dark:bg-white/[0.04] p-2 text-xs shadow-xs"
                >
                  {isImg && downloadUrl ? (
                    <div className="mb-1.5 overflow-hidden rounded-lg">
                      <img
                        src={downloadUrl}
                        alt={att.originalName}
                        className="max-h-48 max-w-xs object-cover rounded-md"
                        loading="lazy"
                      />
                    </div>
                  ) : null}
                  <div className="flex items-center gap-2">
                    {isImg ? (
                      <ImageIcon className="h-4 w-4 text-emerald-500 dark:text-emerald-400 shrink-0" />
                    ) : att.mimeType === "application/pdf" ? (
                      <FileText className="h-4 w-4 text-red-500 dark:text-red-400 shrink-0" />
                    ) : (
                      <File className="h-4 w-4 text-blue-500 dark:text-blue-400 shrink-0" />
                    )}
                    <div className="min-w-0 max-w-[160px]">
                      <div className="truncate font-medium text-foreground">{att.originalName}</div>
                      <div className="text-[10px] text-muted-foreground">{formatBytes(att.size)}</div>
                    </div>
                    {downloadUrl && (
                      <a
                        href={downloadUrl}
                        download={att.originalName}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground transition ml-1"
                        title="Download file"
                      >
                        <Download className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Bubble or Markdown */}
        {isUser ? (
          editing ? (
            <div className="w-full min-w-[280px] max-w-lg rounded-2xl border border-border bg-card p-3 text-card-foreground shadow-md">
              <textarea
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                className="w-full resize-none rounded-lg bg-background border border-border p-2 text-sm outline-none scrollbar-thin"
                rows={3}
              />
              <div className="mt-2 flex items-center justify-end gap-2">
                <button
                  onClick={() => setEditing(false)}
                  className="rounded-lg px-2.5 py-1 text-xs text-muted-foreground hover:bg-accent"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEdit}
                  className="rounded-lg bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                >
                  Save & Resend
                </button>
              </div>
            </div>
          ) : (
            <div
              className={`rounded-2xl rounded-tr-sm bg-secondary text-secondary-foreground dark:bg-white dark:text-black px-4 py-2.5 ${textSizeClass} leading-relaxed shadow-xs`}
            >
              <div className="whitespace-pre-wrap">{content}</div>
            </div>
          )
        ) : (
          <div className={`prose-chat w-full ${textSizeClass}`}>
            <div className={streaming ? "typing-caret" : ""}>
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeHighlight]}
                components={{
                  code({ node, inline, className, children, ...props }) {
                    const match = /language-(\w+)/.exec(className || "");
                    const codeText = String(children).replace(/\n$/, "");

                    if (!inline && match) {
                      return <CodeBlock language={match[1]} code={codeText} />;
                    }
                    if (!inline && codeText.includes("\n")) {
                      return <CodeBlock language="text" code={codeText} />;
                    }
                    return (
                      <code className={className} {...props}>
                        {children}
                      </code>
                    );
                  },
                }}
              >
                {content || " "}
              </ReactMarkdown>
            </div>
          </div>
        )}

        {/* Actions Bar */}
        <div
          className={`mt-1.5 flex items-center gap-2 text-[11px] text-muted-foreground transition-opacity ${
            isUser ? "flex-row-reverse" : ""
          } ${editing ? "hidden" : "opacity-90 md:opacity-0 md:group-hover:opacity-100"}`}
        >
          <span>{formatTime(timestamp)}</span>

          {/* Copy Button */}
          {content && !streaming && (
            <button
              onClick={copy}
              className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 hover:bg-accent hover:text-foreground transition-colors"
              aria-label="Copy message"
              title="Copy message"
            >
              {copied ? (
                <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
              <span>{copied ? "Copied" : "Copy"}</span>
            </button>
          )}

          {/* User Edit Button */}
          {isUser && !streaming && onEdit && (
            <button
              onClick={() => {
                setEditText(content);
                setEditing(true);
              }}
              className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 hover:bg-accent hover:text-foreground transition-colors"
              aria-label="Edit message"
              title="Edit message"
            >
              <Pencil className="h-3 w-3" />
              <span>Edit</span>
            </button>
          )}

          {/* Assistant Actions: Regenerate & Feedback */}
          {!isUser && !streaming && (
            <>
              {onRegenerate && (
                <button
                  onClick={() => onRegenerate(id)}
                  className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 hover:bg-accent hover:text-foreground transition-colors"
                  aria-label="Regenerate response"
                  title="Regenerate response"
                >
                  <RefreshCw className="h-3 w-3" />
                  <span>Regenerate</span>
                </button>
              )}

              {onFeedback && (
                <div className="flex items-center gap-0.5 ml-1 border-l border-border pl-1.5">
                  <button
                    onClick={() =>
                      onFeedback(id, feedback?.rating === "positive" ? null : "positive")
                    }
                    className={`rounded p-1 transition ${
                      feedback?.rating === "positive"
                        ? "text-emerald-600 dark:text-emerald-400 bg-emerald-500/15"
                        : "hover:bg-accent text-muted-foreground hover:text-foreground"
                    }`}
                    aria-label="Thumbs up"
                    title="Good response"
                  >
                    <ThumbsUp className="h-3 w-3" />
                  </button>
                  <button
                    onClick={() =>
                      onFeedback(id, feedback?.rating === "negative" ? null : "negative")
                    }
                    className={`rounded p-1 transition ${
                      feedback?.rating === "negative"
                        ? "text-red-600 dark:text-red-400 bg-red-500/15"
                        : "hover:bg-accent text-muted-foreground hover:text-foreground"
                    }`}
                    aria-label="Thumbs down"
                    title="Poor response"
                  >
                    <ThumbsDown className="h-3 w-3" />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* User Avatar */}
      {isUser && (
        <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground border border-border shadow-xs">
          <User className="h-4 w-4" />
        </div>
      )}
    </motion.div>
  );
}
