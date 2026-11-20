/**
 * MOCK backend: kunlik reyting arxivi. Haqiqiy backendda:
 *   GET /api/v1/admin/ratings/daily?date=YYYY-MM-DD&page=&pageSize=
 * va ma'lumot `daily_ratings` jadvalidan olinadi.
 *
 * Har bir qabul qilingan video — alohida qator: bir ishtirokchi bir necha marta uchrashi mumkin.
 */
import { ApiError } from "../api-error";
import { addDays, clampDate, isIsoDate } from "../dates";
import type { DailyRatingQuery, DailyRatingResponse, RatingEntry } from "../types";
import { getContestData, viewsOn } from "./contest";
import { computeVideoRanking } from "./ranking";
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
  const previousDate = addDays(date, -1);

  const ranking = computeVideoRanking(date, store);
  // Oldingi kungi o'rin — shu videoning o'rni (ishtirokchiniki emas).
  const previousRankByReel = new Map(
    date > data.startsOn
      ? computeVideoRanking(previousDate, store).map((entry) => [entry.reelId, entry.rank])
      : [],
  );

  const participantsById = new Map(data.participants.map((item) => [item.id, item]));
  const reelsById = new Map(data.reels.map((reel) => [reel.id, reel]));
  const targetParticipants = activeTargetParticipants(store, date);
  const { syncTime } = effectiveSettings(store);

  const entries: RatingEntry[] = ranking.flatMap((entry) => {
    const reel = reelsById.get(entry.reelId);
    if (!reel) return [];
    const participant = participantsById.get(entry.participantId);
    // O'sish — shu videoning shu kungi ko'rishlari minus oldingi kungacha yig'ilgani
    // (oldingi kungacha yig'ilmagan bo'lsa — hammasi).
    const viewsGrowth = entry.views - viewsOn(reel, previousDate);
    return [
      {
        rank: entry.rank,
        shortcode: reel.shortcode,
        participantId: entry.participantId,
        firstName: participant?.firstName ?? "",
        lastName: participant?.lastName ?? "",
        instagramUsername: reel.owner ?? participant?.instagramUsername ?? null,
        reelUrl: reel.url,
        views: entry.views,
        viewsGrowth,
        previousRank: previousRankByReel.get(entry.reelId) ?? null,
        // Target ishtirokchi bo'yicha: uning barcha qatorlarida belgilanadi.
        hasTarget: targetParticipants.has(entry.participantId),
      },
    ];
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
      participants: new Set(entries.map((entry) => entry.participantId)).size,
      videos: entries.length,
      totalViews: entries.reduce((sum, entry) => sum + entry.views, 0),
      totalGrowth: entries.reduce((sum, entry) => sum + entry.viewsGrowth, 0),
      newEntries: entries.filter((entry) => entry.previousRank === null).length,
    },
  };
}
