import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import {
  BarChart3,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  ReceiptText,
  ScrollText,
  Settings,
  ShoppingCart,
  Store,
  Tags,
  Users,
  Warehouse,
  X,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { drawerLeft } from "@/lib/motion";
import { cn, roleLabel } from "@/lib/utils";
import { ThemeToggle } from "@/lib/theme";
import { Avatar } from "./ui/Avatar";
import { Button } from "./ui/Button";

const SIDEBAR_KEY = "kariakoo.sidebar";

type NavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  adminOnly?: boolean;
};

const navGroups: Array<{ label: string; items: NavItem[] }> = [
  {
    label: "Workspace",
    items: [
      { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { to: "/pos", label: "Point of sale", icon: ShoppingCart },
      { to: "/sales", label: "Sales", icon: ReceiptText },
      { to: "/products", label: "Products", icon: Package },
      { to: "/categories", label: "Categories", icon: Tags },
    ],
  },
  {
    label: "Operations",
    items: [
      { to: "/inventory", label: "Inventory", icon: Warehouse, adminOnly: true },
      { to: "/reports", label: "Reports", icon: BarChart3, adminOnly: true },
    ],
  },
  {
    label: "Administration",
    items: [
      { to: "/users", label: "Team", icon: Users, adminOnly: true },
      { to: "/settings", label: "Settings", icon: Settings, adminOnly: true },
      { to: "/audit", label: "Audit log", icon: ScrollText, adminOnly: true },
    ],
  },
];

function SidebarContent({
  collapsed,
  mobile = false,
  onToggle,
  onClose,
}: {
  collapsed: boolean;
  mobile?: boolean;
  onToggle?: () => void;
  onClose?: () => void;
}) {
  const { user, settings, isAdmin, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="sidebar-panel">
      <div className="sidebar-brand">
        <div className="brand-mark">
          <Store size={22} strokeWidth={1.7} />
        </div>
        <div className="brand-copy">
          <div className="brand-name">Kariakoo</div>
          <div className="brand-meta">Point of sale</div>
        </div>
        {mobile ? (
          <button type="button" className="sidebar-toggle" onClick={onClose} aria-label="Close menu">
            <X size={15} />
          </button>
        ) : (
          <button
            type="button"
            className="sidebar-toggle"
            onClick={onToggle}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
          </button>
        )}
      </div>

      <nav className="sidebar-nav" aria-label="Main navigation">
        {navGroups.map((group) => {
          const items = group.items.filter((item) => !item.adminOnly || isAdmin);
          if (!items.length) return null;
          return (
            <div key={group.label}>
              <div className="nav-section-label">{group.label}</div>
              {items.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === "/dashboard"}
                    className={({ isActive }) => cn("nav-link", isActive && "active")}
                    title={collapsed ? item.label : undefined}
                    onClick={mobile ? onClose : undefined}
                  >
                    <span className="nav-icon">
                      <Icon size={16} strokeWidth={1.8} />
                    </span>
                    <span className="nav-label">{item.label}</span>
                  </NavLink>
                );
              })}
            </div>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-user">
          <Avatar name={user?.name} size="sm" />
          <div className="user-meta">
            <div className="user-name">{user?.name ?? "Signed in"}</div>
            <div className="user-role">{roleLabel(user?.role)}</div>
          </div>
        </div>
        <div className="hidden px-2 pb-1 text-[10px] leading-relaxed soft lg:block">
          {settings.businessName}
          <br />
          <span style={{ color: "var(--text-soft)" }}>{settings.timezone.replaceAll("_", " ")}</span>
        </div>
        <ThemeToggle className="sidebar-theme" />
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start"
          onClick={handleLogout}
          leftIcon={<LogOut size={14} />}
        >
          <span className="sidebar-label">Sign out</span>
        </Button>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, settings, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(SIDEBAR_KEY) === "collapsed";
    } catch {
      return false;
    }
  });
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_KEY, collapsed ? "collapsed" : "expanded");
    } catch {
      // Ignore storage failures.
    }
  }, [collapsed]);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [mobileOpen]);

  const current = useMemo(() => {
    const all = navGroups.flatMap((group) => group.items);
    if (location.pathname.startsWith("/sales/")) {
      return { label: "Sale detail", icon: ReceiptText };
    }
    return all.find((item) => location.pathname === item.to || location.pathname.startsWith(`${item.to}/`)) ?? {
      label: "Workspace",
      icon: LayoutDashboard,
    };
  }, [location.pathname]);

  const CurrentIcon = current.icon;

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className={cn("app-shell", collapsed && "is-collapsed")}>
      <aside className="sidebar liquid-glass-strong">
        <SidebarContent collapsed={collapsed} onToggle={() => setCollapsed((value) => !value)} />
      </aside>

      {createPortal(
        <AnimatePresence>
          {mobileOpen && (
            <>
              <motion.div
                className="mobile-scrim"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
                onClick={() => setMobileOpen(false)}
              />
              <motion.aside
                className="mobile-drawer liquid-glass-strong"
                variants={drawerLeft}
                initial="initial"
                animate="animate"
                exit="exit"
                role="dialog"
                aria-modal="true"
                aria-label="Navigation menu"
              >
                <SidebarContent collapsed={false} mobile onClose={() => setMobileOpen(false)} />
              </motion.aside>
            </>
          )}
        </AnimatePresence>,
        document.body,
      )}

      <div className="app-main">
        <div className="app-topbar-wrap">
          <header className="topbar liquid-glass">
            <div className="topbar-context">
              <Button
                variant="glass"
                size="icon-sm"
                className="mobile-only"
                onClick={() => setMobileOpen(true)}
                aria-label="Open menu"
              >
                <Menu size={17} />
              </Button>
              <div className="topbar-context-icon">
                <CurrentIcon size={17} strokeWidth={1.8} />
              </div>
              <div className="min-w-0">
                <div className="topbar-title">{current.label}</div>
                <div className="topbar-subtitle">{settings.businessName}</div>
              </div>
            </div>
            <div className="topbar-actions">
              {location.pathname !== "/pos" && (
                <Button
                  size="sm"
                  onClick={() => navigate("/pos")}
                  leftIcon={<Plus size={14} />}
                  className="hidden sm:inline-flex"
                >
                  New sale
                </Button>
              )}
              <ThemeToggle />
              <div className="mx-1 hidden h-7 w-px sm:block" style={{ background: "var(--border)" }} />
              <div className="flex items-center gap-2">
                <Avatar name={user?.name} size="sm" />
                <div className="hidden min-w-0 lg:block">
                  <div className="max-w-[120px] truncate text-[11px] font-semibold leading-tight">{user?.name}</div>
                  <div className="text-[9px] soft">{roleLabel(user?.role)}</div>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={handleLogout}
                aria-label="Sign out"
                title="Sign out"
              >
                <LogOut size={15} />
              </Button>
            </div>
          </header>
        </div>
        <main className="app-content">{children}</main>
      </div>
    </div>
  );
}
