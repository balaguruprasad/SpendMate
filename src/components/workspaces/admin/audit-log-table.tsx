"use client";

/**
 * Admin audit log — renders the LIVE audit trail from `GET /api/v1/audit` via
 * `useAudit()`, newest-first (the backend already orders by createdAt desc).
 * Columns: entity type/id, humanized action, actor name, relative time.
 * Secondary columns collapse on narrow containers via container queries.
 * Loading skeleton + EmptyState. Pass `limit` for the dashboard's compact view
 * (no pagination); otherwise the full table paginates client-side.
 */
import { ScrollText } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { TableSkeleton } from "@/components/shared/loading";
import { TablePagination } from "@/components/shared/table-pagination";
import { usePagedRows } from "@/hooks/use-paged-rows";
import { formatRelative } from "@/lib/format";
import { useAudit, humanizeAuditAction, humanizeEntityType } from "@/features/audit";

interface AuditLogTableProps {
  /** When set, render only the latest N rows without pagination (dashboard). */
  limit?: number;
}

export function AuditLogTable({ limit }: AuditLogTableProps) {
  const auditQuery = useAudit();
  const rows = auditQuery.data ?? [];

  const { page, setPage, pageCount, pageRows, startIndex } = usePagedRows(
    rows,
    10,
  );

  if (auditQuery.isLoading) return <TableSkeleton rows={6} />;

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={ScrollText}
        title="No audit activity"
        description="Lifecycle events across vendors, invoices and payments will appear here."
      />
    );
  }

  const compact = typeof limit === "number";
  const display = compact ? rows.slice(0, limit) : pageRows;
  const offset = compact ? 0 : startIndex;

  return (
    <div className="flex flex-col gap-4">
      <Card className="overflow-hidden p-0">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-12">#</TableHead>
              <TableHead>Entity</TableHead>
              <TableHead>Action</TableHead>
              <TableHead className="hidden @xl/main:table-cell">Actor</TableHead>
              <TableHead className="text-right">When</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {display.map((entry, i) => (
              <TableRow key={entry.id}>
                <TableCell className="text-muted-foreground tabular-nums">
                  {offset + i + 1}
                </TableCell>
                <TableCell className="font-medium">
                  <span>{humanizeEntityType(entry.entityType)}</span>
                  <span className="ml-1.5 font-mono text-xs text-muted-foreground">
                    {entry.entityId.slice(0, 8)}
                  </span>
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">
                    {humanizeAuditAction(entry.action)}
                  </Badge>
                </TableCell>
                <TableCell className="hidden @xl/main:table-cell">
                  {entry.actorName}
                </TableCell>
                <TableCell className="text-right text-muted-foreground">
                  {formatRelative(entry.createdAt)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
      {!compact && (
        <TablePagination
          page={page}
          pageCount={pageCount}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}
