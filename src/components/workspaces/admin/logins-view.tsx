"use client";

/**
 * Who's logged in — the presence panel: a live "here right now" avatar strip
 * (like the Sheets avatar bar) plus every user's last sign-in.
 */
import { TableSkeleton } from "@/components/shared/loading";
import { useLoginActivity, usePresence } from "@/features/spend";

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

function relative(iso: string | null): string {
  if (!iso) return "never";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

export function LoginsView() {
  const presence = usePresence();
  const { data: rows, isLoading } = useLoginActivity();
  const online = presence.data?.users ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl border bg-card p-4 shadow-sm">
        <h2 className="text-lg font-semibold">Who&apos;s logged in</h2>
        <p className="text-sm text-muted-foreground">
          Live presence (updates every ~25s) and each user&apos;s most recent sign-in.
        </p>
        <div className="mt-3 flex items-center gap-2">
          {online.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nobody else is here right now.</p>
          ) : (
            <>
              <div className="flex -space-x-2">
                {online.map((u) => (
                  <span
                    key={u.id}
                    title={`${u.name} · ${u.email}`}
                    className="flex size-9 items-center justify-center rounded-full border-2 border-card bg-[#1e4f39] text-xs font-semibold text-white"
                  >
                    {initials(u.name)}
                  </span>
                ))}
              </div>
              <span className="text-sm text-muted-foreground">
                {online.length} here now: {online.map((u) => u.name).join(", ")}
              </span>
            </>
          )}
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border bg-card shadow-sm">
        {isLoading ? (
          <div className="p-4">
            <TableSkeleton rows={8} />
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="px-4 py-3 font-medium">User</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Last sign-in</th>
              </tr>
            </thead>
            <tbody>
              {(rows ?? []).map((u) => (
                <tr key={u.id} className="border-b last:border-b-0 hover:bg-muted/40">
                  <td className="px-4 py-2.5">
                    <span className="flex items-center gap-2.5">
                      <span className="relative flex size-8 items-center justify-center rounded-full bg-[#e7f2ec] text-xs font-semibold text-[#1e4f39]">
                        {initials(u.name)}
                        {u.online && (
                          <span className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full border-2 border-card bg-emerald-500" />
                        )}
                      </span>
                      <span>
                        <span className="block font-medium">{u.name}</span>
                        <span className="block text-xs text-muted-foreground">{u.email}</span>
                      </span>
                    </span>
                  </td>
                  <td className="px-4 py-2.5">{u.role === "ADMIN" ? "Admin" : "Cardholder"}</td>
                  <td className="px-4 py-2.5">
                    {u.online ? (
                      <span className="rounded-full bg-[#e7f2ec] px-2.5 py-1 text-xs font-medium text-[#1e4f39]">
                        Online now
                      </span>
                    ) : u.isActive ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <span className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                        Deactivated
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground" title={u.lastLogin ?? ""}>
                    {relative(u.lastLogin)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
