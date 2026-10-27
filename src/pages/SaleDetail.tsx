import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowLeft,
  Ban,
  CalendarDays,
  CircleAlert,
  Info,
  Printer,
  ReceiptText,
  RotateCcw,
  User,
  Wallet,
} from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { SaleDetail, SaleItem } from "@/lib/types";
import { formatDateTime, formatNumber, formatTZS, methodLabel } from "@/lib/utils";
import { printReceipt } from "@/lib/receipt";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Badge, MethodBadge, StatusBadge } from "@/components/ui/Badge";
import { Field, Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ReceiptPreview } from "@/components/ui/ReceiptModal";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { EmptyState, ErrorPanel, Skeleton } from "@/components/ui/States";

export function SaleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { settings, isAdmin } = useAuth();
  const [sale, setSale] = useState<SaleDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [voidOpen, setVoidOpen] = useState(false);
  const [voiding, setVoiding] = useState(false);

  const [refundOpen, setRefundOpen] = useState(false);
  const [refundAmount, setRefundAmount] = useState("");
  const [refundReason, setRefundReason] = useState("");
  const [refundRestock, setRefundRestock] = useState(true);
  const [refundError, setRefundError] = useState<string | null>(null);
  const [refunding, setRefunding] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    api.sales
      .get(id)
      .then((result) => {
        if (!cancelled) setSale(result);
      })
      .catch((caught) => {
        if (cancelled) return;
        setError(caught instanceof Error ? caught.message : "Could not load this sale.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, reloadKey]);

  const remaining = sale ? Math.max(0, sale.total - sale.refundedAmount) : 0;
  const canVoid = Boolean(isAdmin && sale && sale.status === "completed");
  const canRefund = Boolean(isAdmin && sale && sale.status !== "voided" && remaining > 0);

  const handlePrint = () => {
    if (!sale) return;
    if (!printReceipt(sale, settings)) {
      toast.error("The print window was blocked. Allow pop-ups for this site and try again.");
    }
  };

  const openRefund = () => {
    if (!sale) return;
    setRefundAmount(String(remaining));
    setRefundReason("");
    setRefundRestock(true);
    setRefundError(null);
    setRefundOpen(true);
  };

  const handleVoid = async () => {
    if (!sale) return;
    setVoiding(true);
    try {
      const result = await api.sales.void(sale.id);
      setSale(result);
      setVoidOpen(false);
      toast.success(`${sale.ref} has been voided and stock returned.`);
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : "Could not void this sale.");
    } finally {
      setVoiding(false);
    }
  };

  const handleRefund = async () => {
    if (!sale) return;
    const amount = Number(refundAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setRefundError("Enter a refund amount greater than zero.");
      return;
    }
    if (amount > remaining) {
      setRefundError(`The refund cannot exceed the remaining ${formatTZS(remaining)}.`);
      return;
    }
    if (refundReason.trim().length < 3) {
      setRefundError("Give a short reason for this refund.");
      return;
    }
    if (refundRestock && amount !== remaining) {
      setRefundError("Partial refunds cannot restock automatically. A full refund is required for restocking.");
      return;
    }
    setRefunding(true);
    setRefundError(null);
    try {
      const result = await api.sales.refund(sale.id, {
        amount,
        reason: refundReason.trim(),
        restock: refundRestock,
      });
      setSale(result);
      setRefundOpen(false);
      toast.success(
        refundRestock
          ? `${formatTZS(amount)} refunded and items returned to stock.`
          : `${formatTZS(amount)} refunded.`,
      );
    } catch (caught) {
      setRefundError(caught instanceof ApiError ? caught.message : "Could not process this refund.");
    } finally {
      setRefunding(false);
    }
  };

  const itemColumns: Column<SaleItem>[] = [
    {
      key: "item",
      header: "Item",
      cell: (item) => (
        <div>
          <div className="cell-main max-w-[320px] truncate">{item.name}</div>
          <div className="cell-sub">{item.sku}</div>
        </div>
      ),
    },
    {
      key: "qty",
      header: "Qty",
      align: "center",
      cell: (item) => <span className="numeric">{formatNumber(item.qty)}</span>,
    },
    {
      key: "unit",
      header: "Unit price",
      align: "right",
      cell: (item) => <span className="numeric">{formatTZS(item.unitPrice)}</span>,
    },
    {
      key: "discount",
      header: "Discount",
      align: "right",
      cell: (item) =>
        item.discount > 0 ? (
          <span className="numeric" style={{ color: "var(--warning)" }}>
            -{formatTZS(item.discount)}
          </span>
        ) : (
          <span className="soft">—</span>
        ),
    },
    {
      key: "total",
      header: "Line total",
      align: "right",
      cell: (item) => <span className="numeric font-semibold">{formatTZS(item.lineTotal)}</span>,
    },
  ];

  if (loading && !sale) {
    return (
      <div className="page-shell">
        <PageHeader title="Sale details" subtitle="Loading transaction…" icon={<ReceiptText size={18} />} />
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="flex flex-col gap-4">
            <Skeleton className="h-[330px] w-full" />
            <Skeleton className="h-[210px] w-full" />
          </div>
          <Skeleton className="h-[560px] w-full" />
        </div>
      </div>
    );
  }

  if (error || !sale) {
    return (
      <div className="page-shell">
        <PageHeader
          title="Sale details"
          subtitle="The requested transaction could not be opened."
          icon={<ReceiptText size={18} />}
          actions={
            <Button variant="secondary" onClick={() => navigate("/sales")} leftIcon={<ArrowLeft size={14} />}>
              Back to sales
            </Button>
          }
        />
        {error ? (
          <ErrorPanel message={error} onRetry={() => setReloadKey((value) => value + 1)} />
        ) : (
          <EmptyState
            icon={ReceiptText}
            title="Sale not found"
            description="This transaction may have been removed, or you may not have access to it."
            action={
              <Button size="sm" onClick={() => navigate("/sales")} leftIcon={<ArrowLeft size={13} />}>
                Back to sales
              </Button>
            }
          />
        )}
      </div>
    );
  }

  const payment = sale.payments[0];

  return (
    <div className="page-shell">
      <PageHeader
        title={`Sale ${sale.ref}`}
        subtitle={
          <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="inline-flex items-center gap-1">
              <CalendarDays size={12} />
              {formatDateTime(sale.createdAt, settings.timezone)}
            </span>
            <span className="soft">·</span>
            <span className="inline-flex items-center gap-1">
              <User size={12} />
              {sale.cashierName}
            </span>
          </span>
        }
        icon={<ReceiptText size={18} />}
        actions={
          <>
            <Button
              variant="secondary"
              onClick={() => navigate("/sales")}
              leftIcon={<ArrowLeft size={14} />}
              className="hidden sm:inline-flex"
            >
              Back
            </Button>
            <Button variant="secondary" onClick={handlePrint} leftIcon={<Printer size={14} />}>
              Print
            </Button>
            {canRefund && (
              <Button variant="secondary" onClick={openRefund} leftIcon={<RotateCcw size={14} />}>
                Refund
              </Button>
            )}
            {canVoid && (
              <Button variant="danger" onClick={() => setVoidOpen(true)} leftIcon={<Ban size={14} />}>
                Void
              </Button>
            )}
          </>
        }
      />

      {sale.status !== "completed" && (
        <div className={`alert ${sale.status === "voided" ? "alert-danger" : "alert-warning"}`}>
          <Info size={16} />
          <div>
            <strong>
              {sale.status === "voided"
                ? "This sale has been voided."
                : `This sale has been ${sale.status.replaceAll("_", " ")}.`}
            </strong>{" "}
            {sale.status === "voided"
              ? "Stock was returned and the transaction no longer counts towards revenue."
              : `${formatTZS(sale.refundedAmount)} has been returned to the customer.`}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex min-w-0 flex-col gap-4">
          <section className="card overflow-hidden">
            <div className="card-header">
              <div>
                <h2 className="card-title">Items sold</h2>
                <p className="card-subtitle">
                  {sale.itemCount} line{sale.itemCount === 1 ? "" : "s"} · {formatNumber(sale.units)} unit
                  {sale.units === 1 ? "" : "s"}
                </p>
              </div>
              <StatusBadge status={sale.status} />
            </div>
            <DataTable
              columns={itemColumns}
              rows={sale.items}
              rowKey={(item) => item.id}
              className="table-plain"
              minWidth={620}
              empty={
                <EmptyState
                  icon={ReceiptText}
                  title="No line items"
                  description="This sale has no recorded items."
                />
              }
            />
            <div className="flex justify-end border-t" style={{ borderColor: "var(--border)" }}>
              <div className="w-full max-w-[330px] p-4 sm:p-5">
                <div className="flex justify-between py-1 text-[11.5px] muted">
                  <span>Subtotal</span>
                  <span className="numeric">{formatTZS(sale.subtotal)}</span>
                </div>
                {sale.discount > 0 && (
                  <div className="flex justify-between py-1 text-[11.5px]" style={{ color: "var(--warning)" }}>
                    <span>Discount</span>
                    <span className="numeric">-{formatTZS(sale.discount)}</span>
                  </div>
                )}
                <div
                  className="mt-1 flex justify-between border-t pt-2.5"
                  style={{ borderColor: "var(--border)" }}
                >
                  <span className="text-[12px] font-semibold">Sale total</span>
                  <span className="numeric text-[15px] font-bold">{formatTZS(sale.total)}</span>
                </div>
                {sale.refundedAmount > 0 && (
                  <>
                    <div className="flex justify-between py-1 pt-3 text-[11.5px]" style={{ color: "var(--warning)" }}>
                      <span>Refunded</span>
                      <span className="numeric">-{formatTZS(sale.refundedAmount)}</span>
                    </div>
                    <div className="flex justify-between text-[12px] font-semibold">
                      <span>Retained</span>
                      <span className="numeric">{formatTZS(remaining)}</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </section>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <section className="card">
              <div className="card-header">
                <div>
                  <h2 className="card-title">Payment</h2>
                  <p className="card-subtitle">How this sale was settled.</p>
                </div>
                <Wallet size={16} className="soft" />
              </div>
              <div className="card-body pt-0">
                <div className="flex items-center justify-between py-2">
                  <span className="text-[11px] muted">Method</span>
                  <MethodBadge method={sale.paymentMethod} />
                </div>
                <div className="flex items-center justify-between border-t py-2" style={{ borderColor: "var(--border)" }}>
                  <span className="text-[11px] muted">Amount</span>
                  <span className="numeric text-[12px] font-semibold">{formatTZS(sale.total)}</span>
                </div>
                {sale.paymentMethod === "cash" ? (
                  <>
                    <div className="flex justify-between border-t py-2" style={{ borderColor: "var(--border)" }}>
                      <span className="text-[11px] muted">Received</span>
                      <span className="numeric text-[11px]">{formatTZS(sale.amountReceived)}</span>
                    </div>
                    <div className="flex justify-between border-t py-2" style={{ borderColor: "var(--border)" }}>
                      <span className="text-[11px] muted">Change given</span>
                      <span className="numeric text-[11px]">{formatTZS(sale.changeDue)}</span>
                    </div>
                  </>
                ) : (
                  <div className="border-t py-2" style={{ borderColor: "var(--border)" }}>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] muted">{methodLabel(sale.paymentMethod)} reference</span>
                      <span className="mono text-[10px]">{payment?.reference ?? "—"}</span>
                    </div>
                    {payment?.simulated && (
                      <div className="mt-1 text-[9px] uppercase tracking-wider soft">Simulated payment</div>
                    )}
                  </div>
                )}
                <div className="flex items-center justify-between border-t py-2" style={{ borderColor: "var(--border)" }}>
                  <span className="text-[11px] muted">Status</span>
                  <Badge tone={sale.status === "voided" ? "danger" : "success"}>
                    {sale.status === "voided" ? "Reversed" : "Captured"}
                  </Badge>
                </div>
              </div>
            </section>

            <section className="card">
              <div className="card-header">
                <div>
                  <h2 className="card-title">Customer & note</h2>
                  <p className="card-subtitle">Attached to this receipt.</p>
                </div>
              </div>
              <div className="card-body pt-0">
                <div className="flex items-center justify-between py-2">
                  <span className="text-[11px] muted">Customer</span>
                  <span className="max-w-[180px] truncate text-[11.5px] font-semibold">
                    {sale.customerName ?? "Walk-in customer"}
                  </span>
                </div>
                <div className="flex items-center justify-between border-t py-2" style={{ borderColor: "var(--border)" }}>
                  <span className="text-[11px] muted">Cashier</span>
                  <span className="text-[11.5px]">{sale.cashierName}</span>
                </div>
                <div className="flex items-center justify-between border-t py-2" style={{ borderColor: "var(--border)" }}>
                  <span className="text-[11px] muted">Business date</span>
                  <span className="mono text-[10.5px]">{sale.businessDate}</span>
                </div>
                <div className="border-t pt-2.5" style={{ borderColor: "var(--border)" }}>
                  <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider soft">Note</div>
                  <p className="text-[11px] leading-relaxed" style={{ color: sale.note ? "var(--text)" : "var(--text-soft)" }}>
                    {sale.note ?? "No note was added to this sale."}
                  </p>
                </div>
              </div>
            </section>
          </div>

          {sale.refunds.length > 0 && (
            <section className="card">
              <div className="card-header">
                <div>
                  <h2 className="card-title">Refund history</h2>
                  <p className="card-subtitle">
                    {sale.refunds.length} refund{sale.refunds.length === 1 ? "" : "s"} ·{" "}
                    {formatTZS(sale.refundedAmount)} total
                  </p>
                </div>
                <RotateCcw size={16} className="soft" />
              </div>
              <div className="card-body pt-1">
                <div className="data-list">
                  {sale.refunds.map((refund) => (
                    <div className="data-list-row" key={refund.id}>
                      <div
                        className="grid h-8 w-8 shrink-0 place-items-center rounded-full"
                        style={{ background: "var(--warning-soft)", color: "var(--warning)" }}
                      >
                        <RotateCcw size={13} />
                      </div>
                      <div className="data-list-main">
                        <div className="data-list-title">{refund.reason}</div>
                        <div className="data-list-sub">
                          {formatDateTime(refund.createdAt, settings.timezone)} · {refund.userName} ·{" "}
                          {refund.restock ? "restocked" : "not restocked"}
                        </div>
                      </div>
                      <div className="data-list-value" style={{ color: "var(--warning)" }}>
                        -{formatTZS(refund.amount)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}
        </div>

        <aside className="flex flex-col gap-3 xl:sticky xl:top-[86px]">
          <div className="card p-3 sm:p-4">
            <ReceiptPreview sale={sale} settings={settings} />
          </div>
          <div className="surface-soft flex items-start gap-2 p-3 text-[10px] leading-relaxed soft">
            <CircleAlert size={13} className="mt-0.5 shrink-0" />
            <span>
              Demo receipt only — this transaction is not reported to TRA. Payment references are simulated.
            </span>
          </div>
        </aside>
      </div>

      <ConfirmDialog
        open={voidOpen}
        onClose={() => setVoidOpen(false)}
        onConfirm={handleVoid}
        title={`Void ${sale.ref}?`}
        description={`This will reverse the entire ${formatTZS(sale.total)} sale and return all ${formatNumber(
          sale.units,
        )} units to stock. This cannot be undone.`}
        confirmLabel="Void sale"
        destructive
        loading={voiding}
      >
        <div className="surface-muted p-3 text-[11px] leading-relaxed muted">
          Voiding is audit-logged against your account. Prefer a refund if the customer is returning only some
          items.
        </div>
      </ConfirmDialog>

      <Modal
        open={refundOpen}
        onClose={() => {
          if (!refunding) setRefundOpen(false);
        }}
        title="Refund sale"
        description={`${sale.ref} · ${formatTZS(sale.total)} total · ${formatTZS(remaining)} refundable`}
        size="sm"
        dismissible={!refunding}
        footer={
          <>
            <Button variant="secondary" onClick={() => setRefundOpen(false)} disabled={refunding}>
              Cancel
            </Button>
            <Button onClick={handleRefund} loading={refunding} leftIcon={<RotateCcw size={14} />}>
              Refund {refundAmount ? formatTZS(Number(refundAmount) || 0) : ""}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3.5">
          {refundError && <div className="alert alert-danger">{refundError}</div>}
          <Field label="Refund amount" required hint={`Maximum ${formatTZS(remaining)}.`}>
            <Input
              type="number"
              min={1}
              max={remaining}
              step={1}
              value={refundAmount}
              onChange={(event) => {
                const next = event.target.value;
                setRefundAmount(next);
                setRefundError(null);
                if (Number(next) !== remaining) setRefundRestock(false);
              }}
            />
          </Field>
          <Field label="Reason" required>
            <Input
              value={refundReason}
              onChange={(event) => {
                setRefundReason(event.target.value);
                setRefundError(null);
              }}
              placeholder="e.g. Customer returned damaged item"
              maxLength={240}
            />
          </Field>
          <label className="check-row surface-soft cursor-pointer p-3">
            <input
              type="checkbox"
              className="checkbox"
              checked={refundRestock}
              disabled={Number(refundAmount) !== remaining}
              onChange={(event) => setRefundRestock(event.target.checked)}
            />
            <span>
              <span className="block text-[11.5px] font-semibold">Return items to stock</span>
              <span className="mt-0.5 block text-[10px] leading-relaxed soft">
                Only available for a full refund. Partial refunds leave stock unchanged.
              </span>
            </span>
          </label>
          <div className="surface-muted p-3 text-[10px] leading-relaxed muted">
            Refunds are recorded against the original sale, audit-logged, and reflected in reports. Payment
            reversal is simulated in this demo.
          </div>
        </div>
      </Modal>
    </div>
  );
}
