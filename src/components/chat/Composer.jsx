import React, { useEffect, useRef, useState } from "react";
import { ArrowUp, Square, Paperclip, X, FileText, Image as ImageIcon, FileCode, File, Loader2 } from "lucide-react";
import { filesApi } from "@/lib/api";

function formatBytes(bytes) {
  if (!bytes) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function getFileIcon(mimeType) {
  if (mimeType?.startsWith("image/")) return <ImageIcon className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />;
  if (mimeType === "application/pdf") return <FileText className="h-4 w-4 text-red-500 dark:text-red-400" />;
  if (mimeType?.includes("json") || mimeType?.includes("javascript") || mimeType?.includes("python"))
    return <FileCode className="h-4 w-4 text-blue-500 dark:text-blue-400" />;
  return <File className="h-4 w-4 text-amber-500 dark:text-amber-400" />;
}

export function Composer({
  value,
  onChange,
  onSubmit,
  onStop,
  disabled,
  loading,
  sendOnEnter = true,
  autoFocus = true,
}) {
  const ref = useRef(null);
  const fileInputRef = useRef(null);
  const [attachments, setAttachments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);

  useEffect(() => {
    if (autoFocus) ref.current?.focus();
  }, [autoFocus]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 200) + "px";
  }, [value]);

  const handleKeyDown = (e) => {
    if (sendOnEnter) {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        if (!disabled && !uploading && (value.trim() || attachments.length > 0)) {
          handleSend();
        }
      }
    } else {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        if (!disabled && !uploading && (value.trim() || attachments.length > 0)) {
          handleSend();
        }
      }
    }
  };

  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    setUploadError(null);
    setUploading(true);

    try {
      for (const file of files) {
        if (file.size > 10 * 1024 * 1024) {
          throw new Error(`"${file.name}" exceeds 10MB limit.`);
        }
        const uploaded = await filesApi.upload(file);
        setAttachments((prev) => [
          ...prev,
          {
            id: uploaded.id,
            originalName: uploaded.originalName,
            mimeType: uploaded.mimeType,
            size: uploaded.size,
          },
        ]);
      }
    } catch (err) {
      setUploadError(err.message || "Failed to upload file.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removeAttachment = (id) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  const handleSend = () => {
    const text = value.trim();
    if (!text && attachments.length === 0) return;
    onSubmit(text, attachments);
    setAttachments([]);
    setUploadError(null);
  };

  const canSend = (value.trim().length > 0 || attachments.length > 0) && !disabled && !uploading;

  return (
    <div className="flex flex-col gap-2">
      {/* Upload error banner */}
      {uploadError && (
        <div className="flex items-center justify-between rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-600 dark:text-red-300">
          <span>{uploadError}</span>
          <button onClick={() => setUploadError(null)}>
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Attachment Previews */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 px-1">
          {attachments.map((att) => (
            <div
              key={att.id}
              className="flex items-center gap-2 rounded-xl border border-border bg-card dark:bg-white/[0.05] py-1.5 pl-2.5 pr-2 text-xs text-foreground shadow-xs backdrop-blur-sm"
            >
              {getFileIcon(att.mimeType)}
              <div className="flex flex-col min-w-0 max-w-[140px]">
                <span className="truncate font-medium">{att.originalName}</span>
                <span className="text-[10px] text-muted-foreground">{formatBytes(att.size)}</span>
              </div>
              <button
                type="button"
                onClick={() => removeAttachment(att.id)}
                className="rounded-full p-1 text-muted-foreground hover:bg-accent hover:text-foreground transition"
                aria-label="Remove attachment"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Composer Input Bar */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (canSend) handleSend();
        }}
        className="glass relative flex items-end gap-2 rounded-[24px] p-2 pl-3"
      >
        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileSelect}
          className="hidden"
          accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.txt,.md,.json,.csv,.js,.jsx,.ts,.tsx,.py,.html,.css,.xml"
        />

        {/* Attachment Button */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading || disabled}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground transition disabled:opacity-40"
          aria-label="Attach file"
          title="Attach PDF, images, text, or documents"
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
          ) : (
            <Paperclip className="h-4 w-4" />
          )}
        </button>

        {/* Text Area */}
        <textarea
          ref={ref}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          placeholder="Ask anything, or attach a document or image..."
          className="min-h-[32px] max-h-[200px] flex-1 resize-none bg-transparent py-1.5 text-[0.96rem] leading-relaxed text-foreground placeholder:text-muted-foreground/60 outline-none scrollbar-thin"
        />

        {/* Send / Stop Button */}
        {loading ? (
          <button
            type="button"
            onClick={onStop}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition shadow-sm"
            aria-label="Stop generation"
            title="Stop generating"
          >
            <Square className="h-3.5 w-3.5 fill-current" />
          </button>
        ) : (
          <button
            type="submit"
            disabled={!canSend}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition enabled:hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground shadow-sm"
            aria-label="Send message"
            title="Send message"
          >
            <ArrowUp className="h-4 w-4 stroke-[2.5]" />
          </button>
        )}
      </form>
    </div>
  );
}
