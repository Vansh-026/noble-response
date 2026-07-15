import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { motion } from "framer-motion";
import { Check, Copy, User, Sparkle } from "lucide-react";

function formatTime(ts) {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function Message({ role, content, timestamp, streaming }) {
  const [copied, setCopied] = useState(false);
  const isUser = role === "user";

  const copy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className={`group flex w-full gap-4 ${isUser ? "justify-end" : "justify-start"}`}
    >
      {!isUser && (
        <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-white/15 to-white/5 border border-white/10">
          <Sparkle className="h-4 w-4 text-white" />
        </div>
      )}

      <div className={`flex max-w-[85%] flex-col ${isUser ? "items-end" : "items-start"}`}>
        <div
          className={
            isUser
              ? "rounded-2xl rounded-tr-md bg-white text-black px-4 py-2.5 text-[0.95rem] leading-relaxed shadow-sm"
              : "prose-chat w-full"
          }
        >
          {isUser ? (
            <div className="whitespace-pre-wrap">{content}</div>
          ) : (
            <div className={streaming ? "typing-caret" : ""}>
              <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
                {content || " "}
              </ReactMarkdown>
            </div>
          )}
        </div>

        <div
          className={`mt-1.5 flex items-center gap-2 text-[11px] text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 ${
            isUser ? "flex-row-reverse" : ""
          }`}
        >
          <span>{formatTime(timestamp)}</span>
          {content && !streaming && (
            <button
              onClick={copy}
              className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 hover:bg-white/5 transition-colors"
              aria-label="Copy message"
            >
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              <span>{copied ? "Copied" : "Copy"}</span>
            </button>
          )}
        </div>
      </div>

      {isUser && (
        <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 border border-white/10">
          <User className="h-4 w-4 text-white" />
        </div>
      )}
    </motion.div>
  );
}
