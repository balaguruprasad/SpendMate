"use client";

/**
 * Statement import — paste rows straight from Excel/CSV (tab- or
 * comma-separated): Card Number, Effective Date, Posting Date (optional),
 * Amount, Description. Preview parses locally; Import appends via the API.
 * GST / ISSUER MARKUP ASSESSMENT lines are auto-categorized server-side.
 */
import { useMemo, useState } from "react";
import { Download, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/layout/page-header";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  formatPaise,
  parseAmountToPaise,
  useImportTransactions,
  type ImportRow,
} from "@/features/spend";

interface ParsedRow extends ImportRow {
  line: number;
  error: string | null;
}

/** dd/mm/yyyy, dd-mm-yyyy, yyyy-mm-dd → yyyy-mm-dd (empty stays empty). */
function normalizeDate(raw: string): string | null {
  const s = raw.trim();
  if (!s) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (m) return `${m[3]}-${m[2]!.padStart(2, "0")}-${m[1]!.padStart(2, "0")}`;
  return null;
}

function parsePasted(text: string): ParsedRow[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim());
  const rows: ParsedRow[] = [];
  lines.forEach((line, i) => {
    if (!line) return;
    const cells = line.includes("\t") ? line.split("\t") : line.split(",");
    const [card = "", eff = "", post = "", amount = "", ...desc] = cells.map((c) => c.trim());
    // Skip a pasted header row.
    if (i === 0 && /card/i.test(card) && /date/i.test(eff)) return;
    const effDate = normalizeDate(eff);
    const postDate = normalizeDate(post);
    const paise = parseAmountToPaise(amount);
    const description = desc.join(", ").trim();
    let error: string | null = null;
    if (!card.replace(/\D/g, "")) error = "Card number missing";
    else if (!effDate) error = `Bad effective date "${eff}"`;
    else if (postDate === null) error = `Bad posting date "${post}"`;
    else if (paise === null) error = `Bad amount "${amount}"`;
    else if (!description) error = "Description missing";
    rows.push({
      line: i + 1,
      cardNumber: card,
      effectiveDate: effDate ?? "",
      postingDate: postDate ?? "",
      amountPaise: paise ?? 0,
      description,
      error,
    });
  });
  return rows;
}

export function ImportView() {
  const importTxns = useImportTransactions();
  const [text, setText] = useState("");
  const parsed = useMemo(() => parsePasted(text), [text]);
  const valid = parsed.filter((r) => !r.error);
  const invalid = parsed.filter((r) => r.error);

  function runImport() {
    importTxns.mutate(
      valid.map(({ cardNumber, effectiveDate, postingDate, amountPaise, description }) => ({
        cardNumber,
        effectiveDate,
        postingDate,
        amountPaise,
        description,
      })),
      { onSuccess: () => setText("") },
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="SpendMate"
        title="Import statement"
        description="Paste rows from the card statement (Excel/CSV): Card Number, Effective Date, Posting Date, Amount, Description. Rows are appended — never edited or deleted."
      />

      <Card className="flex flex-col gap-3 p-5">
        <Textarea
          rows={8}
          className="font-mono text-xs"
          placeholder={
            "4315\t20/08/2026\t21/08/2026\t1,234.56\tGOOGLE WORKSPACE SUBSCRIPTION\n7276\t20/08/2026\t\t500.00\tGST"
          }
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <div className="flex items-center gap-3">
          <Button
            disabled={valid.length === 0}
            loading={importTxns.isPending}
            onClick={runImport}
          >
            <Upload className="size-4" /> Import {valid.length} row{valid.length === 1 ? "" : "s"}
          </Button>
          {invalid.length > 0 && (
            <StatusBadge label={`${invalid.length} row(s) skipped`} tone="destructive" />
          )}
          <span className="text-xs text-muted-foreground">
            <Download className="mr-1 inline size-3.5" />
            Tip: copy the columns straight from the bank&apos;s Excel — tabs are handled.
          </span>
        </div>
      </Card>

      {parsed.length > 0 && (
        <Card className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-12">#</TableHead>
                <TableHead>Card</TableHead>
                <TableHead>Effective</TableHead>
                <TableHead>Posting</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Check</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {parsed.slice(0, 50).map((r) => (
                <TableRow key={r.line}>
                  <TableCell className="text-muted-foreground">{r.line}</TableCell>
                  <TableCell className="font-mono text-xs">{r.cardNumber}</TableCell>
                  <TableCell>{r.effectiveDate || "—"}</TableCell>
                  <TableCell>{r.postingDate || "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {r.error ? "—" : formatPaise(r.amountPaise)}
                  </TableCell>
                  <TableCell className="max-w-72 truncate">{r.description}</TableCell>
                  <TableCell>
                    {r.error ? (
                      <span className="text-xs text-destructive">{r.error}</span>
                    ) : (
                      <StatusBadge label="OK" tone="success" />
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {parsed.length > 50 && (
            <p className="px-4 py-2 text-xs text-muted-foreground">
              Showing the first 50 of {parsed.length} rows.
            </p>
          )}
        </Card>
      )}
    </div>
  );
}
