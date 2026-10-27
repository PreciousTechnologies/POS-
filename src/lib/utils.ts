import { useEffect, useState } from "react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { PaymentMethod, Role, SaleStatus } from "./types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const numberFormatter = new Intl.NumberFormat("en-US");

export function formatNumber(value: number | null | undefined) {
  const n = Number(value ?? 0);
  return numberFormatter.format(Number.isFinite(n) ? n : 0);
}

export function formatTZS(value: number | null | undefined) {
  return `TZS ${formatNumber(value)}`;
}

export function compactNumber(value: number | null | undefined) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return "0";
  if (Math.abs(n) >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return formatNumber(n);
}

export function formatDate(value: string | Date | null | undefined, timeZone = "Africa/Dar_es_Salaam") {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone,
  }).format(date);
}

export function formatDateTime(value: string | Date | null | undefined, timeZone = "Africa/Dar_es_Salaam") {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone,
  }).format(date);
}

export function formatTime(value: string | Date | null | undefined, timeZone = "Africa/Dar_es_Salaam") {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone,
  }).format(date);
}

export function todayInTimeZone(timeZone = "Africa/Dar_es_Salaam") {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const pick = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${pick("year")}-${pick("month")}-${pick("day")}`;
}

export function addDaysIso(isoDate: string, days: number) {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export type RangePreset = "today" | "7d" | "14d" | "30d" | "month" | "custom";

export type DateRange = { from: string; to: string };

export function rangeForPreset(preset: Exclude<RangePreset, "custom">, timeZone = "Africa/Dar_es_Salaam"): DateRange {
  const today = todayInTimeZone(timeZone);
  switch (preset) {
    case "today":
      return { from: today, to: today };
    case "7d":
      return { from: addDaysIso(today, -6), to: today };
    case "14d":
      return { from: addDaysIso(today, -13), to: today };
    case "30d":
      return { from: addDaysIso(today, -29), to: today };
    case "month":
      return { from: `${today.slice(0, 8)}01`, to: today };
  }
}

export function formatRangeLabel(range: DateRange, timeZone = "Africa/Dar_es_Salaam") {
  if (!range.from || !range.to) return "Select a range";
  if (range.from === range.to) return formatDate(`${range.from}T12:00:00Z`, timeZone);
  return `${formatDate(`${range.from}T12:00:00Z`, timeZone)} – ${formatDate(`${range.to}T12:00:00Z`, timeZone)}`;
}

export function initials(name: string | null | undefined) {
  if (!name) return "??";
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function methodLabel(method: PaymentMethod | string | null | undefined) {
  if (method === "cash") return "Cash";
  if (method === "mobile_money") return "Mobile money";
  if (method === "card") return "Card";
  return method ? String(method) : "—";
}

export function statusLabel(status: SaleStatus | string | null | undefined) {
  if (status === "completed") return "Completed";
  if (status === "voided") return "Voided";
  if (status === "refunded") return "Refunded";
  if (status === "partially_refunded") return "Partially refunded";
  return status ? String(status) : "—";
}

export function roleLabel(role: Role | string | null | undefined) {
  if (role === "admin") return "Administrator";
  if (role === "cashier") return "Cashier";
  return role ? String(role) : "—";
}

export function movementLabel(type: string) {
  switch (type) {
    case "stock_in":
      return "Stock in";
    case "sale":
      return "Sale";
    case "void":
      return "Void";
    case "return":
      return "Return";
    case "adjustment":
      return "Adjustment";
    default:
      return type;
  }
}

export function actionLabel(action: string) {
  return action
    .split(".")
    .map((part) => part.replaceAll("_", " "))
    .join(" · ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function truncate(value: string, max = 80) {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

export function isAdmin(role: Role | null | undefined) {
  return role === "admin";
}

export function useDebouncedValue<T>(value: T, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export function useDocumentTitle(title: string) {
  useEffect(() => {
    document.title = `${title} · Kariakoo POS`;
  }, [title]);
}
