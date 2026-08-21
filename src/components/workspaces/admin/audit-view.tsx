"use client";

/**
 * Admin — audit log. A full, read-only trail of lifecycle events over the LIVE
 * `db.audit` store (newest-first), rendered by the co-located `AuditLogTable`.
 */
import { PageHeader } from "@/components/layout/page-header";
import { Section } from "@/components/shared/section";
import { AuditLogTable } from "@/components/workspaces/admin/audit-log-table";

export function AdminAuditView() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Administration"
        title="Audit Log"
        description="Every recorded action across vendors, invoices and payments — newest first."
      />

      <Section title="Activity">
        <AuditLogTable />
      </Section>
    </div>
  );
}
