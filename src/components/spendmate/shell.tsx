"use client";

/**
 * The SpendMate frame, styled after the original Apps Script web app: deep
 * Mesa-green top bar (MESA badge, product title, live presence avatars, user
 * chip), and a white sidebar column. Admins get the tool sections plus a
 * "View as cardholder" list; cardholders get a minimal rail.
 */
import { useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  BarChart3, BellRing, CreditCard, Download, KeyRound, LogOut,
  ReceiptText, ScrollText, Settings2, Trophy, Users, UsersRound,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { ROLE_BASE } from "@/lib/constants";
import { ChangePasswordDialog } from "@/components/layout/change-password-dialog";
import { usePresence, useSpendCards } from "@/features/spend";

const GREEN = "#1e4f39";

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

function NavLink({
  href,
  icon: Icon,
  label,
  active,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
        active ? "bg-[#e7f2ec] font-medium text-[#1e4f39]" : "hover:bg-muted"
      }`}
    >
      <Icon className="size-4 shrink-0" />
      {label}
    </Link>
  );
}

export function SpendShell({ children }: { children: React.ReactNode }) {
  const { user, viewer, logout } = useAuth();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const presence = usePresence();
  const isAdmin = viewer.role === "ADMIN";
  const cardsQuery = useSpendCards();
  const [pwOpen, setPwOpen] = useState(false);
  const base = ROLE_BASE[viewer.role];

  const online = presence.data?.users ?? [];
  const viewingAs = searchParams.get("as");

  // Distinct cardholders (admin sidebar), deactivated cards folded in by label.
  const holders = isAdmin
    ? [...new Map((cardsQuery.data ?? []).map((c) => [c.holderId, c.holderName])).entries()]
        .map(([id, name]) => ({ id, name }))
        .sort((a, b) => a.name.localeCompare(b.name))
    : [];

  const nav: { href: string; icon: LucideIcon; label: string; adminOnly?: boolean }[] = [
    { href: `${base}/charges`, icon: ReceiptText, label: "Transactions" },
    { href: `${base}/months`, icon: BarChart3, label: "Spend by month", adminOnly: true },
    { href: `${base}/top`, icon: Trophy, label: "Top spends", adminOnly: true },
    { href: `${base}/reminders`, icon: BellRing, label: "Reminders", adminOnly: true },
    { href: `${base}/logins`, icon: UsersRound, label: "Who's logged in", adminOnly: true },
  ];
  const adminTools: { href: string; icon: LucideIcon; label: string }[] = [
    { href: `${base}/import`, icon: Download, label: "Import statement" },
    { href: `${base}/cards`, icon: CreditCard, label: "Cards" },
    { href: `${base}/settings`, icon: Settings2, label: "Settings" },
    { href: `${base}/users`, icon: Users, label: "Users" },
    { href: `${base}/audit`, icon: ScrollText, label: "Audit log" },
  ];

  return (
    <div className="flex min-h-svh flex-col bg-[#f4f7f5]">
      {/* Top bar — the Apps Script green header */}
      <header
        className="flex items-center gap-4 px-4 py-3 text-white md:px-6"
        style={{ background: GREEN }}
      >
        <span className="rounded-lg bg-[#a7e0bd] px-3 py-1.5 text-sm font-bold tracking-wide text-[#123527]">
          MESA
        </span>
        <div className="min-w-0">
          <p className="text-lg font-semibold leading-tight">SpendMate</p>
          <p className="truncate text-xs text-white/70">
            Credit card invoices · {isAdmin ? "Admin view" : "Cardholder view"}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-3">
          {/* Presence avatars — like the Sheets avatar stack */}
          <div className="flex items-center">
            <div className="flex -space-x-2">
              {online.slice(0, 5).map((u) => (
                <span
                  key={u.id}
                  title={`${u.name} · ${u.email}`}
                  className="flex size-8 items-center justify-center rounded-full border-2 border-[#1e4f39] bg-[#a7e0bd] text-xs font-semibold text-[#123527]"
                >
                  {initials(u.name)}
                </span>
              ))}
            </div>
            <span className="ml-2 hidden rounded-full bg-white/15 px-2.5 py-1 text-xs md:inline">
              {online.length} here
            </span>
          </div>
          <div className="group relative">
            <button
              type="button"
              className="flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-sm hover:bg-white/25"
            >
              {user.fullName} · {user.email}
            </button>
            <div className="invisible absolute right-0 z-20 mt-1 w-52 rounded-lg border bg-card p-1 text-foreground opacity-0 shadow-md transition-all group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
              <button
                type="button"
                onClick={() => setPwOpen(true)}
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-muted"
              >
                <KeyRound className="size-4" /> Change password
              </button>
              <button
                type="button"
                onClick={() => void logout()}
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-muted"
              >
                <LogOut className="size-4" /> Sign out
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="flex flex-1 gap-4 p-4 md:gap-6 md:p-6">
        {/* Sidebar */}
        <aside className="hidden w-60 shrink-0 flex-col gap-4 md:flex">
          <nav className="flex flex-col gap-0.5 rounded-xl border bg-card p-2 shadow-sm">
            {nav
              .filter((n) => !n.adminOnly || isAdmin)
              .map((n) => (
                <NavLink
                  key={n.href}
                  href={n.href}
                  icon={n.icon}
                  label={n.label}
                  active={pathname.startsWith(n.href) && !viewingAs}
                />
              ))}
          </nav>

          {isAdmin && holders.length > 0 && (
            <div className="rounded-xl border bg-card p-2 shadow-sm">
              <p className="px-3 pb-1 pt-2 text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                View as cardholder
              </p>
              <div className="flex max-h-72 flex-col gap-0.5 overflow-y-auto">
                {holders.map((h) => (
                  <Link
                    key={h.id}
                    href={`${base}/charges?as=${h.id}`}
                    className={`flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-sm transition-colors ${
                      viewingAs === h.id
                        ? "bg-[#e7f2ec] font-medium text-[#1e4f39]"
                        : "hover:bg-muted"
                    }`}
                  >
                    <span className="flex size-6 items-center justify-center rounded-full bg-[#e7f2ec] text-[0.6rem] font-semibold text-[#1e4f39]">
                      {initials(h.name)}
                    </span>
                    <span className="truncate">{h.name}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {isAdmin && (
            <nav className="flex flex-col gap-0.5 rounded-xl border bg-card p-2 shadow-sm">
              <p className="px-3 pb-1 pt-2 text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Admin tools
              </p>
              {adminTools.map((n) => (
                <NavLink
                  key={n.href}
                  href={n.href}
                  icon={n.icon}
                  label={n.label}
                  active={pathname.startsWith(n.href)}
                />
              ))}
            </nav>
          )}
        </aside>

        {/* Content */}
        <main className="@container/main min-w-0 flex-1">{children}</main>
      </div>

      <ChangePasswordDialog open={pwOpen} onOpenChange={setPwOpen} />
    </div>
  );
}
