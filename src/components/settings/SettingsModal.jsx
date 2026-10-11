import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Settings as SettingsIcon,
  Sun,
  Moon,
  Laptop,
  Check,
  Download,
  Trash2,
  User,
  Sparkles,
  Sliders,
  Database,
  ShieldCheck,
  LogOut,
  LogIn,
} from "lucide-react";
import { useSettings } from "@/context/SettingsContext";
import { useTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";
import { conversationsApi } from "@/lib/api";

export function SettingsModal({ threads = [], onClearHistory }) {
  const {
    settings,
    updateSetting,
    settingsModalOpen,
    closeSettings,
    activeTab,
    setActiveTab,
    exportChats,
  } = useSettings();

  const { theme, toggleTheme } = useTheme();
  const { user, isAuthenticated, logout, openAuthModal } = useAuth();
  const [savedToast, setSavedToast] = useState(false);
  const [clearing, setClearing] = useState(false);

  if (!settingsModalOpen) return null;

  const handleSaveInstructions = () => {
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 2000);
  };

  const handleClearTrash = async () => {
    if (!window.confirm("Are you sure you want to permanently empty your conversation trash?")) {
      return;
    }
    setClearing(true);
    try {
      if (isAuthenticated) {
        await conversationsApi.emptyTrash();
      }
      onClearHistory?.();
      setSavedToast(true);
      setTimeout(() => setSavedToast(false), 2000);
    } catch (err) {
      alert("Failed clearing trash: " + (err.message || String(err)));
    } finally {
      setClearing(false);
    }
  };

  const navItems = [
    { id: "general", label: "General", icon: <Sliders className="h-4 w-4" /> },
    { id: "customization", label: "Custom Instructions", icon: <Sparkles className="h-4 w-4" /> },
    { id: "account", label: "Account", icon: <User className="h-4 w-4" /> },
    { id: "data", label: "Data Controls", icon: <Database className="h-4 w-4" /> },
  ];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={closeSettings}
          className="absolute inset-0 bg-black/60 dark:bg-black/75 backdrop-blur-sm"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 10 }}
          transition={{ duration: 0.18 }}
          className="relative flex h-[85vh] max-h-[640px] w-full max-w-2xl flex-col sm:flex-row overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-2xl"
        >
          {/* Mobile Top Bar */}
          <div className="flex items-center justify-between border-b border-border p-3.5 sm:hidden">
            <div className="flex items-center gap-2">
              <SettingsIcon className="h-4 w-4 text-primary" />
              <span className="font-semibold text-sm">Settings</span>
            </div>
            <button
              onClick={closeSettings}
              className="rounded-lg p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Sidebar Nav */}
          <div className="w-full sm:w-52 shrink-0 border-b sm:border-b-0 sm:border-r border-border bg-sidebar/50 p-2 sm:p-3 flex sm:flex-col gap-1 overflow-x-auto">
            <div className="hidden sm:flex items-center gap-2 px-2.5 py-2 font-semibold text-sm text-sidebar-foreground mb-1">
              <SettingsIcon className="h-4 w-4 text-primary" />
              <span>Settings</span>
            </div>

            {navItems.map((item) => {
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium transition shrink-0 ${
                    active
                      ? "bg-accent text-accent-foreground font-semibold shadow-xs"
                      : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>

          {/* Main Content Area */}
          <div className="relative flex flex-1 flex-col overflow-y-auto p-4 sm:p-6 scrollbar-thin">
            {/* Desktop Close Button */}
            <button
              onClick={closeSettings}
              className="absolute right-4 top-4 hidden sm:flex rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition"
              aria-label="Close settings"
            >
              <X className="h-4 w-4" />
            </button>

            {/* TAB 1: GENERAL */}
            {activeTab === "general" && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-base font-semibold">General Preferences</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Customize your visual theme and interaction preferences.
                  </p>
                </div>

                {/* Theme Selector */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-foreground">Theme</label>
                  <div className="grid grid-cols-2 gap-2 sm:max-w-xs">
                    <button
                      type="button"
                      onClick={() => theme !== "light" && toggleTheme()}
                      className={`flex items-center justify-between rounded-xl border p-2.5 text-xs font-medium transition ${
                        theme === "light"
                          ? "border-primary bg-primary/5 text-foreground ring-1 ring-primary"
                          : "border-border bg-card hover:bg-accent text-muted-foreground"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Sun className="h-4 w-4 text-amber-500" />
                        <span>Light</span>
                      </div>
                      {theme === "light" && <Check className="h-3.5 w-3.5 text-primary" />}
                    </button>

                    <button
                      type="button"
                      onClick={() => theme !== "dark" && toggleTheme()}
                      className={`flex items-center justify-between rounded-xl border p-2.5 text-xs font-medium transition ${
                        theme === "dark"
                          ? "border-primary bg-primary/5 text-foreground ring-1 ring-primary"
                          : "border-border bg-card hover:bg-accent text-muted-foreground"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Moon className="h-4 w-4 text-indigo-400" />
                        <span>Dark</span>
                      </div>
                      {theme === "dark" && <Check className="h-3.5 w-3.5 text-primary" />}
                    </button>
                  </div>
                </div>

                {/* Streaming Toggle */}
                <div className="flex items-center justify-between border-t border-border pt-4">
                  <div>
                    <div className="text-xs font-medium text-foreground">
                      Real-time Streaming Responses
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      Show assistant words dynamically as they are generated
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.streamingEnabled}
                    onChange={(e) => updateSetting("streamingEnabled", e.target.checked)}
                    className="h-4 w-4 rounded accent-primary cursor-pointer"
                  />
                </div>

                {/* Send on Enter Toggle */}
                <div className="flex items-center justify-between border-t border-border pt-4">
                  <div>
                    <div className="text-xs font-medium text-foreground">
                      Send on Enter
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      Press Enter to send, or Shift + Enter to add a new line
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.sendOnEnter}
                    onChange={(e) => updateSetting("sendOnEnter", e.target.checked)}
                    className="h-4 w-4 rounded accent-primary cursor-pointer"
                  />
                </div>

                {/* Font Size Selector */}
                <div className="border-t border-border pt-4">
                  <div className="text-xs font-medium text-foreground mb-2">
                    Message Font Size
                  </div>
                  <div className="flex rounded-xl border border-border bg-muted/40 p-1 sm:max-w-xs">
                    {["sm", "md", "lg"].map((size) => (
                      <button
                        key={size}
                        type="button"
                        onClick={() => updateSetting("fontSize", size)}
                        className={`flex-1 rounded-lg py-1.5 text-xs font-medium capitalize transition ${
                          settings.fontSize === size
                            ? "bg-card text-foreground shadow-xs font-semibold"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {size === "sm" ? "Compact" : size === "md" ? "Normal" : "Large"}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: CUSTOM INSTRUCTIONS */}
            {activeTab === "customization" && (
              <div className="space-y-5">
                <div>
                  <h3 className="text-base font-semibold">Custom Instructions</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    What would you like IntelliChat to know about you to provide better responses?
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">
                    What should IntelliChat know about you?
                  </label>
                  <textarea
                    rows={3}
                    value={settings.userBio}
                    onChange={(e) => updateSetting("userBio", e.target.value)}
                    placeholder="e.g. I am a full-stack engineer building React & Node apps. I prefer concise code snippets with clean explanations."
                    className="w-full rounded-xl border border-border bg-background p-3 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 transition resize-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">
                    How would you like IntelliChat to respond?
                  </label>
                  <textarea
                    rows={3}
                    value={settings.customInstructions}
                    onChange={(e) => updateSetting("customInstructions", e.target.value)}
                    placeholder="e.g. Be direct and objective. Write production-ready code. Cite reasoning when asked."
                    className="w-full rounded-xl border border-border bg-background p-3 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 transition resize-none"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleSaveInstructions}
                  className="rounded-xl bg-primary px-4 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition shadow-xs"
                >
                  Save instructions
                </button>
              </div>
            )}

            {/* TAB 3: ACCOUNT */}
            {activeTab === "account" && (
              <div className="space-y-5">
                <div>
                  <h3 className="text-base font-semibold">Account & Authentication</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Manage your profile and sign-in status.
                  </p>
                </div>

                {isAuthenticated ? (
                  <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-sm border border-border">
                        {user?.name ? user.name.slice(0, 2).toUpperCase() : "U"}
                      </div>
                      <div>
                        <div className="font-semibold text-sm text-foreground">{user?.name}</div>
                        <div className="text-xs text-muted-foreground">{user?.email}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-2 border-t border-border text-xs text-emerald-600 dark:text-emerald-400">
                      <ShieldCheck className="h-4 w-4" />
                      <span>Authenticated Session (JWT Token Active)</span>
                    </div>

                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={logout}
                        className="inline-flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3.5 py-2 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-500/20 transition"
                      >
                        <LogOut className="h-3.5 w-3.5" />
                        <span>Sign out of all sessions</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-border bg-muted/20 p-5 text-center space-y-3">
                    <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <User className="h-5 w-5" />
                    </div>
                    <div className="text-sm font-semibold text-foreground">You are browsing as a guest</div>
                    <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                      Sign in or create an account to automatically sync chats, attach documents, and access your history anywhere.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        closeSettings();
                        openAuthModal("login");
                      }}
                      className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition shadow-sm"
                    >
                      <LogIn className="h-4 w-4" />
                      <span>Sign in or Register</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* TAB 4: DATA CONTROLS */}
            {activeTab === "data" && (
              <div className="space-y-5">
                <div>
                  <h3 className="text-base font-semibold">Data Controls</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Export your conversation records or manage cloud storage.
                  </p>
                </div>

                {/* Export Data */}
                <div className="flex items-center justify-between border-t border-border pt-4">
                  <div>
                    <div className="text-xs font-medium text-foreground">Export Conversations</div>
                    <div className="text-[11px] text-muted-foreground">
                      Download a JSON file containing all your conversations and message histories
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => exportChats(threads)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent transition shadow-xs"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>Export</span>
                  </button>
                </div>

                {/* Empty Trash / Clear */}
                <div className="flex items-center justify-between border-t border-border pt-4">
                  <div>
                    <div className="text-xs font-medium text-red-600 dark:text-red-400">Empty Trash History</div>
                    <div className="text-[11px] text-muted-foreground">
                      Permanently delete soft-deleted chats and clean up server storage
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleClearTrash}
                    disabled={clearing}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-500/20 transition disabled:opacity-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>{clearing ? "Emptying..." : "Empty Trash"}</span>
                  </button>
                </div>

                {/* Service Diagnostics */}
                <div className="rounded-xl border border-border bg-muted/20 p-3.5 text-xs space-y-1">
                  <div className="font-semibold text-foreground">System Status</div>
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    <span>API v1 Online & Verified (Render: intelligentchat.onrender.com)</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground font-mono pt-1">
                    Integration: n8n AI Workflow Webhook Active
                  </div>
                </div>
              </div>
            )}

            {/* Saved Notification */}
            {savedToast && (
              <div className="fixed bottom-6 right-6 flex items-center gap-2 rounded-xl bg-primary text-primary-foreground px-3.5 py-2 text-xs font-medium shadow-lg">
                <Check className="h-4 w-4" />
                <span>Settings saved successfully!</span>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
