"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { FullScreenSpinner } from "@/components/ui/spinner";
import { voucherTabHref, WINNER_PATH } from "@/lib/winner-links";

/**
 * `/draws?id=X` → `/winner?tab=voucher&draw=X`, `/draws` → `/winner?tab=voucher`.
 * Eski `?prize=car|travel|phone|tablet` (asosiy sovrinlar) → "Asosiy sovrinlar" tabi.
 * Statik eksportda server `redirect()` yo'q — yo'naltirish brauzerda; `router.replace`
 * `basePath` ni (`/admin`) o'zi qo'shadi.
 */
export function DrawsRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = searchParams.get("id");
  const prize = searchParams.get("prize");

  useEffect(() => {
    router.replace(!id && prize ? WINNER_PATH : voucherTabHref(id));
  }, [router, id, prize]);

  return <FullScreenSpinner label="Yo'naltirilmoqda…" />;
}
