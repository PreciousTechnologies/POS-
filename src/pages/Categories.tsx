import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Package, Pencil, Plus, Power, Search, Tags, X } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { Category, CategoryInput } from "@/lib/types";
import { cn, formatNumber } from "@/lib/utils";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Field, Input, Textarea } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState, ErrorPanel, Skeleton } from "@/components/ui/States";

type CategoryForm = { name: string; description: string; active: boolean };

const emptyForm: CategoryForm = { name: "", description: "", active: true };

export function CategoriesPage() {
  const { isAdmin } = useAuth();
  const [items, setItems] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [form, setForm] = useState<CategoryForm>(emptyForm);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [toggleTarget, setToggleTarget] = useState<Category | null>(null);
  const [toggling, setToggling] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api.categories
      .list()
      .then((result) => {
        if (!cancelled) setItems(result.items);
      })
      .catch((caught) => {
        if (!cancelled) setError(caught instanceof Error ? caught.message : "Could not load categories.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return items;
    return items.filter(
      (category) =>
        category.name.toLowerCase().includes(term) ||
        (category.description ?? "").toLowerCase().includes(term),
    );
  }, [items, search]);

  const activeCount = items.filter((category) => category.active).length;
  const productCount = items.reduce((sum, category) => sum + category.productCount, 0);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setFieldError(null);
    setFormError(null);
    setFormOpen(true);
  };

  const openEdit = (category: Category) => {
    setEditing(category);
    setForm({
      name: category.name,
      description: category.description ?? "",
      active: category.active,
    });
    setFieldError(null);
    setFormError(null);
    setFormOpen(true);
  };

  const save = async () => {
    if (form.name.trim().length < 2) {
      setFieldError("Category name must be at least 2 characters.");
      return;
    }
    setSaving(true);
    setFormError(null);
    const payload: CategoryInput = {
      name: form.name.trim(),
      description: form.description.trim(),
      active: form.active,
    };
    try {
      if (editing) {
        await api.categories.update(editing.id, payload);
        toast.success("Category updated.");
      } else {
        await api.categories.create(payload);
        toast.success("Category created.");
      }
      setFormOpen(false);
      setReloadKey((value) => value + 1);
    } catch (caught) {
      setFormError(caught instanceof ApiError ? caught.message : "Could not save the category.");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async () => {
    if (!toggleTarget) return;
    setToggling(true);
    try {
      await api.categories.update(toggleTarget.id, {
        name: toggleTarget.name,
        description: toggleTarget.description ?? "",
        active: !toggleTarget.active,
      });
      toast.success(`${toggleTarget.name} ${toggleTarget.active ? "deactivated" : "reactivated"}.`);
      setToggleTarget(null);
      setReloadKey((value) => value + 1);
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Could not update the category.");
    } finally {
      setToggling(false);
    }
  };

  return (
    <div className="page-shell">
      <PageHeader
        title="Categories"
        subtitle={`${formatNumber(items.length)} groups · ${formatNumber(activeCount)} active · ${formatNumber(productCount)} products`}
        icon={<Tags size={18} />}
        actions={
          isAdmin ? (
            <Button onClick={openCreate} leftIcon={<Plus size={14} />}>
              Add category
            </Button>
          ) : (
            <Badge tone="info">Cashier view</Badge>
          )
        }
      />

      {error && <ErrorPanel message={error} onRetry={() => setReloadKey((value) => value + 1)} />}

      <div className="flex flex-wrap items-center gap-2">
        <div className="input-icon-wrap min-w-[220px] max-w-[360px] flex-1">
          <Search size={14} />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search categories"
            aria-label="Search categories"
          />
        </div>
        {search && (
          <Button variant="ghost" size="sm" onClick={() => setSearch("")} leftIcon={<X size={12} />}>
            Clear
          </Button>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div className="surface-card p-4" key={index}>
              <Skeleton className="h-10 w-10 rounded-xl" />
              <Skeleton className="mt-4 h-4 w-32" />
              <Skeleton className="mt-2 h-3 w-full" />
              <Skeleton className="mt-5 h-3 w-24" />
            </div>
          ))}
        </div>
      ) : filtered.length ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((category) => (
            <article
              className={cn("surface-card group relative overflow-hidden p-4", !category.active && "opacity-75")}
              key={category.id}
            >
              <div
                className="absolute right-0 top-0 h-24 w-24 rounded-bl-full opacity-60"
                style={{
                  background: "radial-gradient(circle at 80% 10%, var(--primary-soft), transparent 70%)",
                }}
              />
              <div className="relative flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="empty-icon" style={{ width: 39, height: 39, borderRadius: 13 }}>
                    <Tags size={18} />
                  </div>
                  <div>
                    <h2 className="text-[13px] font-semibold">{category.name}</h2>
                    <Badge tone={category.active ? "success" : "neutral"} dot className="mt-1">
                      {category.active ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                </div>
                {isAdmin && (
                  <div className="flex items-center gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => openEdit(category)}
                      aria-label={`Edit ${category.name}`}
                      title="Edit category"
                    >
                      <Pencil size={13} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => setToggleTarget(category)}
                      aria-label={`${category.active ? "Deactivate" : "Reactivate"} ${category.name}`}
                      title={category.active ? "Deactivate category" : "Reactivate category"}
                    >
                      <Power size={13} />
                    </Button>
                  </div>
                )}
              </div>

              <p className="relative mt-3 line-clamp-2 min-h-[34px] text-[11px] leading-relaxed muted">
                {category.description || "No description added yet."}
              </p>

              <div className="relative mt-4 flex items-center justify-between border-t pt-3" style={{ borderColor: "var(--border)" }}>
                <span className="inline-meta">
                  <Package size={12} />
                  {formatNumber(category.activeProductCount)} active
                </span>
                <span className="text-[10px] soft">{formatNumber(category.productCount)} total</span>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="surface-card">
          <EmptyState
            icon={Tags}
            title={search ? "No categories match that search" : "No categories yet"}
            description={
              search
                ? "Try a shorter search or clear the filter."
                : isAdmin
                  ? "Create a category to group the catalogue and make the POS easier to browse."
                  : "Ask an administrator to create categories."
            }
            action={
              isAdmin && !search ? (
                <Button size="sm" onClick={openCreate} leftIcon={<Plus size={13} />}>
                  Add category
                </Button>
              ) : search ? (
                <Button variant="secondary" size="sm" onClick={() => setSearch("")}>
                  Clear search
                </Button>
              ) : undefined
            }
          />
        </div>
      )}

      <Modal
        open={formOpen}
        onClose={() => {
          if (!saving) setFormOpen(false);
        }}
        title={editing ? "Edit category" : "New category"}
        description={editing ? editing.name : "Group related products together."}
        size="sm"
        dismissible={!saving}
        footer={
          <>
            <Button variant="secondary" onClick={() => setFormOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={save} loading={saving}>
              {editing ? "Save changes" : "Create category"}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3.5">
          {formError && <div className="alert alert-danger">{formError}</div>}
          <Field label="Category name" htmlFor="category-name" error={fieldError} required>
            <Input
              id="category-name"
              value={form.name}
              onChange={(event) => {
                setForm((current) => ({ ...current, name: event.target.value }));
                setFieldError(null);
              }}
              placeholder="e.g. Beverages"
              maxLength={60}
            />
          </Field>
          <Field label="Description" htmlFor="category-description" hint="Optional" >
            <Textarea
              id="category-description"
              value={form.description}
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
              placeholder="What belongs in this group?"
              maxLength={240}
            />
          </Field>
          <div className="flex items-center justify-between gap-4 rounded-xl border p-3" style={{ borderColor: "var(--border)", background: "var(--surface-soft)" }}>
            <div>
              <div className="text-[12px] font-semibold">Category is active</div>
              <div className="field-hint">Inactive categories are hidden from the cashier filter list.</div>
            </div>
            <button
              type="button"
              className={cn("switch", form.active && "is-on")}
              onClick={() => setForm((current) => ({ ...current, active: !current.active }))}
              aria-pressed={form.active}
              aria-label="Category active"
            />
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(toggleTarget)}
        onClose={() => setToggleTarget(null)}
        onConfirm={toggleActive}
        title={toggleTarget?.active ? "Deactivate category?" : "Reactivate category?"}
        description={
          toggleTarget
            ? toggleTarget.active
              ? `${toggleTarget.name} will be hidden from cashier category filters. Its ${toggleTarget.productCount} product${toggleTarget.productCount === 1 ? "" : "s"} stay in the catalogue.`
              : `${toggleTarget.name} will be available again in the cashier category filters.`
            : undefined
        }
        confirmLabel={toggleTarget?.active ? "Deactivate" : "Reactivate"}
        destructive={Boolean(toggleTarget?.active)}
        loading={toggling}
      />
    </div>
  );
}
