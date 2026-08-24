/**
 * Centralized TanStack Query key factory — one block per feature.
 * Hooks import keys from here; never inline string keys.
 */
import type { ListParams } from "@/types";

export const queryKeys = {
  spend: {
    all: ["spend"] as const,
    me: () => ["spend", "me"] as const,
    transactions: () => ["spend", "transactions"] as const,
    cards: () => ["spend", "cards"] as const,
    settings: () => ["spend", "settings"] as const,
    reminders: () => ["spend", "reminders"] as const,
    presence: () => ["spend", "presence"] as const,
    logins: () => ["spend", "logins"] as const,
  },
  auth: {
    me: ["auth", "me"] as const,
  },
  vendors: {
    all: ["vendors"] as const,
    list: (params?: ListParams) => ["vendors", "list", params] as const,
    detail: (id: string) => ["vendors", "detail", id] as const,
  },
  invoices: {
    all: ["invoices"] as const,
    list: (params?: ListParams) => ["invoices", "list", params] as const,
    detail: (id: string) => ["invoices", "detail", id] as const,
  },
  approvals: {
    all: ["approvals"] as const,
    list: (params?: ListParams) => ["approvals", "list", params] as const,
  },
  payments: {
    all: ["payments"] as const,
    list: (params?: ListParams) => ["payments", "list", params] as const,
    queue: ["payments", "queue"] as const,
    history: ["payments", "history"] as const,
    detail: (id: string) => ["payments", "detail", id] as const,
  },
  masterData: {
    all: ["master-data"] as const,
    list: (params?: ListParams) => ["master-data", "list", params] as const,
  },
  costCentres: {
    all: ["cost-centres"] as const,
    list: () => ["cost-centres", "list"] as const,
  },
  subCostCentres: {
    all: ["sub-cost-centres"] as const,
    list: (costCentreId?: string) =>
      ["sub-cost-centres", "list", costCentreId ?? null] as const,
  },
  bankAccounts: {
    all: ["bank-accounts"] as const,
    list: () => ["bank-accounts", "list"] as const,
  },
  approvalMatrix: {
    all: ["approval-matrix"] as const,
    list: () => ["approval-matrix", "list"] as const,
  },
  departments: {
    all: ["departments"] as const,
    list: (params?: ListParams) => ["departments", "list", params] as const,
    detail: (id: string) => ["departments", "detail", id] as const,
  },
  batches: {
    all: ["batches"] as const,
    list: (params?: ListParams) => ["batches", "list", params] as const,
    detail: (id: string) => ["batches", "detail", id] as const,
  },
  users: {
    all: ["users"] as const,
    list: (params?: unknown) => ["users", "list", params] as const,
    detail: (id: string) => ["users", "detail", id] as const,
  },
  notifications: {
    all: ["notifications"] as const,
    list: () => ["notifications", "list"] as const,
  },
  audit: {
    all: ["audit"] as const,
    list: (params?: {
      entityType?: string;
      entityId?: string;
      action?: string;
    }) => ["audit", "list", params] as const,
  },
  dashboard: {
    all: ["dashboard"] as const,
    list: (params?: ListParams) => ["dashboard", "list", params] as const,
  },
  analytics: {
    all: ["analytics"] as const,
    expenses: (params?: { from?: string; to?: string }) =>
      ["analytics", "expenses", params] as const,
  },
  attachments: {
    all: ["attachments"] as const,
    list: (entityType: string, entityId: string) =>
      ["attachments", "list", entityType, entityId] as const,
  },
  fees: {
    all: ["fees"] as const,
    students: (search?: string) => ["fees", "students", search ?? null] as const,
    student: (id: string) => ["fees", "student", id] as const,
    structures: () => ["fees", "structures"] as const,
    payments: () => ["fees", "payments"] as const,
    refunds: () => ["fees", "refunds"] as const,
    summary: (filters?: { program?: string; cohort?: string; installment?: string }) =>
      ["fees", "summary", filters ?? null] as const,
    reports: (filters?: { program?: string; cohort?: string; installment?: string }) =>
      ["fees", "reports", filters ?? null] as const,
    installmentReport: (filters?: { program?: string; cohort?: string; installment?: string }) =>
      ["fees", "installment-report", filters ?? null] as const,
    accessMe: () => ["fees", "access", "me"] as const,
    access: () => ["fees", "access"] as const,
    changeRequests: (status?: string) => ["fees", "change-requests", status ?? null] as const,
    thread: (studentId: string) => ["fees", "thread", studentId] as const,
    invoices: () => ["fees", "invoices"] as const,
    invoicesReady: () => ["fees", "invoices", "ready"] as const,
    creditNotes: () => ["fees", "credit-notes"] as const,
    invoiceRegister: () => ["fees", "invoice-register"] as const,
    receipts: () => ["fees", "receipts"] as const,
  },
} as const;
