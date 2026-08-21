import type {
  ApprovalDecision,
  ApprovalLevel,
  CostCentre,
  CurrencyCode,
  Department,
  InvoiceStatus,
  PaymentMode,
  UserRole,
  VendorStatus,
} from "./enums";

export type UUID = string;
export type ISODateString = string;

export interface Timestamps {
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface User extends Timestamps {
  id: UUID;
  employeeNo: string;
  fullName: string;
  email: string;
  role: UserRole;
  /** Home/org department label (free text from OrgTree, e.g. "MSL", "Finance"). */
  orgDepartment: string;
  /** For APPROVER: the invoice Department(s) they sign off (L2 routing). */
  approverDepartments: Department[];
  isActive: boolean;
}

/**
 * A user account as stored/served by the API (`/api/v1/users`). Distinct from
 * the rich mock `User` above (which carries employeeNo / orgDepartment /
 * approverDepartments for the demo). `departmentId` is null unless the user is
 * scoped to a department (required for APPROVER).
 */
export interface UserAccount {
  id: UUID;
  email: string;
  name: string;
  role: UserRole;
  departmentId: string | null;
  isActive: boolean;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

/** Lightweight signed-in identity used by the demo auth context. */
export interface Viewer {
  id: UUID;
  role: UserRole;
}

export interface VendorGstin {
  id: UUID;
  gstin: string; // 15 chars
  stateCode: string; // first 2 chars
}

export interface Attachment {
  id: UUID;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  gcsKey: string;
}

export interface Vendor extends Timestamps {
  id: UUID;
  name: string;
  legalName: string;
  pan: string;
  gstins: VendorGstin[];
  bankAccountNumber: string;
  ifsc: string;
  costCentre: CostCentre;
  isMsme: boolean;
  status: VendorStatus;
  createdById: UUID;
  decisionNote: string | null;
  attachments: Attachment[];
}

export interface InvoiceApproval {
  id: UUID;
  level: ApprovalLevel;
  decision: ApprovalDecision;
  actorId: UUID;
  /** Display name of the deciding actor, mapped from the backend `actorName`. */
  actorName?: string;
  note: string | null;
  decidedAt: ISODateString;
}

export interface Invoice extends Timestamps {
  id: UUID;
  reference: string; // e.g. FIN-2026-0001
  vendorId: UUID;
  /** Display name of the vendor, mapped from list rows / detail `vendor.name`. */
  vendorName?: string;
  createdById: UUID;
  /** Display name of the user who raised the invoice (list `createdByName` / detail `createdBy.name`). */
  createdByName?: string | null;
  department: Department;
  /** Raw backend id — present on detail/edit responses, absent on list rows. */
  departmentId?: string;
  batch: string;
  /** Raw backend id — present on detail/edit responses, absent on list rows. */
  batchId?: string;
  costCentre: CostCentre;
  subCostCentre: string;
  /** Raw backend id — present on detail/edit responses, absent on list rows. */
  subCostCentreId?: string;
  gstin: string | null; // selected vendor GSTIN
  invoiceNumber: string;
  invoiceDate: ISODateString;
  taxableValue: number;
  cgstRate: number;
  cgstAmount: number;
  sgstRate: number;
  sgstAmount: number;
  igstRate: number;
  igstAmount: number;
  totalPayable: number;
  tdsRate: number | null;
  tdsAmount: number | null;
  poReference: string | null;
  remarks: string | null;
  status: InvoiceStatus;
  currency: CurrencyCode;
  approvals: InvoiceApproval[];
  attachments: Attachment[];
  /** The recorded payment when PAID, mapped from the detail `payment` (else null). */
  payment?: Payment | null;
  /** Assigned L1 (Accounts) approver name, from the detail's approval_matrix lookup. */
  l1ApproverName?: string | null;
  /** Assigned L2 (Department) approver name, from the detail's approval_matrix lookup. */
  l2ApproverName?: string | null;
  /** L3 (Finance) approver names — the active Finance team (a list, not a single assignee). */
  l3ApproverNames?: string[] | null;
}

export interface Payment extends Timestamps {
  id: UUID;
  invoiceId: UUID;
  utrNumber: string;
  paymentDate: ISODateString;
  amount: number;
  mode: PaymentMode;
  bankAccountId: UUID;
  remarks: string | null;
  recordedById: UUID;
  attachments: Attachment[];
}

export interface BankAccount {
  id: UUID;
  label: string; // "HDFC ••3421 — Operations"
  isActive: boolean;
}

/**
 * A department master-data ENTITY as stored/served by the API. Distinct from the
 * `Department` enum in `./enums` (which is a CODE union used for invoice routing).
 */
export interface DepartmentRecord {
  id: UUID;
  code: string;
  name: string;
  isActive: boolean;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

/**
 * A cohort batch master-data ENTITY as stored/served by the API
 * (`/api/v1/batches`). Note the human label column is `label`, not `name`.
 */
export interface BatchRecord {
  id: UUID;
  code: string;
  label: string;
  isActive: boolean;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface SubCostCentre {
  id: UUID;
  costCentre: CostCentre;
  name: string;
  poRequired: boolean;
}

/**
 * An approval-matrix rule as served by the API (`/api/v1/approval-matrix`):
 * who signs off L1/L2 for a (department × sub-cost-centre) pair. Keyed entirely
 * on ids — names are resolved client-side via the departments / sub-cost-centre
 * / users lists.
 */
export interface ApprovalMatrixRule {
  id: UUID;
  departmentId: UUID;
  subCostCentreId: UUID;
  l1UserId: UUID;
  l2UserId: UUID;
  isActive: boolean;
}

