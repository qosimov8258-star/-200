/**
 * MOCK backend: kunlik reyting arxivi. Haqiqiy backendda:
 *   GET /api/v1/admin/ratings/daily?date=YYYY-MM-DD&page=&pageSize=
 * va ma'lumot `daily_ratings` jadvalidan olinadi.
 */
import { ApiError } from "../api-error";
import { addDays, clampDate, isIsoDate } from "../dates";
import type { DailyRatingQuery, DailyRatingResponse, RatingEntry } from "../types";
import { getContestData } from "./contest";
import { computeRanking } from "./ranking";
import { effectiveSettings, lastSyncAt } from "./settings";
import { readStore } from "./store";
import { activeTargetParticipants } from "./targets";

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;

export function buildDailyRating(query: DailyRatingQuery): DailyRatingResponse {
  if (query.date !== undefined && !isIsoDate(query.date)) {
    throw new ApiError(400, "Sana noto'g'ri formatda.");
  }

  const data = getContestData();
  const store = readStore();
  const date = clampDate(query.date ?? data.today, data.startsOn, data.today);

  const ranking = computeRanking(date, store);
  const previousRanking =
    date > data.startsOn ? computeRanking(addDays(date, -1), store) : [];
  const previousRankById = new Map(
    previousRanking.map((entry) => [entry.participantId, entry.rank]),
  );
  const previousViewsById = new Map(
    previousRanking.map((entry) => [entry.participantId, entry.views]),
  );

  const participantsById = new Map(data.participants.map((item) => [item.id, item]));
  const reelsById = new Map(data.reels.map((reel) => [reel.id, reel]));
  const targetParticipants = activeTargetParticipants(store, date);
  const { syncTime } = effectiveSettings(store);

  const entries: RatingEntry[] = ranking.map((entry) => {
    const participant = participantsById.get(entry.participantId);
    const topReel = reelsById.get(entry.topReelId);
    // O'sish — natijaning o'zgarishi: shu kungi eng ko'p ko'rilgan video ko'rishlari minus oldingi
    // kungisi (oldingi kun boshqa video eng ko'p ko'rilgan bo'lishi mumkin; reytingda yo'q — 0).
    const viewsGrowth = entry.views - (previousViewsById.get(entry.participantId) ?? 0);
    return {
      rank: entry.rank,
      participantId: entry.participantId,
      firstName: participant?.firstName ?? "",
      lastName: participant?.lastName ?? "",
      instagramUsername: topReel?.owner ?? participant?.instagramUsername ?? null,
      reelUrl: topReel?.url ?? "",
      views: entry.views,
      viewsGrowth,
      previousRank: previousRankById.get(entry.participantId) ?? null,
      hasTarget: targetParticipants.has(entry.participantId),
    };
  });

  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, query.pageSize ?? DEFAULT_PAGE_SIZE));
  const lastPage = Math.max(1, Math.ceil(entries.length / pageSize));
  const page = Math.min(lastPage, Math.max(1, query.page ?? 1));

  return {
    items: entries.slice((page - 1) * pageSize, page * pageSize),
    total: entries.length,
    page,
    pageSize,
    date,
    availableRange: { from: data.startsOn, to: data.today },
    // Reyting har kuni Sozlamalardagi vaqtda (Toshkent) ko'rishlar yig'ilgach tuziladi.
    generatedAt:
      date === data.today
        ? lastSyncAt(data.today, syncTime)
        : new Date(`${date}T${syncTime}:00+05:00`).toISOString(),
    summary: {
      participants: entries.length,
      totalViews: entries.reduce((sum, entry) => sum + entry.views, 0),
      totalGrowth: entries.reduce((sum, entry) => sum + entry.viewsGrowth, 0),
      newEntries: entries.filter((entry) => entry.previousRank === null).length,
    },
  };
}
