import { motion } from "framer-motion";

export function Welcome() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="mx-auto flex max-w-2xl flex-col items-center text-center"
    >
      <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-white/15 to-white/5 border border-white/10 shadow-inner">
        <div className="h-6 w-6 rounded-md bg-gradient-to-br from-white to-white/60" />
      </div>
      <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
        How can I help you today?
      </h1>
      <p className="mt-3 text-base text-muted-foreground">
        I'm a Smart Genius Assistant.
      </p>
    </motion.div>
  );
}
