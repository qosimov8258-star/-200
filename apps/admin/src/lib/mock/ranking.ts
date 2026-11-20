/**
 * MOCK backend: kunlik reyting. Haqiqiy backendda bu `daily_ratings`
 * jadvalidagi kunlik "muzlatilgan" natija bo'ladi.
 */
import type { IsoDate, ParticipantStatus } from "../types";
import { getContestData, reelStatusOn, type MockParticipant } from "./contest";
import { readStore, type MockStore } from "./store";

export interface MockRankingEntry {
  participantId: string;
  /** Shu kuni qabul qilingan videolar, yuborilish tartibida (g'olib tekshiruvlari uchun). */
  reelIds: string[];
  /**
   * Reytingda hisoblanadigan video: shu kuni eng ko'p ko'rilgan qabul qilingani (teng bo'lsa —
   * oldinroq yuborilgani). Reyting va g'olib sahifalaridagi havola ham shu.
   */
  topReelId: string;
  /** Shu videoning shu kungi ko'rishlari (videolar ko'rishlari qo'shilmaydi). */
  views: number;
  rank: number;
}

/** Admin o'zgartirgan holat bo'lsa — o'sha, aks holda boshlang'ich holat. */
export function effectiveStatus(participant: MockParticipant, store: MockStore): ParticipantStatus {
  return store.statusOverrides[participant.id] ?? participant.status;
}

/** Reytingda qatnashadigan holatlar: bloklangan va diskvalifikatsiya qilinganlar chiqariladi. */
export function isRankable(status: ParticipantStatus): boolean {
  return status === "ACTIVE" || status === "WARNED";
}

/**
 * `date` kunidagi reyting: ishtirokchining natijasi — shu kuni qabul qilingan va o'chirilmagan
 * videolari ichida eng ko'p ko'rilgan bittasining ko'rishlari (videolar ko'rishlari qo'shilmaydi),
 * kamayish tartibida. Teng bo'lsa — shu videoni oldinroq yuborgan yuqorida (jamoa tasdiqlagan
 * qaror, 17.11.2026; PLAN.md Q15), keyin id bo'yicha.
 *
 * Soddalik uchun ishtirokchining hozirgi holati barcha kunlarga qo'llanadi.
 */
export function computeRanking(date: IsoDate, store: MockStore = readStore()): MockRankingEntry[] {
  const data = getContestData();
  const participantsById = new Map(data.participants.map((item) => [item.id, item]));

  interface Best {
    participantId: string;
    reelIds: string[];
    topReelId: string;
    views: number;
    /** Eng ko'p ko'rilgan video yuborilgan vaqt — ishtirokchilar teng bo'lganda. */
    topSubmittedAt: string;
  }
  const best = new Map<string, Best>();

  for (const reel of data.reels) {
    const participant = participantsById.get(reel.participantId);
    if (
      participant === undefined ||
      !isRankable(effectiveStatus(participant, store)) ||
      reelStatusOn(reel, date) !== "ACCEPTED"
    ) {
      continue;
    }
    const views = reel.viewsByDay.get(date) ?? 0;
    const current = best.get(reel.participantId);
    if (!current) {
      best.set(reel.participantId, {
        participantId: reel.participantId,
        reelIds: [reel.id],
        topReelId: reel.id,
        views,
        topSubmittedAt: reel.submittedAt,
      });
      continue;
    }
    current.reelIds.push(reel.id);
    // Teng bo'lsa — oldinroq yuborilgani qoladi.
    if (views > current.views || (views === current.views && reel.submittedAt < current.topSubmittedAt)) {
      current.topReelId = reel.id;
      current.views = views;
      current.topSubmittedAt = reel.submittedAt;
    }
  }

  return [...best.values()]
    .sort(
      (a, b) =>
        b.views - a.views ||
        a.topSubmittedAt.localeCompare(b.topSubmittedAt) ||
        a.participantId.localeCompare(b.participantId),
    )
    .map((entry, index) => ({
      participantId: entry.participantId,
      reelIds: entry.reelIds,
      topReelId: entry.topReelId,
      views: entry.views,
      rank: index + 1,
    }));
}
