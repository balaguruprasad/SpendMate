import type { LucideIcon } from "lucide-react";
import {
  CreditCard, Download, ReceiptText, ScrollText, Settings2, Users,
} from "lucide-react";
import type { UserRole } from "@/types";
import { ROLE_BASE, SEGMENTS, stripRoleBase } from "@/lib/constants";

export interface NavItem {
  label: string;
  segment: string;
  icon: LucideIcon;
  roles: UserRole[];
  group: string;
}

export const NAV_ITEMS: NavItem[] = [
  { label: "Charges", segment: SEGMENTS.charges, icon: ReceiptText, roles: ["MEMBER", "ADMIN"], group: "SpendMate" },
  { label: "Import", segment: SEGMENTS.importTxns, icon: Download, roles: ["ADMIN"], group: "SpendMate" },
  { label: "Cards", segment: SEGMENTS.cards, icon: CreditCard, roles: ["ADMIN"], group: "Administration" },
  { label: "Settings", segment: SEGMENTS.settings, icon: Settings2, roles: ["ADMIN"], group: "Administration" },
  { label: "Users", segment: SEGMENTS.users, icon: Users, roles: ["ADMIN"], group: "Administration" },
  { label: "Audit Log", segment: SEGMENTS.audit, icon: ScrollText, roles: ["ADMIN"], group: "Administration" },
];

export function navForRole(role: UserRole): NavItem[] {
  return NAV_ITEMS.filter((i) => i.roles.includes(role));
}

export function hrefFor(role: UserRole, item: NavItem): string {
  return `${ROLE_BASE[role]}/${item.segment}`;
}

export function navItemForPath(pathname: string): NavItem | undefined {
  const rest = stripRoleBase(pathname);
  return NAV_ITEMS.find((i) => rest === i.segment || rest.startsWith(`${i.segment}/`));
}

export const ROLE_LABEL: Record<UserRole, string> = {
  MEMBER: "Cardholder",
  ADMIN: "Admin",
};

export const ROLE_WORKSPACE: Record<UserRole, string> = {
  MEMBER: "Cardholder",
  ADMIN: "Spend Admin",
};
