import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { api, ApiError, TOKEN_KEY, USER_KEY } from "./api";
import type { Settings, User } from "./types";

export const DEFAULT_SETTINGS: Settings = {
  businessName: "Kariakoo Mini Market",
  phone: null,
  email: null,
  address: null,
  tin: null,
  currency: "TZS",
  timezone: "Africa/Dar_es_Salaam",
  receiptFooter: null,
  lowStockThreshold: 10,
  allowDiscounts: true,
  discountLimitPct: 10,
  updatedAt: "",
};

type AuthContextValue = {
  user: User | null;
  settings: Settings;
  loading: boolean;
  isAdmin: boolean;
  login: (username: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  refreshSettings: () => Promise<Settings | null>;
  refreshUser: () => Promise<User>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function storedUser(): User | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as User;
    if (!parsed?.id || !parsed?.role) return null;
    return parsed;
  } catch {
    return null;
  }
}

function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => storedUser());
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  const refreshSettings = useCallback(async () => {
    try {
      const next = await api.settings.get(true);
      setSettings(next);
      return next;
    } catch (error) {
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) return null;
      return null;
    }
  }, []);

  const refreshUser = useCallback(async () => {
    const { user: next } = await api.auth.me();
    setUser(next);
    localStorage.setItem(USER_KEY, JSON.stringify(next));
    return next;
  }, []);

  useEffect(() => {
    let cancelled = false;

    const onUnauthorized = () => {
      clearSession();
      setUser(null);
      setSettings(DEFAULT_SETTINGS);
      toast.error("Your session has expired. Please sign in again.");
    };

    window.addEventListener("kariakoo:unauthorized", onUnauthorized);

    const bootstrap = async () => {
      const token = localStorage.getItem(TOKEN_KEY);
      if (!token) {
        clearSession();
        localStorage.removeItem(USER_KEY);
        if (!cancelled) setLoading(false);
        return;
      }

      try {
        const { user: next } = await api.auth.me();
        if (cancelled) return;
        setUser(next);
        localStorage.setItem(USER_KEY, JSON.stringify(next));
        await refreshSettings();
      } catch (error) {
        if (!cancelled && error instanceof ApiError && (error.status === 401 || error.status === 403)) {
          clearSession();
          setUser(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void bootstrap();
    return () => {
      cancelled = true;
      window.removeEventListener("kariakoo:unauthorized", onUnauthorized);
    };
  }, [refreshSettings]);

  const login = useCallback(
    async (username: string, password: string) => {
      const result = await api.auth.login(username, password);
      localStorage.setItem(TOKEN_KEY, result.token);
      localStorage.setItem(USER_KEY, JSON.stringify(result.user));
      setUser(result.user);
      await refreshSettings();
      toast.success(`Welcome back, ${result.user.name.split(" ")[0]}.`);
      return result.user;
    },
    [refreshSettings],
  );

  const logout = useCallback(async () => {
    try {
      await api.auth.logout();
    } catch {
      // The session is cleared locally even when the server is unreachable.
    } finally {
      clearSession();
      setUser(null);
      setSettings(DEFAULT_SETTINGS);
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      settings,
      loading,
      isAdmin: user?.role === "admin",
      login,
      logout,
      refreshSettings,
      refreshUser,
    }),
    [user, settings, loading, login, logout, refreshSettings, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider.");
  return context;
}
