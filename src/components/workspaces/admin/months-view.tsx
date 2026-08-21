"use client";

/**
 * Spend by month — one row per month: total spend as a single-hue proportion
 * bar (value labeled in text, per the dataviz rules: one series → one hue, no
 * legend, values in ink not in the bar color), plus charge counts and the
 * month's top category. The table IS the data view.
 */
import { useMemo } from "react";
import { TableSkeleton } from "@/components/shared/loading";
import { formatPaise, useSpendTransactions } from "@/features/spend";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function MonthsView() {
  const { data, isLoading } = useSpendTransactions();

  const months = useMemo(() => {
    const by = new Map<
      string,
      { total: number; count: number; pending: number; cats: Map<string, number> }
    >();
    for (const r of data?.rows ?? []) {
      const key = r.effectiveDate.slice(0, 7); // yyyy-mm
      const e = by.get(key) ?? { total: 0, count: 0, pending: 0, cats: new Map() };
      e.total += r.amountPaise;
      e.count += 1;
      if (r.pending) e.pending += 1;
      const cat = r.category || "Uncategorised";
      e.cats.set(cat, (e.cats.get(cat) ?? 0) + r.amountPaise);
      by.set(key, e);
    }
    const rows = [...by.entries()]
      .sort(([a], [b]) => (a < b ? 1 : -1))
      .map(([key, e]) => {
        const [y, m] = key.split("-");
        const topCat = [...e.cats.entries()].sort((a, b) => b[1] - a[1])[0];
        return {
          key,
          label: `${MONTHS[Number(m) - 1]} ${y}`,
          total: e.total,
          count: e.count,
          pending: e.pending,
          topCat: topCat ? `${topCat[0]} (${formatPaise(topCat[1])})` : "—",
        };
      });
    const max = Math.max(1, ...rows.map((r) => r.total));
    return { rows, max };
  }, [data?.rows]);

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl border bg-card p-4 shadow-sm">
        <h2 className="text-lg font-semibold">Spend by month</h2>
        <p className="text-sm text-muted-foreground">
          Card spend per statement month — the bar shows each month against the biggest month.
        </p>
      </div>

      <div className="overflow-x-auto rounded-2xl border bg-card shadow-sm">
        {isLoading ? (
          <div className="p-4">
            <TableSkeleton rows={6} />
          </div>
        ) : (
          <table className="w-full min-w-[48rem] text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="px-4 py-3 font-medium">Month</th>
                <th className="w-1/2 px-4 py-3 font-medium">Spend</th>
                <th className="px-4 py-3 text-right font-medium">Charges</th>
                <th className="px-4 py-3 text-right font-medium">Pending</th>
                <th className="px-4 py-3 font-medium">Top category</th>
              </tr>
            </thead>
            <tbody>
              {months.rows.map((m) => (
                <tr key={m.key} className="border-b last:border-b-0 hover:bg-muted/40">
                  <td className="whitespace-nowrap px-4 py-3 font-medium">{m.label}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="h-4 flex-1 overflow-hidden rounded-[4px] bg-muted">
                        <div
                          className="h-full rounded-[4px] bg-[#1e4f39]"
                          style={{ width: `${Math.max(2, (m.total / months.max) * 100)}%` }}
                          title={`${m.label}: ${formatPaise(m.total)}`}
                        />
                      </div>
                      <span className="w-28 shrink-0 text-right tabular-nums">
                        {formatPaise(m.total)}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{m.count}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {m.pending > 0 ? (
                      <span className="font-medium text-[#8a6116]">{m.pending}</span>
                    ) : (
                      <span className="text-muted-foreground">0</span>
                    )}
                  </td>
                  <td className="max-w-64 truncate px-4 py-3 text-muted-foreground">{m.topCat}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
