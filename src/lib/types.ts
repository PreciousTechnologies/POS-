export type Role = "admin" | "cashier";

export type User = {
  id: string;
  username: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
  createdAt: string;
};

export type Category = {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  productCount: number;
  activeProductCount: number;
};

export type Product = {
  id: string;
  sku: string;
  barcode: string | null;
  name: string;
  categoryId: string;
  categoryName: string;
  costPrice?: number;
  price: number;
  stock: number;
  minStock: number;
  unit: string | null;
  description: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type Paged<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
};

export type PaymentMethod = "cash" | "mobile_money" | "card";
export type SaleStatus = "completed" | "voided" | "refunded" | "partially_refunded";

export type Sale = {
  id: string;
  ref: string;
  cashierId: string;
  cashierName: string;
  subtotal: number;
  discount: number;
  total: number;
  costTotal: number;
  status: SaleStatus;
  paymentMethod: PaymentMethod;
  amountReceived: number;
  changeDue: number;
  customerName: string | null;
  note: string | null;
  businessDate: string;
  createdAt: string;
  voidedAt: string | null;
  refundedAmount: number;
  itemCount: number;
  units: number;
};

export type SaleItem = {
  id: string;
  productId: string;
  name: string;
  sku: string;
  qty: number;
  unitPrice: number;
  discount: number;
  lineTotal: number;
  unitCost: number;
};

export type Payment = {
  id: string;
  method: PaymentMethod;
  amount: number;
  status: string;
  reference: string | null;
  simulated: boolean;
  createdAt: string;
};

export type Refund = {
  id: string;
  amount: number;
  costAmount: number;
  reason: string;
  restock: boolean;
  businessDate: string;
  createdAt: string;
  userName: string;
};

export type SaleDetail = Sale & {
  items: SaleItem[];
  payments: Payment[];
  refunds: Refund[];
};

export type DashboardSeriesPoint = {
  date: string;
  revenue: number;
  transactions: number;
  refunds: number;
};

export type PaymentMixRow = {
  method: PaymentMethod;
  count: number;
  amount: number;
};

export type BestSeller = {
  productId: string;
  name: string;
  sku: string;
  qty: number;
  revenue: number;
};

export type StockAlert = {
  id: string;
  sku: string;
  name: string;
  stock: number;
  minStock: number;
  categoryName: string;
};

export type DashboardData = {
  range: { from: string; to: string };
  scope: "business" | "cashier";
  kpis: {
    grossSales: number;
    refunds: number;
    netRevenue: number;
    transactions: number;
    itemsSold: number;
    avgSale: number;
    discounts: number;
    profit: number;
    refundCount: number;
    lowStockCount: number;
    outOfStockCount: number;
  };
  series: DashboardSeriesPoint[];
  paymentMix: PaymentMixRow[];
  bestSellers: BestSeller[];
  lowStock: StockAlert[];
  recentSales: Array<{
    id: string;
    ref: string;
    total: number;
    status: SaleStatus;
    paymentMethod: PaymentMethod;
    createdAt: string;
    cashierName: string;
  }>;
};

export type ReportData = {
  range: { from: string; to: string };
  generatedAt: string;
  totals: {
    grossSales: number;
    refunds: number;
    netRevenue: number;
    profit: number;
    discounts: number;
    transactions: number;
    itemsSold: number;
    avgSale: number;
    refundCount: number;
  };
  series: Array<{
    date: string;
    revenue: number;
    refunds: number;
    net: number;
    transactions: number;
    cashiers: number;
  }>;
  paymentMix: PaymentMixRow[];
  bestSellers: BestSeller[];
  categories: Array<{ id: string; name: string; qty: number; revenue: number }>;
  inventory: {
    activeProducts: number;
    units: number;
    costValue: number;
    retailValue: number;
    lowStock: number;
    outOfStock: number;
  };
  lowStock: StockAlert[];
  outOfStock: StockAlert[];
  statusBreakdown: Array<{ status: SaleStatus; count: number; total: number }>;
};

export type InventorySummary = {
  activeProducts: number;
  units: number;
  costValuation: number;
  retailValuation: number;
  outOfStock: number;
  lowStock: number;
};

export type InventoryMovement = {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  qtyChange: number;
  type: "sale" | "void" | "return" | "adjustment" | "stock_in";
  reason: string | null;
  reference: string | null;
  userName: string | null;
  createdAt: string;
};

export type InventoryAlerts = {
  lowStock: StockAlert[];
  outOfStock: StockAlert[];
};

export type AuditLog = {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  description: string;
  meta: unknown;
  createdAt: string;
  userName: string | null;
  userRole: Role | null;
};

export type Settings = {
  businessName: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  tin: string | null;
  currency: string;
  timezone: string;
  receiptFooter: string | null;
  lowStockThreshold: number;
  allowDiscounts: boolean;
  discountLimitPct: number;
  updatedAt: string;
};

export type SettingsInput = Omit<Settings, "currency" | "updatedAt">;

export type ProductInput = {
  name: string;
  sku: string;
  barcode: string;
  categoryId: string;
  costPrice: number;
  price: number;
  stock?: number;
  minStock: number;
  unit: string;
  description: string;
  active: boolean;
};

export type CategoryInput = {
  name: string;
  description: string;
  active: boolean;
};

export type UserInput = {
  username: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
  password?: string;
};

export type CheckoutInput = {
  items: Array<{ productId: string; qty: number }>;
  discount: number;
  paymentMethod: PaymentMethod;
  amountReceived?: number;
  mobileProvider?: string;
  cardProvider?: string;
  customerName?: string;
  note?: string;
  idempotencyKey: string;
};

export type CheckoutResult = SaleDetail & { duplicate: boolean };

export type ProductQuery = {
  page?: number;
  pageSize?: number;
  search?: string;
  categoryId?: string;
  status?: "active" | "inactive";
  barcode?: string;
  lowStock?: boolean;
  outOfStock?: boolean;
  sortKey?: string;
  sortDir?: "asc" | "desc";
};

export type SalesQuery = {
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
  search?: string;
  method?: PaymentMethod | "";
  status?: SaleStatus | "";
  cashierId?: string;
  sortKey?: string;
  sortDir?: "asc" | "desc";
};

export type MovementQuery = {
  page?: number;
  pageSize?: number;
  search?: string;
  type?: string;
};

export type AuditQuery = {
  page?: number;
  pageSize?: number;
  search?: string;
  action?: string;
};
