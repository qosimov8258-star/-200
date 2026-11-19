/**
 * Sovg'a ma'lumotlari uchun umumiy qoidalar: chegaralar, tekshiruv va ko'rsatish.
 * Brauzerda tezkor tekshiruv uchun ishlatiladi; yakuniy tekshiruv serverda
 * (hozir mock — `mock/prizes.ts`) xuddi shu qoidalar bilan bo'ladi.
 */
import { formatNumber } from "./format";
import type { Prize, PrizeInput, PrizeKind } from "./types";

export const PRIZE_KINDS: readonly PrizeKind[] = ["MAIN", "MONTHLY"];

export const PRIZE_LIMITS = {
  titleMin: 2,
  titleMax: 120,
  descriptionMax: 500,
  quantityMax: 100_000,
  viewsMax: 1_000_000_000,
} as const;

/** Rasm turlari: JPG, PNG, WebP. */
export const PRIZE_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

/** Tanlanadigan asl rasm hajmi chegarasi (yuklashdan oldin kichraytiriladi). */
export const PRIZE_IMAGE_MAX_SOURCE_BYTES = 15 * 1024 * 1024;

export type PrizeFieldErrors = Partial<Record<keyof PrizeInput, string>>;

function isCount(value: number, max: number): boolean {
  return Number.isInteger(value) && value >= 0 && value <= max;
}

/** Maydonlar bo'yicha xatolar; bo'sh obyekt — hammasi to'g'ri. */
export function validatePrizeInput(input: PrizeInput): PrizeFieldErrors {
  const errors: PrizeFieldErrors = {};
  const title = input.title.trim();

  if (title.length < PRIZE_LIMITS.titleMin) {
    errors.title = "Sovg'a nomini yozing.";
  } else if (title.length > PRIZE_LIMITS.titleMax) {
    errors.title = `Nomi ${PRIZE_LIMITS.titleMax} belgidan oshmasin.`;
  }

  if (input.description.trim().length > PRIZE_LIMITS.descriptionMax) {
    errors.description = `Izoh ${PRIZE_LIMITS.descriptionMax} belgidan oshmasin.`;
  }

  if (!isCount(input.quantity, PRIZE_LIMITS.quantityMax) || input.quantity < 1) {
    errors.quantity = `1 dan ${formatNumber(PRIZE_LIMITS.quantityMax)} gacha butun son.`;
  }

  if (!PRIZE_KINDS.includes(input.kind)) {
    errors.kind = "Sovrin turini tanlang.";
  }

  if (input.minViews !== null && !isCount(input.minViews, PRIZE_LIMITS.viewsMax)) {
    errors.minViews = "Faqat musbat butun son.";
  }
  if (input.maxViews !== null && !isCount(input.maxViews, PRIZE_LIMITS.viewsMax)) {
    errors.maxViews = "Faqat musbat butun son.";
  } else if (
    input.maxViews !== null &&
    input.minViews !== null &&
    !errors.minViews &&
    input.maxViews < input.minViews
  ) {
    errors.maxViews = "\"Gacha\" qiymati \"dan\" qiymatidan kichik bo'lmasin.";
  }

  if (input.imageUrl !== null && input.imageUrl.trim() === "") {
    errors.imageUrl = "Rasm manzili bo'sh.";
  }

  return errors;
}

/** Ko'rishlar sharti: "101 000 – 500 000 ko'rish", "4 000 000 va undan ko'p ko'rish". */
export function formatViewsRange(minViews: number | null, maxViews: number | null): string | null {
  if (minViews !== null && maxViews !== null) {
    return `${formatNumber(minViews)} – ${formatNumber(maxViews)} ko'rish`;
  }
  if (minViews !== null) return `${formatNumber(minViews)} va undan ko'p ko'rish`;
  if (maxViews !== null) return `${formatNumber(maxViews)} tagacha ko'rish`;
  return null;
}

/** Kartadagi qisqa ko'rinish: "101 000 – 500 000", "4 000 000+", "≤ 500 000". */
export function formatViewsRangeShort(minViews: number | null, maxViews: number | null): string | null {
  if (minViews !== null && maxViews !== null) {
    return `${formatNumber(minViews)} – ${formatNumber(maxViews)}`;
  }
  if (minViews !== null) return `${formatNumber(minViews)}+`;
  if (maxViews !== null) return `≤ ${formatNumber(maxViews)}`;
  return null;
}

/** "1 ta", oylik sovrin uchun "300 ta / oy". */
export function formatPrizeQuantity(prize: Pick<Prize, "quantity" | "kind">): string {
  const base = `${formatNumber(prize.quantity)} ta`;
  return prize.kind === "MONTHLY" ? `${base} / oy` : base;
}
