import { addDays } from "../common/time";
import { firstSubmittedAt, topReel, type Participant, type Reel } from "../participants/participants.service";
import { clampDay, reportWindow } from "./days";
import type { CaseInfo } from "./participants";
import { viewsOn } from "./views";

/**
 * Admin panel → Reyting: tanlangan kunning reytingi va oldingi kunga nisbatan o'zgarish
 * (sof funksiyalar). Tiplar `apps/admin/src/lib/types.ts` → Reyting bo'limi bilan bir xil.
 */

export interface RatingEntry {
  rank: number;
  participantId: string;
  firstName: string;
  lastName: string;
  /** Shu kuni eng ko'p ko'rilgan (asosiy) videoning egasi va linki. */
  instagramUsername: string | null;
  reelUrl: string;
  /** Shu kungacha yig'ilgan ko'rishlar — qabul qilingan videolar yig'indisi. */
  views: number;
  /** Shu kuni yig'ilgan yangi ko'rishlar (oldingi kunga nisbatan; kamaygan bo'lsa — manfiy). */
  viewsGrowth: number;
  /** Oldingi kundagi o'rin; oldingi kuni reytingda bo'lmagan bo'lsa — null. */
  previousRank: number | null;
  /** Shu kungacha target aniqlanganmi (ro'yxatdan chiqarilganlar hisobga olinmaydi). */
  hasTarget: boolean;
}

export interface RatingSummary {
  participants: number;
  totalViews: number;
  totalGrowth: number;
  /** Oldingi kuni reytingda bo'lmaganlar. */
  newEntries: number;
}

export interface DailyRating {
  /** Amalda ko'rsatilgan kun (tanlov muddatiga qisilgan). */
  date: string;
  availableRange: { from: string; to: string };
  /** To'liq reyting (sahifalash — controller'da). */
  entries: RatingEntry[];
  summary: RatingSummary;
}

export interface DailyRatingInput {
  participants: readonly Participant[];
  cases: readonly CaseInfo[];
  startsOn: string;
  endsOn: string;
  /** Bugungi tanlov kuni (Asia/Tashkent). */
  today: string;
  /** So'ralgan kun (formati tekshirilgan); berilmasa — bugun. */
  date?: string;
}

export interface RankedOnDay {
  participant: Participant;
  /** Hozir qabul qilingan (ACCEPTED) videolari — yuborilish tartibida. */
  reels: Reel[];
  views: number;
  rank: number;
}

/** Videolarning `day` kunidagi ko'rishlari yig'indisi; hech birida shu kungacha snapshot bo'lmasa — null. */
export function sumViewsOn(reels: readonly Reel[], day: string): number | null {
  let total: number | null = null;
  for (const reel of reels) {
    const views = viewsOn(reel.history, day);
    if (views !== null) total = (total ?? 0) + views;
  }
  return total;
}

/**
 * `day` kunidagi reyting: hozir qabul qilingan (ACCEPTED) videosi bor faol ishtirokchilar,
 * shu kungacha kamida bitta snapshot bo'lganlar. Ko'rishlar — qabul qilingan videolarning
 * `date <= day` oxirgi snapshotlari yig'indisi. Teng ko'rishda birinchi qabul qilingan videosini
 * oldinroq yuborgan yuqorida (`StatsService.ranking` qoidasi).
 *
 * Holat (bloklangan, chetlatilgan, video holati) — joriy; o'tgan kunlar uchun ham shu qo'llanadi.
 */
export function rankOn(participants: readonly Participant[], day: string): RankedOnDay[] {
  const rows = participants.flatMap((participant) => {
    if (participant.status !== "ACTIVE" || !participant.firstName) return [];
    const reels = participant.reels.filter((r) => r.status === "ACCEPTED");
    const views = sumViewsOn(reels, day);
    return views === null ? [] : [{ participant, reels, views, since: firstSubmittedAt(reels) }];
  });
  rows.sort((a, b) => b.views - a.views || a.since - b.since || a.participant.telegramId - b.participant.telegramId);
  return rows.map(({ participant, reels, views }, i) => ({ participant, reels, views, rank: i + 1 }));
}

/**
 * Kunlik reyting. Kun tanlov boshidan bugungacha (tugash kunidan oshmagan) oraliqqa qisiladi.
 * Tanlov hali boshlanmagan bo'lsa — boshlanish kuni, reyting bo'sh.
 * Birinchi kunda "oldingi o'rin" yo'q — hamma yangi.
 */
export function buildDailyRating(input: DailyRatingInput): DailyRating {
  const range = reportWindow(input.startsOn, input.endsOn, input.today);
  const date = clampDay(input.date ?? input.today, range.from, range.to);
  // Kelajakdagi kun (tanlov boshlanmagan) — ma'lumot yo'q.
  const ranking = date > input.today ? [] : rankOn(input.participants, date);
  const previousDay = addDays(date, -1);
  const previousRanking = date > input.startsOn && ranking.length > 0 ? rankOn(input.participants, previousDay) : [];
  const previousRank = new Map(previousRanking.map((e) => [e.participant.telegramId, e.rank]));
  const withTarget = new Set(
    input.cases.filter((c) => c.status !== "DISMISSED" && c.detectedOn <= date).map((c) => c.telegramId),
  );

  const entries: RatingEntry[] = ranking.flatMap(({ participant: p, reels, views, rank }) => {
    const main = topReel(reels, (r) => viewsOn(r.history, date) ?? 0);
    if (!main) return [];
    return [
      {
        rank,
        participantId: String(p.telegramId),
        firstName: p.firstName ?? "",
        lastName: p.lastName ?? "",
        instagramUsername: main.owner,
        reelUrl: main.url,
        views,
        viewsGrowth: views - (sumViewsOn(reels, previousDay) ?? 0),
        previousRank: previousRank.get(p.telegramId) ?? null,
        hasTarget: withTarget.has(p.telegramId),
      },
    ];
  });

  return {
    date,
    availableRange: range,
    entries,
    summary: {
      participants: entries.length,
      totalViews: entries.reduce((sum, e) => sum + e.views, 0),
      totalGrowth: entries.reduce((sum, e) => sum + e.viewsGrowth, 0),
      newEntries: entries.filter((e) => e.previousRank === null).length,
    },
  };
}
