import { useState } from "react";
import { toast } from "sonner";
import {
  Boxes,
  Globe2,
  Info,
  Percent,
  ReceiptText,
  RotateCcw,
  Save,
  Settings2,
  ShieldCheck,
  Store,
} from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { Settings } from "@/lib/types";
import { cn, formatDateTime } from "@/lib/utils";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Field, Input, Select, Textarea } from "@/components/ui/Input";

type SettingsForm = {
  businessName: string;
  phone: string;
  email: string;
  address: string;
  tin: string;
  timezone: string;
  receiptFooter: string;
  lowStockThreshold: string;
  allowDiscounts: boolean;
  discountLimitPct: string;
};

const TIMEZONES = [
  "Africa/Dar_es_Salaam",
  "Africa/Nairobi",
  "Africa/Kampala",
  "Africa/Kigali",
  "Africa/Lusaka",
  "Africa/Maputo",
  "Africa/Johannesburg",
  "Africa/Addis_Ababa",
  "UTC",
];

function toForm(settings: Settings): SettingsForm {
  return {
    businessName: settings.businessName,
    phone: settings.phone ?? "",
    email: settings.email ?? "",
    address: settings.address ?? "",
    tin: settings.tin ?? "",
    timezone: settings.timezone,
    receiptFooter: settings.receiptFooter ?? "",
    lowStockThreshold: String(settings.lowStockThreshold),
    allowDiscounts: settings.allowDiscounts,
    discountLimitPct: String(settings.discountLimitPct),
  };
}

export function SettingsPage() {
  const { settings, refreshSettings } = useAuth();
  const [form, setForm] = useState<SettingsForm>(() => toForm(settings));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = JSON.stringify(form) !== JSON.stringify(toForm(settings));
  const timezones = TIMEZONES.includes(form.timezone) ? TIMEZONES : [form.timezone, ...TIMEZONES];

  const set = <K extends keyof SettingsForm>(key: K, value: SettingsForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setError(null);
  };

  const reset = () => {
    setForm(toForm(settings));
    setError(null);
  };

  const save = async () => {
    if (form.businessName.trim().length < 2) {
      setError("Business name must be at least 2 characters.");
      return;
    }
    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      setError("Enter a valid business email address, or leave it blank.");
      return;
    }
    const lowStockThreshold = Number(form.lowStockThreshold);
    if (!Number.isInteger(lowStockThreshold) || lowStockThreshold < 0 || lowStockThreshold > 100000) {
      setError("Low-stock threshold must be a whole number between 0 and 100,000.");
      return;
    }
    const discountLimitPct = Number(form.discountLimitPct);
    if (!Number.isInteger(discountLimitPct) || discountLimitPct < 0 || discountLimitPct > 100) {
      setError("Discount limit must be a whole number between 0 and 100.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await api.settings.update({
        businessName: form.businessName.trim(),
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        address: form.address.trim() || null,
        tin: form.tin.trim() || null,
        timezone: form.timezone,
        receiptFooter: form.receiptFooter.trim() || null,
        lowStockThreshold,
        allowDiscounts: form.allowDiscounts,
        discountLimitPct,
      });
      const updated = await refreshSettings();
      if (updated) setForm(toForm(updated));
      toast.success("Business settings saved.");
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Could not save settings.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page-shell">
      <PageHeader
        title="Settings"
        subtitle="Business identity, receipt details, and the rules the register follows."
        icon={<Settings2 size={18} />}
        actions={
          <>
            <Button
              variant="secondary"
              onClick={reset}
              disabled={!dirty || saving}
              leftIcon={<RotateCcw size={14} />}
            >
              Reset
            </Button>
            <Button onClick={save} loading={saving} disabled={!dirty} leftIcon={<Save size={14} />}>
              Save changes
            </Button>
          </>
        }
      />

      {error && <div className="alert alert-danger">{error}</div>}

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex flex-col gap-4">
          <section className="card">
            <div className="card-header">
              <div className="flex items-center gap-2.5">
                <span
                  className="grid h-8 w-8 place-items-center rounded-xl"
                  style={{ background: "var(--primary-soft)", color: "var(--primary)" }}
                >
                  <Store size={15} />
                </span>
                <div>
                  <h2 className="card-title">Business profile</h2>
                  <p className="card-subtitle">Shown on receipts and around the workspace.</p>
                </div>
              </div>
              <Badge tone="neutral">{settings.currency}</Badge>
            </div>
            <div className="card-body">
              <div className="form-grid">
                <Field label="Business name" required className="field-full">
                  <Input
                    value={form.businessName}
                    onChange={(event) => set("businessName", event.target.value)}
                    placeholder="e.g. Kariakoo Mini Market"
                    maxLength={120}
                  />
                </Field>
                <Field label="Phone">
                  <Input
                    value={form.phone}
                    onChange={(event) => set("phone", event.target.value)}
                    placeholder="+255 …"
                    maxLength={40}
                  />
                </Field>
                <Field label="Email">
                  <Input
                    type="email"
                    value={form.email}
                    onChange={(event) => set("email", event.target.value)}
                    placeholder="hello@business.co.tz"
                    maxLength={120}
                  />
                </Field>
                <Field label="Address" className="field-full">
                  <Input
                    value={form.address}
                    onChange={(event) => set("address", event.target.value)}
                    placeholder="Street, area, city"
                    maxLength={240}
                  />
                </Field>
                <Field label="TIN" hint="Optional tax identification number printed on receipts.">
                  <Input
                    value={form.tin}
                    onChange={(event) => set("tin", event.target.value)}
                    placeholder="e.g. 123-456-789"
                    maxLength={40}
                  />
                </Field>
                <Field label="Currency">
                  <Input value={settings.currency} disabled readOnly />
                </Field>
              </div>
            </div>
          </section>

          <section className="card">
            <div className="card-header">
              <div className="flex items-center gap-2.5">
                <span
                  className="grid h-8 w-8 place-items-center rounded-xl"
                  style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
                >
                  <ReceiptText size={15} />
                </span>
                <div>
                  <h2 className="card-title">Receipt & locale</h2>
                  <p className="card-subtitle">The closing message and the clock used for business dates.</p>
                </div>
              </div>
            </div>
            <div className="card-body">
              <div className="form-grid">
                <Field label="Timezone" required className="field-full" hint="Business dates, receipts, and reports use this timezone.">
                  <Select value={form.timezone} onChange={(event) => set("timezone", event.target.value)}>
                    {timezones.map((timezone) => (
                      <option key={timezone} value={timezone}>
                        {timezone.replaceAll("_", " ")}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field
                  label="Receipt footer"
                  className="field-full"
                  hint={`${form.receiptFooter.length}/500 characters. Printed beneath the total on every receipt.`}
                >
                  <Textarea
                    value={form.receiptFooter}
                    onChange={(event) => set("receiptFooter", event.target.value)}
                    placeholder="Thank you for shopping with us."
                    maxLength={500}
                    rows={3}
                  />
                </Field>
              </div>
              <div className="surface-soft mt-3 flex items-start gap-2 p-3 text-[10px] leading-relaxed soft">
                <Globe2 size={13} className="mt-0.5 shrink-0" />
                <span>
                  Right now this timezone reads{" "}
                  <strong style={{ color: "var(--text)" }}>
                    {formatDateTime(new Date(), form.timezone)}
                  </strong>
                  . Receipts are demo documents and are not TRA fiscal receipts.
                </span>
              </div>
            </div>
          </section>

          <section className="card">
            <div className="card-header">
              <div className="flex items-center gap-2.5">
                <span
                  className="grid h-8 w-8 place-items-center rounded-xl"
                  style={{ background: "var(--warning-soft)", color: "var(--warning)" }}
                >
                  <Boxes size={15} />
                </span>
                <div>
                  <h2 className="card-title">Stock & discounts</h2>
                  <p className="card-subtitle">Operational rules enforced by the register.</p>
                </div>
              </div>
            </div>
            <div className="card-body">
              <div className="flex flex-col gap-4">
                <Field
                  label="Default low-stock threshold"
                  hint="Used for new products and as a fallback reorder point. Individual products can override it."
                >
                  <Input
                    type="number"
                    min={0}
                    max={100000}
                    step={1}
                    value={form.lowStockThreshold}
                    onChange={(event) => set("lowStockThreshold", event.target.value)}
                    className="max-w-[180px]"
                  />
                </Field>

                <div className="border-t pt-4" style={{ borderColor: "var(--border)" }}>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 text-[12px] font-semibold">
                        <Percent size={14} style={{ color: "var(--primary)" }} />
                        Allow cashier discounts
                      </div>
                      <p className="mt-1 max-w-[430px] text-[10.5px] leading-relaxed soft">
                        When enabled, cashiers can apply a discount up to the limit below. Administrators are not
                        limited by this setting.
                      </p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={form.allowDiscounts}
                      aria-label="Allow cashier discounts"
                      className={cn("switch", form.allowDiscounts && "is-on")}
                      onClick={() => set("allowDiscounts", !form.allowDiscounts)}
                    />
                  </div>
                  <div
                    className={cn("mt-3 flex items-center gap-3", !form.allowDiscounts && "pointer-events-none opacity-50")}
                  >
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={1}
                      value={form.discountLimitPct}
                      onChange={(event) => set("discountLimitPct", event.target.value)}
                      className="flex-1"
                      style={{ accentColor: "var(--primary)" }}
                      aria-label="Cashier discount limit percentage"
                    />
                    <div className="relative w-[92px]">
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        step={1}
                        value={form.discountLimitPct}
                        onChange={(event) => set("discountLimitPct", event.target.value)}
                        className="pr-7"
                        aria-label="Discount limit percentage"
                      />
                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] soft">%</span>
                    </div>
                  </div>
                  <div className="mt-1.5 text-[10px] soft">
                    {form.allowDiscounts
                      ? `Cashiers may discount up to ${form.discountLimitPct || 0}% of a sale.`
                      : "Cashier discounts are disabled."}
                  </div>
                </div>
              </div>
            </div>
          </section>

          <div className="surface-soft flex items-center gap-2 p-3 text-[10px] leading-relaxed soft">
            <ShieldCheck size={14} className="shrink-0" />
            <span>Every settings change is recorded in the audit log with your account and timestamp.</span>
          </div>
        </div>

        <aside className="flex flex-col gap-3 lg:sticky lg:top-[86px]">
          <div className="card p-3 sm:p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="eyebrow">Receipt preview</span>
              <ReceiptText size={14} className="soft" />
            </div>
            <div className="receipt-preview">
              <div className="receipt-center" style={{ fontSize: 13, fontWeight: 700 }}>
                {form.businessName || "Your business name"}
              </div>
              {form.address && <div className="receipt-center receipt-muted">{form.address}</div>}
              {form.phone && <div className="receipt-center receipt-muted">{form.phone}</div>}
              {form.email && <div className="receipt-center receipt-muted">{form.email}</div>}
              {form.tin && <div className="receipt-center receipt-muted">TIN {form.tin}</div>}
              <div className="receipt-rule" />
              <div className="receipt-row">
                <span className="receipt-muted">Sample item</span>
                <span>2 × 3,500</span>
              </div>
              <div className="receipt-row">
                <span className="receipt-muted">Subtotal</span>
                <span>TZS 7,000</span>
              </div>
              <div className="receipt-total receipt-row">
                <span>Total</span>
                <span>TZS 7,000</span>
              </div>
              <div className="receipt-row">
                <span className="receipt-muted">Cashier</span>
                <span>Amina</span>
              </div>
              <div className="receipt-rule" />
              <div className="receipt-center receipt-muted" style={{ fontSize: 9 }}>
                DEMO RECEIPT · Not a TRA fiscal receipt
              </div>
              {form.receiptFooter && (
                <div className="receipt-center" style={{ marginTop: 9, whiteSpace: "pre-line" }}>
                  {form.receiptFooter}
                </div>
              )}
            </div>
          </div>
          <div className="card p-4">
            <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold">
              <Info size={14} style={{ color: "var(--primary)" }} />
              Current rules
            </div>
            <div className="data-list">
              <div className="data-list-row" style={{ paddingInline: 0 }}>
                <span className="text-[10.5px] muted">Discounts</span>
                <Badge tone={form.allowDiscounts ? "success" : "neutral"} dot>
                  {form.allowDiscounts ? `Up to ${form.discountLimitPct || 0}%` : "Disabled"}
                </Badge>
              </div>
              <div className="data-list-row" style={{ paddingInline: 0 }}>
                <span className="text-[10.5px] muted">Low-stock default</span>
                <span className="numeric text-[11px] font-semibold">{form.lowStockThreshold || 0} units</span>
              </div>
              <div className="data-list-row" style={{ paddingInline: 0 }}>
                <span className="text-[10.5px] muted">Business timezone</span>
                <span className="max-w-[155px] truncate text-[10.5px] font-semibold">
                  {form.timezone.replaceAll("_", " ")}
                </span>
              </div>
              <div className="data-list-row" style={{ paddingInline: 0 }}>
                <span className="text-[10.5px] muted">Currency</span>
                <span className="text-[11px] font-semibold">{settings.currency}</span>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
