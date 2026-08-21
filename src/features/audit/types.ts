/**
 * Feature-local DTOs for the audit slice. The backend serves a `{ data, meta }`
 * envelope; the fetch client returns the parsed body, so the service unwraps it.
 */

/** An audit entry as served by `GET /api/v1/audit`. */
export interface AuditEntryView {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  actorId: string | null;
  /** Display name of the actor ("System" when there is no actor). */
  actorName: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

/** Optional filters for the audit list. */
export interface AuditListParams {
  entityType?: string;
  entityId?: string;
  action?: string;
}
