import { Suspense } from "react";
import type { Metadata } from "next";

import { FullScreenSpinner } from "@/components/ui/spinner";

import { DrawsRedirect } from "./draws-redirect";

export const metadata: Metadata = {
  title: "G'oliblar",
};

/**
 * Eski "Random tanlov" manzili (`/draws`, `/draws?id=…`) — bo'lim endi G'oliblar → "Voucher"
 * tabida. Saqlangan havolalar ishlashi uchun shu yerga yo'naltiriladi. Sahifa panel layout'idan
 * tashqarida: aks holda menyuda yo'q yo'l sifatida bosh sahifaga qaytarilardi.
 */
export default function DrawsPage() {
  // `useSearchParams` (`?id=`) Suspense ichida bo'lishi kerak.
  return (
    <Suspense fallback={<FullScreenSpinner label="Yo'naltirilmoqda…" />}>
      <DrawsRedirect />
    </Suspense>
  );
}
