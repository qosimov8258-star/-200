import type { Metadata } from "next";

import { OwnerScreen } from "@/components/owner/owner-screen";

export const metadata: Metadata = {
  // Brauzer tabida ham hech narsa oshkor bo'lmasin.
  title: "Kirish",
};

/**
 * Tashkilot egalari uchun yashirin bo'lim — admin panel layout'idan (`(panel)`) tashqarida:
 * admin sessiyasini talab qilmaydi, o'z kirish formasi bor. Kirish yo'li: tepadagi Olivia
 * logotipini ketma-ket 7 marta bosish (`components/layout/top-nav.tsx`).
 */
export default function OwnerPage() {
  return <OwnerScreen />;
}
