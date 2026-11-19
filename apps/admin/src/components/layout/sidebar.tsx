"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";

import { navItemsForRole, type NavItem } from "@/lib/navigation";
import type { AdminRole } from "@/lib/types";
import { cn } from "@/lib/utils";

import { Logo } from "./logo";

interface SidebarProps {
  role: AdminRole;
  /** Mobil ekranda menyu ochiqmi. */
  open: boolean;
  onClose: () => void;
}

export function Sidebar({ role, open, onClose }: SidebarProps) {
  const pathname = usePathname();
  const items = navItemsForRole(role);
  const readyItems = items.filter((item) => item.ready);
  const upcomingItems = items.filter((item) => !item.ready);

  return (
    <>
      {/* Mobil ekranda menyu ochilganda orqa fon */}
      <div
        className={cn(
          "fixed inset-0 z-30 bg-slate-900/40 transition-opacity lg:hidden",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={onClose}
        aria-hidden
      />

      <aside
        id="admin-sidebar"
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-slate-200 bg-white transition-transform lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-16 items-center justify-between border-b border-slate-200 px-4">
          <Logo />
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 lg:hidden"
            aria-label="Menyuni yopish"
          >
            <X className="size-5" aria-hidden />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Asosiy menyu">
          <ul className="space-y-1">
            {readyItems.map((item) => (
              <li key={item.href}>
                <SidebarLink
                  item={item}
                  active={isActive(pathname, item.href)}
                  onNavigate={onClose}
                />
              </li>
            ))}
          </ul>

          {upcomingItems.length > 0 && (
            <>
              <p className="mt-6 mb-2 px-3 text-xs font-medium tracking-wide text-slate-400 uppercase">
                Tez orada
              </p>
              <ul className="space-y-1">
                {upcomingItems.map((item) => (
                  <li key={item.href}>
                    <UpcomingItem item={item} />
                  </li>
                ))}
              </ul>
            </>
          )}
        </nav>

        <p className="border-t border-slate-200 px-4 py-3 text-xs text-slate-400">
          Reels tanlov · v0.1
        </p>
      </aside>
    </>
  );
}

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

interface SidebarLinkProps {
  item: NavItem;
  active: boolean;
  /** Bandga bosilganda (mobil menyuni yopish uchun). */
  onNavigate: () => void;
}

const ITEM_CLASSES = "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium";

function SidebarLink({ item, active, onNavigate }: SidebarLinkProps) {
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        ITEM_CLASSES,
        "transition-colors",
        active
          ? "bg-brand-50 text-brand-700"
          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
      )}
    >
      <Icon className="size-4.5 shrink-0" aria-hidden />
      <span className="truncate">{item.title}</span>
    </Link>
  );
}

/** Hali qurilmagan bo'lim — bosib bo'lmaydi. */
function UpcomingItem({ item }: { item: NavItem }) {
  const Icon = item.icon;

  return (
    <span
      className={cn(ITEM_CLASSES, "cursor-not-allowed text-slate-400")}
      aria-disabled="true"
      title="Bu bo'lim keyingi bosqichlarda qo'shiladi"
    >
      <Icon className="size-4.5 shrink-0" aria-hidden />
      <span className="truncate">{item.title}</span>
    </span>
  );
}
