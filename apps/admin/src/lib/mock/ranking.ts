/**
 * MOCK backend: kunlik reyting. Haqiqiy backendda bu `daily_ratings`
 * jadvalidagi kunlik "muzlatilgan" natija bo'ladi.
 */
import type { IsoDate, ParticipantStatus } from "../types";
import { getContestData, reelStatusOn, type MockParticipant } from "./contest";
import { readStore, type MockStore } from "./store";

export interface MockRankingEntry {
  participantId: string;
  reelId: string;
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
 * `date` kunidagi reyting: qabul qilingan va o'chirilmagan Reellar ko'rishlar
 * bo'yicha kamayish tartibida. Teng bo'lsa — Reelni oldinroq yuborgan yuqorida
 * (jamoa tasdiqlagan qaror, 17.11.2026; PLAN.md Q15).
 *
 * Soddalik uchun ishtirokchining hozirgi holati barcha kunlarga qo'llanadi.
 */
export function computeRanking(date: IsoDate, store: MockStore = readStore()): MockRankingEntry[] {
  const data = getContestData();
  const participantsById = new Map(data.participants.map((item) => [item.id, item]));

  const entries = data.reels
    .filter((reel) => {
      const participant = participantsById.get(reel.participantId);
      return (
        participant !== undefined &&
        isRankable(effectiveStatus(participant, store)) &&
        reelStatusOn(reel, date) === "ACCEPTED"
      );
    })
    .map((reel) => ({
      participantId: reel.participantId,
      reelId: reel.id,
      views: reel.viewsByDay.get(date) ?? 0,
      submittedOn: reel.submittedOn,
    }))
    .sort(
      (a, b) =>
        b.views - a.views ||
        a.submittedOn.localeCompare(b.submittedOn) ||
        a.participantId.localeCompare(b.participantId),
    );

  return entries.map((entry, index) => ({
    participantId: entry.participantId,
    reelId: entry.reelId,
    views: entry.views,
    rank: index + 1,
  }));
}
