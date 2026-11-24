"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";

import { TopNav } from "@/components/layout/top-nav";
import { QueryProvider } from "@/components/providers/query-provider";
import { Button } from "@/components/ui/button";
import { IosIcon } from "@/components/ui/ios-icon";
import { FullScreenSpinner } from "@/components/ui/spinner";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { canAccess, findNavItem, homePathForRole } from "@/lib/navigation";

/** O'z sarlavhasini (izoh, tugmalar bilan) o'zi chiqaradigan sahifalar. */
const OWN_TITLE_PATHS = ["/dashboard"];

/**
 * Panelning umumiy layout'i: sessiya tekshiruvi, rolga qarab kirish huquqi,
 * tepadagi navigatsiya paneli va sahifa sarlavhasi. Login sahifasi bu layout'dan tashqarida.
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
  const [loggingOut, setLoggingOut] = useState(false);

  const admin = state.status === "authenticated" ? state.admin : null;
  const allowed = admin ? canAccess(admin.role, pathname) : false;
  // Dashboard sarlavhasini o'zi chiqaradi — boshqa sahifalarda shu yerda.
  const ownTitle = OWN_TITLE_PATHS.some((path) => pathname.startsWith(path));
  const pageTitle = ownTitle ? null : (findNavItem(pathname)?.title ?? "Admin panel");

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
        <IosIcon icon={AlertTriangle} tint="orange" size={48} />
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
      <TopNav admin={admin} onLogout={handleLogout} loggingOut={loggingOut} />
      <main className="mx-auto max-w-[1400px] px-4 pt-6 pb-10 sm:px-6 lg:pt-8">
        {pageTitle && <h1 className="mb-6 text-2xl font-semibold tracking-tight text-ink">{pageTitle}</h1>}
        {children}
      </main>
    </div>
  );
}
