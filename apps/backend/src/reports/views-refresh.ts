import { acceptedReels, participantViews, type Participant } from "../participants/participants.service";

/**
 * "Ko'rishlarni yangilash" (admin → Foydalanuvchilar): qaysi ishtirokchilarning videolari qayta
 * o'qiladi.
 *
 * Tanlov ishtirokchining oxirgi yig'ishdagi ko'rishlari bo'yicha (barcha qabul qilingan videolari
 * yig'indisi — reyting va filtr bilan bir xil). Shu orada ko'rishlari oshib, pastki chegaradan
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
 * Yangilanadiganlar: faol (bloklanmagan, chetlatilmagan), kamida bitta qabul qilingan videosi bor
 * ishtirokchilar, ko'rishlari yig'indisi oraliqda (ikkala chegara ham kiradi). `videos` — shu
 * ishtirokchilarning qayta o'qiladigan videolari soni (Apify narxi shunga qarab).
 */
export function refreshCandidates(participants: readonly Participant[], range: RefreshRange): { ids: number[]; videos: number } {
  const { from, to } = effectiveRange(range);
  const picked = participants.filter((p) => {
    if (p.status !== "ACTIVE" || !p.firstName || acceptedReels(p).length === 0) return false;
    const views = participantViews(p);
    return (from === null || views >= from) && (to === null || views <= to);
  });
  return {
    ids: picked.map((p) => p.telegramId),
    videos: picked.reduce((sum, p) => sum + acceptedReels(p).length, 0),
  };
}
