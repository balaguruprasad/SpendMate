"use client";

/**
 * Reminders — like the original app: "Send to everyone pending", the weekly
 * auto-reminder toggle (Mondays ~9:00 IST), last-sent line, and a grid of
 * per-person tick cards with Select-all / Clear / Send-to-selected.
 */
import { useMemo, useState } from "react";
import { BellRing } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TableSkeleton } from "@/components/shared/loading";
import {
  useReminderInfo,
  useSendReminders,
  useSetWeeklyReminders,
  useSpendTransactions,
} from "@/features/spend";

export function RemindersView() {
  const { data, isLoading } = useSpendTransactions();
  const { data: info } = useReminderInfo();
  const send = useSendReminders();
  const weekly = useSetWeeklyReminders();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const people = useMemo(() => {
    const by = new Map<string, { id: string | null; name: string; pending: number }>();
    for (const r of data?.rows ?? []) {
      if (!r.cardholderId) continue;
      const key = r.cardholder;
      const e = by.get(key) ?? { id: r.cardholderId, name: key, pending: 0 };
      if (r.pending) e.pending += 1;
      by.set(key, e);
    }
    return [...by.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [data?.rows]);

  const pendingPeople = people.filter((p) => p.pending > 0 && p.id);

  function toggle(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const lastSent = info?.lastRun
    ? `Last sent: ${new Date(info.lastRun.at).toLocaleString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })} — sent to ${info.lastRun.sent}`
    : "No reminders sent yet";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 rounded-2xl border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-center gap-4">
          <Button
            className="bg-[#1e4f39] text-white hover:bg-[#173d2c]"
            loading={send.isPending}
            disabled={pendingPeople.length === 0}
            onClick={() => send.mutate([])}
          >
            <BellRing className="size-4" /> Send to everyone pending
          </Button>
          <p className="text-sm">
            Weekly auto-reminder is{" "}
            <span className="font-bold">{info?.weeklyOn ? "ON" : "OFF"}</span>
          </p>
          <Button
            variant="outline"
            size="sm"
            loading={weekly.isPending}
            onClick={() => weekly.mutate(!info?.weeklyOn)}
          >
            {info?.weeklyOn ? "Turn off" : "Turn on"}
          </Button>
          <p className="ml-auto text-sm text-muted-foreground">{lastSent}</p>
        </div>

        <div>
          <p className="text-base font-semibold">
            Send to specific people{" "}
            <span className="text-sm font-normal text-muted-foreground">
              tick who to remind, then send — only people with pending charges can be selected
            </span>
          </p>
        </div>

        {isLoading ? (
          <TableSkeleton rows={4} />
        ) : (
          <div className="grid grid-cols-1 gap-3 @xl/main:grid-cols-2 @4xl/main:grid-cols-4">
            {people.map((p) => {
              const selectable = p.pending > 0 && p.id;
              const on = p.id ? selected.has(p.id) : false;
              return (
                <label
                  key={p.name}
                  className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2.5 ${
                    selectable ? "cursor-pointer hover:bg-muted/50" : "opacity-60"
                  } ${on ? "border-[#1e4f39] bg-[#e7f2ec]/60" : ""}`}
                >
                  <span className="flex min-w-0 items-center gap-2.5">
                    <input
                      type="checkbox"
                      className="size-4 shrink-0 accent-[#1e4f39]"
                      disabled={!selectable}
                      checked={on}
                      onChange={() => p.id && toggle(p.id)}
                    />
                    <span className="truncate text-sm font-medium">{p.name}</span>
                  </span>
                  {p.pending > 0 ? (
                    <span className="shrink-0 rounded-full bg-[#fdf3df] px-2.5 py-0.5 text-xs font-medium text-[#8a6116]">
                      {p.pending} pending
                    </span>
                  ) : (
                    <span className="shrink-0 rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">
                      all done
                    </span>
                  )}
                </label>
              );
            })}
          </div>
        )}

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSelected(new Set(pendingPeople.map((p) => p.id!)))}
          >
            Select all pending
          </Button>
          <Button variant="outline" size="sm" onClick={() => setSelected(new Set())}>
            Clear
          </Button>
          <Button
            className="ml-auto bg-[#1e4f39] text-white hover:bg-[#173d2c]"
            disabled={selected.size === 0}
            loading={send.isPending}
            onClick={() => send.mutate([...selected], { onSuccess: () => setSelected(new Set()) })}
          >
            Send to selected
          </Button>
        </div>
      </div>
    </div>
  );
}
