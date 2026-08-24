/** Domain enums for the FDOA P2P portal. Mirror the future schema.sql. */

export const USER_ROLES = ["MEMBER", "ADMIN"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const VENDOR_STATUSES = ["DRAFT", "SUBMITTED", "APPROVED", "REJECTED"] as const;
export type VendorStatus = (typeof VENDOR_STATUSES)[number];

export const INVOICE_STATUSES = [
  "DRAFT",
  "SUBMITTED",
  "L1_APPROVED",
  "L2_APPROVED",
  "FULLY_APPROVED",
  "PAID",
  "REJECTED",
  "ON_HOLD",
] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export const APPROVAL_LEVELS = ["L1", "L2", "L3"] as const;
export type ApprovalLevel = (typeof APPROVAL_LEVELS)[number];

export const APPROVAL_DECISIONS = ["APPROVED", "REJECTED", "ON_HOLD"] as const;
export type ApprovalDecision = (typeof APPROVAL_DECISIONS)[number];

export const COST_CENTRES = [
  "VENDOR_PAYOUT",
  "STUDENT_PAYOUT",
  "FACULTY_PAYOUT",
  "EMPLOYEE_REIMBURSEMENT",
  "OTHERS",
] as const;
export type CostCentre = (typeof COST_CENTRES)[number];

export const DEPARTMENTS = ["PGP", "UG", "FORGE", "FFP", "MSL"] as const;
export type Department = (typeof DEPARTMENTS)[number];

export const PAYMENT_MODES = ["NEFT", "RTGS", "IMPS", "CHEQUE"] as const;
export type PaymentMode = (typeof PAYMENT_MODES)[number];

export const CURRENCY = "INR" as const;
export type CurrencyCode = typeof CURRENCY;
