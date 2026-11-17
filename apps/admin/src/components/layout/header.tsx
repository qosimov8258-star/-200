"use client";

import { usePathname } from "next/navigation";
import { LogOut, Menu } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { findNavItem, ROLE_LABELS } from "@/lib/navigation";
import type { AdminUser } from "@/lib/types";

interface HeaderProps {
  admin: AdminUser;
  onMenuClick: () => void;
  onLogout: () => void;
  loggingOut: boolean;
}

export function Header({ admin, onMenuClick, onLogout, loggingOut }: HeaderProps) {
  const pathname = usePathname();
  const title = findNavItem(pathname)?.title ?? "Admin panel";

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-6">
      <button
        type="button"
        onClick={onMenuClick}
        className="rounded-md p-1.5 text-slate-600 hover:bg-slate-100 lg:hidden"
        aria-label="Menyuni ochish"
        aria-controls="admin-sidebar"
      >
        <Menu className="size-5" aria-hidden />
      </button>

      <h1 className="min-w-0 flex-1 truncate text-lg font-semibold text-slate-900">{title}</h1>

      <div className="flex items-center gap-3">
        <div className="hidden text-right sm:block">
          <p className="text-sm font-medium text-slate-900">{admin.fullName}</p>
          <Badge tone={admin.role === "ADMIN" ? "brand" : "neutral"}>
            {ROLE_LABELS[admin.role]}
          </Badge>
        </div>
        <Button variant="secondary" size="sm" onClick={onLogout} loading={loggingOut}>
          {!loggingOut && <LogOut className="size-4" aria-hidden />}
          <span>Chiqish</span>
        </Button>
      </div>
    </header>
  );
}
