import { useEffect } from "react";
import { Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { Toaster } from "sonner";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { AppShell } from "@/components/AppShell";
import { BootScreen } from "@/components/ui/States";
import { LoginPage } from "@/pages/Login";
import { DashboardPage } from "@/pages/Dashboard";
import { PosPage } from "@/pages/POS";
import { ProductsPage } from "@/pages/Products";
import { CategoriesPage } from "@/pages/Categories";
import { InventoryPage } from "@/pages/Inventory";
import { SalesPage } from "@/pages/Sales";
import { SaleDetailPage } from "@/pages/SaleDetail";
import { ReportsPage } from "@/pages/Reports";
import { UsersPage } from "@/pages/Users";
import { SettingsPage } from "@/pages/Settings";
import { AuditPage } from "@/pages/Audit";
import { NotFoundPage } from "@/pages/NotFound";

function ProtectedLayout() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <BootScreen />;
  if (!user) {
    return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />;
  }

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}

function AdminOnly() {
  const { isAdmin, loading } = useAuth();
  if (loading) return <BootScreen />;
  if (!isAdmin) return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [pathname]);
  return null;
}

function AppToaster() {
  const { theme } = useTheme();
  return (
    <Toaster
      theme={theme === "dark" ? "dark" : "light"}
      position="top-right"
      closeButton
      richColors
      duration={3800}
      toastOptions={{
        style: {
          fontFamily: "var(--font-body)",
          fontSize: "12px",
          borderRadius: "14px",
          border: "1px solid var(--border)",
        },
      }}
    />
  );
}

export function App() {
  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<ProtectedLayout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="pos" element={<PosPage />} />
          <Route path="products" element={<ProductsPage />} />
          <Route path="categories" element={<CategoriesPage />} />
          <Route path="sales" element={<SalesPage />} />
          <Route path="sales/:id" element={<SaleDetailPage />} />
          <Route element={<AdminOnly />}>
            <Route path="inventory" element={<InventoryPage />} />
            <Route path="reports" element={<ReportsPage />} />
            <Route path="users" element={<UsersPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="audit" element={<AuditPage />} />
          </Route>
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
      <AppToaster />
    </>
  );
}
