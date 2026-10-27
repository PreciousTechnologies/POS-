import type { ReactNode } from "react";
import { cn, methodLabel, statusLabel } from "@/lib/utils";
import type { PaymentMethod, SaleStatus } from "@/lib/types";

type Tone = "primary" | "success" | "warning" | "danger" | "info" | "neutral";

const toneClass: Record<Tone, string> = {
  primary: "badge-primary",
  success: "badge-success",
  warning: "badge-warning",
  danger: "badge-danger",
  info: "badge-info",
  neutral: "badge-neutral",
};

export function Badge({
  children,
  tone = "neutral",
  dot = false,
  className,
}: {
  children: ReactNode;
  tone?: Tone;
  dot?: boolean;
  className?: string;
}) {
  return (
    <span className={cn("badge", toneClass[tone], className)}>
      {dot && <span className="status-dot" />}
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: SaleStatus | string }) {
  const tone: Tone =
    status === "completed"
      ? "success"
      : status === "voided"
        ? "neutral"
        : status === "refunded" || status === "partially_refunded"
          ? "warning"
          : "neutral";
  return (
    <Badge tone={tone} dot>
      {statusLabel(status)}
    </Badge>
  );
}

export function MethodBadge({ method }: { method: PaymentMethod | string }) {
  const tone: Tone = method === "cash" ? "neutral" : method === "mobile_money" ? "info" : "primary";
  return <Badge tone={tone}>{methodLabel(method)}</Badge>;
}

export function StockBadge({ stock, minStock }: { stock: number; minStock: number }) {
  if (stock <= 0) return <Badge tone="danger" dot>Out of stock</Badge>;
  if (stock <= minStock) return <Badge tone="warning" dot>Low stock</Badge>;
  return <Badge tone="success" dot>In stock</Badge>;
}

export function RoleBadge({ role }: { role: string }) {
  return <Badge tone={role === "admin" ? "primary" : "info"}>{role === "admin" ? "Admin" : "Cashier"}</Badge>;
}
