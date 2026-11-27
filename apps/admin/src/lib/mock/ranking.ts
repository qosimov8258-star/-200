/**
 * MOCK backend: kunlik reyting. Haqiqiy backendda bu `daily_ratings`
 * jadvalidagi kunlik "muzlatilgan" natija bo'ladi.
 *
 * Reytingda har bir qabul qilingan video alohida qator (`computeVideoRanking`): ishtirokchi
 * bir necha marta uchrashi mumkin. Ishtirokchining o'rni — eng ko'p ko'rilgan videosining shu
 * reytingdagi o'rni (`computeRanking`), shuning uchun ishtirokchilar o'rinlari oralab ketishi
 * mumkin (1, 4, 5…). Sovg'alar, g'olib va random tanlov esa ishtirokchi bo'yicha.
 */
import type { IsoDate, ParticipantStatus } from "../types";
import { getContestData, reelStatusOn, type MockParticipant, type MockReel } from "./contest";
import { readStore, type MockStore } from "./store";

/** Reytingdagi bitta qator — bitta video. */
export interface MockVideoRankingEntry {
  reelId: string;
  participantId: string;
  /** Shu videoning shu kungi ko'rishlari. */
  views: number;
  /** Qatorning o'rni (1..N, takrorlanmaydi). */
  rank: number;
}

/** Ishtirokchi bo'yicha natija (g'olib, target, ega bo'limi va boshqalar uchun). */
export interface MockRankingEntry {
  participantId: string;
  /** Shu kuni qabul qilingan videolar, yuborilish tartibida (g'olib tekshiruvlari uchun). */
  reelIds: string[];
  /**
   * Ishtirokchining eng ko'p ko'rilgan qabul qilingan videosi (teng bo'lsa — oldinroq
   * yuborilgani). G'olib sahifasidagi havola ham shu.
   */
  topReelId: string;
  /** Shu videoning shu kungi ko'rishlari (videolar ko'rishlari qo'shilmaydi). */
  views: number;
  /** Shu videoning video reytingidagi o'rni (`computeVideoRanking`). */
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

interface RankedReel {
  reel: MockReel;
  views: number;
  rank: number;
}

/**
 * `date` kunidagi video reytingi: reytingda qatnashadigan ishtirokchilarning shu kuni qabul
 * qilingan va o'chirilmagan barcha videolari, ko'rishlar kamayishi bo'yicha. Teng bo'lsa —
 * oldinroq yuborilgan video yuqorida (jamoa tasdiqlagan qaror, 17.11.2026; PLAN.md Q15), keyin
 * ishtirokchi id, keyin shortcode bo'yicha.
 *
 * Soddalik uchun ishtirokchining hozirgi holati barcha kunlarga qo'llanadi.
 */
function rankReels(date: IsoDate, store: MockStore): RankedReel[] {
  const data = getContestData();
  const participantsById = new Map(data.participants.map((item) => [item.id, item]));

  const accepted: Array<{ reel: MockReel; views: number }> = [];
  for (const reel of data.reels) {
    const participant = participantsById.get(reel.participantId);
    if (
      participant === undefined ||
      !isRankable(effectiveStatus(participant, store)) ||
      reelStatusOn(reel, date) !== "ACCEPTED"
    ) {
      continue;
    }
    accepted.push({ reel, views: reel.viewsByDay.get(date) ?? 0 });
  }

  return accepted
    .sort(
      (a, b) =>
        b.views - a.views ||
        a.reel.submittedAt.localeCompare(b.reel.submittedAt) ||
        a.reel.participantId.localeCompare(b.reel.participantId) ||
        a.reel.shortcode.localeCompare(b.reel.shortcode),
    )
    .map((item, index) => ({ ...item, rank: index + 1 }));
}

/** `date` kunidagi reyting: har bir qabul qilingan video — alohida qator (`rankReels`). */
export function computeVideoRanking(
  date: IsoDate,
  store: MockStore = readStore(),
): MockVideoRankingEntry[] {
  return rankReels(date, store).map(({ reel, views, rank }) => ({
    reelId: reel.id,
    participantId: reel.participantId,
    views,
    rank,
  }));
}

/**
 * `date` kunidagi ishtirokchilar tartibi: har biri eng ko'p ko'rilgan videosi bo'yicha (videolar
 * ko'rishlari qo'shilmaydi), `rank` — shu videoning video reytingidagi o'rni. Tartib video
 * reytingidagi bilan bir xil: ishtirokchining birinchi uchragan qatori — uning eng yaxshi videosi.
 */
export function computeRanking(date: IsoDate, store: MockStore = readStore()): MockRankingEntry[] {
  const ranked = rankReels(date, store);
  const entries = new Map<string, MockRankingEntry>();
  const submittedAt = new Map<string, string>();

  // Oferta 7.1: ishtirokchining natijasi — barcha qabul qilingan videolari ko'rishlarining yig'indisi.
  for (const { reel, views } of ranked) {
    submittedAt.set(reel.id, reel.submittedAt);
    const entry = entries.get(reel.participantId);
    if (entry) {
      entry.reelIds.push(reel.id);
      entry.views += views;
      continue;
    }
    entries.set(reel.participantId, {
      participantId: reel.participantId,
      reelIds: [reel.id],
      topReelId: reel.id,
      views,
      rank: 0,
    });
  }

  const bySubmission = (a: string, b: string) =>
    (submittedAt.get(a) ?? "").localeCompare(submittedAt.get(b) ?? "") || a.localeCompare(b);
  const first = (entry: MockRankingEntry) => entry.reelIds.map((id) => submittedAt.get(id) ?? "").sort()[0] ?? "";
  return [...entries.values()]
    .map((entry) => ({ ...entry, reelIds: entry.reelIds.sort(bySubmission) }))
    .sort((a, b) => b.views - a.views || first(a).localeCompare(first(b)) || a.participantId.localeCompare(b.participantId))
    .map((entry, i) => ({ ...entry, rank: i + 1 }));
}
