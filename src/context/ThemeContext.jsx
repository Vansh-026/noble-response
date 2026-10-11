import React, { createContext, useContext, useEffect, useState } from "react";

const ThemeContext = createContext({
  theme: "dark",
  toggleTheme: () => {},
});

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("intellichat_theme") || "dark";
    }
    return "dark";
  });

  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;

    if (theme === "light") {
      root.classList.remove("dark");
      root.classList.add("light");
      body.classList.remove("dark");
      body.classList.add("light");
    } else {
      root.classList.remove("light");
      root.classList.add("dark");
      body.classList.remove("light");
      body.classList.add("dark");
    }

    localStorage.setItem("intellichat_theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };

  return <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
