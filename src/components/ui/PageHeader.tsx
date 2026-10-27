import type { ReactNode } from "react";
import { useDocumentTitle } from "@/lib/utils";

export function PageHeader({
  title,
  subtitle,
  actions,
  eyebrow,
  icon,
  documentTitle,
}: {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  eyebrow?: string;
  icon?: ReactNode;
  documentTitle?: string;
}) {
  useDocumentTitle(documentTitle ?? title);

  return (
    <div className="page-header">
      <div className="flex min-w-0 items-start gap-3">
        {icon && <div className="topbar-context-icon mt-0.5 hidden sm:grid">{icon}</div>}
        <div className="min-w-0">
          {eyebrow && <div className="eyebrow mb-1">{eyebrow}</div>}
          <h1 className="page-title">{title}</h1>
          {subtitle && <div className="page-subtitle">{subtitle}</div>}
        </div>
      </div>
      {actions && <div className="page-header-actions">{actions}</div>}
    </div>
  );
}
