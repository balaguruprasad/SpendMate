/**
 * Audit service — talks to the real backend's `GET /api/v1/audit` (ADMIN/FINANCE).
 * The fetch client returns the parsed `{ data, meta }` envelope as-is, so we
 * unwrap `.data`. Optional `entityType` / `entityId` / `action` filters narrow
 * the trail; `limit` defaults high so the client-side table can paginate locally.
 */
import { api } from "@/lib/api/client";
import type { AuditEntryView, AuditListParams } from "../types";

export async function listAudit(
  params: AuditListParams = {},
): Promise<AuditEntryView[]> {
  const search = new URLSearchParams({ limit: "100" });
  if (params.entityType) search.set("entityType", params.entityType);
  if (params.entityId) search.set("entityId", params.entityId);
  if (params.action) search.set("action", params.action);
  const { data } = await api.get<{
    data: AuditEntryView[];
    meta?: { nextCursor?: string };
  }>(`/audit?${search.toString()}`);
  return data;
}

export const auditService = { listAudit };
