"use client";

/**
 * Top spends — like the original app: pick a statement month, see the ten
 * biggest charges that month with cardholder and remarks.
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
  return `${MONTHS[Number(m) - 1]}-${y!.slice(2)}`;
}

export function TopView() {
  const { data, isLoading } = useSpendTransactions();
  const [month, setMonth] = useState<string | null>(null);

  const monthKeys = useMemo(
    () =>
      [...new Set((data?.rows ?? []).map((r) => r.effectiveDate.slice(0, 7)))].sort().reverse(),
    [data?.rows],
  );
  const selected = month ?? monthKeys[0] ?? null;

  const top = useMemo(() => {
    if (!selected) return [];
    return (data?.rows ?? [])
      .filter((r) => r.effectiveDate.slice(0, 7) === selected)
      .sort((a, b) => b.amountPaise - a.amountPaise)
      .slice(0, 10);
  }, [data?.rows, selected]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border bg-card p-4 shadow-sm">
        <div>
          <h2 className="text-lg font-semibold">Top spends</h2>
          <p className="text-sm text-muted-foreground">
            The ten biggest charges in the chosen statement month.
          </p>
        </div>
        <div className="ml-auto">
          <Select value={selected ?? undefined} onValueChange={setMonth}>
            <SelectTrigger size="sm" className="w-32">
              <SelectValue placeholder="Month" />
            </SelectTrigger>
            <SelectContent>
              {monthKeys.map((k) => (
                <SelectItem key={k} value={k}>
                  {monthLabel(k)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border bg-card shadow-sm">
        {isLoading ? (
          <div className="p-4">
            <TableSkeleton rows={8} />
          </div>
        ) : (
          <table className="w-full min-w-[44rem] text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="w-10 px-4 py-3 font-medium">#</th>
                <th className="px-4 py-3 font-medium">Cardholder</th>
                <th className="px-4 py-3 font-medium">Description</th>
                <th className="px-4 py-3 text-right font-medium">Amount</th>
                <th className="px-4 py-3 font-medium">Remarks</th>
              </tr>
            </thead>
            <tbody>
              {top.map((r, i) => (
                <tr key={r.id} className="border-b last:border-b-0 hover:bg-muted/40">
                  <td className="px-4 py-2.5 text-muted-foreground">{i + 1}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 font-medium">{r.cardholder}</td>
                  <td className="max-w-72 truncate px-4 py-2.5" title={r.description}>
                    {r.description}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-right font-medium tabular-nums">
                    {formatPaise(r.amountPaise)}
                  </td>
                  <td className="max-w-64 truncate px-4 py-2.5 text-muted-foreground" title={r.remarks}>
                    {r.remarks || "—"}
                  </td>
                </tr>
              ))}
              {top.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                    No charges in this month.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
