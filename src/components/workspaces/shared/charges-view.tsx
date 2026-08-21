"use client";

/**
 * Charges — the single working screen of SpendMate, shared by cardholders
 * (their own + helped charges) and the admin (everyone's, plus the summary
 * strip and reminders). Each charge is completed by uploading its invoice OR
 * picking a category (no-invoice charges like bank fees), and — when the
 * configurable Tag dropdown (e.g. Department) has options — selecting a tag.
 */
import { useMemo, useState } from "react";
import { BellRing, Paperclip, Pencil, UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { TableSkeleton } from "@/components/shared/loading";
import { StatusBadge } from "@/components/shared/status-badge";
import { TablePagination } from "@/components/shared/table-pagination";
import { FileUpload } from "@/components/shared/file-upload";
import { usePagedRows } from "@/hooks/use-paged-rows";
import type { UploadedFile } from "@/features/attachments";
import {
  formatPaise,
  TXN_STATUS_LABEL,
  useAddHelper,
  useAttachInvoice,
  useRemoveHelper,
  useReminderInfo,
  useSendReminders,
  useSpendMe,
  useSpendTransactions,
  useUpdateTransaction,
  type SpendTransaction,
} from "@/features/spend";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

export function ChargesView({ isAdmin }: { isAdmin: boolean }) {
  const { data: me } = useSpendMe();
  const { data, isLoading } = useSpendTransactions();
  const update = useUpdateTransaction();
  const attach = useAttachInvoice();
  const sendReminders = useSendReminders();
  const { data: reminders } = useReminderInfo();
  const addHelper = useAddHelper();
  const removeHelper = useRemoveHelper();

  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "done">("pending");
  const [personFilter, setPersonFilter] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<SpendTransaction | null>(null);
  const [editCategory, setEditCategory] = useState("");
  const [editTags, setEditTags] = useState<string[]>([]);
  const [editRemarks, setEditRemarks] = useState("");
  const [uploadFiles, setUploadFiles] = useState<UploadedFile[]>([]);
  const [helpersOpen, setHelpersOpen] = useState(false);
  const [helperEmail, setHelperEmail] = useState("");

  const settings = me?.settings;
  const tagLabel = settings?.tagLabel ?? "Tag";
  const tagOptions = settings?.tagOptions ?? [];
  const categories = settings?.categories ?? [];

  const people = useMemo(
    () => Object.keys(data?.summary ?? {}).sort((a, b) => a.localeCompare(b)),
    [data?.summary],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (data?.rows ?? []).filter((r) => {
      if (statusFilter === "pending" && !r.pending) return false;
      if (statusFilter === "done" && r.pending) return false;
      if (personFilter !== "all" && r.cardholder !== personFilter) return false;
      if (!q) return true;
      return (
        r.description.toLowerCase().includes(q) ||
        r.cardholder.toLowerCase().includes(q) ||
        r.category.toLowerCase().includes(q)
      );
    });
  }, [data?.rows, statusFilter, personFilter, query]);

  const { page, setPage, pageCount, pageRows } = usePagedRows(filtered, 15);

  function openEdit(r: SpendTransaction) {
    setEditing(r);
    setEditCategory(r.category);
    setEditTags(r.tags ? r.tags.split(",").map((s) => s.trim()).filter(Boolean) : []);
    setEditRemarks(r.remarks);
    setUploadFiles([]);
  }

  async function saveEdit() {
    if (!editing) return;
    if (uploadFiles.length > 0) {
      await attach.mutateAsync({ id: editing.id, file: uploadFiles[0]! });
    }
    await update.mutateAsync({
      id: editing.id,
      patch: {
        category: editCategory,
        tags: editTags.join(", "),
        remarks: editRemarks.trim(),
      },
    });
    setEditing(null);
  }

  const pendingTotal = (data?.rows ?? []).filter((r) => r.pending).length;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="SpendMate"
        title="Charges"
        description={
          isAdmin
            ? "Every company-card charge. Import statements, chase pending invoices, and keep the books clean."
            : "Your company-card charges. Upload each invoice (or pick a category when none exists) and set the " +
              tagLabel.toLowerCase() +
              "."
        }
        actions={
          <>
            {!isAdmin && (me?.myCards.length ?? 0) > 0 && (
              <Button variant="outline" onClick={() => setHelpersOpen(true)}>
                <UserPlus className="size-4" /> My helpers
              </Button>
            )}
            {isAdmin && (
              <Button
                loading={sendReminders.isPending}
                onClick={() => sendReminders.mutate([])}
                title={
                  reminders?.lastRun
                    ? `Last sent ${reminders.lastRun.at.slice(0, 16).replace("T", " ")} to ${reminders.lastRun.sent}`
                    : "Notify everyone with pending charges"
                }
              >
                <BellRing className="size-4" /> Send reminders
              </Button>
            )}
          </>
        }
      />

      {isAdmin && people.length > 0 && (
        <div className="grid grid-cols-2 gap-3 @2xl/main:grid-cols-4">
          {people.map((name) => {
            const s = data!.summary[name]!;
            return (
              <Card key={name} className="flex flex-col gap-0.5 px-4 py-3">
                <p className="truncate text-sm font-medium">{name}</p>
                <p className="text-xs text-muted-foreground">
                  {s.count} charge{s.count === 1 ? "" : "s"} · {formatPaise(s.total)}
                </p>
                {s.pending > 0 ? (
                  <p className="text-xs font-medium text-destructive">{s.pending} pending</p>
                ) : (
                  <p className="text-xs text-success">All complete</p>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Search description, person, category…"
          className="w-full @2xl/main:w-72"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(1);
          }}
        />
        <Select
          value={statusFilter}
          onValueChange={(v) => {
            setStatusFilter(v as typeof statusFilter);
            setPage(1);
          }}
        >
          <SelectTrigger size="sm" className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pending">Pending ({pendingTotal})</SelectItem>
            <SelectItem value="done">Completed</SelectItem>
            <SelectItem value="all">All charges</SelectItem>
          </SelectContent>
        </Select>
        {people.length > 1 && (
          <Select
            value={personFilter}
            onValueChange={(v) => {
              setPersonFilter(v);
              setPage(1);
            }}
          >
            <SelectTrigger size="sm" className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Everyone</SelectItem>
              {people.map((p) => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {isLoading ? (
        <TableSkeleton rows={8} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Paperclip}
          title={statusFilter === "pending" ? "Nothing pending" : "No charges"}
          description={
            statusFilter === "pending"
              ? "Every charge here is complete — invoices in, categories and tags set."
              : "Charges appear when the admin imports the card statement."
          }
        />
      ) : (
        <>
          <Card className="overflow-x-auto p-0">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  {isAdmin && <TableHead>Cardholder</TableHead>}
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Category</TableHead>
                  {tagOptions.length > 0 && <TableHead>{tagLabel}</TableHead>}
                  <TableHead>Status</TableHead>
                  <TableHead className="w-24 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageRows.map((r) => (
                  <TableRow key={r.id} className={r.pending ? "" : "opacity-80"}>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {r.effectiveDate}
                    </TableCell>
                    <TableCell>
                      <span className="block max-w-64 truncate font-medium" title={r.description}>
                        {r.description}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {r.card}
                        {r.remarks && <span title={r.remarks}> · “{r.remarks.slice(0, 40)}”</span>}
                      </span>
                    </TableCell>
                    {isAdmin && <TableCell>{r.cardholder}</TableCell>}
                    <TableCell className="whitespace-nowrap text-right tabular-nums">
                      {formatPaise(r.amountPaise)}
                    </TableCell>
                    <TableCell>
                      {r.category || <span className="text-xs text-muted-foreground">—</span>}
                    </TableCell>
                    {tagOptions.length > 0 && (
                      <TableCell>
                        {r.tags ? (
                          <span className="text-sm">{r.tags}</span>
                        ) : (
                          <span className="text-xs text-destructive">missing</span>
                        )}
                      </TableCell>
                    )}
                    <TableCell>
                      <StatusBadge
                        label={r.pending ? "Pending" : TXN_STATUS_LABEL[r.status]}
                        tone={r.pending ? "warning" : "success"}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        {r.invoiceUrl && (
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            aria-label="View invoice"
                            title={r.invoiceName}
                            onClick={() =>
                              window.open(
                                r.invoiceUrl.startsWith("/api")
                                  ? API_BASE.replace(/\/api\/v1$/, "") + r.invoiceUrl
                                  : r.invoiceUrl,
                                "_blank",
                              )
                            }
                          >
                            <Paperclip className="size-3.5" />
                          </Button>
                        )}
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          aria-label="Complete this charge"
                          onClick={() => openEdit(r)}
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
          <TablePagination page={page} pageCount={pageCount} onPageChange={setPage} />
        </>
      )}

      {/* Complete-a-charge dialog: invoice + category + tag + remarks in one place. */}
      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Complete charge</DialogTitle>
            <DialogDescription>
              {editing
                ? `${editing.description} — ${formatPaise(editing.amountPaise)} on ${editing.effectiveDate}`
                : ""}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>Invoice {editing?.invoiceName ? `(current: ${editing.invoiceName})` : ""}</Label>
              <FileUpload
                entityType="TRANSACTION"
                value={uploadFiles}
                onChange={(files) => setUploadFiles(files.slice(-1))}
                compact
              />
              <p className="text-xs text-muted-foreground">
                No invoice for this charge (bank fee, GST line)? Just pick a category below.
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Category</Label>
              <Select value={editCategory || "__none"} onValueChange={(v) => setEditCategory(v === "__none" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Pick a category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">— none —</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {tagOptions.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <Label>
                  {tagLabel} <span className="text-destructive">*</span>
                </Label>
                <div className="flex flex-wrap gap-1.5">
                  {tagOptions.map((t) => {
                    const on = editTags.includes(t);
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() =>
                          setEditTags((prev) => (on ? prev.filter((x) => x !== t) : [...prev, t]))
                        }
                        className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                          on
                            ? "border-primary bg-primary text-primary-foreground"
                            : "hover:bg-muted"
                        }`}
                      >
                        {t}
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-muted-foreground">
                  A charge is not complete until the {tagLabel.toLowerCase()} is set.
                </p>
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="charge-remarks">Remarks</Label>
              <Textarea
                id="charge-remarks"
                rows={2}
                value={editRemarks}
                placeholder="Anything the admin should know about this charge"
                onChange={(e) => setEditRemarks(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button loading={update.isPending || attach.isPending} onClick={() => void saveEdit()}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* My-helpers dialog: nominate colleagues who can complete your charges. */}
      <Dialog open={helpersOpen} onOpenChange={setHelpersOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>My invoice helpers</DialogTitle>
            <DialogDescription>
              Helpers see your charges and can upload invoices or fill in details for you.
              Reminder emails still come only to you.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            {(me?.myHelpers ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground">No helpers yet.</p>
            )}
            {(me?.myHelpers ?? []).map((h) => (
              <div key={h.id} className="flex items-center justify-between rounded-lg border px-3 py-2">
                <div>
                  <p className="text-sm font-medium">{h.name}</p>
                  <p className="text-xs text-muted-foreground">{h.email}</p>
                </div>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label={`Remove ${h.name}`}
                  loading={removeHelper.isPending}
                  onClick={() => removeHelper.mutate(h.id)}
                >
                  <X className="size-3.5" />
                </Button>
              </div>
            ))}
            <div className="flex items-end gap-2">
              <div className="flex flex-1 flex-col gap-1.5">
                <Label htmlFor="helper-email">Add a helper</Label>
                <Input
                  id="helper-email"
                  type="email"
                  placeholder="colleague@mesaschool.co"
                  value={helperEmail}
                  onChange={(e) => setHelperEmail(e.target.value)}
                />
              </div>
              <Button
                disabled={!helperEmail.includes("@")}
                loading={addHelper.isPending}
                onClick={() =>
                  addHelper.mutate(helperEmail.trim().toLowerCase(), {
                    onSuccess: () => setHelperEmail(""),
                  })
                }
              >
                Add
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
