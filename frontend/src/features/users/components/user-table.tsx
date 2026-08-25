"use client";

/**
 * User list as a plain `ui/table` (no @tanstack/react-table). Resolves each
 * user's `departmentId` to a department name via a `useDepartments()` id→name
 * map (shows "—" when null/unknown). Secondary columns collapse on narrow
 * containers via container queries. Each row exposes Edit + Deactivate/Activate
 * actions. Sr. No. + `TablePagination` (10/page) via `usePagedRows`.
 */
import { useMemo } from "react";
import {
  Eye,
  KeyRound,
  MoreHorizontal,
  Pencil,
  Trash2,
  Users,
} from "lucide-react";
import type { UserAccount } from "@/types";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { TablePagination } from "@/components/shared/table-pagination";
import { StatusBadge } from "@/components/shared/status-badge";
import { usePagedRows } from "@/hooks/use-paged-rows";
import { RoleBadge } from "./role-badge";

interface UserTableProps {
  users: UserAccount[];
  /** Open the edit sheet for a user. */
  onEdit?: (user: UserAccount) => void;
  /** Reset a user's password (ADMIN). When provided, a per-row action is shown. */
  onResetPassword?: (user: UserAccount) => void;
  /** Permanently delete a user (confirmed by the caller). */
  onDelete?: (user: UserAccount) => void;
  /**
   * "View as" / impersonate a user (ADMIN). When provided, a per-row action is
   * shown — except for the current admin's own row (`currentUserId`).
   */
  onImpersonate?: (user: UserAccount) => void;
  /** The signed-in user's id — used to hide "View as" on their own row. */
  currentUserId?: string;
  /** Optional empty-state action (e.g. an "Add user" button). */
  emptyAction?: React.ReactNode;
  /** Disable action buttons while a mutation is in flight. */
  pending?: boolean;
  /** User ids that hold a card — members outside this set show as "Helper". */
  cardHolderIds?: Set<string>;
}

export function UserTable({
  users,
  onEdit,
  onResetPassword,
  onDelete,
  onImpersonate,
  currentUserId,
  emptyAction,
  pending = false,
  cardHolderIds,
}: UserTableProps) {
  const { page, setPage, pageCount, pageRows, startIndex } = usePagedRows(
    users,
    10,
  );

  if (users.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="No users yet"
        description="Users you add will appear here."
        action={emptyAction}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="overflow-hidden p-0">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-12">#</TableHead>
              <TableHead>Name</TableHead>
              <TableHead className="hidden @2xl/main:table-cell">Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageRows.map((user, i) => (
              <TableRow key={user.id}>
                <TableCell className="text-muted-foreground tabular-nums">
                  {startIndex + i + 1}
                </TableCell>
                <TableCell className="font-medium">{user.name}</TableCell>
                <TableCell className="hidden text-muted-foreground @2xl/main:table-cell">
                  {user.email}
                </TableCell>
                <TableCell>
                  <RoleBadge
                    role={user.role}
                    label={
                      user.role === "MEMBER" && cardHolderIds && !cardHolderIds.has(user.id)
                        ? "Helper"
                        : undefined
                    }
                  />
                </TableCell>
                <TableCell>
                  <StatusBadge
                    label={user.isActive ? "Active" : "Inactive"}
                    tone={user.isActive ? "success" : "muted"}
                  />
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Actions"
                        >
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {onImpersonate && user.id !== currentUserId ? (
                          <DropdownMenuItem
                            disabled={pending}
                            onSelect={() => onImpersonate(user)}
                          >
                            <Eye className="size-4" />
                            View as
                          </DropdownMenuItem>
                        ) : null}
                        {onEdit ? (
                          <DropdownMenuItem
                            disabled={pending}
                            onSelect={() => onEdit(user)}
                          >
                            <Pencil className="size-4" />
                            Edit
                          </DropdownMenuItem>
                        ) : null}
                        {onResetPassword ? (
                          <DropdownMenuItem
                            disabled={pending}
                            onSelect={() => onResetPassword(user)}
                          >
                            <KeyRound className="size-4" />
                            Reset password
                          </DropdownMenuItem>
                        ) : null}
                        {onDelete ? (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              variant="destructive"
                              disabled={pending}
                              onSelect={() => onDelete(user)}
                            >
                              <Trash2 className="size-4" />
                              Delete
                            </DropdownMenuItem>
                          </>
                        ) : null}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
      <TablePagination
        page={page}
        pageCount={pageCount}
        onPageChange={setPage}
      />
    </div>
  );
}
