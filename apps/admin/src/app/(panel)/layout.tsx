"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";

import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";
import { QueryProvider } from "@/components/providers/query-provider";
import { Button } from "@/components/ui/button";
import { FullScreenSpinner } from "@/components/ui/spinner";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { canAccess, homePathForRole } from "@/lib/navigation";

/**
 * Panelning umumiy layout'i: sessiya tekshiruvi, rolga qarab kirish huquqi,
 * yon menyu va sarlavha. Login sahifasi bu layout'dan tashqarida.
 */
export default function PanelLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <QueryProvider>
      <AuthProvider>
        <PanelShell>{children}</PanelShell>
      </AuthProvider>
    </QueryProvider>
  );
}

function PanelShell({ children }: { children: React.ReactNode }) {
  const { state, reload, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const admin = state.status === "authenticated" ? state.admin : null;
  const allowed = admin ? canAccess(admin.role, pathname) : false;

  // Sessiya yo'q — login sahifasiga (qaytish manzili bilan).
  useEffect(() => {
    if (state.status === "unauthenticated" && !loggingOut) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [state.status, loggingOut, pathname, router]);

  // Rolga ruxsat etilmagan bo'lim — rolning bosh sahifasiga.
  useEffect(() => {
    if (admin && !allowed) {
      router.replace(homePathForRole(admin.role));
    }
  }, [admin, allowed, router]);

  async function handleLogout() {
    setLoggingOut(true);
    await logout();
    router.replace("/login");
  }

  if (state.status === "error") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
        <AlertTriangle className="size-8 text-amber-500" aria-hidden />
        <p className="text-sm text-slate-600">{state.message}</p>
        <Button variant="secondary" onClick={reload}>
          Qayta urinish
        </Button>
      </div>
    );
  }

  if (state.status === "loading") {
    return <FullScreenSpinner />;
  }

  if (!admin) {
    return <FullScreenSpinner label="Login sahifasiga yo'naltirilmoqda…" />;
  }

  if (!allowed) {
    return <FullScreenSpinner label="Yo'naltirilmoqda…" />;
  }

  return (
    <div className="min-h-screen">
      <Sidebar role={admin.role} open={menuOpen} onClose={() => setMenuOpen(false)} />

      <div className="lg:pl-64">
        <Header
          admin={admin}
          onMenuClick={() => setMenuOpen(true)}
          onLogout={handleLogout}
          loggingOut={loggingOut}
        />
        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">{children}</main>
      </div>
    </div>
  );
}
