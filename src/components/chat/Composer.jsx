import { useEffect, useRef } from "react";
import { ArrowUp, Square } from "lucide-react";

export function Composer({ value, onChange, onSubmit, onStop, disabled, loading, autoFocus = true }) {
  const ref = useRef(null);

  useEffect(() => {
    if (autoFocus) ref.current?.focus();
  }, [autoFocus]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 220) + "px";
  }, [value]);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!disabled && value.trim()) onSubmit();
    }
  };

  const canSend = value.trim().length > 0 && !disabled;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (canSend) onSubmit();
      }}
      className="glass relative flex items-end gap-2 rounded-[22px] p-2.5 pl-4 shadow-[0_10px_40px_-15px_rgba(0,0,0,0.6)]"
    >
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        rows={1}
        placeholder="Ask me anything..."
        className="min-h-[28px] max-h-[220px] flex-1 resize-none bg-transparent py-2 text-[0.98rem] leading-relaxed text-foreground placeholder:text-muted-foreground/70 outline-none scrollbar-thin"
      />
      {loading ? (
        <button
          type="button"
          onClick={onStop}
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-black transition hover:bg-white/90"
          aria-label="Stop"
        >
          <Square className="h-4 w-4 fill-current" />
        </button>
      ) : (
        <button
          type="submit"
          disabled={!canSend}
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-black transition enabled:hover:bg-white/90 disabled:cursor-not-allowed disabled:bg-white/20 disabled:text-white/40"
          aria-label="Send"
        >
          <ArrowUp className="h-5 w-5" />
        </button>
      )}
    </form>
  );
}
