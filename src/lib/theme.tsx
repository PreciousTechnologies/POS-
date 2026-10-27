import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { Coffee, Moon, Sparkles, type LucideIcon } from "lucide-react";
import { cn } from "./utils";

export type Theme = "lavender" | "brown" | "dark";

const THEME_KEY = "kariakoo.theme";

const THEMES: Array<{ id: Theme; label: string; short: string; Icon: LucideIcon; color: string }> = [
  { id: "lavender", label: "Lavender glass", short: "Lavender", Icon: Sparkles, color: "#f6f0ff" },
  { id: "brown", label: "Earth glass", short: "Earth", Icon: Coffee, color: "#f6efe6" },
  { id: "dark", label: "Midnight glass", short: "Midnight", Icon: Moon, color: "#0d0b14" },
];

type ThemeContextValue = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  themes: typeof THEMES;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readTheme(): Theme {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === "lavender" || stored === "brown" || stored === "dark") return stored;
  } catch {
    // localStorage can be unavailable in hardened browser contexts.
  }
  return "lavender";
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.remove("theme-lavender", "theme-brown", "theme-dark");
  root.classList.add(`theme-${theme}`);
  root.dataset.theme = theme;
  root.style.colorScheme = theme === "dark" ? "dark" : "light";
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (meta) meta.content = THEMES.find((entry) => entry.id === theme)?.color ?? "#f6f0ff";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(readTheme);

  useEffect(() => {
    applyTheme(theme);
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      // Ignore storage failures; the theme still applies for this session.
    }
  }, [theme]);

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, setTheme: setThemeState, themes: THEMES }),
    [theme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used inside ThemeProvider.");
  return context;
}

export function ThemeToggle({ className, labels = false }: { className?: string; labels?: boolean }) {
  const { theme, setTheme } = useTheme();
  return (
    <div className={cn("theme-switch", className)} role="group" aria-label="Color theme">
      {THEMES.map(({ id, label, short, Icon }) => (
        <button
          key={id}
          type="button"
          className={cn("theme-switch-option", theme === id && "is-active")}
          onClick={() => setTheme(id)}
          aria-label={`Use ${label}`}
          aria-pressed={theme === id}
          title={label}
        >
          <Icon size={15} strokeWidth={1.8} />
          {labels && <span>{short}</span>}
        </button>
      ))}
    </div>
  );
}
