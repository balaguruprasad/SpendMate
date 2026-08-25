"use client";

/**
 * Transactions — the working screen, styled after the original Apps Script
 * app: stat tiles, All / Pending / Done pills, search, Download report, and a
 * table with INLINE category + department dropdowns and invoice
 * Upload / View / Replace right in the row.
 *
 * Admins additionally get "View as cardholder" (?as=<holderId>): the list
 * narrows to that person and edits save to their charges, exactly like the
 * old app's banner said.
 */
import { useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Check, Download, Eye, Pencil, Upload, UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { TableSkeleton } from "@/components/shared/loading";
import { TablePagination } from "@/components/shared/table-pagination";
import { usePagedRows } from "@/hooks/use-paged-rows";
import { upload } from "@/features/attachments";
import { downloadFile, toCsv } from "@/lib/csv";
import { toast } from "@/lib/toast";
import {
  formatPaise,
  openInvoice,
  useAddHelper,
  useAttachInvoice,
  useRemoveHelper,
  useSpendMe,
  useSpendTransactions,
  useUpdateTransaction,
  type SpendTransaction,
} from "@/features/spend";
import { ROLE_BASE } from "@/lib/constants";

/** One stat tile, Apps-Script style: label on top, big number under. */
function Tile({
  label,
  value,
  tone = "green",
}: {
  label: string;
  value: string;
  tone?: "amber" | "green";
}) {
  return (
    <div
      className={`flex-1 rounded-xl px-4 py-3 ${
        tone === "amber" ? "bg-[#fdf3df]" : "bg-[#e7f2ec]"
      }`}
    >
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold tabular-nums">{value}</p>
    </div>
  );
}

export function ChargesView({ isAdmin }: { isAdmin: boolean }) {
  const { data: me } = useSpendMe();
  const { data, isLoading } = useSpendTransactions();
  const update = useUpdateTransaction();
  const attach = useAttachInvoice();
  const addHelper = useAddHelper();
  const removeHelper = useRemoveHelper();
  const searchParams = useSearchParams();
  const viewAsId = isAdmin ? searchParams.get("as") : null;
  const chargesBase = `${ROLE_BASE[isAdmin ? "ADMIN" : "MEMBER"]}/charges`;

  const [pill, setPill] = useState<"all" | "pending" | "done">("all");
  const [query, setQuery] = useState("");
  // Column filters (G-Sheet style): description text, category + tag dropdowns.
  const [fDesc, setFDesc] = useState("");
  const [fCat, setFCat] = useState("all");
  const [fTag, setFTag] = useState("all");
  const [remarksFor, setRemarksFor] = useState<SpendTransaction | null>(null);
  const [remarksText, setRemarksText] = useState("");
  const [helpersOpen, setHelpersOpen] = useState(false);
  const [helperEmail, setHelperEmail] = useState("");
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const pendingUploadTxn = useRef<string | null>(null);

  const settings = me?.settings;
  const tagLabel = settings?.tagLabel ?? "Department";
  const tagOptions = settings?.tagOptions ?? [];
  const categories = settings?.categories ?? [];

  const viewAsName = useMemo(() => {
    if (!viewAsId) return null;
    return (data?.rows ?? []).find((r) => r.cardholderId === viewAsId)?.cardholder ?? null;
  }, [viewAsId, data?.rows]);

  const scoped = useMemo(() => {
    const rows = (data?.rows ?? []).filter((r) => !r.settlement);
    return viewAsId ? rows.filter((r) => r.cardholderId === viewAsId) : rows;
  }, [data?.rows, viewAsId]);

  const stats = useMemo(() => {
    const pending = scoped.filter((r) => r.pending).length;
    const submitted = scoped.filter((r) => r.status === "SUBMITTED").length;
    const noInvoice = scoped.filter((r) => r.status === "NO_INVOICE_NEEDED").length;
    const toReview = scoped.filter((r) => !r.pending && !r.reviewed).length;
    const total = scoped.reduce((s, r) => s + r.amountPaise, 0);
    return { pending, submitted, noInvoice, toReview, count: scoped.length, total };
  }, [scoped]);

  // Admin overview: per-cardholder roll-up (click a row to "view as").
  const holderSummary = useMemo(() => {
    if (!isAdmin || viewAsId) return [];
    const by = new Map<
      string,
      { id: string | null; name: string; total: number; count: number; pending: number }
    >();
    for (const r of data?.rows ?? []) {
      if (r.settlement) continue;
      const key = r.cardholder;
      const e = by.get(key) ?? { id: r.cardholderId, name: key, total: 0, count: 0, pending: 0 };
      e.total += r.amountPaise;
      e.count += 1;
      if (r.pending) e.pending += 1;
      by.set(key, e);
    }
    return [...by.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [isAdmin, viewAsId, data?.rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const fd = fDesc.trim().toLowerCase();
    return scoped.filter((r) => {
      if (pill === "pending" && !r.pending) return false;
      if (pill === "done" && r.pending) return false;
      if (fd && !r.description.toLowerCase().includes(fd)) return false;
      if (fCat !== "all") {
        if (fCat === "__none" ? r.category !== "" : r.category !== fCat) return false;
      }
      if (fTag !== "all") {
        const tags = r.tags.split(",").map((s) => s.trim());
        if (fTag === "__none" ? r.tags.trim() !== "" : !tags.includes(fTag)) return false;
      }
      if (!q) return true;
      return (
        r.description.toLowerCase().includes(q) ||
        r.remarks.toLowerCase().includes(q) ||
        r.category.toLowerCase().includes(q) ||
        r.cardholder.toLowerCase().includes(q) ||
        r.tags.toLowerCase().includes(q)
      );
    });
  }, [scoped, pill, query, fDesc, fCat, fTag]);

  const { page, setPage, pageCount, pageRows } = usePagedRows(filtered, 20);

  function pickFile(txnId: string) {
    pendingUploadTxn.current = txnId;
    fileRef.current?.click();
  }

  async function onFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const txnId = pendingUploadTxn.current;
    e.target.value = "";
    if (!file || !txnId) return;
    setUploadingId(txnId);
    try {
      const uploaded = await upload(file, "TRANSACTION");
      await attach.mutateAsync({ id: txnId, file: uploaded });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploadingId(null);
      pendingUploadTxn.current = null;
    }
  }

  function setCategory(r: SpendTransaction, category: string) {
    update.mutate({ id: r.id, patch: { category } });
  }

  function toggleTag(r: SpendTransaction, tag: string) {
    const current = r.tags ? r.tags.split(",").map((s) => s.trim()).filter(Boolean) : [];
    const next = current.includes(tag) ? current.filter((t) => t !== tag) : [...current, tag];
    update.mutate({ id: r.id, patch: { tags: next.join(", ") } });
  }

  function downloadReport() {
    const header = [
      "date", "description", "cardholder", "card", "amount", "category",
      tagLabel.toLowerCase(), "status", "remarks", "invoice",
    ];
    const body = filtered.map((r) => [
      r.effectiveDate, r.description, r.cardholder, r.card,
      (r.amountPaise / 100).toFixed(2), r.category, r.tags,
      r.pending ? "Pending" : r.status === "SUBMITTED" ? "Submitted" : "No invoice needed",
      r.remarks, r.invoiceName,
    ]);
    downloadFile(
      `spendmate-report-${new Date().toISOString().slice(0, 10)}.csv`,
      toCsv([header, ...body]),
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <input ref={fileRef} type="file" hidden accept=".pdf,.png,.jpg,.jpeg" onChange={onFileChosen} />

      {viewAsName && (
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-muted-foreground">
            Seeing what <span className="font-semibold text-foreground">{viewAsName}</span> sees —
            uploads and remarks you make here are saved to their charges.
          </p>
          {/* Hard navigation — a client-side Link to the same pathname with
              only the ?as= query removed does not navigate in this Next
              version (mirrors how view-as is entered). */}
          <button
            type="button"
            onClick={() => {
              window.location.href = chargesBase;
            }}
            className="inline-flex items-center gap-1 rounded-full border border-[#1e4f39] px-3 py-1 text-xs font-medium text-[#1e4f39] hover:bg-[#e7f2ec]"
          >
            <X className="size-3.5" /> Exit — back to all charges
          </button>
        </div>
      )}

      {/* Admin overview: totals + per-cardholder roll-up (click → view as) */}
      {isAdmin && !viewAsId && (
        <div className="flex flex-col gap-3 rounded-2xl border bg-card p-4 shadow-sm">
          <div className="flex flex-col gap-3 @2xl/main:flex-row">
            <Tile label="Total spend" value={formatPaise(stats.total)} />
            <Tile label="Cardholders" value={String(holderSummary.length)} />
            <Tile label="Invoices pending" value={String(stats.pending)} tone="amber" />
            <Tile label="To review" value={String(stats.toReview)} />
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="px-3 py-2 font-medium">Cardholder</th>
                <th className="px-3 py-2 text-right font-medium">Net total</th>
                <th className="px-3 py-2 text-right font-medium">Line items</th>
                <th className="px-3 py-2 text-right font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {holderSummary.map((h) => {
                const row = (
                  <>
                    <td className="px-3 py-2 font-medium">{h.name}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatPaise(h.total)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{h.count}</td>
                    <td className="px-3 py-2 text-right">
                      {h.pending > 0 ? (
                        <span className="font-medium text-[#8a6116]">{h.pending} pending</span>
                      ) : (
                        <span className="rounded-full bg-[#e7f2ec] px-2.5 py-0.5 text-xs font-medium text-[#1e4f39]">
                          All done
                        </span>
                      )}
                    </td>
                  </>
                );
                return h.id ? (
                  <tr
                    key={h.name}
                    className="cursor-pointer border-b last:border-b-0 hover:bg-[#e7f2ec]/50"
                    title={`View as ${h.name}`}
                    onClick={() => (window.location.href = `${chargesBase}?as=${h.id}`)}
                  >
                    {row}
                  </tr>
                ) : (
                  <tr key={h.name} className="border-b last:border-b-0">
                    {row}
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="text-xs text-muted-foreground">
            Click a cardholder to view (and complete) their charges as they see them.
          </p>
        </div>
      )}
      {!isAdmin && (me?.helperFor.length ?? 0) > 0 && (
        <p className="text-sm text-muted-foreground">
          You also see charges for{" "}
          <span className="font-medium text-foreground">
            {me!.helperFor.map((h) => h.name).join(", ")}
          </span>{" "}
          — they added you as their invoice helper.
        </p>
      )}

      {/* Per-person stat tiles (member view + admin's view-as) */}
      {(!isAdmin || viewAsId) && (
        <div className="flex flex-col gap-3 rounded-2xl border bg-card p-4 shadow-sm @2xl/main:flex-row">
          <Tile label="Pending — needs action" value={String(stats.pending)} tone="amber" />
          <Tile label="Invoice submitted" value={String(stats.submitted)} />
          <Tile label="No invoice needed" value={String(stats.noInvoice)} />
          <Tile label="Total charges" value={String(stats.count)} />
          <Tile label="Total spend" value={formatPaise(stats.total)} />
        </div>
      )}

      {/* Pills + search + report */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border bg-card p-4 shadow-sm">
        {(
          [
            ["all", `All (${stats.count})`],
            ["pending", `Pending (${stats.pending})`],
            ["done", `Done (${stats.count - stats.pending})`],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => {
              setPill(key);
              setPage(1);
            }}
            className={`rounded-full border px-4 py-1.5 text-sm transition-colors ${
              pill === key
                ? "border-[#1e4f39] bg-[#1e4f39] font-medium text-white"
                : "hover:bg-muted"
            }`}
          >
            {label}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <Input
            placeholder="Search description, remarks, category…"
            className="w-64"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
          />
          <Button className="bg-[#1e4f39] text-white hover:bg-[#173d2c]" onClick={downloadReport}>
            <Download className="size-4" /> Download report
          </Button>
          {!isAdmin && (me?.myCards.length ?? 0) > 0 && (
            <Button variant="outline" onClick={() => setHelpersOpen(true)}>
              <UserPlus className="size-4" /> My helpers
            </Button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-2xl border bg-card shadow-sm">
        {isLoading ? (
          <div className="p-4">
            <TableSkeleton rows={10} />
          </div>
        ) : (
          <table className="w-full min-w-[64rem] text-sm">
            <thead>
              {/* One header line — the filters sit inline beside their labels */}
              <tr className="border-b text-left text-muted-foreground">
                <th className="px-4 py-2 font-medium">Date</th>
                <th className="px-4 py-2 font-medium">
                  <span className="flex items-center gap-2">
                    Description
                    <Input
                      placeholder="Filter…"
                      className="h-6 w-32 px-2 text-xs font-normal"
                      value={fDesc}
                      onChange={(e) => {
                        setFDesc(e.target.value);
                        setPage(1);
                      }}
                    />
                  </span>
                </th>
                {isAdmin && !viewAsId && <th className="px-4 py-2 font-medium">Cardholder</th>}
                <th className="px-4 py-2 text-right font-medium">Amount</th>
                <th className="px-4 py-2 font-medium">
                  <span className="flex items-center gap-2">
                    Category
                    <Select
                      value={fCat}
                      onValueChange={(v) => {
                        setFCat(v);
                        setPage(1);
                      }}
                    >
                      <SelectTrigger className="h-6 w-20 px-2 text-xs font-normal" size="sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="__none">— blank —</SelectItem>
                        {categories.map((c) => (
                          <SelectItem key={c} value={c}>
                            {c}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </span>
                </th>
                {tagOptions.length > 0 && (
                  <th className="px-4 py-2 font-medium">
                    <span className="flex items-center gap-2">
                      {tagLabel}
                      <Select
                        value={fTag}
                        onValueChange={(v) => {
                          setFTag(v);
                          setPage(1);
                        }}
                      >
                        <SelectTrigger className="h-6 w-20 px-2 text-xs font-normal" size="sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All</SelectItem>
                          <SelectItem value="__none">— blank —</SelectItem>
                          {tagOptions.map((t) => (
                            <SelectItem key={t} value={t}>
                              {t}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </span>
                  </th>
                )}
                <th className="px-4 py-2 font-medium">Remarks</th>
                <th className="px-4 py-2 font-medium">Invoice</th>
                <th className="w-10 px-2 py-2" title="Reviewed by accounts" />
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-muted-foreground">
                    {pill === "pending" ? "Nothing pending here — all done." : "No charges match."}
                  </td>
                </tr>
              )}
              {pageRows.map((r) => (
                <tr key={r.id} className="border-b last:border-b-0 hover:bg-muted/40">
                  <td className="whitespace-nowrap px-4 py-1 text-muted-foreground">
                    {r.effectiveDate}
                  </td>
                  <td className="max-w-72 px-4 py-1">
                    <span className="block truncate font-medium" title={r.description}>
                      {r.description}
                    </span>
                  </td>
                  {isAdmin && !viewAsId && (
                    <td className="whitespace-nowrap px-4 py-1">{r.cardholder}</td>
                  )}
                  <td className="whitespace-nowrap px-4 py-1 text-right tabular-nums">
                    {formatPaise(r.amountPaise)}
                  </td>
                  <td className="px-4 py-1">
                    {/* Categories are auto-assigned (GST / markup) or default
                        to Others — nobody hand-picks GST/Markup. The only
                        manual move is the Penny-testing toggle. */}
                    <span className="flex items-center gap-1.5">
                      {r.category ? (
                        <span className="whitespace-nowrap rounded-full bg-muted px-2.5 py-0.5 text-xs">
                          {r.category}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                      {!r.reviewed && r.category === "Penny testing" && (
                        <button
                          type="button"
                          className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted"
                          title="Not a penny test — put it back under Others"
                          onClick={() => setCategory(r, "Others")}
                        >
                          Undo
                        </button>
                      )}
                      {/* Suggest penny-marking only while the charge still
                          needs action — done rows are done. */}
                      {!r.reviewed && r.pending && (r.category === "" || r.category === "Others") && (
                        <button
                          type="button"
                          className="rounded-full border border-[#1e4f39]/40 px-2 py-0.5 text-xs text-[#1e4f39] hover:bg-[#e7f2ec]"
                          title="Mark this charge as a bank penny test (nominal debit/credit)"
                          onClick={() => setCategory(r, "Penny testing")}
                        >
                          Penny?
                        </button>
                      )}
                    </span>
                  </td>
                  {tagOptions.length > 0 && (
                    <td className="px-4 py-1">
                      {r.reviewed && !isAdmin ? (
                        <span className="block w-40 truncate text-sm" title={r.tags}>
                          {r.tags || "—"}
                        </span>
                      ) : (
                      <Popover>
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            className={`w-36 truncate rounded-md border px-2 py-0.5 text-left text-xs hover:bg-muted ${
                              r.tags ? "" : "text-destructive"
                            }`}
                            title={r.tags || `Pick the ${tagLabel.toLowerCase()}`}
                          >
                            {r.tags || "— pick —"}
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-56 p-2" align="start">
                          <div className="flex flex-wrap gap-1.5">
                            {tagOptions.map((t) => {
                              const on = r.tags.split(",").map((s) => s.trim()).includes(t);
                              return (
                                <button
                                  key={t}
                                  type="button"
                                  onClick={() => toggleTag(r, t)}
                                  className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                                    on
                                      ? "border-[#1e4f39] bg-[#1e4f39] text-white"
                                      : "hover:bg-muted"
                                  }`}
                                >
                                  {t}
                                </button>
                              );
                            })}
                          </div>
                        </PopoverContent>
                      </Popover>
                      )}
                    </td>
                  )}
                  <td className="max-w-64 px-4 py-1">
                    {r.reviewed && !isAdmin ? (
                      <span className="block truncate text-xs text-muted-foreground" title={r.remarks}>
                        {r.remarks || "—"}
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setRemarksFor(r);
                          setRemarksText(r.remarks);
                        }}
                        className="group flex w-full items-center gap-1 text-left text-xs text-muted-foreground hover:text-foreground"
                        title="Edit remarks"
                      >
                        <Pencil className="size-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
                        {r.remarks ? (
                          <span className="truncate">{r.remarks}</span>
                        ) : (
                          <span className="italic opacity-40 transition-opacity group-hover:opacity-100">
                            add remarks
                          </span>
                        )}
                      </button>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-1">
                    <div className="flex items-center gap-1.5">
                      {r.invoiceUrl ? (
                        <>
                          <button
                            type="button"
                            onClick={() => void openInvoice(r.invoiceUrl)}
                            className="inline-flex items-center gap-1 text-sm text-[#1e4f39] underline-offset-2 hover:underline"
                            title={r.invoiceName}
                          >
                            <Eye className="size-3.5" /> View
                          </button>
                          {!(r.reviewed && !isAdmin) && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 px-2 text-xs"
                              loading={uploadingId === r.id}
                              onClick={() => pickFile(r.id)}
                            >
                              Replace
                            </Button>
                          )}
                        </>
                      ) : r.reviewed && !isAdmin ? (
                        <span className="text-xs text-muted-foreground">—</span>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 px-2 text-xs"
                          loading={uploadingId === r.id}
                          onClick={() => pickFile(r.id)}
                        >
                          <Upload className="size-3.5" /> Upload
                        </Button>
                      )}
                    </div>
                  </td>
                  <td className="px-2 py-1">
                    {r.reviewed && (
                      <span
                        className="inline-flex size-5 items-center justify-center rounded-full bg-[#1e4f39] text-white"
                        title="Accounts has reviewed this charge — accounting done"
                      >
                        <Check className="size-3.5" />
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <TablePagination page={page} pageCount={pageCount} onPageChange={setPage} />

      {/* Remarks dialog */}
      <Dialog open={remarksFor !== null} onOpenChange={(o) => !o && setRemarksFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remarks</DialogTitle>
            <DialogDescription>
              {remarksFor
                ? `${remarksFor.description} — ${formatPaise(remarksFor.amountPaise)} on ${remarksFor.effectiveDate}`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <Textarea
            rows={3}
            value={remarksText}
            placeholder="What was this charge for?"
            onChange={(e) => setRemarksText(e.target.value)}
          />
          <DialogFooter>
            <Button
              loading={update.isPending}
              onClick={() => {
                if (!remarksFor) return;
                update.mutate(
                  { id: remarksFor.id, patch: { remarks: remarksText.trim() } },
                  { onSuccess: () => setRemarksFor(null) },
                );
              }}
            >
              Save remarks
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* My-helpers dialog (cardholders) */}
      <Dialog open={helpersOpen} onOpenChange={setHelpersOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>My invoice helpers</DialogTitle>
            <DialogDescription>
              Helpers see your charges and can upload invoices or fill in details for you.
              Reminders still come only to you.
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
