import type { Participant } from "../participants/participants.service";

/**
 * "Ko'rishlarni yangilash" (admin → Foydalanuvchilar): qaysi videolar qayta o'qiladi.
 *
 * Tanlov oxirgi yig'ishdagi ko'rishlar bo'yicha. Shu orada ko'rishlari oshib, pastki chegaradan
 * o'tgan bo'lishi mumkin bo'lganlar tushib qolmasligi uchun `includeNear` — pastki chegara
 * `NEAR_MARGIN` ga pastroqdan olinadi (100 000 → 80 000). Yuqori chegara o'zgarmaydi: ko'rishlar
 * odatda faqat oshadi.
 */
export const NEAR_MARGIN = 0.2;

export interface RefreshRange {
  minViews: number | null;
  maxViews: number | null;
  includeNear: boolean;
}

/** Amalda qo'llanadigan chegaralar (yaqinlar qo'shilgan holda). */
export function effectiveRange(range: RefreshRange): { from: number | null; to: number | null } {
  const from =
    range.minViews === null ? null : range.includeNear ? Math.floor(range.minViews * (1 - NEAR_MARGIN)) : range.minViews;
  return { from, to: range.maxViews };
}

/**
 * Yangilanadiganlar: faol (bloklanmagan, chetlatilmagan) ishtirokchilarning qabul qilingan
 * videolari, oxirgi ma'lum ko'rishlari oraliqda (ikkala chegara ham kiradi).
 */
export function refreshCandidates(participants: readonly Participant[], range: RefreshRange): number[] {
  const { from, to } = effectiveRange(range);
  return participants
    .filter((p) => {
      if (p.status !== "ACTIVE" || !p.firstName || p.reel?.status !== "ACCEPTED") return false;
      const views = p.reel.history.at(-1)?.views ?? 0;
      return (from === null || views >= from) && (to === null || views <= to);
    })
    .map((p) => p.telegramId);
}
