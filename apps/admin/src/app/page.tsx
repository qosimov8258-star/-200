"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { FullScreenSpinner } from "@/components/ui/spinner";

/**
 * Bosh manzil panelga yo'naltiradi. Sessiya yo'q bo'lsa panel layout'i
 * login sahifasiga, Support roli bo'lsa — Support bo'limiga o'tkazadi.
 *
 * Statik eksportda server `redirect()` ishlamaydi (server yo'q), shuning uchun
 * yo'naltirish brauzerda; `router.replace` `basePath` ni (`/admin`) o'zi qo'shadi.
 */
export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard");
  }, [router]);

  return <FullScreenSpinner label="Yo'naltirilmoqda…" />;
}
