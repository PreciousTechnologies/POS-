import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Banknote,
  BarChart3,
  Boxes,
  CircleDollarSign,
  Download,
  FileSpreadsheet,
  Package,
  Percent,
  ReceiptText,
  RefreshCw,
  ShoppingBag,
  TrendingUp,
  Trophy,
  Wallet,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { ReportData } from "@/lib/types";
import {
  compactNumber,
  formatDate,
  formatDateTime,
  formatNumber,
  formatTZS,
  methodLabel,
  rangeForPreset,
  type DateRange,
} from "@/lib/utils";
import { PageHeader } from "@/components/ui/PageHeader";
import { KpiCard } from "@/components/ui/KpiCard";
import { RangePicker } from "@/components/ui/RangePicker";
import { Button } from "@/components/ui/Button";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { EmptyState, ErrorPanel, Skeleton } from "@/components/ui/States";

type ExportType = "summary" | "sales" | "inventory" | "best-sellers";

const CHART_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

const EXPORT_OPTIONS: Array<{
  type: ExportType;
  title: string;
  description: string;
  icon: typeof Download;
}> = [
  {
    type: "summary",
    title: "Summary report",
    description: "Daily totals, payment mix, and category performance.",
    icon: BarChart3,
  },
  {
    type: "sales",
    title: "Sales register",
    description: "Every line item with cashier, payment, and refund data.",
    icon: ReceiptText,
  },
  {
    type: "best-sellers",
    title: "Best sellers",
    description: "Products ranked by units sold and revenue.",
    icon: Trophy,
  },
  {
    type: "inventory",
    title: "Inventory snapshot",
    description: "Current stock levels, costs, and reorder points.",
    icon: Package,
  },
];

function axisDate(value: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    timeZone,
  }).format(new Date(`${value}T12:00:00Z`));
}

function RevenueTooltip({
  active,
  payload,
  label,
  timeZone,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ dataKey?: string | number; name?: string; value?: number; color?: string }>;
  label?: string;
  timeZone: string;
}) {
  if (!active || !payload?.length || !label) return null;
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-label">{formatDate(`${label}T12:00:00Z`, timeZone)}</div>
      {payload.map((item) => (
        <div className="chart-tooltip-row" key={item.dataKey ?? item.name}>
          <span className="flex items-center gap-1.5">
            <span className="chart-tooltip-dot" style={{ background: item.color }} />
            {item.name}
          </span>
          <span>{formatTZS(Number(item.value ?? 0))}</span>
        </div>
      ))}
    </div>
  );
}

function PaymentTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ name?: string; value?: number; payload?: { method?: string } }>;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0];
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-label">{methodLabel(row.payload?.method)}</div>
      <div className="chart-tooltip-row">
        <span>Collected</span>
        <span>{formatTZS(Number(row.value ?? 0))}</span>
      </div>
    </div>
  );
}

export function ReportsPage() {
  const { settings } = useAuth();
  const [range, setRange] = useState<DateRange>(() => rangeForPreset("30d", settings.timezone));
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [exportOpen, setExportOpen] = useState(false);
  const [exporting, setExporting] = useState<ExportType | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api.reports
      .summary(range)
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((caught) => {
        if (!cancelled) setError(caught instanceof Error ? caught.message : "Could not load reports.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [range, reloadKey]);

  const totals = data?.totals;
  const paymentTotal = data?.paymentMix.reduce((sum, row) => sum + Number(row.amount), 0) ?? 0;
  const bestMax = Math.max(1, ...(data?.bestSellers.map((item) => item.qty) ?? [1]));
  const categoryMax = Math.max(1, ...(data?.categories.map((item) => item.revenue) ?? [1]));
  const hasSales = Boolean(data?.series.some((point) => point.revenue > 0 || point.refunds > 0));

  const handleExport = async (type: ExportType) => {
    setExporting(type);
    try {
      const filename = await api.reports.exportCsv({ ...range, type });
      toast.success(`Exported ${filename}.`);
      setExportOpen(false);
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Could not export this report.");
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="page-shell">
      <PageHeader
        title="Reports"
        subtitle={
          data
            ? `Business performance · ${formatDate(`${data.range.from}T12:00:00Z`, settings.timezone)} – ${formatDate(
                `${data.range.to}T12:00:00Z`,
                settings.timezone,
              )}`
            : "Business performance for the selected period"
        }
        icon={<BarChart3 size={18} />}
        actions={
          <>
            <RangePicker from={range.from} to={range.to} onChange={setRange} timezone={settings.timezone} />
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setReloadKey((value) => value + 1)}
              leftIcon={<RefreshCw size={13} className={loading ? "spin" : undefined} />}
              aria-label="Refresh reports"
            >
              <span className="hidden sm:inline">Refresh</span>
            </Button>
            <Button onClick={() => setExportOpen(true)} leftIcon={<Download size={14} />}>
              Export
            </Button>
          </>
        }
      />

      {error && <ErrorPanel message={error} onRetry={() => setReloadKey((value) => value + 1)} />}

      <div className="kpi-grid">
        {loading && !data ? (
          Array.from({ length: 4 }).map((_, index) => (
            <div className="kpi-card" key={index}>
              <Skeleton className="h-3 w-24" />
              <Skeleton className="mt-5 h-7 w-36" />
              <Skeleton className="mt-3 h-3 w-28" />
            </div>
          ))
        ) : (
          <>
            <KpiCard
              label="Gross sales"
              value={totals ? formatTZS(totals.grossSales) : "—"}
              hint={totals ? `${formatNumber(totals.transactions)} transactions` : "Selected period"}
              icon={<Banknote size={16} />}
              index={0}
            />
            <KpiCard
              label="Net revenue"
              value={totals ? formatTZS(totals.netRevenue) : "—"}
              hint={totals ? `${formatTZS(totals.refunds)} refunded` : "After refunds"}
              icon={<Wallet size={16} />}
              index={1}
            />
            <KpiCard
              label="Estimated profit"
              value={totals ? formatTZS(totals.profit) : "—"}
              hint={totals ? `${formatNumber(totals.itemsSold)} items sold` : "Cost-based estimate"}
              icon={<TrendingUp size={16} />}
              index={2}
            />
            <KpiCard
              label="Average sale"
              value={totals ? formatTZS(totals.avgSale) : "—"}
              hint={totals ? `${formatNumber(totals.refundCount)} refunds · ${formatTZS(totals.discounts)} discounts` : "Selected period"}
              icon={<Percent size={16} />}
              index={3}
            />
          </>
        )}
      </div>

      <div className="stat-row grid-cols-2 sm:grid-cols-4">
        <div className="stat-box">
          <div className="stat-box-value numeric">{totals ? formatNumber(totals.itemsSold) : "—"}</div>
          <div className="stat-box-label">Items sold</div>
        </div>
        <div className="stat-box">
          <div className="stat-box-value numeric">{totals ? formatNumber(totals.transactions) : "—"}</div>
          <div className="stat-box-label">Transactions</div>
        </div>
        <div className="stat-box">
          <div className="stat-box-value numeric">{totals ? formatTZS(totals.discounts) : "—"}</div>
          <div className="stat-box-label">Discounts given</div>
        </div>
        <div className="stat-box">
          <div className="stat-box-value numeric">{data ? formatNumber(data.inventory.lowStock + data.inventory.outOfStock) : "—"}</div>
          <div className="stat-box-label">Stock alerts</div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.62fr_1fr]">
        <section className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">Revenue vs refunds</h2>
              <p className="card-subtitle">Daily sales and the money returned to customers.</p>
            </div>
            <div className="chart-legend">
              <span className="chart-legend-item">
                <span className="chart-legend-dot" style={{ background: "var(--chart-1)" }} />
                Sales
              </span>
              <span className="chart-legend-item">
                <span className="chart-legend-dot" style={{ background: "var(--chart-2)" }} />
                Refunds
              </span>
            </div>
          </div>
          <div className="card-body">
            {loading && !data ? (
              <Skeleton className="h-[270px] w-full" />
            ) : data && hasSales ? (
              <div className="chart-wrap">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.series} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                    <defs>
                      <linearGradient id="reportRevenueFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.34} />
                        <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.02} />
                      </linearGradient>
                      <linearGradient id="reportRefundFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--chart-2)" stopOpacity={0.24} />
                        <stop offset="100%" stopColor="var(--chart-2)" stopOpacity={0.01} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} stroke="var(--chart-grid)" strokeDasharray="3 3" />
                    <XAxis
                      dataKey="date"
                      axisLine={false}
                      tickLine={false}
                      minTickGap={26}
                      tickFormatter={(value: string) => axisDate(value, settings.timezone)}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      width={48}
                      tickFormatter={(value: number) => compactNumber(value)}
                    />
                    <Tooltip content={<RevenueTooltip timeZone={settings.timezone} />} />
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      name="Sales"
                      stroke="var(--chart-1)"
                      strokeWidth={2.2}
                      fill="url(#reportRevenueFill)"
                      activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--surface-solid)" }}
                    />
                    <Area
                      type="monotone"
                      dataKey="refunds"
                      name="Refunds"
                      stroke="var(--chart-2)"
                      strokeWidth={1.6}
                      fill="url(#reportRefundFill)"
                      activeDot={{ r: 3.5 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyState
                icon={BarChart3}
                title="No activity in this range"
                description="Choose a wider range or complete a sale to populate this report."
                className="h-[270px]"
              />
            )}
          </div>
        </section>

        <section className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">Payment mix</h2>
              <p className="card-subtitle">How the business collected money.</p>
            </div>
            <CircleDollarSign size={17} style={{ color: "var(--primary)" }} />
          </div>
          <div className="card-body">
            {loading && !data ? (
              <Skeleton className="h-[250px] w-full" />
            ) : data && data.paymentMix.length ? (
              <>
                <div className="relative mx-auto h-[185px] w-full max-w-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={data.paymentMix}
                        dataKey="amount"
                        nameKey="method"
                        innerRadius={55}
                        outerRadius={78}
                        paddingAngle={4}
                        stroke="none"
                      >
                        {data.paymentMix.map((row, index) => (
                          <Cell key={row.method} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip content={<PaymentTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <div className="text-[9px] font-semibold uppercase tracking-[0.12em] soft">Collected</div>
                    <div className="mt-0.5 font-display text-base font-bold tracking-tight">
                      {compactNumber(paymentTotal)}
                    </div>
                    <div className="text-[9px] soft">TZS</div>
                  </div>
                </div>
                <div className="mt-2 flex flex-col gap-2">
                  {data.paymentMix.map((row, index) => (
                    <div className="flex items-center justify-between gap-2" key={row.method}>
                      <span className="flex items-center gap-1.5 text-[11px] font-medium" style={{ color: "var(--text-muted)" }}>
                        <span
                          className="chart-legend-dot"
                          style={{ background: CHART_COLORS[index % CHART_COLORS.length] }}
                        />
                        {methodLabel(row.method)}
                      </span>
                      <span className="numeric text-[11px] font-semibold">
                        {paymentTotal ? `${Math.round((Number(row.amount) / paymentTotal) * 100)}%` : "0%"}
                        <span className="ml-2 soft">{formatTZS(row.amount)}</span>
                      </span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <EmptyState
                icon={CircleDollarSign}
                title="No payments yet"
                description="Completed sales will populate the payment mix."
                className="h-[250px]"
              />
            )}
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">Best sellers</h2>
              <p className="card-subtitle">Ranked by units sold in this period.</p>
            </div>
            <Trophy size={17} style={{ color: "var(--warning)" }} />
          </div>
          <div className="card-body pt-3">
            {loading && !data ? (
              <div className="flex flex-col gap-3">
                {Array.from({ length: 5 }).map((_, index) => (
                  <Skeleton key={index} className="h-10 w-full" />
                ))}
              </div>
            ) : data && data.bestSellers.length ? (
              <div className="flex flex-col gap-3.5">
                {data.bestSellers.map((item, index) => (
                  <div key={item.productId} className="flex items-center gap-3">
                    <span
                      className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-[11px] font-bold"
                      style={{ background: "var(--primary-soft)", color: "var(--primary)" }}
                    >
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-[11.5px] font-semibold">{item.name}</span>
                        <span className="numeric shrink-0 text-[10.5px] soft">
                          {formatNumber(item.qty)} sold · {formatTZS(item.revenue)}
                        </span>
                      </div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full" style={{ background: "var(--surface-muted)" }}>
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.max(6, (item.qty / bestMax) * 100)}%`,
                            background: "linear-gradient(90deg, var(--primary), var(--accent))",
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={ShoppingBag}
                title="No products sold"
                description="Product rankings appear once there are sales in this range."
                className="h-[220px]"
              />
            )}
          </div>
        </section>

        <section className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">Category performance</h2>
              <p className="card-subtitle">Revenue contribution by category.</p>
            </div>
            <FileSpreadsheet size={17} className="soft" />
          </div>
          <div className="card-body pt-3">
            {loading && !data ? (
              <div className="flex flex-col gap-3">
                {Array.from({ length: 5 }).map((_, index) => (
                  <Skeleton key={index} className="h-10 w-full" />
                ))}
              </div>
            ) : data && data.categories.length ? (
              <div className="flex flex-col gap-3.5">
                {data.categories.map((item) => (
                  <div key={item.id}>
                    <div className="mb-1.5 flex items-center justify-between gap-2">
                      <span className="truncate text-[11.5px] font-semibold">{item.name}</span>
                      <span className="numeric shrink-0 text-[10.5px] soft">
                        {formatNumber(item.qty)} units · {formatTZS(item.revenue)}
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full" style={{ background: "var(--surface-muted)" }}>
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.max(4, (item.revenue / categoryMax) * 100)}%`,
                          background: "var(--chart-3)",
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={Package}
                title="No category revenue"
                description="Category performance appears once sales are recorded."
                className="h-[220px]"
              />
            )}
          </div>
        </section>
      </div>

      <section className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title">Inventory snapshot</h2>
            <p className="card-subtitle">The stock position at the time this report was generated.</p>
          </div>
          <Boxes size={17} className="soft" />
        </div>
        <div className="card-body pt-0">
          {loading && !data ? (
            <Skeleton className="h-[100px] w-full" />
          ) : data ? (
            <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-6">
              <div className="stat-box">
                <div className="stat-box-value numeric">{formatNumber(data.inventory.activeProducts)}</div>
                <div className="stat-box-label">Active products</div>
              </div>
              <div className="stat-box">
                <div className="stat-box-value numeric">{formatNumber(data.inventory.units)}</div>
                <div className="stat-box-label">Units on hand</div>
              </div>
              <div className="stat-box">
                <div className="stat-box-value numeric">{formatTZS(data.inventory.costValue)}</div>
                <div className="stat-box-label">Cost value</div>
              </div>
              <div className="stat-box">
                <div className="stat-box-value numeric">{formatTZS(data.inventory.retailValue)}</div>
                <div className="stat-box-label">Retail value</div>
              </div>
              <div className="stat-box">
                <div className="stat-box-value numeric" style={{ color: "var(--warning)" }}>
                  {formatNumber(data.inventory.lowStock)}
                </div>
                <div className="stat-box-label">Low stock</div>
              </div>
              <div className="stat-box">
                <div className="stat-box-value numeric" style={{ color: "var(--danger)" }}>
                  {formatNumber(data.inventory.outOfStock)}
                </div>
                <div className="stat-box-label">Out of stock</div>
              </div>
            </div>
          ) : null}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">Low stock</h2>
              <p className="card-subtitle">Products at or below the reorder point.</p>
            </div>
            <Badge tone="warning" dot>
              {formatNumber(data?.inventory.lowStock ?? 0)}
            </Badge>
          </div>
          <div className="card-body pt-2">
            {loading && !data ? (
              <div className="flex flex-col gap-2">
                {Array.from({ length: 4 }).map((_, index) => (
                  <Skeleton key={index} className="h-11 w-full" />
                ))}
              </div>
            ) : data && data.lowStock.length ? (
              <div className="data-list">
                {data.lowStock.map((item) => (
                  <div className="data-list-row" key={item.id}>
                    <div className="empty-icon" style={{ width: 32, height: 32, borderRadius: 10 }}>
                      <Boxes size={15} />
                    </div>
                    <div className="data-list-main">
                      <div className="data-list-title">{item.name}</div>
                      <div className="data-list-sub">
                        {item.categoryName} · min {item.minStock}
                      </div>
                    </div>
                    <div className="data-list-value" style={{ color: "var(--warning)" }}>
                      {item.stock} left
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={Boxes}
                title="No low-stock products"
                description="All products are above their reorder points."
                className="h-[200px]"
              />
            )}
          </div>
        </section>

        <section className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">Out of stock</h2>
              <p className="card-subtitle">Unavailable products that need restocking.</p>
            </div>
            <Badge tone="danger" dot>
              {formatNumber(data?.inventory.outOfStock ?? 0)}
            </Badge>
          </div>
          <div className="card-body pt-2">
            {loading && !data ? (
              <div className="flex flex-col gap-2">
                {Array.from({ length: 4 }).map((_, index) => (
                  <Skeleton key={index} className="h-11 w-full" />
                ))}
              </div>
            ) : data && data.outOfStock.length ? (
              <div className="data-list">
                {data.outOfStock.map((item) => (
                  <div className="data-list-row" key={item.id}>
                    <div className="empty-icon" style={{ width: 32, height: 32, borderRadius: 10 }}>
                      <Package size={15} />
                    </div>
                    <div className="data-list-main">
                      <div className="data-list-title">{item.name}</div>
                      <div className="data-list-sub">
                        {item.categoryName} · {item.sku}
                      </div>
                    </div>
                    <div className="data-list-value" style={{ color: "var(--danger)" }}>
                      0 left
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={Package}
                title="Nothing is out of stock"
                description="All active products have units available."
                className="h-[200px]"
              />
            )}
          </div>
        </section>
      </div>

      <section className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title">Sale status breakdown</h2>
            <p className="card-subtitle">Completed, refunded, and voided transactions.</p>
          </div>
          <Badge tone="neutral">{formatNumber(totals?.transactions ?? 0)} total</Badge>
        </div>
        <div className="card-body pt-0">
          {loading && !data ? (
            <Skeleton className="h-[76px] w-full" />
          ) : data && data.statusBreakdown.length ? (
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
              {data.statusBreakdown.map((row) => (
                <div className="surface-soft p-3" key={row.status}>
                  <div className="flex items-center justify-between gap-2">
                    <StatusBadge status={row.status} />
                    <strong className="numeric text-sm">{formatNumber(row.count)}</strong>
                  </div>
                  <div className="mt-2 text-[10px] muted">{formatTZS(row.total)}</div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={ReceiptText}
              title="No transactions"
              description="Sale statuses will appear once transactions exist in this range."
              className="h-[150px]"
            />
          )}
        </div>
        {data && (
          <div className="border-t px-4 py-2.5 text-[10px] soft" style={{ borderColor: "var(--border)" }}>
            Generated {formatDateTime(data.generatedAt, settings.timezone)} · Profit is a cost-based estimate from
            recorded sale line costs.
          </div>
        )}
      </section>

      <Modal
        open={exportOpen}
        onClose={() => {
          if (!exporting) setExportOpen(false);
        }}
        title="Export reports"
        description={`CSV files for ${formatDate(`${range.from}T12:00:00Z`, settings.timezone)} – ${formatDate(
          `${range.to}T12:00:00Z`,
          settings.timezone,
        )}.`}
        size="sm"
        dismissible={!exporting}
        footer={
          <Button variant="secondary" onClick={() => setExportOpen(false)} disabled={Boolean(exporting)}>
            Close
          </Button>
        }
      >
        <div className="flex flex-col gap-2">
          {EXPORT_OPTIONS.map((option) => {
            const Icon = option.icon;
            return (
              <button
                type="button"
                key={option.type}
                className="surface-soft flex items-center gap-3 p-3 text-left transition-colors hover:border-[var(--border-strong)] disabled:opacity-60"
                style={{ border: "1px solid var(--border)" }}
                onClick={() => void handleExport(option.type)}
                disabled={Boolean(exporting)}
              >
                <span
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-xl"
                  style={{ background: "var(--primary-soft)", color: "var(--primary)" }}
                >
                  <Icon size={16} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[11.5px] font-semibold">{option.title}</span>
                  <span className="mt-0.5 block text-[10px] leading-relaxed soft">{option.description}</span>
                </span>
                {exporting === option.type ? (
                  <RefreshCw size={14} className="spin soft" />
                ) : (
                  <Download size={14} className="soft" />
                )}
              </button>
            );
          })}
        </div>
      </Modal>
    </div>
  );
}
