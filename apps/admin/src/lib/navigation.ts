import {
  Award,
  CirclePlay,
  ClipboardCheck,
  Crosshair,
  Dices,
  LayoutDashboard,
  LifeBuoy,
  ListOrdered,
  ScrollText,
  Send,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";

import type { AdminRole } from "./types";

export interface NavItem {
  href: string;
  title: string;
  icon: LucideIcon;
  /** Bo'limni ko'ra oladigan rollar (TZ, 2-bo'lim). */
  roles: AdminRole[];
  /** `false` — bo'lim hali qurilmagan, menyuda "tez orada" bo'lib turadi. */
  ready: boolean;
}

/** Navigatsiya bandlari — TZ 6-bo'limidagi admin panel bo'limlari (tartibi — paneldagi tartib). */
export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", title: "Dashboard", icon: LayoutDashboard, roles: ["ADMIN"], ready: true },
  { href: "/users", title: "Foydalanuvchilar", icon: Users, roles: ["ADMIN"], ready: true },
  { href: "/ratings", title: "Reyting", icon: ListOrdered, roles: ["ADMIN"], ready: true },
  { href: "/manual-review", title: "Qo'lda tekshiruv", icon: ClipboardCheck, roles: ["ADMIN"], ready: true },
  { href: "/support", title: "Support", icon: LifeBuoy, roles: ["ADMIN", "SUPPORT"], ready: true },
  { href: "/telegram", title: "Telegram", icon: Send, roles: ["ADMIN"], ready: true },
  { href: "/targets", title: "Target yoqqanlar", icon: Crosshair, roles: ["ADMIN"], ready: true },
  { href: "/stories", title: "Istoriyalar", icon: CirclePlay, roles: ["ADMIN"], ready: true },
  { href: "/draws", title: "Random tanlov", icon: Dices, roles: ["ADMIN"], ready: true },
  { href: "/winner", title: "G'olib", icon: Award, roles: ["ADMIN"], ready: true },
  { href: "/settings", title: "Sozlamalar", icon: Settings, roles: ["ADMIN"], ready: true },
  { href: "/audit-log", title: "Audit log", icon: ScrollText, roles: ["ADMIN"], ready: true },
];

export const ROLE_LABELS: Record<AdminRole, string> = {
  ADMIN: "Admin",
  SUPPORT: "Support operatori",
};

/** Joriy yo'lga mos menyu bandi. */
export function findNavItem(pathname: string): NavItem | undefined {
  return NAV_ITEMS.find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
}

/** Rol uchun ko'rinadigan menyu bandlari. */
export function navItemsForRole(role: AdminRole): NavItem[] {
  return NAV_ITEMS.filter((item) => item.roles.includes(role));
}

/** Kirgandan keyin ochiladigan birinchi sahifa. */
export function homePathForRole(role: AdminRole): string {
  return role === "SUPPORT" ? "/support" : "/dashboard";
}

/** Rol shu yo'lni ochishi mumkinmi. */
export function canAccess(role: AdminRole, pathname: string): boolean {
  const item = findNavItem(pathname);
  return item ? item.ready && item.roles.includes(role) : false;
}
