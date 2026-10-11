import React, { useState } from "react";
import { Check, Copy } from "lucide-react";

export function CodeBlock({ language, code }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.warn("Failed to copy code:", err);
    }
  };

  return (
    <div className="relative my-3 overflow-hidden rounded-xl border border-white/10 bg-[#0d0d0d] font-mono text-xs shadow-lg">
      {/* Code Header Bar */}
      <div className="flex items-center justify-between border-b border-white/10 bg-white/[0.04] px-4 py-2 text-muted-foreground select-none">
        <span className="text-[11px] font-semibold tracking-wide uppercase text-sidebar-foreground/70">
          {language || "code"}
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] hover:bg-white/10 hover:text-white transition"
          aria-label="Copy code"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 text-green-400" />
              <span className="text-green-400">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" />
              <span>Copy code</span>
            </>
          )}
        </button>
      </div>

      {/* Code Body */}
      <div className="overflow-x-auto p-4 text-[0.88rem] leading-relaxed scrollbar-thin text-zinc-100">
        <code>{code}</code>
      </div>
    </div>
  );
}
