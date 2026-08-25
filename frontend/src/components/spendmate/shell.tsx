"use client";

/**
 * The SpendMate frame, styled after the original Apps Script web app: deep
 * Mesa-green top bar (MESA badge, product title, live presence avatars, user
 * chip), and a white sidebar column. Admins get the tool sections plus a
 * "View as cardholder" list; cardholders get a minimal rail.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useRouter } from "next/navigation";
import {
  BarChart3, BellRing, ClipboardCheck, CreditCard, Download, Eye, FileSpreadsheet,
  KeyRound, Landmark, LogOut, PanelLeftClose, PanelLeftOpen, ReceiptText,
  Settings2, Trophy, Users, UsersRound,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { LogoMark } from "@/components/layout/brand";
import { ROLE_BASE } from "@/lib/constants";
import { toast } from "@/lib/toast";
import { ChangePasswordDialog } from "@/components/layout/change-password-dialog";
import { usePresence, useSpendMe } from "@/features/spend";

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
  collapsed,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  active: boolean;
  collapsed: boolean;
}) {
  return (
    <Link
      href={href}
      title={collapsed ? label : undefined}
      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
        collapsed ? "justify-center px-2" : ""
      } ${active ? "bg-[#e7f2ec] font-medium text-[#1e4f39]" : "hover:bg-muted"}`}
    >
      <Icon className="size-4 shrink-0" />
      {!collapsed && label}
    </Link>
  );
}

export function SpendShell({ children }: { children: React.ReactNode }) {
  const { user, viewer, logout, isImpersonating, realUser, stopImpersonating } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const presence = usePresence();
  const { data: me } = useSpendMe();
  const hasCards = (me?.myCards.length ?? 0) > 0;
  const isAdmin = viewer.role === "ADMIN";
  const [pwOpen, setPwOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const base = ROLE_BASE[viewer.role];

  useEffect(() => {
    setCollapsed(localStorage.getItem("spend.sidebar") === "collapsed");
  }, []);
  function toggleSidebar() {
    setCollapsed((c) => {
      localStorage.setItem("spend.sidebar", c ? "open" : "collapsed");
      return !c;
    });
  }

  const online = presence.data?.users ?? [];
  const viewingAs = searchParams.get("as");

  const nav: { href: string; icon: LucideIcon; label: string; adminOnly?: boolean }[] = [
    { href: `${base}/charges`, icon: ReceiptText, label: "Transactions" },
    { href: `${base}/months`, icon: BarChart3, label: "Spend by month", adminOnly: true },
    { href: `${base}/top`, icon: Trophy, label: "Top spends", adminOnly: true },
    { href: `${base}/reminders`, icon: BellRing, label: "Reminders", adminOnly: true },
    { href: `${base}/settlements`, icon: Landmark, label: "Settlements", adminOnly: true },
    { href: `${base}/review`, icon: ClipboardCheck, label: "Review", adminOnly: true },
    { href: `${base}/logins`, icon: UsersRound, label: "Who's logged in", adminOnly: true },
  ];
  const adminTools: { href: string; icon: LucideIcon; label: string }[] = [
    { href: `${base}/import`, icon: Download, label: "Import statement" },
    { href: `${base}/reports`, icon: FileSpreadsheet, label: "Reports" },
    { href: `${base}/cards`, icon: CreditCard, label: "Cards" },
    { href: `${base}/settings`, icon: Settings2, label: "Settings" },
    { href: `${base}/users`, icon: Users, label: "Users" },
  ];

  return (
    <div className="flex min-h-svh flex-col bg-[#f4f7f5]">
      {/* Top bar — the Apps Script green header */}
      <header
        className="sticky top-0 z-40 flex items-center gap-4 px-4 py-3 text-white shadow-md md:px-6"
        style={{ background: GREEN }}
      >
        {/* Mesa "m" mark — white tile, header green shows through the m. */}
        <LogoMark className="size-9 shrink-0 bg-white" />
        <div className="min-w-0">
          <p className="text-lg font-semibold leading-tight">SpendMate</p>
          <p className="truncate text-xs text-white/70">
            Credit card invoices · {isAdmin ? "Admin view" : hasCards ? "Cardholder view" : "Helper view"}
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

      {/* Impersonation strip — the "View as" from Users switches the whole
          session to the target, so the exit must live in the shell. */}
      {isImpersonating && (
        <div className="sticky top-[3.75rem] z-30 flex items-center gap-3 border-b border-[#8a6116]/30 bg-[#fdf3df] px-4 py-2 text-sm text-[#5b430f] md:px-6">
          <Eye className="size-4 shrink-0" />
          <p className="min-w-0 flex-1 truncate">
            Viewing as <span className="font-semibold">{user.fullName}</span>
            {realUser ? ` — signed in from ${realUser.fullName}'s admin account.` : "."}
          </p>
          <button
            type="button"
            className="shrink-0 rounded-full border border-[#8a6116]/40 px-3 py-1 font-medium hover:bg-[#8a6116]/10"
            onClick={() => {
              void (async () => {
                try {
                  await stopImpersonating();
                  toast.success("Back to your admin account.");
                  router.push("/admin/charges");
                } catch {
                  toast.error("Could not exit — please try again.");
                }
              })();
            }}
          >
            Exit view as
          </button>
        </div>
      )}

      <div className="flex flex-1 gap-4 p-4 md:gap-6 md:p-6">
        {/* Sidebar — expandable/collapsible */}
        <aside
          className={`hidden shrink-0 flex-col gap-4 transition-all md:flex ${
            collapsed ? "w-14" : "w-60"
          }`}
        >
          <nav className="flex flex-col gap-0.5 rounded-xl border bg-card p-2 shadow-sm">
            <button
              type="button"
              onClick={toggleSidebar}
              title={collapsed ? "Expand sidebar" : "Compress sidebar"}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted ${
                collapsed ? "justify-center px-2" : ""
              }`}
            >
              {collapsed ? (
                <PanelLeftOpen className="size-4 shrink-0" />
              ) : (
                <>
                  <PanelLeftClose className="size-4 shrink-0" /> Compress
                </>
              )}
            </button>
            {nav
              .filter((n) => !n.adminOnly || isAdmin)
              .map((n) => (
                <NavLink
                  key={n.href}
                  href={n.href}
                  icon={n.icon}
                  label={n.label}
                  active={pathname.startsWith(n.href) && !viewingAs}
                  collapsed={collapsed}
                />
              ))}
          </nav>

          {isAdmin && (
            <nav className="flex flex-col gap-0.5 rounded-xl border bg-card p-2 shadow-sm">
              {!collapsed && (
                <p className="px-3 pb-1 pt-2 text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Admin tools
                </p>
              )}
              {adminTools.map((n) => (
                <NavLink
                  key={n.href}
                  href={n.href}
                  icon={n.icon}
                  label={n.label}
                  active={pathname.startsWith(n.href)}
                  collapsed={collapsed}
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
