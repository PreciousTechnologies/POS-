import { useEffect, useState } from "react";
import { History, RefreshCw, Search, ShieldCheck, X } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { AuditLog } from "@/lib/types";
import { actionLabel, formatDateTime, formatNumber, useDebouncedValue } from "@/lib/utils";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Badge, RoleBadge } from "@/components/ui/Badge";
import { Input, Select } from "@/components/ui/Input";
import { DataTable, Pagination, type Column } from "@/components/ui/DataTable";
import { EmptyState, ErrorPanel } from "@/components/ui/States";

type AuditTone = "success" | "info" | "warning" | "danger" | "primary" | "neutral";

function auditTone(action: string): AuditTone {
  if (action.includes("create") || action.includes("reactivate")) return "success";
  if (action.includes("deactivate") || action.includes("void")) return "danger";
  if (action.includes("refund") || action.includes("adjust")) return "warning";
  if (action.includes("update")) return "info";
  return "neutral";
}

function auditIconColor(action: string) {
  const tone = auditTone(action);
  if (tone === "success") return "var(--success)";
  if (tone === "danger") return "var(--danger)";
  if (tone === "warning") return "var(--warning)";
  if (tone === "info") return "var(--info)";
  return "var(--primary)";
}

export function AuditPage() {
  const { settings } = useAuth();
  const [items, setItems] = useState<AuditLog[]>([]);
  const [actions, setActions] = useState<Array<{ action: string; count: number }>>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const [action, setAction] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api.audit
      .list({
        page,
        pageSize,
        search: debouncedSearch.trim() || undefined,
        action: action || undefined,
      })
      .then((result) => {
        if (cancelled) return;
        setItems(result.items);
        setTotal(result.total);
        setActions(result.actions);
      })
      .catch((caught) => {
        if (cancelled) return;
        setError(caught instanceof Error ? caught.message : "Could not load the audit log.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [page, pageSize, debouncedSearch, action, reloadKey]);

  const columns: Column<AuditLog>[] = [
    {
      key: "when",
      header: "When",
      cell: (log) => (
        <span className="whitespace-nowrap text-[10.5px] muted">
          {formatDateTime(log.createdAt, settings.timezone)}
        </span>
      ),
    },
    {
      key: "event",
      header: "Event",
      cell: (log) => (
        <div className="flex items-start gap-2.5">
          <span
            className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg"
            style={{
              background: `color-mix(in srgb, ${auditIconColor(log.action)} 13%, transparent)`,
              color: auditIconColor(log.action),
            }}
          >
            <History size={13} />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge tone={auditTone(log.action)}>{actionLabel(log.action)}</Badge>
              <span className="text-[9px] soft">{log.entity}</span>
            </div>
            <div className="mt-1 max-w-[360px] text-[11px] leading-relaxed">{log.description}</div>
            {log.meta != null && (
              <details className="audit-meta">
                <summary>Details</summary>
                <pre>{JSON.stringify(log.meta, null, 2)}</pre>
              </details>
            )}
          </div>
        </div>
      ),
    },
    {
      key: "user",
      header: "Actor",
      cell: (log) => (
        <div>
          <div className="cell-main">{log.userName ?? "System"}</div>
          <div className="mt-1">
            {log.userRole ? <RoleBadge role={log.userRole} /> : <span className="cell-sub">Automated</span>}
          </div>
        </div>
      ),
    },
    {
      key: "entity",
      header: "Entity",
      cell: (log) => (
        <div>
          <div className="text-[10.5px] font-semibold capitalize">{log.entity}</div>
          <div className="cell-sub mono">{log.entityId ? `${log.entityId.slice(0, 10)}…` : "—"}</div>
        </div>
      ),
    },
  ];

  const hasFilters = Boolean(search || action);

  return (
    <div className="page-shell">
      <PageHeader
        title="Audit log"
        subtitle={`${formatNumber(total)} recorded event${total === 1 ? "" : "s"} · immutable activity trail`}
        icon={<ShieldCheck size={18} />}
        actions={
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setReloadKey((value) => value + 1)}
            leftIcon={<RefreshCw size={13} className={loading ? "spin" : undefined} />}
          >
            Refresh
          </Button>
        }
      />

      {error && <ErrorPanel message={error} onRetry={() => setReloadKey((value) => value + 1)} />}

      <div className="table-wrap">
        <div className="table-toolbar">
          <div className="table-toolbar-left">
            <div className="input-icon-wrap min-w-[220px] flex-1 sm:max-w-[320px]">
              <Search size={14} />
              <Input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                placeholder="Search description, actor or entity"
                aria-label="Search audit log"
              />
            </div>
            <Select
              value={action}
              onChange={(event) => {
                setAction(event.target.value);
                setPage(1);
              }}
              className="max-w-[230px]"
              aria-label="Filter audit action"
            >
              <option value="">All actions</option>
              {actions.map((row) => (
                <option key={row.action} value={row.action}>
                  {actionLabel(row.action)} ({row.count})
                </option>
              ))}
            </Select>
            {hasFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearch("");
                  setAction("");
                  setPage(1);
                }}
                leftIcon={<X size={12} />}
              >
                Clear
              </Button>
            )}
          </div>
          <span className="text-[10px] soft">{formatNumber(actions.length)} action types</span>
        </div>

        <DataTable
          columns={columns}
          rows={items}
          rowKey={(log) => log.id}
          loading={loading}
          skeletonRows={8}
          className="table-plain"
          minWidth={840}
          empty={
            <EmptyState
              icon={History}
              title={hasFilters ? "No events match these filters" : "No audit events yet"}
              description={
                hasFilters
                  ? "Try a different action or clear the search."
                  : "Sales, stock changes, user updates, and settings changes will be recorded here."
              }
              action={
                hasFilters ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setSearch("");
                      setAction("");
                    }}
                  >
                    Clear filters
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

      <div className="surface-soft flex items-start gap-2 p-3 text-[10px] leading-relaxed soft">
        <ShieldCheck size={14} className="mt-0.5 shrink-0" />
        <span>
          Audit entries are append-only. They capture who changed what and when, including account activity,
          inventory movements, refunds, voids, and settings changes.
        </span>
      </div>
    </div>
  );
}
