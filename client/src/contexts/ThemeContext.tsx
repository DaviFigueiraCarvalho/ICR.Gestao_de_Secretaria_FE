import React, { createContext, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark";
type ThemeMode = "system" | Theme;

interface ThemeContextType {
  theme: Theme;
  mode: ThemeMode;
  toggleTheme?: () => void;
  setThemeMode?: (mode: ThemeMode) => void;
  switchable: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: Theme;
  switchable?: boolean;
  defaultMode?: ThemeMode;
}

const THEME_MODE_STORAGE_KEY = "theme_mode";

const resolveThemeFromMode = (mode: ThemeMode): Theme => {
  if (mode === "light" || mode === "dark") return mode;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
};

export function ThemeProvider({
  children,
  defaultTheme = "light",
  switchable = false,
  defaultMode,
}: ThemeProviderProps) {
  const [mode, setMode] = useState<ThemeMode>(() => {
    if (switchable) {
      const stored = localStorage.getItem(THEME_MODE_STORAGE_KEY);
      if (stored === "light" || stored === "dark" || stored === "system") {
        return stored;
      }
    }
    if (defaultMode) return defaultMode;
    return defaultTheme;
  });
  const [theme, setTheme] = useState<Theme>(() => resolveThemeFromMode(mode));

  useEffect(() => {
    const applyResolvedTheme = () => {
      const resolvedTheme = resolveThemeFromMode(mode);
      setTheme(resolvedTheme);

      const root = document.documentElement;
      root.classList.remove("light", "dark");
      root.classList.add(resolvedTheme);

      if (switchable) {
        localStorage.setItem(THEME_MODE_STORAGE_KEY, mode);
      }
    };

    applyResolvedTheme();

    if (mode !== "system") return;

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const listener = () => applyResolvedTheme();
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, [mode, switchable]);

  const toggleTheme = switchable
    ? () => {
        setMode(prev => {
          if (prev === "system") {
            return resolveThemeFromMode("system") === "light" ? "dark" : "light";
          }
          return prev === "light" ? "dark" : "light";
        });
      }
    : undefined;

  const setThemeMode = switchable
    ? (nextMode: ThemeMode) => setMode(nextMode)
    : undefined;

  return (
    <ThemeContext.Provider value={{ theme, mode, toggleTheme, setThemeMode, switchable }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
