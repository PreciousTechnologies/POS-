import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  ArrowDownToLine,
  Boxes,
  Package,
  Search,
  SlidersHorizontal,
  TriangleAlert,
  Wallet,
  X,
} from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type {
  InventoryAlerts,
  InventoryMovement,
  InventorySummary,
  Product,
  StockAlert,
} from "@/lib/types";
import {
  formatDateTime,
  formatNumber,
  formatTZS,
  movementLabel,
  useDebouncedValue,
} from "@/lib/utils";
import { PageHeader } from "@/components/ui/PageHeader";
import { KpiCard } from "@/components/ui/KpiCard";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Field, Input, Select } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { DataTable, Pagination, type Column } from "@/components/ui/DataTable";
import { ProductArt } from "@/components/ui/ProductArt";
import { EmptyState, ErrorPanel, Skeleton } from "@/components/ui/States";

type InventoryTarget = {
  id: string;
  name: string;
  sku: string;
  stock: number;
  minStock: number;
  categoryName: string;
};

type StockInForm = { qty: string; reason: string; reference: string };
type AdjustForm = { qtyChange: string; reason: string };

const emptyStockIn: StockInForm = { qty: "", reason: "", reference: "" };
const emptyAdjust: AdjustForm = { qtyChange: "", reason: "" };

function toTarget(product: Product | StockAlert): InventoryTarget {
  return {
    id: product.id,
    name: product.name,
    sku: product.sku,
    stock: product.stock,
    minStock: product.minStock,
    categoryName: product.categoryName,
  };
}

function movementTone(type: InventoryMovement["type"]) {
  if (type === "stock_in" || type === "return") return "success" as const;
  if (type === "adjustment") return "info" as const;
  if (type === "void") return "warning" as const;
  return "neutral" as const;
}

export function InventoryPage() {
  const { settings } = useAuth();
  const [summary, setSummary] = useState<InventorySummary | null>(null);
  const [alerts, setAlerts] = useState<InventoryAlerts>({ lowStock: [], outOfStock: [] });
  const [inventoryLoading, setInventoryLoading] = useState(true);
  const [inventoryError, setInventoryError] = useState<string | null>(null);

  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [movementTotal, setMovementTotal] = useState(0);
  const [movementPage, setMovementPage] = useState(1);
  const [movementPageSize, setMovementPageSize] = useState(12);
  const [movementSearch, setMovementSearch] = useState("");
  const debouncedSearch = useDebouncedValue(movementSearch, 300);
  const [movementType, setMovementType] = useState("");
  const [movementsLoading, setMovementsLoading] = useState(true);
  const [movementsError, setMovementsError] = useState<string | null>(null);

  const [reloadKey, setReloadKey] = useState(0);

  const [stockInOpen, setStockInOpen] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [target, setTarget] = useState<InventoryTarget | null>(null);
  const [productQuery, setProductQuery] = useState("");
  const debouncedProductQuery = useDebouncedValue(productQuery, 260);
  const [productResults, setProductResults] = useState<Product[]>([]);
  const [productLoading, setProductLoading] = useState(false);
  const [stockInForm, setStockInForm] = useState<StockInForm>(emptyStockIn);
  const [adjustForm, setAdjustForm] = useState<AdjustForm>(emptyAdjust);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setInventoryLoading(true);
    setInventoryError(null);
    Promise.all([api.inventory.summary(), api.inventory.alerts()])
      .then(([nextSummary, nextAlerts]) => {
        if (cancelled) return;
        setSummary(nextSummary);
        setAlerts(nextAlerts);
      })
      .catch((caught) => {
        if (cancelled) return;
        setInventoryError(caught instanceof Error ? caught.message : "Could not load inventory.");
      })
      .finally(() => {
        if (!cancelled) setInventoryLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  useEffect(() => {
    let cancelled = false;
    setMovementsLoading(true);
    setMovementsError(null);
    api.inventory
      .movements({
        page: movementPage,
        pageSize: movementPageSize,
        search: debouncedSearch.trim() || undefined,
        type: movementType || undefined,
      })
      .then((result) => {
        if (cancelled) return;
        setMovements(result.items);
        setMovementTotal(result.total);
      })
      .catch((caught) => {
        if (cancelled) return;
        setMovementsError(caught instanceof Error ? caught.message : "Could not load stock movements.");
      })
      .finally(() => {
        if (!cancelled) setMovementsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [movementPage, movementPageSize, debouncedSearch, movementType, reloadKey]);

  useEffect(() => {
    if ((!stockInOpen && !adjustOpen) || target) return;
    let cancelled = false;
    setProductLoading(true);
    api.products
      .list({
        search: debouncedProductQuery.trim() || undefined,
        pageSize: 20,
        status: "active",
        sortKey: "name",
        sortDir: "asc",
      })
      .then((result) => {
        if (!cancelled) setProductResults(result.items);
      })
      .catch(() => {
        if (!cancelled) setProductResults([]);
      })
      .finally(() => {
        if (!cancelled) setProductLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [stockInOpen, adjustOpen, target, debouncedProductQuery]);

  const openStockIn = (product?: InventoryTarget) => {
    setAdjustOpen(false);
    setStockInOpen(true);
    setTarget(product ?? null);
    setStockInForm(emptyStockIn);
    setFormError(null);
    setProductQuery("");
  };

  const openAdjust = (product?: InventoryTarget) => {
    setStockInOpen(false);
    setAdjustOpen(true);
    setTarget(product ?? null);
    setAdjustForm(emptyAdjust);
    setFormError(null);
    setProductQuery("");
  };

  const closeForms = () => {
    if (submitting) return;
    setStockInOpen(false);
    setAdjustOpen(false);
    setTarget(null);
    setFormError(null);
  };

  const submitStockIn = async () => {
    if (!target) {
      setFormError("Select a product first.");
      return;
    }
    const qty = Number(stockInForm.qty);
    if (!Number.isInteger(qty) || qty <= 0) {
      setFormError("Quantity must be a positive whole number.");
      return;
    }
    if (stockInForm.reason.trim().length < 3) {
      setFormError("Provide a short reason for the stock entry.");
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      await api.inventory.stockIn({
        productId: target.id,
        qty,
        reason: stockInForm.reason.trim(),
        reference: stockInForm.reference.trim() || undefined,
      });
      toast.success(`${formatNumber(qty)} unit${qty === 1 ? "" : "s"} added to ${target.name}.`);
      setStockInOpen(false);
      setTarget(null);
      setReloadKey((value) => value + 1);
    } catch (caught) {
      setFormError(caught instanceof ApiError ? caught.message : "Could not add stock.");
    } finally {
      setSubmitting(false);
    }
  };

  const submitAdjustment = async () => {
    if (!target) {
      setFormError("Select a product first.");
      return;
    }
    const qtyChange = Number(adjustForm.qtyChange);
    if (!Number.isInteger(qtyChange) || qtyChange === 0) {
      setFormError("Enter a non-zero whole number. Use a negative value to reduce stock.");
      return;
    }
    if (target.stock + qtyChange < 0) {
      setFormError(`This would leave negative stock. Current stock is ${target.stock}.`);
      return;
    }
    if (adjustForm.reason.trim().length < 3) {
      setFormError("Provide a short reason for the adjustment.");
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      await api.inventory.adjust({
        productId: target.id,
        qtyChange,
        reason: adjustForm.reason.trim(),
      });
      toast.success(`${target.name} adjusted by ${qtyChange > 0 ? "+" : ""}${formatNumber(qtyChange)}.`);
      setAdjustOpen(false);
      setTarget(null);
      setReloadKey((value) => value + 1);
    } catch (caught) {
      setFormError(caught instanceof ApiError ? caught.message : "Could not adjust stock.");
    } finally {
      setSubmitting(false);
    }
  };

  const movementColumns: Column<InventoryMovement>[] = [
    {
      key: "when",
      header: "When",
      cell: (movement) => (
        <span className="whitespace-nowrap text-[11px] muted">
          {formatDateTime(movement.createdAt, settings.timezone)}
        </span>
      ),
    },
    {
      key: "product",
      header: "Product",
      cell: (movement) => (
        <div>
          <div className="cell-main max-w-[200px] truncate">{movement.productName}</div>
          <div className="cell-sub">{movement.sku}</div>
        </div>
      ),
    },
    {
      key: "type",
      header: "Type",
      cell: (movement) => <Badge tone={movementTone(movement.type)}>{movementLabel(movement.type)}</Badge>,
    },
    {
      key: "change",
      header: "Change",
      align: "right",
      cell: (movement) => (
        <span
          className="numeric text-[12px] font-bold"
          style={{ color: movement.qtyChange > 0 ? "var(--success)" : "var(--danger)" }}
        >
          {movement.qtyChange > 0 ? "+" : ""}
          {formatNumber(movement.qtyChange)}
        </span>
      ),
    },
    {
      key: "reason",
      header: "Reason / reference",
      cell: (movement) => (
        <div>
          <div className="max-w-[220px] truncate text-[11px]">{movement.reason ?? "—"}</div>
          <div className="cell-sub">{movement.reference ?? "No reference"}</div>
        </div>
      ),
    },
    {
      key: "user",
      header: "By",
      cell: (movement) => <span className="text-[11px] muted">{movement.userName ?? "System"}</span>,
    },
  ];

  const alertsCount = (summary?.lowStock ?? 0) + (summary?.outOfStock ?? 0);

  return (
    <div className="page-shell">
      <PageHeader
        title="Inventory"
        subtitle="Stock positions, movement history, and the products that need attention."
        icon={<Boxes size={18} />}
        actions={
          <>
            <Button variant="secondary" onClick={() => openAdjust()} leftIcon={<SlidersHorizontal size={14} />}>
              Adjust
            </Button>
            <Button onClick={() => openStockIn()} leftIcon={<ArrowDownToLine size={14} />}>
              Stock in
            </Button>
          </>
        }
      />

      {inventoryError && <ErrorPanel message={inventoryError} onRetry={() => setReloadKey((value) => value + 1)} />}

      <div className="kpi-grid">
        {inventoryLoading && !summary ? (
          Array.from({ length: 4 }).map((_, index) => (
            <div className="kpi-card" key={index}>
              <Skeleton className="h-3 w-24" />
              <Skeleton className="mt-5 h-7 w-32" />
              <Skeleton className="mt-3 h-3 w-24" />
            </div>
          ))
        ) : (
          <>
            <KpiCard
              label="Units on hand"
              value={summary ? formatNumber(summary.units) : "—"}
              hint={summary ? `${formatNumber(summary.activeProducts)} active products` : "Live stock"}
              icon={<Boxes size={16} />}
              index={0}
            />
            <KpiCard
              label="Cost value"
              value={summary ? formatTZS(summary.costValuation) : "—"}
              hint="Stock at cost price"
              icon={<Wallet size={16} />}
              index={1}
            />
            <KpiCard
              label="Retail value"
              value={summary ? formatTZS(summary.retailValuation) : "—"}
              hint="Stock at selling price"
              icon={<Package size={16} />}
              index={2}
            />
            <KpiCard
              label="Stock alerts"
              value={summary ? formatNumber(alertsCount) : "—"}
              hint={summary ? `${formatNumber(summary.lowStock)} low · ${formatNumber(summary.outOfStock)} out` : "Reorder points"}
              icon={<TriangleAlert size={16} />}
              index={3}
            />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">Low stock</h2>
              <p className="card-subtitle">At or below the reorder point, but still sellable.</p>
            </div>
            <Badge tone="warning" dot>
              {formatNumber(alerts.lowStock.length)} low
            </Badge>
          </div>
          <div className="card-body pt-2">
            {inventoryLoading ? (
              <div className="flex flex-col gap-2">
                {Array.from({ length: 4 }).map((_, index) => (
                  <Skeleton key={index} className="h-12 w-full" />
                ))}
              </div>
            ) : alerts.lowStock.length ? (
              <div className="data-list">
                {alerts.lowStock.slice(0, 6).map((item) => (
                  <div className="data-list-row" key={item.id}>
                    <ProductArt name={item.name} categoryName={item.categoryName} compact />
                    <div className="data-list-main">
                      <div className="data-list-title">{item.name}</div>
                      <div className="data-list-sub">
                        {item.categoryName} · min {item.minStock}
                      </div>
                    </div>
                    <div className="data-list-value" style={{ color: "var(--warning)" }}>
                      {item.stock} left
                    </div>
                    <Button
                      variant="secondary"
                      size="icon-sm"
                      onClick={() => openStockIn(toTarget(item))}
                      aria-label={`Add stock for ${item.name}`}
                      title="Stock in"
                    >
                      <ArrowDownToLine size={13} />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={Boxes}
                title="No low-stock products"
                description="Everything is comfortably above its reorder point."
                className="h-[210px]"
              />
            )}
          </div>
        </section>

        <section className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">Out of stock</h2>
              <p className="card-subtitle">These products cannot be sold until stock returns.</p>
            </div>
            <Badge tone="danger" dot>
              {formatNumber(alerts.outOfStock.length)} out
            </Badge>
          </div>
          <div className="card-body pt-2">
            {inventoryLoading ? (
              <div className="flex flex-col gap-2">
                {Array.from({ length: 4 }).map((_, index) => (
                  <Skeleton key={index} className="h-12 w-full" />
                ))}
              </div>
            ) : alerts.outOfStock.length ? (
              <div className="data-list">
                {alerts.outOfStock.slice(0, 6).map((item) => (
                  <div className="data-list-row" key={item.id}>
                    <ProductArt name={item.name} categoryName={item.categoryName} compact />
                    <div className="data-list-main">
                      <div className="data-list-title">{item.name}</div>
                      <div className="data-list-sub">{item.categoryName} · {item.sku}</div>
                    </div>
                    <div className="data-list-value" style={{ color: "var(--danger)" }}>
                      0 left
                    </div>
                    <Button
                      variant="secondary"
                      size="icon-sm"
                      onClick={() => openStockIn(toTarget(item))}
                      aria-label={`Add stock for ${item.name}`}
                      title="Stock in"
                    >
                      <ArrowDownToLine size={13} />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={Package}
                title="Nothing is out of stock"
                description="All active products have at least one unit available."
                className="h-[210px]"
              />
            )}
          </div>
        </section>
      </div>

      {movementsError && <ErrorPanel message={movementsError} onRetry={() => setReloadKey((value) => value + 1)} />}

      <div className="table-wrap">
        <div className="table-toolbar">
          <div className="table-toolbar-left">
            <div className="input-icon-wrap min-w-[210px] flex-1 sm:max-w-[300px]">
              <Search size={14} />
              <Input
                value={movementSearch}
                onChange={(event) => {
                  setMovementSearch(event.target.value);
                  setMovementPage(1);
                }}
                placeholder="Search product, reason or reference"
                aria-label="Search stock movements"
              />
            </div>
            <Select
              value={movementType}
              onChange={(event) => {
                setMovementType(event.target.value);
                setMovementPage(1);
              }}
              className="w-[145px]"
              aria-label="Filter movement type"
            >
              <option value="">All movements</option>
              <option value="sale">Sales</option>
              <option value="stock_in">Stock in</option>
              <option value="adjustment">Adjustments</option>
              <option value="void">Voids</option>
              <option value="return">Returns</option>
            </Select>
            {(movementSearch || movementType) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setMovementSearch("");
                  setMovementType("");
                  setMovementPage(1);
                }}
                leftIcon={<X size={12} />}
              >
                Clear
              </Button>
            )}
          </div>
          <span className="text-[10px] soft">{formatNumber(movementTotal)} movements</span>
        </div>
        <DataTable
          columns={movementColumns}
          rows={movements}
          rowKey={(movement) => movement.id}
          loading={movementsLoading}
          className="table-plain"
          minWidth={860}
          empty={
            <EmptyState
              icon={Boxes}
              title="No stock movements found"
              description="Stock in, sales, adjustments, voids, and returns will appear here."
            />
          }
        />
        <Pagination
          page={movementPage}
          pageSize={movementPageSize}
          total={movementTotal}
          onPageChange={setMovementPage}
          onPageSizeChange={(size) => {
            setMovementPageSize(size);
            setMovementPage(1);
          }}
        />
      </div>

      <Modal
        open={stockInOpen || adjustOpen}
        onClose={closeForms}
        title={stockInOpen ? "Add stock" : "Adjust stock"}
        description={
          stockInOpen
            ? "Receive new units into the selected product."
            : "Correct stock up or down with a clear reason."
        }
        size="sm"
        dismissible={!submitting}
        footer={
          <>
            <Button variant="secondary" onClick={closeForms} disabled={submitting}>
              Cancel
            </Button>
            <Button
              onClick={stockInOpen ? submitStockIn : submitAdjustment}
              loading={submitting}
              disabled={!target}
              leftIcon={stockInOpen ? <ArrowDownToLine size={14} /> : <SlidersHorizontal size={14} />}
            >
              {stockInOpen ? "Add stock" : "Save adjustment"}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3.5">
          {formError && <div className="alert alert-danger">{formError}</div>}

          {target ? (
            <div className="surface-soft flex items-center gap-3 p-3">
              <ProductArt name={target.name} categoryName={target.categoryName} compact />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[12px] font-semibold">{target.name}</div>
                <div className="text-[10px] soft">
                  {target.sku} · {target.stock} in stock
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setTarget(null)}>
                Change
              </Button>
            </div>
          ) : (
            <div>
              <div className="input-icon-wrap">
                <Search size={14} />
                <Input
                  value={productQuery}
                  onChange={(event) => setProductQuery(event.target.value)}
                  placeholder="Search an active product"
                  autoFocus
                />
              </div>
              <div className="mt-2 max-h-[230px] overflow-y-auto rounded-xl border" style={{ borderColor: "var(--border)" }}>
                {productLoading ? (
                  <div className="flex flex-col gap-1 p-2">
                    {Array.from({ length: 4 }).map((_, index) => (
                      <Skeleton key={index} className="h-11 w-full" />
                    ))}
                  </div>
                ) : productResults.length ? (
                  productResults.map((product) => (
                    <button
                      key={product.id}
                      type="button"
                      className="flex w-full items-center gap-2.5 border-b px-3 py-2 text-left transition-colors last:border-0 hover:bg-[var(--surface-soft)]"
                      style={{ borderColor: "var(--border)" }}
                      onClick={() => setTarget(toTarget(product))}
                    >
                      <ProductArt name={product.name} categoryName={product.categoryName} compact />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[11.5px] font-semibold">{product.name}</span>
                        <span className="block text-[10px] soft">
                          {product.sku} · {product.stock} in stock
                        </span>
                      </span>
                    </button>
                  ))
                ) : (
                  <EmptyState
                    icon={Package}
                    title="No active products found"
                    description="Try a different search."
                    className="min-h-[150px]"
                  />
                )}
              </div>
            </div>
          )}

          {stockInOpen ? (
            <>
              <Field label="Quantity received" required>
                <Input
                  type="number"
                  min={1}
                  step={1}
                  value={stockInForm.qty}
                  onChange={(event) => setStockInForm((current) => ({ ...current, qty: event.target.value }))}
                  placeholder="e.g. 24"
                />
              </Field>
              <Field label="Reason" required hint="For example: supplier delivery, transfer, or opening count.">
                <Input
                  value={stockInForm.reason}
                  onChange={(event) => setStockInForm((current) => ({ ...current, reason: event.target.value }))}
                  placeholder="Supplier delivery"
                  maxLength={240}
                />
              </Field>
              <Field label="Reference" hint="Optional invoice or delivery note number.">
                <Input
                  value={stockInForm.reference}
                  onChange={(event) => setStockInForm((current) => ({ ...current, reference: event.target.value }))}
                  placeholder="e.g. INV-2048"
                  maxLength={60}
                />
              </Field>
            </>
          ) : (
            <>
              <Field
                label="Quantity change"
                required
                hint="Positive adds stock. Negative removes stock — for example -2 for breakage."
              >
                <Input
                  type="number"
                  step={1}
                  value={adjustForm.qtyChange}
                  onChange={(event) => setAdjustForm((current) => ({ ...current, qtyChange: event.target.value }))}
                  placeholder="e.g. -2"
                />
              </Field>
              <Field label="Reason" required>
                <Input
                  value={adjustForm.reason}
                  onChange={(event) => setAdjustForm((current) => ({ ...current, reason: event.target.value }))}
                  placeholder="Stock count correction"
                  maxLength={240}
                />
              </Field>
              {target && (
                <div className="surface-muted flex items-center justify-between p-3 text-xs">
                  <span className="muted">Stock after adjustment</span>
                  <strong className="numeric">
                    {formatNumber(target.stock + (Number(adjustForm.qtyChange) || 0))}
                  </strong>
                </div>
              )}
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}
