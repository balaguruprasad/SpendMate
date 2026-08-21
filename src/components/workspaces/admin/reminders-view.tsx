"use client";

/**
 * Reminders — who still owes invoices, with per-person selection and a
 * one-click nudge (in-app notification; email joins in prod once SMTP is
 * configured). Shows the last run, like the old app.
 */
import { useMemo, useState } from "react";
import { BellRing } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TableSkeleton } from "@/components/shared/loading";
import {
  formatPaise,
  useReminderInfo,
  useSendReminders,
  useSpendTransactions,
} from "@/features/spend";

export function RemindersView() {
  const { data, isLoading } = useSpendTransactions();
  const { data: info } = useReminderInfo();
  const send = useSendReminders();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const people = useMemo(() => {
    const by = new Map<string, { id: string; name: string; count: number; total: number }>();
    for (const r of data?.rows ?? []) {
      if (!r.pending || !r.cardholderId) continue;
      const e = by.get(r.cardholderId) ?? {
        id: r.cardholderId,
        name: r.cardholder,
        count: 0,
        total: 0,
      };
      e.count += 1;
      e.total += r.amountPaise;
      by.set(r.cardholderId, e);
    }
    return [...by.values()].sort((a, b) => b.count - a.count);
  }, [data?.rows]);

  function toggle(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border bg-card p-4 shadow-sm">
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold">Reminders</h2>
          <p className="text-sm text-muted-foreground">
            Nudge cardholders with pending charges. Select rows to remind only some people;
            nobody selected = everyone below.
            {info?.lastRun && (
              <span className="ml-1">
                Last sent {info.lastRun.at.slice(0, 16).replace("T", " ")} to {info.lastRun.sent}{" "}
                people.
              </span>
            )}
          </p>
        </div>
        <Button
          className="bg-[#1e4f39] text-white hover:bg-[#173d2c]"
          loading={send.isPending}
          disabled={people.length === 0}
          onClick={() =>
            send.mutate([...selected], { onSuccess: () => setSelected(new Set()) })
          }
        >
          <BellRing className="size-4" />
          Send reminders{selected.size > 0 ? ` (${selected.size})` : " to everyone"}
        </Button>
      </div>

      <div className="overflow-x-auto rounded-2xl border bg-card shadow-sm">
        {isLoading ? (
          <div className="p-4">
            <TableSkeleton rows={6} />
          </div>
        ) : people.length === 0 ? (
          <p className="px-4 py-10 text-center text-muted-foreground">
            Nobody has pending charges — nothing to chase. 🎉
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="w-10 px-4 py-3" />
                <th className="px-4 py-3 font-medium">Cardholder</th>
                <th className="px-4 py-3 text-right font-medium">Pending charges</th>
                <th className="px-4 py-3 text-right font-medium">Pending amount</th>
              </tr>
            </thead>
            <tbody>
              {people.map((p) => (
                <tr key={p.id} className="border-b last:border-b-0 hover:bg-muted/40">
                  <td className="px-4 py-2.5">
                    <input
                      type="checkbox"
                      className="size-4 accent-[#1e4f39]"
                      checked={selected.has(p.id)}
                      onChange={() => toggle(p.id)}
                      aria-label={`Select ${p.name}`}
                    />
                  </td>
                  <td className="px-4 py-2.5 font-medium">{p.name}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-[#8a6116]">{p.count}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{formatPaise(p.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
