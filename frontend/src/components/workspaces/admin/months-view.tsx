"use client";

/**
 * Spend by month — like the original app: a range picker (Last 3 / 6 / all
 * months), a vertical bar chart (single series → one green hue, value labels
 * above each bar, no legend), and the cardholder × month matrix underneath
 * with row totals. The matrix is the table view of the same data.
 */
import { useMemo, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TableSkeleton } from "@/components/shared/loading";
import { formatPaise, useSpendTransactions } from "@/features/spend";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function monthLabel(key: string): string {
  const [y, m] = key.split("-");
  return `${MONTHS[Number(m) - 1]} ${y!.slice(2)}`;
}

/** Compact ₹ for bar labels: ₹12.4L / ₹85k / ₹950 */
function compactPaise(paise: number): string {
  const r = paise / 100;
  if (r >= 100_000) return `₹${(r / 100_000).toFixed(1).replace(/\.0$/, "")}L`;
  if (r >= 1_000) return `₹${(r / 1_000).toFixed(1).replace(/\.0$/, "")}k`;
  return `₹${Math.round(r)}`;
}

export function MonthsView() {
  const { data, isLoading } = useSpendTransactions();
  const [range, setRange] = useState<"3" | "6" | "all">("6");

  const { monthKeys, totals, holders, max } = useMemo(() => {
    const rows = (data?.rows ?? []).filter((r) => !r.settlement);
    const allKeys = [...new Set(rows.map((r) => r.effectiveDate.slice(0, 7)))].sort();
    const monthKeys =
      range === "all" ? allKeys : allKeys.slice(-Number(range));
    const keySet = new Set(monthKeys);

    const totals = new Map<string, number>();
    const byHolder = new Map<string, Map<string, number>>();
    for (const r of rows) {
      const key = r.effectiveDate.slice(0, 7);
      if (!keySet.has(key)) continue;
      totals.set(key, (totals.get(key) ?? 0) + r.amountPaise);
      const h = byHolder.get(r.cardholder) ?? new Map<string, number>();
      h.set(key, (h.get(key) ?? 0) + r.amountPaise);
      byHolder.set(r.cardholder, h);
    }

    const holders = [...byHolder.entries()]
      .map(([name, months]) => ({
        name,
        months,
        total: [...months.values()].reduce((a, b) => a + b, 0),
      }))
      .sort((a, b) => b.total - a.total);

    const max = Math.max(1, ...monthKeys.map((k) => totals.get(k) ?? 0));
    return { monthKeys, totals, holders, max };
  }, [data?.rows, range]);

  const grand = monthKeys.reduce((a, k) => a + (totals.get(k) ?? 0), 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border bg-card p-4 shadow-sm">
        <div>
          <h2 className="text-lg font-semibold">Spend by month</h2>
          <p className="text-sm text-muted-foreground">
            Total card spend per statement month, and who spent it.
          </p>
        </div>
        <div className="ml-auto">
          <Select value={range} onValueChange={(v) => setRange(v as typeof range)}>
            <SelectTrigger size="sm" className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="3">Last 3 months</SelectItem>
              <SelectItem value="6">Last 6 months</SelectItem>
              <SelectItem value="all">All months</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="rounded-2xl border bg-card p-4 shadow-sm">
          <TableSkeleton rows={6} />
        </div>
      ) : (
        <>
          {/* Bar chart — value labels above bars, month labels below */}
          <div className="rounded-2xl border bg-card p-5 shadow-sm">
            <div className="overflow-x-auto">
              <div
                className="grid min-w-[36rem] items-end gap-3"
                style={{ gridTemplateColumns: `repeat(${monthKeys.length}, minmax(0, 1fr))` }}
              >
                {monthKeys.map((k) => {
                  const v = totals.get(k) ?? 0;
                  return (
                    <div key={k} className="flex flex-col items-center gap-1">
                      <span className="text-xs font-medium tabular-nums">{compactPaise(v)}</span>
                      <div
                        className="w-full max-w-16 rounded-t-[4px] bg-[#1e4f39]"
                        style={{ height: `${Math.max(3, (v / max) * 180)}px` }}
                        title={`${monthLabel(k)}: ${formatPaise(v)}`}
                      />
                    </div>
                  );
                })}
                {monthKeys.map((k) => (
                  <span
                    key={`${k}-label`}
                    className="border-t pt-1.5 text-center text-xs text-muted-foreground"
                  >
                    {monthLabel(k)}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Cardholder × month matrix */}
          <div className="overflow-x-auto rounded-2xl border bg-card shadow-sm">
            <table className="w-full min-w-[48rem] text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Cardholder</th>
                  {monthKeys.map((k) => (
                    <th key={k} className="px-4 py-3 text-right font-medium">
                      {monthLabel(k)}
                    </th>
                  ))}
                  <th className="px-4 py-3 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {holders.map((h) => (
                  <tr key={h.name} className="border-b last:border-b-0 hover:bg-muted/40">
                    <td className="whitespace-nowrap px-4 py-2.5 font-medium">{h.name}</td>
                    {monthKeys.map((k) => {
                      const v = h.months.get(k) ?? 0;
                      return (
                        <td key={k} className="px-4 py-2.5 text-right tabular-nums">
                          {v ? formatPaise(v) : <span className="text-muted-foreground">—</span>}
                        </td>
                      );
                    })}
                    <td className="px-4 py-2.5 text-right font-semibold tabular-nums">
                      {formatPaise(h.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t bg-muted/30 font-semibold">
                  <td className="px-4 py-2.5">All cardholders</td>
                  {monthKeys.map((k) => (
                    <td key={k} className="px-4 py-2.5 text-right tabular-nums">
                      {formatPaise(totals.get(k) ?? 0)}
                    </td>
                  ))}
                  <td className="px-4 py-2.5 text-right tabular-nums">{formatPaise(grand)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
