"use client";

/**
 * Admin — users (real API, ADMIN-only). Lists every user with role / department
 * / status and per-row Edit + Deactivate/Activate actions. "Add user" opens a
 * create Sheet; Edit opens an edit Sheet; Deactivate is guarded by a
 * ConfirmDialog, while reactivation is inline. All data + mutations come from
 * the users slice.
 */
import { useMemo, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Search, UserPlus, Users as UsersIcon, Download, Upload } from "lucide-react";
import { USER_ROLES, type UserAccount, type UserRole } from "@/types";
import { useAuth } from "@/hooks/use-auth";
import { ROLE_BASE, QUERY_DEFAULTS } from "@/lib/constants";
import { toast } from "@/lib/toast";
import { ApiError } from "@/lib/api/http-error";
import { api, getAccessToken } from "@/lib/api/client";
import { env } from "@/lib/config/env";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/api/query-keys";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PageHeader } from "@/components/layout/page-header";
import { Section } from "@/components/shared/section";
import { EmptyState } from "@/components/shared/empty-state";
import { TableSkeleton } from "@/components/shared/loading";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { ROLE_LABEL } from "@/lib/config/navigation";
import {
  UserTable,
  UserForm,
  useUsers,
  useDeleteUser,
  useResetUserPassword,
} from "@/features/users";
import { ResetPasswordDialog } from "./reset-password-dialog";

function parseCsvPreview(text: string): { headers: string[]; rows: string[][] } {
  const lines: string[][] = [];
  let line: string[] = [];
  let entry = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        entry += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      line.push(entry.trim());
      entry = "";
    } else if ((char === "\r" || char === "\n") && !inQuotes) {
      if (char === "\r" && nextChar === "\n") {
        i++;
      }
      line.push(entry.trim());
      if (line.length > 1 || line[0] !== "") {
        lines.push(line);
      }
      line = [];
      entry = "";
    } else {
      entry += char;
    }
  }

  if (entry || line.length > 0) {
    line.push(entry.trim());
    lines.push(line);
  }

  const headers = lines[0] ?? [];
  const dataRows = lines
    .slice(1)
    .filter(
      (r) =>
        r.length > 0 &&
        !r[0]?.startsWith("#") &&
        r.some((val) => val !== ""),
    )
    .slice(0, 5);

  return { headers, rows: dataRows };
}

/** Sentinel value for the "all" option in each filter Select. */
const ALL = "__all__";
type StatusFilter = "all" | "active" | "inactive";

export function AdminUsersView() {
  const router = useRouter();
  const { user: admin, impersonate } = useAuth();

  // Filters: role / department / status are server-driven (passed to useUsers);
  // search + the "inactive" case are applied client-side over the fetched rows.
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<UserRole | typeof ALL>(ALL);
  // Deactivated users stay hidden unless explicitly asked for.
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");

  const usersQuery = useUsers({
    role: roleFilter === ALL ? undefined : roleFilter,
    // The backend only supports `activeOnly`; "inactive" is handled below.
    activeOnly: statusFilter === "active" ? true : undefined,
  });

  const allUsers = useMemo(() => usersQuery.data ?? [], [usersQuery.data]);

  const users = useMemo(() => {
    const term = search.trim().toLowerCase();
    return allUsers.filter((u) => {
      if (statusFilter === "inactive" && u.isActive) return false;
      if (
        term &&
        !u.name.toLowerCase().includes(term) &&
        !u.email.toLowerCase().includes(term)
      ) {
        return false;
      }
      return true;
    });
  }, [allUsers, search, statusFilter]);

  const hasActiveFilters =
    search.trim() !== "" ||
    roleFilter !== ALL ||
    statusFilter !== "active";

  const deleteUser = useDeleteUser();
  const resetPassword = useResetUserPassword();

  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<UserAccount | null>(null);
  const [resetting, setResetting] = useState<UserAccount | null>(null);
  const [deleting, setDeleting] = useState<UserAccount | null>(null);
  const [impersonatingId, setImpersonatingId] = useState<string | null>(null);

  const handleImpersonate = async (target: UserAccount) => {
    setImpersonatingId(target.id);
    try {
      const next = await impersonate(target.id);
      toast.success(`Now viewing as ${next.fullName}`);
      router.push(`${ROLE_BASE[next.role]}/charges`);
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : "Could not start impersonation.";
      toast.error(message);
      setImpersonatingId(null);
    }
  };

  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewHeaders, setPreviewHeaders] = useState<string[]>([]);
  const [previewRows, setPreviewRows] = useState<string[][]>([]);
  const [csvContent, setCsvContent] = useState("");

  interface BulkResult {
    processed: number;
    created: number;
    skipped: number;
    errors: { row: number; email?: string; error: string }[];
  }
  const [uploadResult, setUploadResult] = useState<BulkResult | null>(null);

  const handleExportUsers = async () => {
    try {
      const token = getAccessToken();
      const headers: Record<string, string> = {};
      if (token) headers.Authorization = `Bearer ${token}`;
      
      const res = await fetch(`${env.NEXT_PUBLIC_API_BASE_URL}/users/export/csv`, {
        credentials: "include",
        headers,
      });
      if (!res.ok) throw await ApiError.fromResponse(res);
      const csvText = await res.text();
      
      const blob = new Blob([csvText], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `users_export_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("Users exported successfully!");
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Could not export users.";
      toast.error(message);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const token = getAccessToken();
      const headers: Record<string, string> = {};
      if (token) headers.Authorization = `Bearer ${token}`;
      
      const res = await fetch(`${env.NEXT_PUBLIC_API_BASE_URL}/users/export/template`, {
        credentials: "include",
        headers,
      });
      if (!res.ok) throw await ApiError.fromResponse(res);
      const csvText = await res.text();
      
      const blob = new Blob([csvText], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "users_bulk_upload_template.csv");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("Sample template downloaded!");
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Could not download template.";
      toast.error(message);
    }
  };

  const handleOpenUploadModal = () => {
    setUploadModalOpen(true);
    setSelectedFile(null);
    setPreviewRows([]);
    setPreviewHeaders([]);
    setCsvContent("");
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    try {
      const text = await file.text();
      setCsvContent(text);
      const { headers, rows } = parseCsvPreview(text);
      setPreviewHeaders(headers);
      setPreviewRows(rows);
    } catch (err) {
      toast.error("Could not parse the CSV file.");
      setSelectedFile(null);
    }
  };

  const handleConfirmUpload = async () => {
    if (!csvContent) return;

    setUploading(true);
    setUploadResult(null);

    try {
      const res = await api.post<BulkResult>("/users/bulk-upload", { csvText: csvContent });
      
      setUploadResult(res);
      setUploadModalOpen(false); // Close the preview modal
      
      void queryClient.invalidateQueries({ queryKey: queryKeys.users.all });

      const errorsCount = res.errors?.length ?? 0;
      if (errorsCount === 0) {
        toast.success(`Successfully uploaded ${res.created} users!`);
      } else if (res.created > 0) {
        toast.success(`Uploaded ${res.created} users with ${errorsCount} errors.`);
      } else {
        toast.error(`Failed to upload: ${errorsCount} errors encountered.`);
      }
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Could not upload CSV file.";
      toast.error(message);
    } finally {
      setUploading(false);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const addUser = (
    <Button size="sm" onClick={() => setCreateOpen(true)}>
      <UserPlus className="size-4" />
      Add user
    </Button>
  );

  const headerActions = (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="outline" size="sm" onClick={handleDownloadTemplate} title="Download the sample CSV template">
        <Download className="size-4" />
        Sample CSV
      </Button>
      <Button variant="outline" size="sm" onClick={handleExportUsers} title="Export all users as CSV">
        <Download className="size-4" />
        Export CSV
      </Button>
      <Button variant="outline" size="sm" onClick={handleOpenUploadModal} title="Bulk upload users from a CSV file">
        <Upload className="size-4" />
        Bulk Upload
      </Button>
      {addUser}
    </div>
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Administration"
        title="Users"
        description="Manage SpendMate access — roles and activation."
        actions={headerActions}
      />

      <Section title="All users">
        <div className="flex flex-col gap-3 @2xl/main:flex-row @2xl/main:flex-wrap @2xl/main:items-center">
          <div className="relative w-full @2xl/main:max-w-xs">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or email"
              className="pl-8"
              aria-label="Search users"
            />
          </div>

          <Select
            value={roleFilter}
            onValueChange={(value) =>
              setRoleFilter(value as UserRole | typeof ALL)
            }
          >
            <SelectTrigger className="w-full @2xl/main:w-44" aria-label="Filter by role">
              <SelectValue placeholder="All roles" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All roles</SelectItem>
              {USER_ROLES.map((role) => (
                <SelectItem key={role} value={role}>
                  {ROLE_LABEL[role]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>


          <Select
            value={statusFilter}
            onValueChange={(value) => setStatusFilter(value as StatusFilter)}
          >
            <SelectTrigger
              className="w-full @2xl/main:w-36"
              aria-label="Filter by status"
            >
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {usersQuery.isLoading ? (
          <TableSkeleton rows={6} />
        ) : users.length === 0 && hasActiveFilters ? (
          <EmptyState
            icon={UsersIcon}
            title="No users match"
            description="No users match the current filters. Try clearing the search or a filter."
          />
        ) : (
          <UserTable
            users={users}
            pending={
              deleteUser.isPending ||
              resetPassword.isPending ||
              impersonatingId !== null
            }
            emptyAction={addUser}
            currentUserId={admin.id}
            onEdit={(user) => setEditing(user)}
            onResetPassword={(user) => setResetting(user)}
            onDelete={(user) => setDeleting(user)}
            onImpersonate={handleImpersonate}
          />
        )}
      </Section>

      {/* Create */}
      <Sheet open={createOpen} onOpenChange={setCreateOpen}>
        <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Add user</SheetTitle>
            <SheetDescription>
              Create a portal user, assign their level/role and department, and
              set an initial password.
            </SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-6">
            <UserForm onDone={() => setCreateOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>

      {/* Edit */}
      <Sheet
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
      >
        <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Edit user</SheetTitle>
            <SheetDescription>
              Update the user&apos;s name, role, department, and activation.
            </SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-6">
            {editing ? (
              <UserForm
                mode="edit"
                user={editing}
                onDone={() => setEditing(null)}
              />
            ) : null}
          </div>
        </SheetContent>
      </Sheet>

      {/* Reset password */}
      <ResetPasswordDialog
        user={resetting}
        onOpenChange={(open) => {
          if (!open) setResetting(null);
        }}
        pending={resetPassword.isPending}
        onSubmit={async (newPassword) => {
          if (!resetting) return;
          await resetPassword.mutateAsync({
            id: resetting.id,
            name: resetting.name,
            newPassword,
          });
          setResetting(null);
        }}
      />

      {/* Delete confirmation */}
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        title="Delete user?"
        description={
          deleting
            ? `${deleting.name} will be permanently removed. Users with invoice or approval history can't be deleted — deactivate them via Edit instead.`
            : undefined
        }
        confirmLabel="Delete"
        destructive
        onConfirm={() => {
          if (deleting) {
            deleteUser.mutate(deleting.id);
            setDeleting(null);
          }
        }}
      />

      {/* Bulk upload results report */}
      <Dialog
        open={uploadResult !== null}
        onOpenChange={(open) => {
          if (!open) setUploadResult(null);
        }}
      >
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Bulk Upload Report</DialogTitle>
            <DialogDescription>
              Summary of the user import process.
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex flex-col gap-4 py-2">
            <div className="grid grid-cols-3 gap-4 rounded-lg border border-border p-4 bg-muted/30 text-center">
              <div>
                <div className="text-2xl font-bold font-mono text-foreground">{uploadResult?.processed}</div>
                <div className="text-xs text-muted-foreground mt-0.5">Rows Processed</div>
              </div>
              <div>
                <div className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-500">{uploadResult?.created}</div>
                <div className="text-xs text-muted-foreground mt-0.5">Created Successfully</div>
              </div>
              <div>
                <div className="text-2xl font-bold font-mono text-red-600 dark:text-red-500">{uploadResult?.errors?.length ?? 0}</div>
                <div className="text-xs text-muted-foreground mt-0.5">Errors Encountered</div>
              </div>
            </div>

            {uploadResult && (uploadResult.errors?.length ?? 0) > 0 && (
              <div className="flex flex-col gap-2">
                <div className="text-sm font-semibold text-foreground">Error Details:</div>
                <div className="max-h-60 overflow-y-auto rounded-lg border border-border bg-background divide-y divide-border">
                  {uploadResult.errors?.map((err, idx) => (
                    <div key={idx} className="flex items-start gap-4 p-3 text-sm">
                      <div className="font-mono text-xs font-semibold bg-red-100 dark:bg-red-950/50 text-red-700 dark:text-red-400 px-1.5 py-0.5 rounded">
                        Row {err.row}
                      </div>
                      <div className="flex-1 min-w-0">
                        {err.email && (
                          <div className="font-mono text-xs text-muted-foreground truncate mb-0.5">
                            {err.email}
                          </div>
                        )}
                        <div className="text-foreground font-medium text-xs sm:text-sm">{err.error}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          
          <div className="flex justify-end pt-2">
            <Button onClick={() => setUploadResult(null)}>Close</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk upload & preview modal */}
      <Dialog
        open={uploadModalOpen}
        onOpenChange={setUploadModalOpen}
      >
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>Bulk Upload Users</DialogTitle>
            <DialogDescription>
              Select a CSV file to preview and upload users in bulk.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-2 min-w-0">
            {!selectedFile ? (
              <div 
                className="flex flex-col items-center justify-center border-2 border-dashed border-border rounded-lg p-8 hover:bg-muted/30 transition cursor-pointer"
                onClick={triggerFileInput}
              >
                <Upload className="size-8 text-muted-foreground mb-2" />
                <span className="text-sm font-medium text-foreground">Click to select CSV file</span>
                <span className="text-xs text-muted-foreground mt-1">Accepts standard .csv files with Name, Email, Role headers</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={handleFileSelect}
                />
              </div>
            ) : (
              <div className="flex flex-col gap-4 min-w-0">
                <div className="flex items-center justify-between rounded-lg border border-border p-3 bg-muted/20">
                  <div className="flex items-center gap-2">
                    <UsersIcon className="size-5 text-indigo-600 dark:text-indigo-400" />
                    <div>
                      <div className="text-sm font-semibold text-foreground truncate max-w-75">{selectedFile.name}</div>
                      <div className="text-xs text-muted-foreground">{(selectedFile.size / 1024).toFixed(1)} KB</div>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setSelectedFile(null)}>Change File</Button>
                </div>

                {previewRows.length > 0 && (
                  <div className="flex flex-col gap-2 min-w-0">
                    <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider">File Preview (Top 5 rows)</div>
                    <div className="w-full min-w-0 overflow-x-auto rounded-lg border border-border">
                      <table className="w-full border-collapse text-left text-xs">
                        <thead>
                          <tr className="border-b border-border bg-muted/50">
                            {previewHeaders.map((h, i) => (
                              <th key={i} className="whitespace-nowrap px-3 py-2 font-semibold uppercase tracking-wider text-muted-foreground">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {previewRows.map((row, rIdx) => (
                            <tr key={rIdx} className="transition-colors hover:bg-muted/30">
                              {row.map((val, cIdx) => (
                                <td
                                  key={cIdx}
                                  title={val}
                                  className="max-w-32 truncate px-3 py-2 align-middle text-foreground"
                                >
                                  {val.trim() ? val : <span className="text-muted-foreground/60">—</span>}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <Button variant="outline" onClick={() => setUploadModalOpen(false)}>Cancel</Button>
            <Button 
              disabled={!selectedFile || uploading} 
              loading={uploading} 
              onClick={handleConfirmUpload}
            >
              Confirm Import
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
