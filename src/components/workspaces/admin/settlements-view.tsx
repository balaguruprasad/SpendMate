"use client";

/**
 * Settlements — credit-card payment credits ("PAYMENT RECEIVED-AUTODEBIT").
 * These are card bill payments, not spends, so they live here instead of the
 * transactions/analytics views. Month filter + per-month totals.
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

export function SettlementsView() {
  const { data, isLoading } = useSpendTransactions();
  const [month, setMonth] = useState<string>("all");

  const settlements = useMemo(
    () =>
      (data?.rows ?? [])
        .filter((r) => r.settlement)
        .sort((a, b) => (a.effectiveDate < b.effectiveDate ? 1 : -1)),
    [data?.rows],
  );

  const monthKeys = useMemo(
    () => [...new Set(settlements.map((r) => r.effectiveDate.slice(0, 7)))].sort().reverse(),
    [settlements],
  );

  const byMonth = useMemo(() => {
    const by = new Map<string, { total: number; count: number }>();
    for (const r of settlements) {
      const key = r.effectiveDate.slice(0, 7);
      const e = by.get(key) ?? { total: 0, count: 0 };
      e.total += r.amountPaise;
      e.count += 1;
      by.set(key, e);
    }
    return by;
  }, [settlements]);

  const visible = useMemo(
    () =>
      month === "all"
        ? settlements
        : settlements.filter((r) => r.effectiveDate.slice(0, 7) === month),
    [settlements, month],
  );
  const visibleTotal = visible.reduce((s, r) => s + r.amountPaise, 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border bg-card p-4 shadow-sm">
        <div>
          <h2 className="text-lg font-semibold">Settlements</h2>
          <p className="text-sm text-muted-foreground">
            Credit-card bill payments (PAYMENT RECEIVED) — kept out of the spend views.
          </p>
        </div>
        <div className="ml-auto">
          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger size="sm" className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All months</SelectItem>
              {monthKeys.map((k) => (
                <SelectItem key={k} value={k}>
                  {monthLabel(k)}
                </SelectItem>
              ))}
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
          <div className="grid grid-cols-1 gap-4 @xl/main:grid-cols-2">
            <div className="rounded-2xl border bg-[#e7f2ec] p-4 shadow-sm">
              <p className="text-sm text-muted-foreground">
                Settled {month === "all" ? "— all months" : `in ${monthLabel(month)}`}
              </p>
              <p className="text-2xl font-bold tabular-nums">{formatPaise(visibleTotal)}</p>
            </div>
            <div className="rounded-2xl border bg-card p-4 shadow-sm">
              <p className="text-sm text-muted-foreground">Payments</p>
              <p className="text-2xl font-bold tabular-nums">{visible.length}</p>
            </div>
          </div>

          {month === "all" && monthKeys.length > 1 && (
            <div className="overflow-x-auto rounded-2xl border bg-card shadow-sm">
              <p className="border-b px-4 py-3 text-sm font-semibold">Month on month</p>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="px-4 py-2.5 font-medium">Month</th>
                    <th className="px-4 py-2.5 text-right font-medium">Payments</th>
                    <th className="px-4 py-2.5 text-right font-medium">Settled</th>
                  </tr>
                </thead>
                <tbody>
                  {monthKeys.map((k) => (
                    <tr key={k} className="border-b last:border-b-0 hover:bg-muted/40">
                      <td className="px-4 py-2.5 font-medium">{monthLabel(k)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">
                        {byMonth.get(k)?.count ?? 0}
                      </td>
                      <td className="px-4 py-2.5 text-right font-medium tabular-nums">
                        {formatPaise(byMonth.get(k)?.total ?? 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="overflow-x-auto rounded-2xl border bg-card shadow-sm">
            <table className="w-full min-w-[40rem] text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Card</th>
                  <th className="px-4 py-3 font-medium">Cardholder</th>
                  <th className="px-4 py-3 font-medium">Description</th>
                  <th className="px-4 py-3 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => (
                  <tr key={r.id} className="border-b last:border-b-0 hover:bg-muted/40">
                    <td className="whitespace-nowrap px-4 py-2.5">{r.effectiveDate}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 tabular-nums">{r.card}</td>
                    <td className="whitespace-nowrap px-4 py-2.5">{r.cardholder}</td>
                    <td className="max-w-72 truncate px-4 py-2.5" title={r.description}>
                      {r.description}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-right font-medium tabular-nums">
                      {formatPaise(r.amountPaise)}
                    </td>
                  </tr>
                ))}
                {visible.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                      No settlements found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
