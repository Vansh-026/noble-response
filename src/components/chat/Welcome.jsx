import React from "react";
import { motion } from "framer-motion";
import { FileText, Code2, Sparkles, Compass } from "lucide-react";

export function Welcome({ onSelectPrompt }) {
  const suggestions = [
    {
      icon: <FileText className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />,
      title: "Analyze & summarize",
      description: "Attach a PDF, doc, or text file to extract key insights",
      prompt: "Can you analyze and summarize this attached document?",
    },
    {
      icon: <Code2 className="h-4 w-4 text-blue-500 dark:text-blue-400" />,
      title: "Write or debug code",
      description: "Generate algorithms, fix bugs, or review code snippets",
      prompt: "Can you help me write and debug a modern web function?",
    },
    {
      icon: <Sparkles className="h-4 w-4 text-purple-500 dark:text-purple-400" />,
      title: "Brainstorm ideas",
      description: "Develop product concepts, marketing copies, or project outlines",
      prompt: "Brainstorm 5 innovative startup ideas in AI automation",
    },
    {
      icon: <Compass className="h-4 w-4 text-amber-500 dark:text-amber-400" />,
      title: "Explain concepts",
      description: "Break down complex topics into clear, understandable explanations",
      prompt: "Explain how JWT refresh token rotation protects against replay attacks",
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="mx-auto flex max-w-2xl flex-col items-center text-center px-4"
    >
      <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary border border-border shadow-xs">
        <Sparkles className="h-7 w-7" />
      </div>

      <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
        How can I help you today?
      </h1>
      <p className="mt-2 text-sm text-muted-foreground max-w-md">
        Your intelligent assistant with multi-format file analysis, streaming responses, and
        complete conversation history.
      </p>

      {/* Suggestion Prompt Cards */}
      <div className="mt-8 grid w-full grid-cols-1 sm:grid-cols-2 gap-3 text-left">
        {suggestions.map((s, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => onSelectPrompt?.(s.prompt)}
            className="flex flex-col gap-1 rounded-2xl border border-border bg-card p-3.5 transition hover:bg-accent hover:border-foreground/20 text-left shadow-xs dark:shadow-none group"
          >
            <div className="flex items-center gap-2">
              {s.icon}
              <span className="text-xs font-semibold text-foreground transition">
                {s.title}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground line-clamp-2">{s.description}</p>
          </button>
        ))}
      </div>
    </motion.div>
  );
}
