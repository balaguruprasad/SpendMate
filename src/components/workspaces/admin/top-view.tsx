"use client";

/**
 * Top spends — the biggest individual charges and the biggest merchants
 * (grouped by description) side by side. Ranked tables; no chart needed.
 */
import { useMemo } from "react";
import { TableSkeleton } from "@/components/shared/loading";
import { formatPaise, useSpendTransactions } from "@/features/spend";

export function TopView() {
  const { data, isLoading } = useSpendTransactions();

  const { biggest, merchants } = useMemo(() => {
    const rows = data?.rows ?? [];
    const biggest = [...rows].sort((a, b) => b.amountPaise - a.amountPaise).slice(0, 15);
    const byMerchant = new Map<string, { total: number; count: number; holders: Set<string> }>();
    for (const r of rows) {
      // Collapse gateway suffixes a little: use the leading words of the description.
      const key = r.description.replace(/\s+/g, " ").trim().slice(0, 32);
      const e = byMerchant.get(key) ?? { total: 0, count: 0, holders: new Set() };
      e.total += r.amountPaise;
      e.count += 1;
      e.holders.add(r.cardholder);
      byMerchant.set(key, e);
    }
    const merchants = [...byMerchant.entries()]
      .map(([name, e]) => ({ name, ...e }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 15);
    return { biggest, merchants };
  }, [data?.rows]);

  if (isLoading)
    return (
      <div className="rounded-2xl border bg-card p-4 shadow-sm">
        <TableSkeleton rows={8} />
      </div>
    );

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl border bg-card p-4 shadow-sm">
        <h2 className="text-lg font-semibold">Top spends</h2>
        <p className="text-sm text-muted-foreground">
          The largest single charges and the merchants taking the most, across all cards.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 @3xl/main:grid-cols-2">
        <div className="overflow-x-auto rounded-2xl border bg-card shadow-sm">
          <p className="border-b px-4 py-3 text-sm font-semibold">Largest charges</p>
          <table className="w-full text-sm">
            <tbody>
              {biggest.map((r, i) => (
                <tr key={r.id} className="border-b last:border-b-0 hover:bg-muted/40">
                  <td className="w-8 px-4 py-2.5 text-muted-foreground">{i + 1}</td>
                  <td className="max-w-56 px-2 py-2.5">
                    <span className="block truncate font-medium" title={r.description}>
                      {r.description}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {r.cardholder} · {r.effectiveDate}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-right font-medium tabular-nums">
                    {formatPaise(r.amountPaise)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="overflow-x-auto rounded-2xl border bg-card shadow-sm">
          <p className="border-b px-4 py-3 text-sm font-semibold">Biggest merchants</p>
          <table className="w-full text-sm">
            <tbody>
              {merchants.map((m, i) => (
                <tr key={m.name} className="border-b last:border-b-0 hover:bg-muted/40">
                  <td className="w-8 px-4 py-2.5 text-muted-foreground">{i + 1}</td>
                  <td className="max-w-56 px-2 py-2.5">
                    <span className="block truncate font-medium" title={m.name}>
                      {m.name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {m.count} charge{m.count === 1 ? "" : "s"} ·{" "}
                      {[...m.holders].slice(0, 3).join(", ")}
                      {m.holders.size > 3 ? "…" : ""}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-right font-medium tabular-nums">
                    {formatPaise(m.total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
