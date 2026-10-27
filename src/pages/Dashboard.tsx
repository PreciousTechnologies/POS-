import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Banknote,
  BarChart3,
  Boxes,
  CircleDollarSign,
  LayoutDashboard,
  PackageOpen,
  Plus,
  ReceiptText,
  RefreshCw,
  ShoppingBag,
  ShoppingCart,
  TrendingUp,
  TriangleAlert,
  Users,
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
import type { DashboardData } from "@/lib/types";
import {
  compactNumber,
  formatDate,
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
import { StatusBadge } from "@/components/ui/Badge";
import { EmptyState, ErrorPanel, Skeleton } from "@/components/ui/States";

const CHART_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

function greeting(timeZone: string) {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hour12: false, timeZone }).format(new Date()),
  );
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

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

export function DashboardPage() {
  const { user, settings, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [range, setRange] = useState<DateRange>(() => rangeForPreset("30d", settings.timezone));
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.dashboard(range);
      setData(result);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load the dashboard.");
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    void load();
  }, [load, reloadKey]);

  const kpis = data?.kpis;
  const paymentTotal = data?.paymentMix.reduce((sum, row) => sum + Number(row.amount), 0) ?? 0;
  const bestMax = Math.max(1, ...(data?.bestSellers.map((item) => item.qty) ?? [1]));
  const todayLabel = formatDate(new Date(), settings.timezone);

  return (
    <div className="page-shell">
      <PageHeader
        title="Dashboard"
        subtitle={`${data?.scope === "cashier" ? "Your counter" : "Business overview"} · ${todayLabel}`}
        icon={<LayoutDashboard size={18} />}
        actions={
          <>
            <RangePicker from={range.from} to={range.to} onChange={setRange} timezone={settings.timezone} />
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setReloadKey((value) => value + 1)}
              leftIcon={<RefreshCw size={13} className={loading ? "spin" : undefined} />}
              aria-label="Refresh dashboard"
            >
              <span className="hidden sm:inline">Refresh</span>
            </Button>
          </>
        }
      />

      <section className="hero-card">
        <div className="hero-grid" />
        <div className="hero-content">
          <div className="hero-kicker">
            <SparkKicker />
            {data?.scope === "cashier" ? "My counter" : "Kariakoo Mini Market"}
          </div>
          <h2 className="hero-title">
            {greeting(settings.timezone)}, {user?.name.split(" ")[0] ?? "there"}. Let’s make today count.
          </h2>
          <p className="hero-copy">
            {isAdmin
              ? "The shelves, the counter, and the books are in one place. Here is how the selected period is moving."
              : "Your sales, receipts, and the products that need attention are right here. Keep the queue moving."}
          </p>
          <div className="hero-stats">
            <div>
              <div className="hero-stat-value numeric">{kpis ? formatTZS(kpis.netRevenue) : "—"}</div>
              <div className="hero-stat-label">Net revenue</div>
            </div>
            <div>
              <div className="hero-stat-value numeric">{kpis ? formatNumber(kpis.transactions) : "—"}</div>
              <div className="hero-stat-label">Transactions</div>
            </div>
            <div>
              <div className="hero-stat-value numeric">{kpis ? formatNumber(kpis.itemsSold) : "—"}</div>
              <div className="hero-stat-label">Items sold</div>
            </div>
            <div className="flex items-end gap-2 pb-0.5">
              <Button size="sm" onClick={() => navigate("/pos")} leftIcon={<Plus size={14} />}>
                Start a sale
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => navigate("/sales")}
                rightIcon={<ArrowRight size={13} />}
                className="hidden sm:inline-flex"
              >
                Sales
              </Button>
            </div>
          </div>
        </div>
      </section>

      {error && <ErrorPanel message={error} onRetry={() => void load()} />}

      <div className="kpi-grid">
        {loading && !data
          ? Array.from({ length: 4 }).map((_, index) => (
              <div className="kpi-card" key={index}>
                <Skeleton className="h-3 w-24" />
                <Skeleton className="mt-5 h-7 w-36" />
                <Skeleton className="mt-3 h-3 w-28" />
              </div>
            ))
          : (
              <>
                <KpiCard
                  label="Gross sales"
                  value={kpis ? formatTZS(kpis.grossSales) : "—"}
                  hint={kpis ? `${formatNumber(kpis.transactions)} completed sales` : "Selected period"}
                  icon={<Banknote size={16} />}
                  index={0}
                />
                <KpiCard
                  label="Net revenue"
                  value={kpis ? formatTZS(kpis.netRevenue) : "—"}
                  hint={kpis ? `${formatNumber(kpis.refundCount)} refund${kpis.refundCount === 1 ? "" : "s"}` : "After refunds"}
                  icon={<Wallet size={16} />}
                  index={1}
                />
                <KpiCard
                  label="Transactions"
                  value={kpis ? formatNumber(kpis.transactions) : "—"}
                  hint={kpis ? `Avg. ${formatTZS(kpis.avgSale)}` : "Selected period"}
                  icon={<ReceiptText size={16} />}
                  index={2}
                />
                {isAdmin ? (
                  <KpiCard
                    label="Estimated profit"
                    value={kpis ? formatTZS(kpis.profit) : "—"}
                    hint={kpis ? `${formatNumber(kpis.lowStockCount)} low stock · ${formatNumber(kpis.outOfStockCount)} out` : "Cost-based estimate"}
                    icon={<TrendingUp size={16} />}
                    index={3}
                  />
                ) : (
                  <KpiCard
                    label="Items sold"
                    value={kpis ? formatNumber(kpis.itemsSold) : "—"}
                    hint="Units across your sales"
                    icon={<ShoppingBag size={16} />}
                    index={3}
                  />
                )}
              </>
            )}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.62fr_1fr]">
        <section className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">Revenue rhythm</h2>
              <p className="card-subtitle">Daily gross sales and refunds across the selected range.</p>
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
              <Skeleton className="h-[260px] w-full" />
            ) : data && data.series.some((point) => point.revenue > 0) ? (
              <div className="chart-wrap">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.series} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                    <defs>
                      <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.34} />
                        <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.02} />
                      </linearGradient>
                      <linearGradient id="refundFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--chart-2)" stopOpacity={0.22} />
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
                      fill="url(#revenueFill)"
                      activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--surface-solid)" }}
                    />
                    <Area
                      type="monotone"
                      dataKey="refunds"
                      name="Refunds"
                      stroke="var(--chart-2)"
                      strokeWidth={1.6}
                      fill="url(#refundFill)"
                      activeDot={{ r: 3.5 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyState
                icon={BarChart3}
                title="No sales in this range"
                description="The rhythm will appear as soon as a sale is completed."
                action={
                  <Button size="sm" onClick={() => navigate("/pos")} leftIcon={<ShoppingCart size={13} />}>
                    Open the counter
                  </Button>
                }
                className="h-[260px]"
              />
            )}
          </div>
        </section>

        <section className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">Payment mix</h2>
              <p className="card-subtitle">How customers are paying in this range.</p>
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
                description="Complete a sale to see the cash, mobile money, and card mix."
                className="h-[250px]"
              />
            )}
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.08fr_0.92fr]">
        <section className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">Top sellers</h2>
              <p className="card-subtitle">The products moving fastest in this period.</p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => navigate("/reports")} className="hidden sm:inline-flex">
              Reports <ArrowRight size={12} />
            </Button>
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
                            background: `linear-gradient(90deg, var(--primary), var(--accent))`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={PackageOpen}
                title="No products sold yet"
                description="Top sellers are ranked by units sold in the selected period."
                className="h-[200px]"
              />
            )}
          </div>
        </section>

        <section className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">Stock watch</h2>
              <p className="card-subtitle">Products at or below their reorder point.</p>
            </div>
            <TriangleAlert size={17} style={{ color: "var(--warning)" }} />
          </div>
          <div className="card-body pt-2">
            {loading && !data ? (
              <div className="flex flex-col gap-2">
                {Array.from({ length: 4 }).map((_, index) => (
                  <Skeleton key={index} className="h-11 w-full" />
                ))}
              </div>
            ) : data && data.lowStock.length ? (
              <>
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
                <Button
                  variant="secondary"
                  size="sm"
                  className="mt-2 w-full"
                  onClick={() => navigate("/inventory")}
                  leftIcon={<Boxes size={13} />}
                >
                  Manage stock
                </Button>
              </>
            ) : (
              <EmptyState
                icon={Boxes}
                title="Stock looks healthy"
                description="No products are below their reorder point right now."
                className="h-[205px]"
              />
            )}
          </div>
        </section>
      </div>

      <section className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title">Recent sales</h2>
            <p className="card-subtitle">The latest completed transactions across the selected range.</p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => navigate("/sales")} rightIcon={<ArrowRight size={12} />}>
            All sales
          </Button>
        </div>
        <div className="card-body pt-2">
          {loading && !data ? (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 5 }).map((_, index) => (
                <Skeleton key={index} className="h-11 w-full" />
              ))}
            </div>
          ) : data && data.recentSales.length ? (
            <div className="data-list">
              {data.recentSales.map((sale) => (
                <Link to={`/sales/${sale.id}`} key={sale.id} className="data-list-row group">
                  <div className="flex min-w-0 flex-1 items-center gap-2.5">
                    <div className="empty-icon" style={{ width: 32, height: 32, borderRadius: 10 }}>
                      <ReceiptText size={15} />
                    </div>
                    <div className="min-w-0">
                      <div className="data-list-title group-hover:underline">{sale.ref}</div>
                      <div className="data-list-sub">
                        {sale.cashierName} · {formatDate(sale.createdAt, settings.timezone)}
                      </div>
                    </div>
                  </div>
                  <StatusBadge status={sale.status} />
                  <div className="data-list-value">{formatTZS(sale.total)}</div>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState icon={ReceiptText} title="No recent sales" description="Completed sales will appear here." />
          )}
        </div>
      </section>
    </div>
  );
}

function SparkKicker() {
  return <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: "var(--primary)" }} />;
}
