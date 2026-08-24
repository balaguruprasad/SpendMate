"use client";

/**
 * Reports — periodic bulk download for Bala/accounts: every field of every
 * charge as CSV, or a ZIP that also bundles all the invoice files, ready to
 * drop into the internal shared folders.
 */
import { useState } from "react";
import { FileDown, FolderArchive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api/client";
import { toast } from "@/lib/toast";

function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export function ReportsView() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState<"csv" | "zip" | null>(null);

  async function download(kind: "csv" | "zip") {
    setBusy(kind);
    try {
      const params = new URLSearchParams();
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      params.set("invoices", kind === "zip" ? "1" : "0");
      const blob = await api.getBlob(`/spend/export?${params.toString()}`);
      const stamp = `${from || "start"}_to_${to || "latest"}`;
      saveBlob(blob, `spendmate-report-${stamp}.${kind === "zip" ? "zip" : "csv"}`);
      toast.success(kind === "zip" ? "Report + invoices downloaded." : "Report downloaded.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Download failed.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl border bg-card p-4 shadow-sm">
        <h2 className="text-lg font-semibold">Reports</h2>
        <p className="text-sm text-muted-foreground">
          Bulk download for the accounts folder: every charge with all fields (cardholder, amount,
          category, department, remarks, status, review sign-off, invoice file name) — optionally
          bundled with every invoice copy.
        </p>
      </div>

      <div className="flex flex-col gap-5 rounded-2xl border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="rep-from">From month</Label>
            <Input
              id="rep-from"
              type="month"
              className="w-44"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="rep-to">To month</Label>
            <Input
              id="rep-to"
              type="month"
              className="w-44"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
          <p className="pb-2 text-xs text-muted-foreground">
            Leave both empty for everything; set just one for an open range.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button
            className="bg-[#1e4f39] text-white hover:bg-[#173d2c]"
            loading={busy === "csv"}
            disabled={busy !== null}
            onClick={() => void download("csv")}
          >
            <FileDown className="size-4" /> Download CSV (all fields)
          </Button>
          <Button
            variant="outline"
            className="border-[#1e4f39]/40 text-[#1e4f39] hover:bg-[#e7f2ec]"
            loading={busy === "zip"}
            disabled={busy !== null}
            onClick={() => void download("zip")}
          >
            <FolderArchive className="size-4" /> Download CSV + all invoices (ZIP)
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          The ZIP contains the CSV plus an <code>invoices/</code> folder; each file is named
          date_cardholder_id so it matches the &quot;Invoice in bundle&quot; column in the CSV.
          Large ranges can take a minute — the invoices are fetched from storage on the fly.
        </p>
      </div>
    </div>
  );
}
