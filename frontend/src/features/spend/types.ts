/** SpendMate domain types — mirror the spend module's API shapes. */

export type TxnStatus = "PENDING" | "SUBMITTED" | "NO_INVOICE_NEEDED";

export interface SpendSettings {
  categories: string[];
  tagLabel: string;
  tagOptions: string[];
}

export interface SpendTransaction {
  id: string;
  card: string;
  cardholder: string;
  cardholderId: string | null;
  effectiveDate: string;
  postingDate: string | null;
  amountPaise: number;
  description: string;
  category: string;
  status: TxnStatus;
  remarks: string;
  invoiceName: string;
  invoiceUrl: string;
  tags: string;
  pending: boolean;
  reviewed: boolean;
  /** Card settlement credit (PAYMENT RECEIVED) — shown under Settlements, not in spends. */
  settlement: boolean;
  /** Accounts parked this charge: something is wrong or missing and the
   * cardholder has to answer before it can be signed off. */
  onHold: boolean;
  holdReason: string;
  heldAt: string | null;
  commentCount: number;
  lastCommentAt: string | null;
  updatedAt: string;
}

export type TxnCommentKind = "COMMENT" | "HOLD" | "RELEASE";

/** One line of the conversation on a charge. */
export interface SpendComment {
  id: string;
  transactionId: string;
  authorId: string;
  authorName: string;
  authorEmail: string;
  kind: TxnCommentKind;
  body: string;
  createdAt: string;
}

export interface SpendSummaryEntry {
  total: number;
  count: number;
  pending: number;
}

export interface SpendTransactionsResponse {
  rows: SpendTransaction[];
  summary: Record<string, SpendSummaryEntry>;
}

export interface SpendCard {
  id: string;
  number: string;
  label: string;
  holderId: string;
  remindersOn: boolean;
  holderName: string;
  holderEmail: string;
}

export interface SpendHelper {
  id: string;
  name: string;
  email: string;
}

export interface SpendMe {
  isAdmin: boolean;
  myCards: { id: string; number: string; label: string; remindersOn: boolean }[];
  helperFor: { id: string; name: string }[];
  myHelpers: SpendHelper[];
  settings: SpendSettings;
}

export interface ImportRow {
  cardNumber: string;
  effectiveDate: string;
  postingDate: string;
  amountPaise: number;
  description: string;
}

export const TXN_STATUS_LABEL: Record<TxnStatus, string> = {
  PENDING: "Pending",
  SUBMITTED: "Submitted",
  NO_INVOICE_NEEDED: "No invoice needed",
};

/** ₹ formatting from integer paise (card charges carry decimals). */
export function formatPaise(paise: number): string {
  const rupees = paise / 100;
  return `₹${rupees.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Parse a statement amount ("1,234.56" / "₹1234.5") into integer paise. */
export function parseAmountToPaise(raw: string): number | null {
  const cleaned = raw.replace(/[^0-9.-]/g, "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}
