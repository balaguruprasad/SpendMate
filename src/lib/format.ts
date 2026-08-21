import { CURRENCY } from "@/types";

const currencyFmt = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: CURRENCY,
  maximumFractionDigits: 0,
});

const currencyFmtPrecise = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: CURRENCY,
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Whole-rupee currency, e.g. ₹1,20,000. */
export function formatMoney(amount: number): string {
  return currencyFmt.format(amount);
}

/** Currency with paise, e.g. ₹1,20,000.00. */
export function formatMoneyPrecise(amount: number): string {
  return currencyFmtPrecise.format(amount);
}

/** Compact money for chart axes, e.g. ₹1.2L, ₹45k. */
export function formatMoneyCompact(amount: number): string {
  if (amount >= 1e7) return `₹${(amount / 1e7).toFixed(1)}Cr`;
  if (amount >= 1e5) return `₹${(amount / 1e5).toFixed(1)}L`;
  if (amount >= 1e3) return `₹${Math.round(amount / 1e3)}k`;
  return `₹${amount}`;
}

/** All dates render in India Standard Time (GMT+5:30) regardless of the viewer's locale. */
const IST = "Asia/Kolkata";

const dateFmt = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: IST,
});

const dateTimeFmt = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
  timeZone: IST,
});

export function formatDate(iso: string): string {
  return dateFmt.format(new Date(iso));
}

/** e.g. "08 Jun 2026, 01:14 pm IST" — always India Standard Time. */
export function formatDateTime(iso: string): string {
  return `${dateTimeFmt.format(new Date(iso))} IST`;
}

/** "2 hours ago" style relative time for activity feeds. */
export function formatRelative(iso: string, now: Date = new Date()): string {
  const diffMs = now.getTime() - new Date(iso).getTime();
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.round(diffHr / 24);
  if (diffDay < 30) return `${diffDay}d ago`;
  return formatDate(iso);
}

export function initials(fullName: string): string {
  return fullName
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function formatFileSize(bytes: number): string {
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(1)} MB`;
  if (bytes >= 1e3) return `${Math.round(bytes / 1e3)} KB`;
  return `${bytes} B`;
}
