import { Car, Plane, Smartphone, Tablet, type LucideIcon } from "lucide-react";

import { formatNumber } from "@/lib/format";
import type { RatingPrizeKind, RatingPrizeTier } from "@/lib/types";

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
