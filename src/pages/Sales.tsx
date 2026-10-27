import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight, Plus, ReceiptText, Search, X } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { PaymentMethod, Sale, SaleStatus, User } from "@/lib/types";
import {
  formatDateTime,
  formatNumber,
  formatTZS,
  rangeForPreset,
  useDebouncedValue,
  type DateRange,
} from "@/lib/utils";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { MethodBadge, StatusBadge } from "@/components/ui/Badge";
import { Input, Select } from "@/components/ui/Input";
import { RangePicker } from "@/components/ui/RangePicker";
import { DataTable, Pagination, type Column } from "@/components/ui/DataTable";
import { EmptyState, ErrorPanel } from "@/components/ui/States";

export function SalesPage() {
  const { settings, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [range, setRange] = useState<DateRange>(() => rangeForPreset("30d", settings.timezone));
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const [method, setMethod] = useState<PaymentMethod | "">("");
  const [status, setStatus] = useState<SaleStatus | "">("");
  const [cashierId, setCashierId] = useState("");
  const [cashiers, setCashiers] = useState<User[]>([]);
  const [items, setItems] = useState<Sale[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    api.users
      .list()
      .then((result) => {
        if (!cancelled) setCashiers(result.items);
      })
      .catch(() => {
        if (!cancelled) setCashiers([]);
      });
    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api.sales
      .list({
        from: range.from,
        to: range.to,
        page,
        pageSize,
        search: debouncedSearch.trim() || undefined,
        method: method || undefined,
        status: status || undefined,
        cashierId: isAdmin ? cashierId || undefined : undefined,
        sortKey: "createdAt",
        sortDir: "desc",
      })
      .then((result) => {
        if (cancelled) return;
        setItems(result.items);
        setTotal(result.total);
      })
      .catch((caught) => {
        if (cancelled) return;
        setError(caught instanceof Error ? caught.message : "Could not load sales.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [range, page, pageSize, debouncedSearch, method, status, cashierId, isAdmin, reloadKey]);

  const hasFilters = Boolean(search || method || status || cashierId);

  const columns: Column<Sale>[] = [
    {
      key: "ref",
      header: "Reference",
      cell: (sale) => (
        <div>
          <div className="cell-main mono text-[11px]">{sale.ref}</div>
          <div className="cell-sub">{sale.businessDate}</div>
        </div>
      ),
    },
    {
      key: "when",
      header: "When",
      cell: (sale) => (
        <span className="whitespace-nowrap text-[11px] muted">
          {formatDateTime(sale.createdAt, settings.timezone)}
        </span>
      ),
    },
    {
      key: "customer",
      header: "Customer / cashier",
      cell: (sale) => (
        <div>
          <div className="cell-main max-w-[180px] truncate">{sale.customerName ?? "Walk-in customer"}</div>
          <div className="cell-sub">{sale.cashierName}</div>
        </div>
      ),
    },
    {
      key: "items",
      header: "Items",
      align: "center",
      cell: (sale) => (
        <div>
          <div className="numeric text-[11px] font-semibold">{formatNumber(sale.units)}</div>
          <div className="cell-sub">{sale.itemCount} lines</div>
        </div>
      ),
    },
    {
      key: "total",
      header: "Total",
      align: "right",
      cell: (sale) => (
        <div>
          <div className="numeric font-semibold">{formatTZS(sale.total)}</div>
          {sale.refundedAmount > 0 && (
            <div className="cell-sub" style={{ color: "var(--warning)" }}>
              -{formatTZS(sale.refundedAmount)} refunded
            </div>
          )}
        </div>
      ),
    },
    {
      key: "payment",
      header: "Payment",
      cell: (sale) => <MethodBadge method={sale.paymentMethod} />,
    },
    {
      key: "status",
      header: "Status",
      cell: (sale) => <StatusBadge status={sale.status} />,
    },
    {
      key: "open",
      header: "",
      align: "right",
      cell: (sale) => (
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => navigate(`/sales/${sale.id}`)}
          aria-label={`Open ${sale.ref}`}
          title="Open sale"
        >
          <ChevronRight size={14} />
        </Button>
      ),
    },
  ];

  return (
    <div className="page-shell">
      <PageHeader
        title="Sales"
        subtitle={`${formatNumber(total)} transaction${total === 1 ? "" : "s"} in the selected range`}
        icon={<ReceiptText size={18} />}
        actions={
          <>
            <RangePicker
              from={range.from}
              to={range.to}
              timezone={settings.timezone}
              onChange={(next) => {
                setRange(next);
                setPage(1);
              }}
            />
            <Button onClick={() => navigate("/pos")} leftIcon={<Plus size={14} />}>
              New sale
            </Button>
          </>
        }
      />

      {error && <ErrorPanel message={error} onRetry={() => setReloadKey((value) => value + 1)} />}

      <div className="table-wrap">
        <div className="table-toolbar">
          <div className="table-toolbar-left">
            <div className="input-icon-wrap min-w-[210px] flex-1 sm:max-w-[290px]">
              <Search size={14} />
              <Input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                placeholder="Search reference, customer or cashier"
                aria-label="Search sales"
              />
            </div>
            <Select
              value={method}
              onChange={(event) => {
                setMethod(event.target.value as PaymentMethod | "");
                setPage(1);
              }}
              className="w-[140px]"
              aria-label="Filter payment method"
            >
              <option value="">All payments</option>
              <option value="cash">Cash</option>
              <option value="mobile_money">Mobile money</option>
              <option value="card">Card</option>
            </Select>
            <Select
              value={status}
              onChange={(event) => {
                setStatus(event.target.value as SaleStatus | "");
                setPage(1);
              }}
              className="w-[155px]"
              aria-label="Filter sale status"
            >
              <option value="">All status</option>
              <option value="completed">Completed</option>
              <option value="partially_refunded">Partially refunded</option>
              <option value="refunded">Refunded</option>
              <option value="voided">Voided</option>
            </Select>
            {isAdmin && (
              <Select
                value={cashierId}
                onChange={(event) => {
                  setCashierId(event.target.value);
                  setPage(1);
                }}
                className="w-[150px]"
                aria-label="Filter cashier"
              >
                <option value="">All cashiers</option>
                {cashiers.map((cashier) => (
                  <option key={cashier.id} value={cashier.id}>
                    {cashier.name}
                  </option>
                ))}
              </Select>
            )}
            {hasFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearch("");
                  setMethod("");
                  setStatus("");
                  setCashierId("");
                  setPage(1);
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
          rowKey={(sale) => sale.id}
          loading={loading}
          className="table-plain"
          minWidth={980}
          onRowClick={(sale) => navigate(`/sales/${sale.id}`)}
          empty={
            <EmptyState
              icon={ReceiptText}
              title={hasFilters ? "No sales match these filters" : "No sales in this range"}
              description={
                hasFilters
                  ? "Clear a filter or choose a wider date range."
                  : "Completed sales will appear here as soon as the counter is busy."
              }
              action={
                hasFilters ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setSearch("");
                      setMethod("");
                      setStatus("");
                      setCashierId("");
                    }}
                  >
                    Clear filters
                  </Button>
                ) : (
                  <Button size="sm" onClick={() => navigate("/pos")} leftIcon={<Plus size={13} />}>
                    Start a sale
                  </Button>
                )
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
    </div>
  );
}
