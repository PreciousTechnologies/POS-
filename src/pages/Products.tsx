import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Package,
  Pencil,
  Plus,
  Power,
  ScanBarcode,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { Category, Product, ProductInput } from "@/lib/types";
import { cn, formatTZS, useDebouncedValue } from "@/lib/utils";
import { PageHeader } from "@/components/ui/PageHeader";
import { BarcodeScanner } from "@/components/ui/BarcodeScanner";
import { Button } from "@/components/ui/Button";
import { Badge, StockBadge } from "@/components/ui/Badge";
import { Field, Input, Select, Textarea } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DataTable, Pagination, type Column } from "@/components/ui/DataTable";
import { ProductArt } from "@/components/ui/ProductArt";
import { EmptyState, ErrorPanel } from "@/components/ui/States";

type SortOption = "name:asc" | "name:desc" | "price:asc" | "price:desc" | "stock:asc" | "stock:desc";

type ProductForm = {
  name: string;
  sku: string;
  barcode: string;
  categoryId: string;
  costPrice: string;
  price: string;
  stock: string;
  minStock: string;
  unit: string;
  description: string;
  active: boolean;
};

function emptyForm(categories: Category[]): ProductForm {
  return {
    name: "",
    sku: "",
    barcode: "",
    categoryId: categories[0]?.id ?? "",
    costPrice: "",
    price: "",
    stock: "0",
    minStock: "10",
    unit: "pcs",
    description: "",
    active: true,
  };
}

export function ProductsPage() {
  const { isAdmin } = useAuth();
  const [items, setItems] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const [categoryId, setCategoryId] = useState("");
  const [status, setStatus] = useState<"" | "active" | "inactive">("");
  const [stockFilter, setStockFilter] = useState<"" | "low" | "out">("");
  const [sort, setSort] = useState<SortOption>("name:asc");
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState<ProductForm>(() => emptyForm([]));
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [scanBarcodeOpen, setScanBarcodeOpen] = useState(false);

  const [deactivatingProduct, setDeactivatingProduct] = useState<Product | null>(null);
  const [deactivating, setDeactivating] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api.categories
      .list()
      .then((result) => {
        if (cancelled) return;
        setCategories(result.items);
      })
      .catch(() => {
        if (!cancelled) setCategories([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const [sortKey, sortDir] = sort.split(":") as [string, "asc" | "desc"];
    api.products
      .list({
        page,
        pageSize,
        search: debouncedSearch.trim() || undefined,
        categoryId: categoryId || undefined,
        status: isAdmin ? status || undefined : undefined,
        lowStock: stockFilter === "low" || undefined,
        outOfStock: stockFilter === "out" || undefined,
        sortKey,
        sortDir,
      })
      .then((result) => {
        if (cancelled) return;
        setItems(result.items);
        setTotal(result.total);
      })
      .catch((caught) => {
        if (cancelled) return;
        setError(caught instanceof Error ? caught.message : "Could not load products.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [page, pageSize, debouncedSearch, categoryId, status, stockFilter, sort, isAdmin, reloadKey]);

  const resetPage = () => setPage(1);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm(categories));
    setFieldErrors({});
    setFormError(null);
    setFormOpen(true);
  };

  const openEdit = (product: Product) => {
    setEditing(product);
    setForm({
      name: product.name,
      sku: product.sku,
      barcode: product.barcode ?? "",
      categoryId: product.categoryId,
      costPrice: String(product.costPrice ?? ""),
      price: String(product.price),
      stock: String(product.stock),
      minStock: String(product.minStock),
      unit: product.unit ?? "",
      description: product.description ?? "",
      active: product.active,
    });
    setFieldErrors({});
    setFormError(null);
    setFormOpen(true);
  };

  const validate = () => {
    const errors: Record<string, string> = {};
    if (form.name.trim().length < 2) errors.name = "Product name is required.";
    if (!/^[A-Za-z0-9._-]{2,40}$/.test(form.sku.trim())) {
      errors.sku = "Use 2–40 letters, numbers, dots, dashes or underscores.";
    }
    if (!form.categoryId) errors.categoryId = "Select a category.";
    const cost = Number(form.costPrice);
    if (!Number.isInteger(cost) || cost < 0) errors.costPrice = "Enter a whole TZS amount.";
    const price = Number(form.price);
    if (!Number.isInteger(price) || price <= 0) errors.price = "Enter a selling price above zero.";
    if (!editing) {
      const stock = Number(form.stock);
      if (!Number.isInteger(stock) || stock < 0) errors.stock = "Enter a whole quantity.";
    }
    const minStock = Number(form.minStock);
    if (!Number.isInteger(minStock) || minStock < 0) errors.minStock = "Enter a whole quantity.";
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const save = async () => {
    if (!validate()) return;
    setSaving(true);
    setFormError(null);
    const payload: ProductInput = {
      name: form.name.trim(),
      sku: form.sku.trim(),
      barcode: form.barcode.trim(),
      categoryId: form.categoryId,
      costPrice: Number(form.costPrice),
      price: Number(form.price),
      minStock: Number(form.minStock),
      unit: form.unit.trim(),
      description: form.description.trim(),
      active: form.active,
    };
    if (!editing) payload.stock = Number(form.stock);

    try {
      if (editing) {
        await api.products.update(editing.id, payload);
        toast.success("Product updated.");
      } else {
        await api.products.create(payload);
        toast.success("Product created.");
      }
      setFormOpen(false);
      setReloadKey((value) => value + 1);
    } catch (caught) {
      setFormError(caught instanceof ApiError ? caught.message : "Could not save the product.");
    } finally {
      setSaving(false);
    }
  };

  const deactivate = async () => {
    if (!deactivatingProduct) return;
    setDeactivating(true);
    try {
      await api.products.deactivate(deactivatingProduct.id);
      toast.success(`${deactivatingProduct.name} deactivated.`);
      setDeactivatingProduct(null);
      setReloadKey((value) => value + 1);
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Could not deactivate the product.");
    } finally {
      setDeactivating(false);
    }
  };

  const hasFilters = Boolean(debouncedSearch || categoryId || status || stockFilter);

  const columns: Column<Product>[] = [
    {
      key: "product",
      header: "Product",
      cell: (product) => (
        <div className="flex min-w-[210px] items-center gap-2.5">
          <ProductArt name={product.name} categoryName={product.categoryName} compact />
          <div className="min-w-0">
            <div className="cell-main max-w-[240px] truncate">{product.name}</div>
            <div className="cell-sub">
              {product.sku}
              {product.barcode ? ` · ${product.barcode}` : ""}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: "category",
      header: "Category",
      cell: (product) => <span className="muted text-[11px]">{product.categoryName}</span>,
    },
    {
      key: "price",
      header: "Selling price",
      align: "right",
      cell: (product) => <span className="numeric font-semibold">{formatTZS(product.price)}</span>,
    },
    ...(isAdmin
      ? [
          {
            key: "cost",
            header: "Cost",
            align: "right" as const,
            cell: (product: Product) => (
              <span className="numeric muted text-[11px]">{formatTZS(product.costPrice ?? 0)}</span>
            ),
          },
        ]
      : []),
    {
      key: "stock",
      header: "Stock",
      align: "center",
      cell: (product) => (
        <div className="flex flex-col items-center gap-1">
          <span className="numeric text-[11px] font-semibold">{product.stock}</span>
          <StockBadge stock={product.stock} minStock={product.minStock} />
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      cell: (product) => (
        <Badge tone={product.active ? "success" : "neutral"} dot>
          {product.active ? "Active" : "Inactive"}
        </Badge>
      ),
    },
    ...(isAdmin
      ? [
          {
            key: "actions",
            header: "",
            align: "right" as const,
            cell: (product: Product) => (
              <div className="cell-actions">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => openEdit(product)}
                  aria-label={`Edit ${product.name}`}
                  title="Edit product"
                >
                  <Pencil size={13} />
                </Button>
                {product.active && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setDeactivatingProduct(product)}
                    aria-label={`Deactivate ${product.name}`}
                    title="Deactivate product"
                  >
                    <Power size={13} />
                  </Button>
                )}
              </div>
            ),
          },
        ]
      : []),
  ];

  return (
    <div className="page-shell">
      <PageHeader
        title="Products"
        subtitle={`${total.toLocaleString()} product${total === 1 ? "" : "s"} in the catalogue`}
        icon={<Package size={18} />}
        actions={
          isAdmin ? (
            <Button onClick={openCreate} leftIcon={<Plus size={14} />}>
              Add product
            </Button>
          ) : (
            <Badge tone="info">Cashier view</Badge>
          )
        }
      />

      {error && <ErrorPanel message={error} onRetry={() => setReloadKey((value) => value + 1)} />}

      <div className="table-wrap">
        <div className="table-toolbar">
          <div className="table-toolbar-left">
            <div className="input-icon-wrap min-w-[200px] flex-1 sm:max-w-[280px]">
              <Search size={14} />
              <Input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  resetPage();
                }}
                placeholder="Search name, SKU or barcode"
                aria-label="Search products"
              />
            </div>
            <Select
              value={categoryId}
              onChange={(event) => {
                setCategoryId(event.target.value);
                resetPage();
              }}
              aria-label="Filter by category"
              className="w-[145px]"
            >
              <option value="">All categories</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </Select>
            {isAdmin && (
              <Select
                value={status}
                onChange={(event) => {
                  setStatus(event.target.value as typeof status);
                  resetPage();
                }}
                aria-label="Filter by status"
                className="w-[120px]"
              >
                <option value="">All status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </Select>
            )}
            <Select
              value={stockFilter}
              onChange={(event) => {
                setStockFilter(event.target.value as typeof stockFilter);
                resetPage();
              }}
              aria-label="Filter by stock"
              className="w-[130px]"
            >
              <option value="">All stock</option>
              <option value="low">Low stock</option>
              <option value="out">Out of stock</option>
            </Select>
          </div>
          <div className="table-toolbar-right">
            <SlidersHorizontal size={13} className="hidden sm:block soft" />
            <Select
              value={sort}
              onChange={(event) => {
                setSort(event.target.value as SortOption);
                resetPage();
              }}
              aria-label="Sort products"
              className="w-[145px]"
            >
              <option value="name:asc">Name A–Z</option>
              <option value="name:desc">Name Z–A</option>
              <option value="price:asc">Price low–high</option>
              <option value="price:desc">Price high–low</option>
              <option value="stock:asc">Stock low–high</option>
              <option value="stock:desc">Stock high–low</option>
            </Select>
            {hasFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearch("");
                  setCategoryId("");
                  setStatus("");
                  setStockFilter("");
                  resetPage();
                }}
                leftIcon={<X size={12} />}
              >
                Clear
              </Button>
            )}
          </div>
        </div>

        <DataTable
          columns={columns}
          rows={items}
          rowKey={(product) => product.id}
          loading={loading}
          className="table-plain"
          empty={
            <EmptyState
              icon={Package}
              title={hasFilters ? "No products match these filters" : "No products yet"}
              description={
                hasFilters
                  ? "Clear a filter or try a different search."
                  : isAdmin
                    ? "Add your first product to start selling."
                    : "Ask an administrator to add products to the catalogue."
              }
              action={
                isAdmin && !hasFilters ? (
                  <Button size="sm" onClick={openCreate} leftIcon={<Plus size={13} />}>
                    Add product
                  </Button>
                ) : undefined
              }
            />
          }
        />
        <Pagination
          page={page}
          pageSize={pageSize}
          total={total}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
          }}
        />
      </div>

      <Modal
        open={formOpen}
        onClose={() => {
          if (!saving) setFormOpen(false);
        }}
        title={editing ? "Edit product" : "New product"}
        description={editing ? editing.name : "Add a product to the catalogue and opening stock."}
        size="wide"
        dismissible={!saving}
        footer={
          <>
            <Button variant="secondary" onClick={() => setFormOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={save} loading={saving}>
              {editing ? "Save changes" : "Create product"}
            </Button>
          </>
        }
      >
        <div className="form-grid">
          {formError && (
            <div className="alert alert-danger field-full">
              {formError}
            </div>
          )}
          <Field label="Product name" htmlFor="product-name" error={fieldErrors.name} required className="field-full">
            <Input
              id="product-name"
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              placeholder="e.g. Azam Soda 500ml"
              maxLength={120}
            />
          </Field>
          <Field label="SKU" htmlFor="product-sku" error={fieldErrors.sku} required>
            <Input
              id="product-sku"
              value={form.sku}
              onChange={(event) => setForm((current) => ({ ...current, sku: event.target.value.toUpperCase() }))}
              placeholder="AZM-500"
              maxLength={40}
            />
          </Field>
          <Field label="Barcode" htmlFor="product-barcode" hint="Optional" error={fieldErrors.barcode}>
            <div className="flex items-center gap-2">
              <Input
                id="product-barcode"
                value={form.barcode}
                onChange={(event) => setForm((current) => ({ ...current, barcode: event.target.value }))}
                placeholder="Scan or type barcode"
                maxLength={40}
                className="min-w-0 flex-1"
              />
              <Button
                variant="secondary"
                size="icon"
                onClick={() => setScanBarcodeOpen(true)}
                aria-label="Scan barcode with camera"
                title="Scan barcode with camera"
              >
                <ScanBarcode size={15} />
              </Button>
            </div>
          </Field>
          <Field label="Category" htmlFor="product-category" error={fieldErrors.categoryId} required>
            <Select
              id="product-category"
              value={form.categoryId}
              onChange={(event) => setForm((current) => ({ ...current, categoryId: event.target.value }))}
            >
              <option value="">Select category</option>
              {categories
                .filter((category) => category.active || category.id === form.categoryId)
                .map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
            </Select>
          </Field>
          <Field label="Unit" htmlFor="product-unit" hint="e.g. pcs, kg, pack">
            <Input
              id="product-unit"
              value={form.unit}
              onChange={(event) => setForm((current) => ({ ...current, unit: event.target.value }))}
              placeholder="pcs"
              maxLength={30}
            />
          </Field>
          <Field label="Cost price (TZS)" htmlFor="product-cost" error={fieldErrors.costPrice} required>
            <Input
              id="product-cost"
              type="number"
              min={0}
              step={500}
              value={form.costPrice}
              onChange={(event) => setForm((current) => ({ ...current, costPrice: event.target.value }))}
              placeholder="0"
            />
          </Field>
          <Field label="Selling price (TZS)" htmlFor="product-price" error={fieldErrors.price} required>
            <Input
              id="product-price"
              type="number"
              min={1}
              step={500}
              value={form.price}
              onChange={(event) => setForm((current) => ({ ...current, price: event.target.value }))}
              placeholder="0"
            />
          </Field>
          {!editing && (
            <Field label="Opening stock" htmlFor="product-stock" error={fieldErrors.stock}>
              <Input
                id="product-stock"
                type="number"
                min={0}
                step={1}
                value={form.stock}
                onChange={(event) => setForm((current) => ({ ...current, stock: event.target.value }))}
                placeholder="0"
              />
            </Field>
          )}
          <Field
            label="Reorder point"
            htmlFor="product-min-stock"
            hint="Low-stock alerts trigger at or below this quantity."
            error={fieldErrors.minStock}
          >
            <Input
              id="product-min-stock"
              type="number"
              min={0}
              step={1}
              value={form.minStock}
              onChange={(event) => setForm((current) => ({ ...current, minStock: event.target.value }))}
              placeholder="10"
            />
          </Field>
          <Field label="Description" htmlFor="product-description" hint="Optional" className="field-full">
            <Textarea
              id="product-description"
              value={form.description}
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
              placeholder="Pack size, supplier notes, or shelf details"
              maxLength={400}
            />
          </Field>
          <div className="field field-full">
            <div className="flex items-center justify-between gap-4 rounded-xl border p-3" style={{ borderColor: "var(--border)", background: "var(--surface-soft)" }}>
              <div>
                <div className="text-[12px] font-semibold">Product is active</div>
                <div className="field-hint">Inactive products are hidden from the POS and cashier catalogue.</div>
              </div>
              <button
                type="button"
                className={cn("switch", form.active && "is-on")}
                onClick={() => setForm((current) => ({ ...current, active: !current.active }))}
                aria-pressed={form.active}
                aria-label="Product active"
              />
            </div>
          </div>
          {editing && (
            <div className="alert alert-info field-full">
              Stock is changed through Inventory movements, so the quantity is not editable here.
            </div>
          )}
        </div>
      </Modal>

      <BarcodeScanner
        open={scanBarcodeOpen}
        onClose={() => setScanBarcodeOpen(false)}
        onDetected={(code) => {
          setForm((current) => ({ ...current, barcode: code }));
          setScanBarcodeOpen(false);
          return true;
        }}
        title="Scan product barcode"
        description="Point the camera at the product barcode to fill the Barcode field."
      />

      <ConfirmDialog
        open={Boolean(deactivatingProduct)}
        onClose={() => setDeactivatingProduct(null)}
        onConfirm={deactivate}
        title="Deactivate product?"
        description={
          deactivatingProduct
            ? `${deactivatingProduct.name} will be hidden from the POS and cashier catalogue. Existing sales are not affected.`
            : undefined
        }
        confirmLabel="Deactivate"
        destructive
        loading={deactivating}
      >
        {deactivatingProduct && (
          <div className="surface-soft flex items-center gap-3 p-3">
            <ProductArt name={deactivatingProduct.name} categoryName={deactivatingProduct.categoryName} compact />
            <div>
              <div className="text-xs font-semibold">{deactivatingProduct.name}</div>
              <div className="text-[10px] soft">
                {deactivatingProduct.sku} · {deactivatingProduct.stock} in stock
              </div>
            </div>
          </div>
        )}
      </ConfirmDialog>
    </div>
  );
}
