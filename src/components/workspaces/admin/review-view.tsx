"use client";

/**
 * Review bucket — the accounts team's queue. Charges land here once the
 * cardholder is done (invoice uploaded / no invoice needed + department
 * tagged). Accounts verifies the details and marks the charge complete;
 * after that the cardholder can no longer change it.
 */
import { useMemo, useState } from "react";
import { Check, Eye, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TableSkeleton } from "@/components/shared/loading";
import { TablePagination } from "@/components/shared/table-pagination";
import { usePagedRows } from "@/hooks/use-paged-rows";
import {
  formatPaise,
  openInvoice,
  useSetReviewed,
  useSetReviewedBulk,
  useSpendTransactions,
} from "@/features/spend";

export function ReviewView() {
  const { data, isLoading } = useSpendTransactions();
  const setReviewed = useSetReviewed();
  const bulk = useSetReviewedBulk();
  const [tab, setTab] = useState<"todo" | "done">("todo");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // Per-column filters (like the transactions table).
  const [fMonth, setFMonth] = useState("all");
  const [fHolder, setFHolder] = useState("all");
  const [fDesc, setFDesc] = useState("");
  const [fCat, setFCat] = useState("all");
  const [fTag, setFTag] = useState("all");
  const [fRem, setFRem] = useState("");

  const { todo, done } = useMemo(() => {
    const rows = (data?.rows ?? []).filter((r) => !r.settlement && !r.pending);
    return {
      todo: rows.filter((r) => !r.reviewed),
      done: rows.filter((r) => r.reviewed),
    };
  }, [data?.rows]);

  // Filter option lists, derived from the data itself.
  const { months, holders, cats, tags } = useMemo(() => {
    const all = [...todo, ...done];
    return {
      months: [...new Set(all.map((r) => r.effectiveDate.slice(0, 7)))].sort().reverse(),
      holders: [...new Set(all.map((r) => r.cardholder))].sort(),
      cats: [...new Set(all.map((r) => r.category).filter(Boolean))].sort(),
      tags: [...new Set(all.flatMap((r) => r.tags.split(",").map((s) => s.trim()).filter(Boolean)))].sort(),
    };
  }, [todo, done]);

  const visible = useMemo(() => {
    const source = tab === "todo" ? todo : done;
    const q = query.trim().toLowerCase();
    const fd = fDesc.trim().toLowerCase();
    const fr = fRem.trim().toLowerCase();
    return source.filter((r) => {
      if (fMonth !== "all" && r.effectiveDate.slice(0, 7) !== fMonth) return false;
      if (fHolder !== "all" && r.cardholder !== fHolder) return false;
      if (fd && !r.description.toLowerCase().includes(fd)) return false;
      if (fCat !== "all" && r.category !== fCat) return false;
      if (fTag !== "all") {
        const rowTags = r.tags.split(",").map((s) => s.trim());
        if (fTag === "__none" ? r.tags.trim() !== "" : !rowTags.includes(fTag)) return false;
      }
      if (fr && !r.remarks.toLowerCase().includes(fr)) return false;
      if (!q) return true;
      return (
        r.description.toLowerCase().includes(q) ||
        r.cardholder.toLowerCase().includes(q) ||
        r.category.toLowerCase().includes(q) ||
        r.tags.toLowerCase().includes(q) ||
        r.remarks.toLowerCase().includes(q)
      );
    });
  }, [tab, todo, done, query, fMonth, fHolder, fDesc, fCat, fTag, fRem]);

  const { page, setPage, pageCount, pageRows } = usePagedRows(visible, 20);

  const allVisibleSelected = visible.length > 0 && visible.every((r) => selected.has(r.id));

  function toggleRow(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected(allVisibleSelected ? new Set() : new Set(visible.map((r) => r.id)));
  }

  function completeSelected() {
    bulk.mutate(
      { ids: [...selected], on: tab === "todo" },
      { onSuccess: () => setSelected(new Set()) },
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl border bg-card p-4 shadow-sm">
        <h2 className="text-lg font-semibold">Review — accounts sign-off</h2>
        <p className="text-sm text-muted-foreground">
          Charges the cardholders have completed. Verify the invoice and details, then mark
          complete — the cardholder can no longer change a completed charge.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-2xl border bg-card p-4 shadow-sm">
        {(
          [
            ["todo", `To review (${todo.length})`],
            ["done", `Completed (${done.length})`],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => {
              setTab(key);
              setPage(1);
              setSelected(new Set());
            }}
            className={`rounded-full border px-4 py-1.5 text-sm transition-colors ${
              tab === key
                ? "border-[#1e4f39] bg-[#1e4f39] font-medium text-white"
                : "hover:bg-muted"
            }`}
          >
            {label}
          </button>
        ))}
        <Input
          placeholder="Search description, cardholder, remarks…"
          className="ml-auto w-72"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(1);
          }}
        />
        <Button
          className="bg-[#1e4f39] text-white hover:bg-[#173d2c]"
          disabled={selected.size === 0}
          loading={bulk.isPending}
          onClick={completeSelected}
        >
          {tab === "todo" ? (
            <>
              <Check className="size-4" /> Complete selected ({selected.size})
            </>
          ) : (
            <>
              <Undo2 className="size-4" /> Undo selected ({selected.size})
            </>
          )}
        </Button>
      </div>

      <div className="overflow-x-auto rounded-2xl border bg-card shadow-sm">
        {isLoading ? (
          <div className="p-4">
            <TableSkeleton rows={8} />
          </div>
        ) : (
          <table className="w-full min-w-[64rem] text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    className="size-4 accent-[#1e4f39]"
                    checked={allVisibleSelected}
                    onChange={toggleAll}
                    title={allVisibleSelected ? "Clear selection" : "Select all (matching filter)"}
                  />
                </th>
                <th className="px-4 py-3 font-medium">
                  <span className="flex items-center gap-2">
                    Date
                    <Select value={fMonth} onValueChange={(v) => { setFMonth(v); setPage(1); }}>
                      <SelectTrigger className="h-6 w-24 px-2 text-xs font-normal" size="sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        {months.map((m) => (
                          <SelectItem key={m} value={m}>{m}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </span>
                </th>
                <th className="px-4 py-3 font-medium">
                  <span className="flex items-center gap-2">
                    Cardholder
                    <Select value={fHolder} onValueChange={(v) => { setFHolder(v); setPage(1); }}>
                      <SelectTrigger className="h-6 w-20 px-2 text-xs font-normal" size="sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        {holders.map((h) => (
                          <SelectItem key={h} value={h}>{h}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </span>
                </th>
                <th className="px-4 py-3 font-medium">
                  <span className="flex items-center gap-2">
                    Description
                    <Input
                      placeholder="Filter…"
                      className="h-6 w-28 px-2 text-xs font-normal"
                      value={fDesc}
                      onChange={(e) => { setFDesc(e.target.value); setPage(1); }}
                    />
                  </span>
                </th>
                <th className="px-4 py-3 text-right font-medium">Amount</th>
                <th className="px-4 py-3 font-medium">
                  <span className="flex items-center gap-2">
                    Category
                    <Select value={fCat} onValueChange={(v) => { setFCat(v); setPage(1); }}>
                      <SelectTrigger className="h-6 w-16 px-2 text-xs font-normal" size="sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        {cats.map((ct) => (
                          <SelectItem key={ct} value={ct}>{ct}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </span>
                </th>
                <th className="px-4 py-3 font-medium">
                  <span className="flex items-center gap-2">
                    Department
                    <Select value={fTag} onValueChange={(v) => { setFTag(v); setPage(1); }}>
                      <SelectTrigger className="h-6 w-16 px-2 text-xs font-normal" size="sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="__none">— blank —</SelectItem>
                        {tags.map((t) => (
                          <SelectItem key={t} value={t}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </span>
                </th>
                <th className="px-4 py-3 font-medium">
                  <span className="flex items-center gap-2">
                    Remarks
                    <Input
                      placeholder="Filter…"
                      className="h-6 w-24 px-2 text-xs font-normal"
                      value={fRem}
                      onChange={(e) => { setFRem(e.target.value); setPage(1); }}
                    />
                  </span>
                </th>
                <th className="px-4 py-3 font-medium">Invoice</th>
                <th className="px-4 py-3 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-10 text-center text-muted-foreground">
                    {tab === "todo"
                      ? "Nothing waiting for review."
                      : "Nothing marked complete yet."}
                  </td>
                </tr>
              )}
              {pageRows.map((r) => (
                <tr key={r.id} className="border-b last:border-b-0 hover:bg-muted/40">
                  <td className="px-4 py-1.5">
                    <input
                      type="checkbox"
                      className="size-4 accent-[#1e4f39]"
                      checked={selected.has(r.id)}
                      onChange={() => toggleRow(r.id)}
                    />
                  </td>
                  <td className="whitespace-nowrap px-4 py-1.5 text-muted-foreground">
                    {r.effectiveDate}
                  </td>
                  <td className="whitespace-nowrap px-4 py-1.5 font-medium">{r.cardholder}</td>
                  <td className="max-w-64 truncate px-4 py-1.5" title={r.description}>
                    {r.description}
                  </td>
                  <td className="whitespace-nowrap px-4 py-1.5 text-right tabular-nums">
                    {formatPaise(r.amountPaise)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-1.5">
                    {r.category ? (
                      <span className="rounded-full bg-muted px-2.5 py-1 text-xs">{r.category}</span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="max-w-44 truncate px-4 py-1.5" title={r.tags}>
                    {r.tags || "—"}
                  </td>
                  <td className="max-w-56 truncate px-4 py-1.5 text-muted-foreground" title={r.remarks}>
                    {r.remarks || "—"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-1.5">
                    {r.invoiceUrl ? (
                      <button
                        type="button"
                        onClick={() => void openInvoice(r.invoiceUrl)}
                        className="inline-flex items-center gap-1 text-sm text-[#1e4f39] underline-offset-2 hover:underline"
                        title={r.invoiceName}
                      >
                        <Eye className="size-3.5" /> View
                      </button>
                    ) : (
                      <span className="text-xs text-muted-foreground">No invoice needed</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-1.5">
                    {tab === "todo" ? (
                      <Button
                        size="sm"
                        className="h-7 bg-[#1e4f39] px-2.5 text-xs text-white hover:bg-[#173d2c]"
                        loading={setReviewed.isPending && setReviewed.variables?.id === r.id}
                        onClick={() => setReviewed.mutate({ id: r.id, on: true })}
                      >
                        <Check className="size-3.5" /> Complete
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2.5 text-xs"
                        loading={setReviewed.isPending && setReviewed.variables?.id === r.id}
                        onClick={() => setReviewed.mutate({ id: r.id, on: false })}
                      >
                        <Undo2 className="size-3.5" /> Undo
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <TablePagination page={page} pageCount={pageCount} onPageChange={setPage} />
    </div>
  );
}
