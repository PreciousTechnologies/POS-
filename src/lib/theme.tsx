import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
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

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme, themes } = useTheme();
  const reduceMotion = useReducedMotion();
  const index = Math.max(0, themes.findIndex((entry) => entry.id === theme));
  const current = themes[index] ?? themes[0];
  const next = themes[(index + 1) % themes.length];
  const Icon = current.Icon;

  return (
    <button
      type="button"
      className={cn("theme-toggle", className)}
      onClick={() => setTheme(next.id)}
      aria-label={`Theme: ${current.label}. Switch to ${next.label}.`}
      title={`${current.label} — click for ${next.label}`}
      data-theme={theme}
    >
      <span className="theme-toggle-icon" aria-hidden="true">
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={theme}
            className="theme-toggle-glyph"
            initial={reduceMotion ? false : { rotate: -90, scale: 0.4, opacity: 0 }}
            animate={{ rotate: 0, scale: 1, opacity: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { rotate: 90, scale: 0.4, opacity: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.24, ease: [0.22, 1, 0.36, 1] }}
          >
            <Icon size={16} strokeWidth={1.8} />
          </motion.span>
        </AnimatePresence>
      </span>
      <span className="theme-toggle-label">{current.short}</span>
      <span className="theme-toggle-dots" aria-hidden="true">
        {themes.map((entry) => (
          <span
            key={entry.id}
            className={cn("theme-toggle-dot", entry.id === theme && "is-active")}
          />
        ))}
      </span>
    </button>
  );
}
