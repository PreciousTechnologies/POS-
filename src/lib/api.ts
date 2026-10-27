import type {
  AuditLog,
  AuditQuery,
  Category,
  CategoryInput,
  CheckoutInput,
  CheckoutResult,
  DashboardData,
  InventoryAlerts,
  InventoryMovement,
  InventorySummary,
  MovementQuery,
  Paged,
  Product,
  ProductInput,
  ProductQuery,
  ReportData,
  Sale,
  SaleDetail,
  SalesQuery,
  Settings,
  SettingsInput,
  StockAlert,
  User,
  UserInput,
} from "./types";

export const TOKEN_KEY = "kariakoo.token";
export const USER_KEY = "kariakoo.user";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") || "/api";

export class ApiError extends Error {
  status: number;
  details: unknown;

  constructor(message: string, status: number, details: unknown = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

type QueryValue = string | number | boolean | null | undefined;

function queryString(params: Record<string, QueryValue>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    search.set(key, typeof value === "boolean" ? (value ? "1" : "0") : String(value));
  }
  const encoded = search.toString();
  return encoded ? `?${encoded}` : "";
}

async function parseError(response: Response) {
  const text = await response.text();
  let message = `Request failed (${response.status}).`;
  let details: unknown = null;
  if (text) {
    try {
      const body = JSON.parse(text) as { error?: string; message?: string; details?: unknown };
      message = body.error || body.message || message;
      details = body.details ?? body;
    } catch {
      message = text;
    }
  }
  return new ApiError(message, response.status, details);
}

function authHeaders() {
  const token = localStorage.getItem(TOKEN_KEY);
  const headers = new Headers();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return headers;
}

type RequestOptions = { silentAuth?: boolean };

async function request<T>(path: string, init: RequestInit = {}, options: RequestOptions = {}): Promise<T> {
  const headers = authHeaders();
  new Headers(init.headers).forEach((value, key) => headers.set(key, value));
  if (init.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, { ...init, headers });
  } catch {
    throw new ApiError("Cannot reach the POS server. Check your connection and try again.", 0, null);
  }

  if (!response.ok) {
    if (response.status === 401 && path !== "/auth/login" && !options.silentAuth) {
      window.dispatchEvent(new Event("kariakoo:unauthorized"));
    }
    throw await parseError(response);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

function jsonBody(data: unknown): RequestInit {
  return { body: JSON.stringify(data) };
}

export const api = {
  auth: {
    login: (username: string, password: string) =>
      request<{ token: string; user: User }>("/auth/login", { method: "POST", ...jsonBody({ username, password }) }),
    me: () => request<{ user: User }>("/auth/me", {}, { silentAuth: true }),
    logout: () => request<{ ok: boolean }>("/auth/logout", { method: "POST" }),
  },

  settings: {
    get: (silentAuth = false) => request<Settings>("/settings", {}, { silentAuth }),
    update: (data: SettingsInput) => request<Settings>("/settings", { method: "PUT", ...jsonBody(data) }),
  },

  dashboard: (params: { from: string; to: string }) =>
    request<DashboardData>(`/dashboard${queryString(params)}`),

  products: {
    list: (params: ProductQuery = {}) => request<Paged<Product>>(`/products${queryString(params)}`),
    get: (id: string) => request<Product>(`/products/${id}`),
    create: (data: ProductInput) => request<Product>("/products", { method: "POST", ...jsonBody(data) }),
    update: (id: string, data: ProductInput) =>
      request<Product>(`/products/${id}`, { method: "PUT", ...jsonBody(data) }),
    deactivate: (id: string) =>
      request<{ ok: boolean; alreadyInactive?: boolean }>(`/products/${id}`, { method: "DELETE" }),
  },

  categories: {
    list: () => request<{ items: Category[] }>("/categories"),
    create: (data: CategoryInput) => request<Category>("/categories", { method: "POST", ...jsonBody(data) }),
    update: (id: string, data: CategoryInput) =>
      request<Category>(`/categories/${id}`, { method: "PUT", ...jsonBody(data) }),
  },

  inventory: {
    summary: () => request<InventorySummary>("/inventory/summary"),
    movements: (params: MovementQuery = {}) =>
      request<Paged<InventoryMovement>>(`/inventory/movements${queryString(params)}`),
    alerts: () => request<InventoryAlerts>("/inventory/alerts"),
    stockIn: (data: { productId: string; qty: number; reason: string; reference?: string }) =>
      request<StockAlert>("/inventory/stock-in", { method: "POST", ...jsonBody(data) }),
    adjust: (data: { productId: string; qtyChange: number; reason: string }) =>
      request<{ id: string; stock: number }>("/inventory/adjust", { method: "POST", ...jsonBody(data) }),
  },

  sales: {
    list: (params: SalesQuery = {}) => request<Paged<Sale>>(`/sales${queryString(params)}`),
    get: (id: string) => request<SaleDetail>(`/sales/${id}`),
    checkout: (data: CheckoutInput) =>
      request<CheckoutResult>("/sales/checkout", { method: "POST", ...jsonBody(data) }),
    void: (id: string) => request<SaleDetail>(`/sales/${id}/void`, { method: "POST" }),
    refund: (id: string, data: { amount: number; reason: string; restock: boolean }) =>
      request<SaleDetail>(`/sales/${id}/refund`, { method: "POST", ...jsonBody(data) }),
  },

  reports: {
    summary: (params: { from: string; to: string }) =>
      request<ReportData>(`/reports/summary${queryString(params)}`),
    exportCsv: async (params: { from: string; to: string; type: "sales" | "inventory" | "best-sellers" | "summary" }) => {
      const headers = authHeaders();
      let response: Response;
      try {
        response = await fetch(`${API_BASE}/reports/export${queryString(params)}`, { headers });
      } catch {
        throw new ApiError("Export failed because the server could not be reached.", 0, null);
      }
      if (!response.ok) {
        if (response.status === 401) window.dispatchEvent(new Event("kariakoo:unauthorized"));
        throw await parseError(response);
      }
      const blob = await response.blob();
      const disposition = response.headers.get("content-disposition") ?? "";
      const match = /filename="?([^";]+)"?/i.exec(disposition);
      const fallback = `${params.type}-${params.from}_to_${params.to}.csv`;
      const filename = match?.[1] ?? fallback;
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1500);
      return filename;
    },
  },

  users: {
    list: () => request<{ items: User[] }>("/users"),
    create: (data: UserInput) => request<User>("/users", { method: "POST", ...jsonBody(data) }),
    update: (id: string, data: UserInput) => request<User>(`/users/${id}`, { method: "PUT", ...jsonBody(data) }),
  },

  audit: {
    list: (params: AuditQuery = {}) =>
      request<Paged<AuditLog> & { actions: Array<{ action: string; count: number }> }>(
        `/audit${queryString(params)}`,
      ),
  },
};
