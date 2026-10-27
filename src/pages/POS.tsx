import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Banknote,
  CalendarDays,
  CreditCard,
  Minus,
  PackageSearch,
  Plus,
  ReceiptText,
  ScanBarcode,
  Search,
  ShoppingCart,
  Smartphone,
  Trash2,
  X,
} from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { Category, CheckoutResult, PaymentMethod, Product } from "@/lib/types";
import {
  cn,
  formatNumber,
  formatTZS,
  todayInTimeZone,
  useDebouncedValue,
} from "@/lib/utils";
import { PageHeader } from "@/components/ui/PageHeader";
import { BarcodeScanner } from "@/components/ui/BarcodeScanner";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Field, Input, Select } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { ProductArt } from "@/components/ui/ProductArt";
import { ReceiptModal } from "@/components/ui/ReceiptModal";
import { EmptyState, Skeleton } from "@/components/ui/States";

type CartLine = { product: Product; qty: number };

function newIdempotencyKey() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `checkout-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

const paymentOptions: Array<{ id: PaymentMethod; label: string; icon: typeof Banknote; hint: string }> = [
  { id: "cash", label: "Cash", icon: Banknote, hint: "Count and give change" },
  { id: "mobile_money", label: "Mobile", icon: Smartphone, hint: "M-Pesa, Tigo, Airtel" },
  { id: "card", label: "Card", icon: CreditCard, hint: "Simulated terminal" },
];

export function PosPage() {
  const { user, settings, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const debouncedSearch = useDebouncedValue(search, 280);
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const requestSequence = useRef(0);

  const [cart, setCart] = useState<CartLine[]>([]);
  const [discount, setDiscount] = useState(0);
  const [mobileCartOpen, setMobileCartOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [amountReceived, setAmountReceived] = useState(0);
  const [mobileProvider, setMobileProvider] = useState("M-Pesa");
  const [cardProvider, setCardProvider] = useState("Simulated terminal");
  const [customerName, setCustomerName] = useState("");
  const [note, setNote] = useState("");
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [checkingOut, setCheckingOut] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState("");
  const [lastSale, setLastSale] = useState<CheckoutResult | null>(null);
  const [receiptOpen, setReceiptOpen] = useState(false);

  useEffect(() => {
    if (!cart.length) setMobileCartOpen(false);
  }, [cart.length]);

  useEffect(() => {
    let cancelled = false;
    api.categories
      .list()
      .then((result) => {
        if (!cancelled) setCategories(result.items);
      })
      .catch(() => {
        if (!cancelled) setCategories([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const loadProducts = useCallback(
    async (targetPage: number, append: boolean) => {
      const sequence = ++requestSequence.current;
      if (append) setLoadingMore(true);
      else setLoadingProducts(true);
      try {
        const result = await api.products.list({
          page: targetPage,
          pageSize: 48,
          search: debouncedSearch.trim() || undefined,
          categoryId: categoryId || undefined,
          status: isAdmin ? "active" : undefined,
          sortKey: "name",
          sortDir: "asc",
        });
        if (sequence !== requestSequence.current) return;
        setProducts((current) => (append ? [...current, ...result.items] : result.items));
        setTotal(result.total);
        setPage(targetPage);
      } catch (caught) {
        if (sequence !== requestSequence.current) return;
        toast.error(caught instanceof Error ? caught.message : "Could not load products.");
        if (!append) {
          setProducts([]);
          setTotal(0);
        }
      } finally {
        if (sequence === requestSequence.current) {
          setLoadingProducts(false);
          setLoadingMore(false);
        }
      }
    },
    [categoryId, debouncedSearch, isAdmin],
  );

  useEffect(() => {
    setPage(1);
    void loadProducts(1, false);
  }, [loadProducts, reloadKey]);

  const addToCart = (product: Product): boolean => {
    if (product.stock <= 0) {
      toast.error(`${product.name} is out of stock.`);
      return false;
    }
    const existing = cart.find((line) => line.product.id === product.id);
    const nextQty = (existing?.qty ?? 0) + 1;
    if (nextQty > product.stock) {
      toast.warning(`Only ${product.stock} unit${product.stock === 1 ? "" : "s"} of ${product.name} available.`);
      return false;
    }
    if (existing) {
      setCart((current) =>
        current.map((line) => (line.product.id === product.id ? { ...line, product, qty: nextQty } : line)),
      );
    } else {
      setCart((current) => [...current, { product, qty: 1 }]);
    }
    return true;
  };

  const addByBarcode = async (raw: string): Promise<boolean> => {
    const code = raw.trim();
    if (!code) return false;
    try {
      const result = await api.products.list({
        barcode: code,
        pageSize: 5,
        status: isAdmin ? "active" : undefined,
      });
      if (result.items.length !== 1) return false;
      const product = result.items[0];
      if (!addToCart(product)) return false;
      setSearch("");
      toast.success(`${product.name} added.`);
      return true;
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Barcode lookup failed.");
      return false;
    }
  };

  const updateQty = (productId: string, nextQty: number) => {
    setCart((current) =>
      current.flatMap((line) => {
        if (line.product.id !== productId) return [line];
        if (nextQty <= 0) return [];
        if (nextQty > line.product.stock) {
          toast.warning(`Only ${line.product.stock} left for ${line.product.name}.`);
          return [{ ...line, qty: line.product.stock }];
        }
        return [{ ...line, qty: nextQty }];
      }),
    );
  };

  const removeLine = (productId: string) => {
    setCart((current) => current.filter((line) => line.product.id !== productId));
  };

  const clearCart = () => {
    if (!cart.length) return;
    if (!window.confirm("Clear every item from this sale?")) return;
    setCart([]);
    setDiscount(0);
    setPaymentError(null);
    setIdempotencyKey("");
    setMobileCartOpen(false);
  };

  const subtotal = cart.reduce((sum, line) => sum + line.product.price * line.qty, 0);
  const maxDiscount = isAdmin ? subtotal : settings.allowDiscounts ? Math.floor((subtotal * settings.discountLimitPct) / 100) : 0;
  const discountTooHigh = discount > maxDiscount;
  const saleTotal = Math.max(0, subtotal - discount);
  const units = cart.reduce((sum, line) => sum + line.qty, 0);
  const changeDue = Math.max(0, amountReceived - saleTotal);
  const canCharge =
    cart.length > 0 &&
    saleTotal > 0 &&
    !discountTooHigh &&
    (paymentMethod !== "cash" || amountReceived >= saleTotal);

  const quickCash = Array.from(
    new Set([
      saleTotal,
      Math.ceil(saleTotal / 5000) * 5000,
      Math.ceil(saleTotal / 10000) * 10000,
      Math.ceil(saleTotal / 20000) * 20000,
    ]),
  )
    .filter((value) => value >= saleTotal)
    .slice(0, 4);

  const openPayment = () => {
    if (!cart.length || discountTooHigh) return;
    setMobileCartOpen(false);
    setPaymentError(null);
    setAmountReceived(saleTotal);
    if (!idempotencyKey) setIdempotencyKey(newIdempotencyKey());
    setPaymentOpen(true);
  };

  const handleBarcodeOrSearch = async (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    const value = search.trim();
    if (!value) return;
    try {
      const result = await api.products.list({
        barcode: value,
        pageSize: 5,
        status: isAdmin ? "active" : undefined,
      });
      if (result.items.length === 1) {
        addToCart(result.items[0]);
        setSearch("");
        toast.success(`${result.items[0].name} added.`);
      } else if (products.length === 1) {
        addToCart(products[0]);
        setSearch("");
      } else {
        toast.error("No single product matched that barcode.");
      }
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Barcode lookup failed.");
    }
  };

  const handleCheckout = async () => {
    if (!canCharge) return;
    setCheckingOut(true);
    setPaymentError(null);
    try {
      const sale = await api.sales.checkout({
        items: cart.map((line) => ({ productId: line.product.id, qty: line.qty })),
        discount,
        paymentMethod,
        amountReceived: paymentMethod === "cash" ? amountReceived : undefined,
        mobileProvider: paymentMethod === "mobile_money" ? mobileProvider : undefined,
        cardProvider: paymentMethod === "card" ? cardProvider : undefined,
        customerName: customerName.trim() || undefined,
        note: note.trim() || undefined,
        idempotencyKey,
      });
      setLastSale(sale);
      setPaymentOpen(false);
      setMobileCartOpen(false);
      setReceiptOpen(true);
      setCart([]);
      setDiscount(0);
      setCustomerName("");
      setNote("");
      setIdempotencyKey("");
      setReloadKey((value) => value + 1);
      toast.success(sale.duplicate ? "Sale already recorded." : `Sale ${sale.ref} completed.`);
    } catch (caught) {
      if (caught instanceof ApiError) {
        const details = caught.details as
          | { code?: string; productId?: string; available?: number; name?: string }
          | null;
        if (details?.code === "INSUFFICIENT_STOCK" && details.productId) {
          const available = Math.max(0, Number(details.available ?? 0));
          setCart((current) =>
            current.flatMap((line) =>
              line.product.id === details.productId
                ? available > 0
                  ? [{ ...line, product: { ...line.product, stock: available }, qty: Math.min(line.qty, available) }]
                  : []
                : [line],
            ),
          );
        }
        setPaymentError(caught.message);
      } else {
        setPaymentError("The sale could not be completed. Check the connection and try again.");
      }
    } finally {
      setCheckingOut(false);
    }
  };

  const today = todayInTimeZone(settings.timezone);

  const cartHeader = (
    <div className="pos-cart-header">
      <div>
        <div className="flex items-center gap-2">
          <h2 className="card-title">Current sale</h2>
          <Badge tone={cart.length ? "primary" : "neutral"}>
            {cart.length ? `${units} item${units === 1 ? "" : "s"}` : "Empty"}
          </Badge>
        </div>
        <p className="card-subtitle">
          {user?.name ?? "Cashier"} · {settings.businessName}
        </p>
      </div>
      {cart.length > 0 && (
        <Button variant="ghost" size="icon-sm" onClick={clearCart} aria-label="Clear cart">
          <Trash2 size={14} />
        </Button>
      )}
    </div>
  );

  const cartBody = cart.length ? (
    <>
      <div className="cart-lines">
        {cart.map((line) => (
          <div className="cart-line" key={line.product.id}>
            <div className="min-w-0">
              <div className="cart-line-name">{line.product.name}</div>
              <div className="cart-line-price">{formatTZS(line.product.price)} each</div>
              <div className="qty-step">
                <button
                  type="button"
                  onClick={() => updateQty(line.product.id, line.qty - 1)}
                  aria-label={`Reduce ${line.product.name}`}
                >
                  <Minus size={11} />
                </button>
                <span>{line.qty}</span>
                <button
                  type="button"
                  onClick={() => updateQty(line.product.id, line.qty + 1)}
                  aria-label={`Add another ${line.product.name}`}
                >
                  <Plus size={11} />
                </button>
              </div>
            </div>
            <div className="flex flex-col items-end justify-between gap-1">
              <div className="cart-line-total">{formatTZS(line.product.price * line.qty)}</div>
              <button
                type="button"
                className="text-[10px] font-medium soft hover:text-[var(--danger)]"
                onClick={() => removeLine(line.product.id)}
              >
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="cart-summary">
        <div className="cart-row">
          <span>Subtotal</span>
          <span className="numeric">{formatTZS(subtotal)}</span>
        </div>
        <div className="cart-row">
          <span>Items</span>
          <span className="numeric">{formatNumber(units)}</span>
        </div>
        <div className="cart-row total">
          <span>Total</span>
          <span>{formatTZS(saleTotal)}</span>
        </div>
      </div>

      <div className="cart-controls">
        <Field
          label="Discount"
          hint={
            isAdmin
              ? `Admin override · up to ${formatTZS(subtotal)}`
              : settings.allowDiscounts
                ? `Cashier limit ${settings.discountLimitPct}% · up to ${formatTZS(maxDiscount)}`
                : "Discounts are disabled for cashiers."
          }
          error={discountTooHigh ? "Discount exceeds the allowed amount." : undefined}
        >
          <div className="discount-row">
            <div className="input-icon-wrap flex-1">
              <Input
                type="number"
                min={0}
                max={maxDiscount}
                step={500}
                value={discount || ""}
                placeholder="0"
                onChange={(event) => setDiscount(Math.max(0, Math.floor(Number(event.target.value) || 0)))}
                disabled={!isAdmin && !settings.allowDiscounts}
                aria-label="Discount in TZS"
                className="pr-12"
              />
              <span className="input-suffix">TZS</span>
            </div>
            {discount > 0 && (
              <Button variant="ghost" size="icon-sm" onClick={() => setDiscount(0)} aria-label="Remove discount">
                <X size={13} />
              </Button>
            )}
          </div>
        </Field>

        <Button
          size="lg"
          className="w-full"
          onClick={openPayment}
          disabled={discountTooHigh}
          leftIcon={<ShoppingCart size={16} />}
        >
          Charge {formatTZS(saleTotal)}
        </Button>
      </div>
    </>
  ) : (
    <div className="cart-empty">
      <div className="flex flex-col items-center gap-2">
        <div className="empty-icon">
          <ShoppingCart size={21} />
        </div>
        <div className="empty-title">The cart is ready</div>
        <div className="empty-copy">Tap a product, or scan a barcode to begin a sale.</div>
      </div>
    </div>
  );

  return (
    <>
      <div className="page-shell">
      <PageHeader
        title="Point of sale"
        subtitle={`${user?.name ?? "Cashier"} · ${formatNumber(total)} products available`}
        icon={<ShoppingCart size={18} />}
        actions={
          <>
            <span className="chip">
              <CalendarDays size={12} />
              {today}
            </span>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigate("/sales")}
              leftIcon={<ReceiptText size={13} />}
            >
              Sales
            </Button>
          </>
        }
      />

      <div className={cn("pos-layout", cart.length > 0 && "has-mobile-cart")}>
        <section className="pos-products">
          <div className="pos-toolbar">
            <div className="input-icon-wrap pos-search">
              <Search size={15} />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                onKeyDown={handleBarcodeOrSearch}
                placeholder="Search or scan barcode"
                aria-label="Search products or scan a barcode"
                className="pr-9"
              />
              {search && (
                <button
                  type="button"
                  className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-lg soft hover:bg-[var(--surface-muted)]"
                  onClick={() => setSearch("")}
                  aria-label="Clear search"
                >
                  <X size={14} />
                </button>
              )}
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setScanOpen(true)}
              leftIcon={<ScanBarcode size={14} />}
              aria-label="Scan barcode with camera"
              title="Scan barcode with camera"
            >
              <span className="hidden sm:inline">Scan</span>
            </Button>
          </div>

          <div className="category-strip scrollbar-none">
            <button
              type="button"
              className={cn("category-chip", !categoryId && "is-active")}
              onClick={() => setCategoryId("")}
            >
              All products
            </button>
            {categories.map((category) => (
              <button
                key={category.id}
                type="button"
                className={cn("category-chip", categoryId === category.id && "is-active")}
                onClick={() => setCategoryId(category.id)}
              >
                {category.name}
              </button>
            ))}
          </div>

          {loadingProducts ? (
            <div className="product-grid">
              {Array.from({ length: 12 }).map((_, index) => (
                <div className="product-tile" key={index}>
                  <Skeleton className="aspect-[1.22] w-full rounded-xl" />
                  <Skeleton className="h-3 w-4/5" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              ))}
            </div>
          ) : products.length ? (
            <>
              <div className="product-grid">
                {products.map((product) => {
                  const inCart = cart.find((line) => line.product.id === product.id)?.qty ?? 0;
                  const out = product.stock <= 0;
                  const low = product.stock > 0 && product.stock <= product.minStock;
                  return (
                    <button
                      key={product.id}
                      type="button"
                      className="product-tile"
                      onClick={() => addToCart(product)}
                      disabled={out}
                      title={out ? "Out of stock" : `Add ${product.name}`}
                    >
                      <ProductArt name={product.name} categoryName={product.categoryName} />
                      <div className="px-1">
                        <div className="product-name">{product.name}</div>
                        <div className="product-meta">
                          <span className="product-price">{formatTZS(product.price)}</span>
                          {inCart > 0 && <Badge tone="primary">{inCart} in cart</Badge>}
                        </div>
                        <div className={cn("stock-note mt-1", out && "out", low && "low")}>
                          {out ? "Out of stock" : `${product.stock} in stock`}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
              {products.length < total && (
                <div className="mt-3 flex justify-center">
                  <Button
                    variant="secondary"
                    size="sm"
                    loading={loadingMore}
                    onClick={() => void loadProducts(page + 1, true)}
                  >
                    Load more products
                  </Button>
                </div>
              )}
            </>
          ) : (
            <div className="card mt-3">
              <EmptyState
                icon={PackageSearch}
                title="No products found"
                description="Try another search, choose a different category, or add products from the Products page."
                action={
                  debouncedSearch || categoryId ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setSearch("");
                        setCategoryId("");
                      }}
                    >
                      Clear filters
                    </Button>
                  ) : undefined
                }
              />
            </div>
          )}
        </section>

        <aside className="pos-cart pos-cart-desktop liquid-glass-strong">
          {cartHeader}
          {cartBody}
        </aside>
      </div>

      <Modal
        open={paymentOpen}
        onClose={() => {
          if (!checkingOut) setPaymentOpen(false);
        }}
        title="Take payment"
        description={`${units} item${units === 1 ? "" : "s"} · ${formatTZS(saleTotal)}`}
        size="sm"
        dismissible={!checkingOut}
        footer={
          <>
            <Button variant="secondary" onClick={() => setPaymentOpen(false)} disabled={checkingOut}>
              Back
            </Button>
            <Button
              onClick={handleCheckout}
              loading={checkingOut}
              disabled={!canCharge}
              leftIcon={<ReceiptText size={14} />}
            >
              Complete · {formatTZS(saleTotal)}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          {paymentError && <div className="alert alert-danger">{paymentError}</div>}

          <div className="payment-grid">
            {paymentOptions.map((option) => {
              const Icon = option.icon;
              return (
                <button
                  key={option.id}
                  type="button"
                  className={cn("payment-tile", paymentMethod === option.id && "is-active")}
                  onClick={() => {
                    setPaymentMethod(option.id);
                    if (option.id === "cash") setAmountReceived(saleTotal);
                  }}
                >
                  <Icon size={18} />
                  <span>{option.label}</span>
                </button>
              );
            })}
          </div>

          {paymentMethod === "cash" ? (
            <>
              <Field label="Cash received" hint="Enter the amount handed over by the customer.">
                <div className="input-icon-wrap">
                  <Banknote size={15} />
                  <Input
                    type="number"
                    min={saleTotal}
                    step={500}
                    value={amountReceived || ""}
                    onChange={(event) => setAmountReceived(Math.max(0, Math.floor(Number(event.target.value) || 0)))}
                    className="pr-12"
                    aria-label="Cash received"
                  />
                  <span className="input-suffix">TZS</span>
                </div>
              </Field>
              <div className="quick-cash-grid grid grid-cols-4 gap-1.5">
                {quickCash.map((amount) => (
                  <button
                    key={amount}
                    type="button"
                    className="btn btn-secondary btn-sm px-1"
                    onClick={() => setAmountReceived(amount)}
                  >
                    {amount === saleTotal ? "Exact" : formatTZS(amount)}
                  </button>
                ))}
              </div>
              <div className="surface-soft flex items-center justify-between px-3 py-2.5 text-xs">
                <span className="muted">Change due</span>
                <strong className="numeric text-base">{formatTZS(changeDue)}</strong>
              </div>
            </>
          ) : paymentMethod === "mobile_money" ? (
            <Field label="Mobile provider" hint="The payment will be recorded as simulated.">
              <Select value={mobileProvider} onChange={(event) => setMobileProvider(event.target.value)}>
                {["M-Pesa", "Tigo Pesa", "Airtel Money", "Halopesa"].map((provider) => (
                  <option key={provider} value={provider}>
                    {provider}
                  </option>
                ))}
              </Select>
            </Field>
          ) : (
            <Field label="Card terminal" hint="The payment will be recorded as simulated.">
              <Select value={cardProvider} onChange={(event) => setCardProvider(event.target.value)}>
                {["Simulated terminal", "Visa simulation", "Mastercard simulation"].map((provider) => (
                  <option key={provider} value={provider}>
                    {provider}
                  </option>
                ))}
              </Select>
            </Field>
          )}

          <div className="grid grid-cols-1 gap-3">
            <Field label="Customer" hint="Optional. Leave blank for a walk-in customer.">
              <Input
                value={customerName}
                onChange={(event) => setCustomerName(event.target.value)}
                placeholder="Customer name"
                maxLength={120}
              />
            </Field>
            <Field label="Note" hint="Optional note for this sale.">
              <Input
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="e.g. packed separately"
                maxLength={300}
              />
            </Field>
          </div>

          <div className="surface-muted p-3">
            <div className="cart-row">
              <span>Subtotal</span>
              <span className="numeric">{formatTZS(subtotal)}</span>
            </div>
            <div className="cart-row mt-1">
              <span>Discount</span>
              <span className="numeric">-{formatTZS(discount)}</span>
            </div>
            <div className="cart-row total mt-2">
              <span>Total to charge</span>
              <span>{formatTZS(saleTotal)}</span>
            </div>
          </div>
        </div>
      </Modal>

        <ReceiptModal
          open={receiptOpen}
          onClose={() => setReceiptOpen(false)}
          sale={lastSale}
          settings={settings}
        />

        <BarcodeScanner
          open={scanOpen}
          onClose={() => setScanOpen(false)}
          onDetected={addByBarcode}
        />
      </div>

      {cart.length > 0 && (
        <button
          type="button"
          className="pos-mobile-cart"
          onClick={() => setMobileCartOpen(true)}
          aria-label={`View current sale, ${units} item${units === 1 ? "" : "s"}, ${formatTZS(saleTotal)}`}
        >
          <span className="pos-mobile-cart-icon">
            <ShoppingCart size={18} />
          </span>
          <span className="pos-mobile-cart-meta">
            <strong>
              {units} item{units === 1 ? "" : "s"} in cart
            </strong>
            <span>{formatTZS(saleTotal)}</span>
          </span>
          <span className="pos-mobile-cart-action">View cart</span>
        </button>
      )}

      <Modal
        open={mobileCartOpen}
        onClose={() => setMobileCartOpen(false)}
        title="Current sale"
        description={`${units} item${units === 1 ? "" : "s"} · ${settings.businessName}`}
        size="sm"
        className="mobile-cart-modal"
      >
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-meta">{user?.name ?? "Cashier"}</span>
            {cart.length > 0 && (
              <Button variant="ghost" size="sm" onClick={clearCart} leftIcon={<Trash2 size={13} />}>
                Clear cart
              </Button>
            )}
          </div>
          {cartBody}
        </div>
      </Modal>
    </>
  );
}
