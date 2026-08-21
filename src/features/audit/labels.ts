/**
 * Display helpers for audit entries. The backend `action` is an open string
 * (e.g. INVOICE_SUBMITTED, L1_APPROVED, UPDATED, DEACTIVATED), so we humanize
 * generically: known actions get a curated label, the rest fall back to
 * title-casing the underscored token.
 */

const ACTION_LABEL: Record<string, string> = {
  VENDOR_SUBMITTED: "Vendor submitted",
  VENDOR_APPROVED: "Vendor approved",
  VENDOR_REJECTED: "Vendor rejected",
  INVOICE_SUBMITTED: "Invoice submitted",
  L1_APPROVED: "L1 approved",
  L2_APPROVED: "L2 approved",
  L3_APPROVED: "L3 approved",
  APPROVE: "Approved",
  REJECT: "Rejected",
  REJECTED: "Rejected",
  HOLD: "Put on hold",
  ON_HOLD: "On hold",
  SUBMIT: "Submitted",
  RESUBMIT: "Resubmitted",
  RESUBMITTED: "Resubmitted",
  PAID: "Paid",
  EDITED: "Edited",
  UPDATED: "Updated",
  CREATED: "Created",
  DELETED: "Deleted",
  DEACTIVATED: "Deactivated",
  UNLOCKED: "Unlocked",
  IMPERSONATED: "Impersonated",
};

/** Title-case an UPPER_SNAKE token: "L1_APPROVED" → "L1 approved". */
function titleCase(token: string): string {
  const words = token.toLowerCase().replace(/_/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** A readable label for an audit action. */
export function humanizeAuditAction(action: string): string {
  return ACTION_LABEL[action] ?? titleCase(action);
}

/** A readable label for an entity type ("APPROVAL_MATRIX" → "Approval matrix"). */
export function humanizeEntityType(entityType: string): string {
  return titleCase(entityType);
}
