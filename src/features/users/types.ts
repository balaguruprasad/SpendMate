/**
 * Feature-local DTOs for the users slice. The `UserAccount` model (the API
 * shape) lives in `@/types`; these describe the shapes that cross the service
 * boundary (list filters, create/update payloads).
 */
import type { UserRole } from "@/types";

/** Query parameters for the users list endpoint (`/api/v1/users`). */
export interface UserListParams {
  /** Filter to a single role when present. */
  role?: UserRole;
  /** Filter to a single department when present. */
  departmentId?: string;
  /** When true, only active users are returned. */
  activeOnly?: boolean;
}

/** Payload accepted by `usersService.create` — includes the initial password. */
export interface UserCreateInput {
  name: string;
  email: string;
  role: UserRole;
  /** Required when role is APPROVER; optional otherwise. */
  departmentId?: string;
  /** Admin-set initial password (min 8). Argon2-hashed server-side. */
  password: string;
}

/** Payload accepted by `usersService.update` — never email or password. */
export interface UserUpdateInput {
  name?: string;
  role?: UserRole;
  departmentId?: string | null;
  isActive?: boolean;
}
