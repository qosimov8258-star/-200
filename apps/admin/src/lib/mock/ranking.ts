/**
 * MOCK backend: kunlik reyting. Haqiqiy backendda bu `daily_ratings`
 * jadvalidagi kunlik "muzlatilgan" natija bo'ladi.
 */
import type { IsoDate, ParticipantStatus } from "../types";
import { getContestData, reelStatusOn, type MockParticipant } from "./contest";
import { readStore, type MockStore } from "./store";

export interface MockRankingEntry {
  participantId: string;
  /** Shu kuni hisobga olingan (qabul qilingan) videolar, yuborilish tartibida. */
  reelIds: string[];
  /** Eng ko'p ko'rishli video — reyting va g'olib sahifalaridagi havola uchun. */
  topReelId: string;
  /** Qabul qilingan videolar ko'rishlari yig'indisi. */
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
 * `date` kunidagi reyting: ishtirokchining ko'rishlari — shu kuni qabul qilingan va
 * o'chirilmagan barcha videolari ko'rishlari yig'indisi (Aksiya qoidalari 7.1, 7.3),
 * kamayish tartibida. Teng bo'lsa — birinchi videosini oldinroq yuborgan yuqorida
 * (jamoa tasdiqlagan qaror, 17.11.2026; PLAN.md Q15).
 *
 * Soddalik uchun ishtirokchining hozirgi holati barcha kunlarga qo'llanadi.
 */
export function computeRanking(date: IsoDate, store: MockStore = readStore()): MockRankingEntry[] {
  const data = getContestData();
  const participantsById = new Map(data.participants.map((item) => [item.id, item]));

  interface Totals {
    participantId: string;
    reelIds: string[];
    topReelId: string;
    topViews: number;
    views: number;
    firstSubmittedOn: IsoDate;
  }
  const totals = new Map<string, Totals>();

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
    const current = totals.get(reel.participantId);
    if (!current) {
      totals.set(reel.participantId, {
        participantId: reel.participantId,
        reelIds: [reel.id],
        topReelId: reel.id,
        topViews: views,
        views,
        firstSubmittedOn: reel.submittedOn,
      });
      continue;
    }
    current.reelIds.push(reel.id);
    current.views += views;
    if (views > current.topViews) {
      current.topReelId = reel.id;
      current.topViews = views;
    }
    if (reel.submittedOn < current.firstSubmittedOn) current.firstSubmittedOn = reel.submittedOn;
  }

  return [...totals.values()]
    .sort(
      (a, b) =>
        b.views - a.views ||
        a.firstSubmittedOn.localeCompare(b.firstSubmittedOn) ||
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
