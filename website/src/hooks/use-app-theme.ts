"use client";

import { create } from "zustand";

type ThemeMode = "light" | "dark";

const STORAGE_KEY = "trading-theme";

function applyTheme(theme: ThemeMode) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", theme === "dark");
}

interface ThemeState {
  theme: ThemeMode;
  initialized: boolean;
  initialize: () => void;
  setTheme: (theme: ThemeMode) => void;
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: "dark",
  initialized: false,
  initialize: () => {
    if (get().initialized) return;

    let next: ThemeMode = "dark";
    if (typeof window !== "undefined") {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored === "light" || stored === "dark") {
        next = stored;
      }
    }

    applyTheme(next);
    set({ theme: next, initialized: true });
  },
  setTheme: (theme) => {
    applyTheme(theme);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, theme);
    }
    set({ theme, initialized: true });
  },
}));

export function useAppTheme() {
  const { theme, setTheme, initialize, initialized } = useThemeStore();

  return {
    theme,
    resolvedTheme: theme,
    setTheme,
    initialize,
    initialized,
    toggleTheme: () => setTheme(theme === "dark" ? "light" : "dark"),
  };
}
