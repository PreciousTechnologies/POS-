import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn, formatNumber } from "@/lib/utils";
import { EmptyState, Skeleton } from "./States";
import { Button } from "./Button";

export type Column<T> = {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  className?: string;
  align?: "left" | "center" | "right";
  width?: string | number;
};

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  loading = false,
  skeletonRows = 6,
  empty,
  minWidth = 690,
  onRowClick,
  className,
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  loading?: boolean;
  skeletonRows?: number;
  empty?: ReactNode;
  minWidth?: number;
  onRowClick?: (row: T) => void;
  className?: string;
}) {
  return (
    <div className={cn("table-wrap", className)}>
      <div className="table-scroll">
        <table className="data-table" style={{ minWidth }}>
          <thead>
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={column.className}
                  style={{ width: column.width, textAlign: column.align }}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: skeletonRows }).map((_, rowIndex) => (
                  <tr key={`skeleton-${rowIndex}`}>
                    {columns.map((column, columnIndex) => (
                      <td key={column.key} style={{ textAlign: column.align }}>
                        <Skeleton
                          className={cn("h-3.5", columnIndex === 0 ? "w-40" : "w-20", column.align === "right" && "ml-auto")}
                        />
                      </td>
                    ))}
                  </tr>
                ))
              : rows.map((row) => (
                  <tr
                    key={rowKey(row)}
                    className={cn(onRowClick && "cursor-pointer")}
                    tabIndex={onRowClick ? 0 : undefined}
                    onClick={(event) => {
                      if (!onRowClick) return;
                      const target = event.target;
                      if (target instanceof HTMLElement && target.closest("button, a, input, select, textarea, label")) return;
                      onRowClick(row);
                    }}
                    onKeyDown={(event) => {
                      if (!onRowClick) return;
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onRowClick(row);
                      }
                    }}
                  >
                    {columns.map((column) => (
                      <td key={column.key} className={column.className} style={{ textAlign: column.align }}>
                        {column.cell(row)}
                      </td>
                    ))}
                  </tr>
                ))}
          </tbody>
        </table>
      </div>
      {!loading && rows.length === 0 && (empty ?? <EmptyState description="Try changing your filters or add a new record." />)}
    </div>
  );
}

export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  className,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  className?: string;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(total, page * pageSize);

  return (
    <div className={cn("table-pagination", className)}>
      <div className="flex items-center gap-2">
        <span>
          Showing <strong className="numeric" style={{ color: "var(--text)" }}>{formatNumber(start)}</strong>–
          <strong className="numeric" style={{ color: "var(--text)" }}>{formatNumber(end)}</strong> of{" "}
          <strong className="numeric" style={{ color: "var(--text)" }}>{formatNumber(total)}</strong>
        </span>
        {onPageSizeChange && (
          <select
            className="select"
            style={{ width: 70, minHeight: 27, padding: "2px 20px 2px 7px", fontSize: 11 }}
            value={pageSize}
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
            aria-label="Rows per page"
          >
            {[10, 12, 20, 40, 100].map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        )}
      </div>
      <div className="flex items-center gap-1.5">
        <Button
          variant="secondary"
          size="icon-sm"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          aria-label="Previous page"
        >
          <ChevronLeft size={14} />
        </Button>
        <span className="px-1.5 text-[11px] font-semibold" style={{ color: "var(--text-muted)" }}>
          {page} / {pages}
        </span>
        <Button
          variant="secondary"
          size="icon-sm"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= pages}
          aria-label="Next page"
        >
          <ChevronRight size={14} />
        </Button>
      </div>
    </div>
  );
}
