"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { AppBrand } from "./brand";
import { navForRole, hrefFor, ROLE_WORKSPACE } from "@/lib/config/navigation";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/types";

export function AppSidebar({ role }: { role: UserRole }) {
  const pathname = usePathname();
  const items = navForRole(role);

  // Preserve declared order while grouping by the nav group label.
  const groups: string[] = [];
  for (const item of items) {
    if (!groups.includes(item.group)) groups.push(item.group);
  }

  return (
    <Sidebar collapsible="icon" variant="inset">
      <SidebarHeader className="h-16 justify-center px-2.5">
        <AppBrand workspace={ROLE_WORKSPACE[role]} />
      </SidebarHeader>

      <SidebarContent className="px-1.5">
        {groups.map((group) => (
          <SidebarGroup key={group}>
            <SidebarGroupLabel>{group}</SidebarGroupLabel>
            <SidebarMenu>
              {items
                .filter((i) => i.group === group)
                .map((item) => {
                  const href = hrefFor(role, item);
                  const active =
                    pathname === href || pathname.startsWith(`${href}/`);
                  const Icon = item.icon;
                  return (
                    <SidebarMenuItem key={item.segment}>
                      <SidebarMenuButton
                        asChild
                        isActive={active}
                        tooltip={item.label}
                        className={cn(
                          "data-[active=true]:bg-sidebar-primary/10 data-[active=true]:font-medium",
                          active &&
                            "data-[active=true]:text-sidebar-accent-foreground",
                        )}
                      >
                        <Link href={href}>
                          <Icon
                            className={cn(
                              active && "text-sidebar-primary",
                            )}
                          />
                          <span>{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
            </SidebarMenu>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="px-3 pb-3 text-[0.6875rem] text-muted-foreground group-data-[collapsible=icon]:hidden">
        Mesa School · Internal
      </SidebarFooter>
    </Sidebar>
  );
}
