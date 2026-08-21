/**
 * TanStack Query hook for the audit slice. Keyed via `queryKeys.audit.list`.
 * Components consume only this hook — never the service directly.
 */
"use client";

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/api/query-keys";
import { QUERY_DEFAULTS } from "@/lib/constants";
import { auditService } from "../services/audit.service";
import type { AuditListParams } from "../types";

/** The audit trail (ADMIN/FINANCE), optionally filtered by entity / action. */
export function useAudit(params: AuditListParams = {}) {
  return useQuery({
    queryKey: queryKeys.audit.list(params),
    queryFn: () => auditService.listAudit(params),
    staleTime: QUERY_DEFAULTS.staleTime,
  });
}
