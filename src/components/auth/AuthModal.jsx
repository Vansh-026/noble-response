import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Lock, Mail, User, Sparkle, AlertCircle, CheckCircle, ArrowRight } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { authApi } from "@/lib/api";

export function AuthModal() {
  const { authModalOpen, closeAuthModal, authModalMode, setAuthModalMode, login, register } =
    useAuth();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  if (!authModalOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      if (authModalMode === "login") {
        if (!email || !password) throw new Error("Please enter both email and password.");
        await login({ email, password });
      } else if (authModalMode === "register") {
        if (!name || name.trim().length < 2) throw new Error("Name must be at least 2 characters.");
        if (!email || !email.includes("@")) throw new Error("Please enter a valid email address.");
        if (!password || password.length < 6)
          throw new Error("Password must be at least 6 characters.");
        await register({ name, email, password });
      } else if (authModalMode === "forgot") {
        if (!email || !email.includes("@")) throw new Error("Please enter a valid email address.");
        await authApi.forgotPassword(email);
        setSuccessMsg("If an account exists with that email, reset instructions were generated.");
      }
    } catch (err) {
      setError(err.message || "Authentication failed. Please check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (mode) => {
    setError(null);
    setSuccessMsg(null);
    setAuthModalMode(mode);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={closeAuthModal}
          className="absolute inset-0 bg-black/75 backdrop-blur-md"
        />

        {/* Modal Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2 }}
          className="relative w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card p-6 text-card-foreground shadow-2xl"
        >
          {/* Close button */}
          <button
            onClick={closeAuthModal}
            className="absolute right-4 top-4 rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>

          {/* Header */}
          <div className="flex flex-col items-center text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary border border-border shadow-xs">
              <Sparkle className="h-6 w-6" />
            </div>
            <h2 className="mt-4 text-xl font-semibold tracking-tight text-foreground">
              {authModalMode === "login" && "Welcome back to IntelliChat"}
              {authModalMode === "register" && "Create your IntelliChat account"}
              {authModalMode === "forgot" && "Reset your password"}
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {authModalMode === "login" && "Sign in to access your chat history and files"}
              {authModalMode === "register" &&
                "Get started with full chat history and file attachments"}
              {authModalMode === "forgot" && "Enter your email to receive recovery instructions"}
            </p>
          </div>

          {/* Tabs for Login / Register */}
          {authModalMode !== "forgot" && (
            <div className="mt-6 flex rounded-xl bg-muted/50 p-1 border border-border">
              <button
                type="button"
                onClick={() => switchMode("login")}
                className={`flex-1 rounded-lg py-1.5 text-xs font-medium transition ${
                  authModalMode === "login"
                    ? "bg-card text-foreground shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => switchMode("register")}
                className={`flex-1 rounded-lg py-1.5 text-xs font-medium transition ${
                  authModalMode === "register"
                    ? "bg-card text-foreground shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Create Account
              </button>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="mt-5 space-y-3.5">
            {error && (
              <div className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3.5 py-2.5 text-xs text-red-600 dark:text-red-400">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {successMsg && (
              <div className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3.5 py-2.5 text-xs text-emerald-600 dark:text-emerald-400">
                <CheckCircle className="h-4 w-4 shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            {authModalMode === "register" && (
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  Full Name
                </label>
                <div className="relative">
                  <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Alex Morgan"
                    className="w-full rounded-xl border border-border bg-background py-2.5 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-foreground mb-1">
                Email Address
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="alex@example.com"
                  className="w-full rounded-xl border border-border bg-background py-2.5 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition"
                />
              </div>
            </div>

            {authModalMode !== "forgot" && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-medium text-foreground">
                    Password
                  </label>
                  {authModalMode === "login" && (
                    <button
                      type="button"
                      onClick={() => switchMode("forgot")}
                      className="text-[11px] text-muted-foreground hover:text-foreground transition underline-offset-4 hover:underline"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-xl border border-border bg-background py-2.5 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition"
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50 shadow-sm"
            >
              {loading ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
              ) : (
                <>
                  <span>
                    {authModalMode === "login" && "Sign In"}
                    {authModalMode === "register" && "Create Account"}
                    {authModalMode === "forgot" && "Send Reset Link"}
                  </span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          {/* Footer switch */}
          <div className="mt-5 text-center text-xs text-muted-foreground">
            {authModalMode === "login" && (
              <p>
                Don't have an account?{" "}
                <button
                  onClick={() => switchMode("register")}
                  className="font-medium text-primary underline-offset-4 hover:underline"
                >
                  Sign up
                </button>
              </p>
            )}
            {authModalMode === "register" && (
              <p>
                Already have an account?{" "}
                <button
                  onClick={() => switchMode("login")}
                  className="font-medium text-primary underline-offset-4 hover:underline"
                >
                  Sign in
                </button>
              </p>
            )}
            {authModalMode === "forgot" && (
              <p>
                Remember your password?{" "}
                <button
                  onClick={() => switchMode("login")}
                  className="font-medium text-primary underline-offset-4 hover:underline"
                >
                  Back to Sign In
                </button>
              </p>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
