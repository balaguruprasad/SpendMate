/**
 * Public surface of the users feature slice. Other code imports ONLY from
 * here — never from `./services/*` (components reach the API through hooks).
 */
export {
  useUsers,
  useUser,
  useCreateUser,
  useUpdateUser,
  useSetUserActive,
  useResetUserPassword,
  useDeleteUser,
} from "./hooks/use-users";

export { UserTable } from "./components/user-table";
export { UserForm } from "./components/user-form";
export { RoleBadge } from "./components/role-badge";

export {
  userCreateSchema,
  userUpdateSchema,
  type UserCreateValues,
  type UserUpdateValues,
} from "./schemas";
export type {
  UserListParams,
  UserCreateInput,
  UserUpdateInput,
} from "./types";
