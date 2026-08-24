import type { InvoiceStatus, VendorStatus } from "@/types";

export const INVOICE_STATUS_LABEL: Record<InvoiceStatus, string> = {
  DRAFT: "Draft", SUBMITTED: "Submitted", L1_APPROVED: "L1 Approved",
  L2_APPROVED: "L2 Approved", FULLY_APPROVED: "Fully Approved", PAID: "Paid",
  REJECTED: "Rejected", ON_HOLD: "On Hold",
};
export const INVOICE_STATUS_TONE: Record<InvoiceStatus, "muted"|"info"|"warning"|"success"|"destructive"> = {
  DRAFT: "muted", SUBMITTED: "info", L1_APPROVED: "info", L2_APPROVED: "info",
  FULLY_APPROVED: "success", PAID: "success", REJECTED: "destructive", ON_HOLD: "warning",
};
export const VENDOR_STATUS_LABEL: Record<VendorStatus, string> = {
  DRAFT: "Draft", SUBMITTED: "Pending Approval", APPROVED: "Approved", REJECTED: "Rejected",
};
/** Next status after an approval at a given level. */
export function advanceInvoice(status: InvoiceStatus): InvoiceStatus {
  if (status === "SUBMITTED") return "L1_APPROVED";
  if (status === "L1_APPROVED") return "L2_APPROVED";
  if (status === "L2_APPROVED") return "FULLY_APPROVED";
  return status;
}
