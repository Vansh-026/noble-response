import React, { createContext, useContext, useEffect, useState } from "react";

const SETTINGS_KEY = "intellichat_settings_v1";

const defaultSettings = {
  streamingEnabled: true,
  sendOnEnter: true,
  fontSize: "md", // 'sm' | 'md' | 'lg'
  customInstructions: "",
  userBio: "",
};

const SettingsContext = createContext(null);

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(() => {
    if (typeof window === "undefined") return defaultSettings;
    try {
      const stored = localStorage.getItem(SETTINGS_KEY);
      return stored ? { ...defaultSettings, ...JSON.parse(stored) } : defaultSettings;
    } catch {
      return defaultSettings;
    }
  });

  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("general");

  useEffect(() => {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch (err) {
      console.warn("Failed saving settings:", err);
    }
  }, [settings]);

  const updateSetting = (key, value) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const openSettings = (tab = "general") => {
    setActiveTab(tab);
    setSettingsModalOpen(true);
  };

  const closeSettings = () => {
    setSettingsModalOpen(false);
  };

  const exportChats = (threads) => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(threads, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `intellichat_export_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <SettingsContext.Provider
      value={{
        settings,
        updateSetting,
        settingsModalOpen,
        openSettings,
        closeSettings,
        activeTab,
        setActiveTab,
        exportChats,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error("useSettings must be used within a SettingsProvider");
  }
  return context;
}
