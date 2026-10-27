import type { ReactNode } from "react";
import { Inbox, Loader2, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} aria-hidden="true" />;
}

export function Spinner({ size = 18, className }: { size?: number; className?: string }) {
  return <Loader2 size={size} className={cn("spin", className)} aria-hidden="true" />;
}

export function InlineLoading({ label = "Loading" }: { label?: string }) {
  return (
    <span className="inline-meta">
      <Spinner size={13} />
      {label}
    </span>
  );
}

export function BootScreen({ label = "Opening your workspace" }: { label?: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="brand-mark animate-float" style={{ width: 56, height: 56, borderRadius: 19 }}>
          <span className="font-display text-lg font-bold">K</span>
        </div>
        <div>
          <div className="font-display text-sm font-semibold">Kariakoo POS</div>
          <div className="mt-1 flex items-center justify-center gap-2 text-xs soft">
            <Spinner size={13} />
            {label}
          </div>
        </div>
      </div>
    </div>
  );
}

export function EmptyState({
  icon: Icon = Inbox,
  title = "Nothing here yet",
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title?: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("empty-state", className)}>
      <div className="empty-icon">
        <Icon size={22} strokeWidth={1.7} />
      </div>
      <div className="empty-title">{title}</div>
      {description && <div className="empty-copy">{description}</div>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function ErrorPanel({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="alert alert-danger">
      <span className="flex-1">{message}</span>
      {onRetry && (
        <button type="button" className="link-button" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  );
}
