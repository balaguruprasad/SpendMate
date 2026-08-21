"use client";

import { usePathname } from "next/navigation";
import { Search } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { ThemeSwitch } from "@/components/shared/theme-switch";
import { NavUser } from "./nav-user";
import { NotificationBell } from "./notification-bell";
import { ImpersonationBanner } from "./impersonation-banner";
import { navItemForPath } from "@/lib/config/navigation";
import { stripRoleBase } from "@/lib/constants";
import type { UserRole } from "@/types";

function useTitle(pathname: string): string {
  const rest = stripRoleBase(pathname);
  // Nested fee routes would prefix-match the "Fees" nav item — resolve first.
  if (rest.startsWith("fees/students/")) return "Student Fees";
  const item = navItemForPath(pathname);
  if (item) return item.label;
  if (rest === "vendors/new") return "New Vendor";
  if (rest === "invoices/new") return "New Invoice";
  if (rest.startsWith("vendors/")) return "Vendor";
  if (rest.startsWith("invoices/")) return "Invoice";
  return "Dashboard";
}

export function AppTopbar({ role }: { role: UserRole }) {
  const pathname = usePathname();
  const title = useTitle(pathname);

  return (
    // Sticky stack inside the content column: impersonation banner (when active)
    // sits above the topbar. Rendered here — not above the fixed sidebar — so it
    // spans the content width and never gets clipped by the sidebar panel.
    <div className="sticky top-0 z-30">
      <ImpersonationBanner />
      <header className="flex h-16 shrink-0 items-center gap-2 border-b border-border bg-background/85 px-3 backdrop-blur md:px-5">
        <SidebarTrigger className="text-muted-foreground" />
        <Separator orientation="vertical" className="mr-1 hidden h-5 sm:block" />
        <h1 className="truncate text-base font-semibold">{title}</h1>

        <div className="ml-auto flex items-center gap-1 sm:gap-1.5">
          <button
            type="button"
            className="hidden items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted md:flex"
            aria-label="Search"
          >
            <Search className="size-4" />
            <span>Search…</span>
          </button>

          <NotificationBell />

          <ThemeSwitch />

          <NavUser role={role} />
        </div>
      </header>
    </div>
  );
}
