import { Car, Plane, Smartphone, Tablet, type LucideIcon } from "lucide-react";

import { formatNumber } from "@/lib/format";
import type { RatingPrizeKind, RatingPrizeTier } from "@/lib/types";
import { WINNER_PATH } from "@/lib/winner-links";

/** Asosiy sovrinlar (oraliqlar ichida random) ikonkalari. */
export const RATING_PRIZE_ICONS: Record<RatingPrizeKind, LucideIcon> = {
  car: Car,
  travel: Plane,
  phone: Smartphone,
  tablet: Tablet,
};

/** "1 ta", "3 ta yo'llanma". */
export function prizeQuantityLabel(tier: Pick<RatingPrizeTier, "quantity" | "unit">): string {
  return `${formatNumber(tier.quantity)} ta${tier.unit ? ` ${tier.unit}` : ""}`;
}

/** Asosiy sovrin tanlovining `prizeId` si: "car" → "main-car" (backend bilan bir xil). */
export function mainPrizeId(kind: RatingPrizeKind): string {
  return `main-${kind}`;
}

/** Bosh sovrin (avtomobil) tanlovi: uning g'olibi xabar bilan emas, "E'lon qilish" orqali tabriklanadi. */
export const CAR_PRIZE_ID = mainPrizeId("car");

/** Avtomobil g'olibi kartasining langari (G'oliblar → "Asosiy sovrinlar"). */
export const CAR_WINNER_ANCHOR = "car-winner";

/** Avtomobil g'olibini tekshirish, tasdiqlash va e'lon qilish joyi. */
export const CAR_WINNER_HREF = `${WINNER_PATH}#${CAR_WINNER_ANCHOR}`;

/** Asosiy sovrin tanlovi natijasining langari ("Asosiy sovrinlar" tabida, `winners-view.tsx`). */
export const MAIN_DRAW_RESULT_ANCHOR = "main-draw-result";

/** Voucher tanlovi natijasining sarlavhasi ("Voucher" tabida, `voucher-tab.tsx`). */
export const VOUCHER_DRAW_ANCHOR = "voucher-draw-title";

/** Baraban shu sovrin tanlangan holda: `/winner?prize=main-car#baraban`. */
export function drumHref(prizeKey: string): string {
  return `${WINNER_PATH}?prize=${encodeURIComponent(prizeKey)}#baraban`;
}

/**
 * Havolaga barabandagi tanlangan sovrinni (`?prize=`) qo'shadi — boshqa joyga o'tilganda tepadagi
 * baraban boshqa sovringa o'tib ketmasin. `#langar` bo'lsa, oxirida qoladi.
 */
export function withDrumPrize(href: string, prize: string | null | undefined): string {
  if (!prize) return href;
  const hashAt = href.indexOf("#");
  const path = hashAt < 0 ? href : href.slice(0, hashAt);
  const hash = hashAt < 0 ? "" : href.slice(hashAt);
  return `${path}${path.includes("?") ? "&" : "?"}prize=${encodeURIComponent(prize)}${hash}`;
}
