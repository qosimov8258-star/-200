import { addDays } from "../common/time";
import type { Participant, Reel } from "../participants/participants.service";
import { clampDay, reportWindow } from "./days";
import type { CaseInfo } from "./participants";
import { viewsOn } from "./views";

/**
 * Admin panel → Reyting: tanlangan kunning videolar reytingi (har bir video alohida qator) va
 * oldingi kunga nisbatan o'zgarish (sof funksiyalar). Tiplar `apps/admin/src/lib/types.ts` → Reyting bo'limi bilan bir xil.
 */

export interface RatingEntry {
  rank: number;
  /** Video (shortcode) — qatorning noyob kaliti: bitta ishtirokchi bir nechta qatorda bo'lishi mumkin. */
  shortcode: string;
  participantId: string;
  firstName: string;
  lastName: string;
  /** Shu videoning egasi (Instagram akkaunti) va linki. */
  instagramUsername: string | null;
  reelUrl: string;
  /** Shu videoning shu kungacha yig'ilgan ko'rishlari. */
  views: number;
  /**
   * Shu videoning shu kuni yig'ilgan yangi ko'rishlari (oldingi kunga nisbatan; kamaygan bo'lsa —
   * manfiy; oldingi kungacha yig'ilmagan bo'lsa — hammasi).
   */
  viewsGrowth: number;
  /** Shu videoning oldingi kundagi o'rni; oldingi kuni reytingda bo'lmagan bo'lsa — null. */
  previousRank: number | null;
  /** Ishtirokchida shu kungacha target aniqlanganmi (ro'yxatdan chiqarilganlar hisobga olinmaydi). */
  hasTarget: boolean;
}

export interface RatingSummary {
  /** Reytingdagi turli ishtirokchilar soni. */
  participants: number;
  /** Reytingdagi videolar (qatorlar) soni. */
  videos: number;
  totalViews: number;
  totalGrowth: number;
  /** Oldingi kuni reytingda bo'lmagan videolar. */
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

export interface RankedReelOnDay {
  participant: Participant;
  reel: Reel;
  views: number;
  rank: number;
}

/**
 * `day` kunidagi videolar reytingi: faol ishtirokchilarning hozir qabul qilingan (ACCEPTED) har bir
 * videosi — alohida qator (shu kungacha kamida bitta snapshot bo'lganlari). Ko'rishlar — videoning
 * `date <= day` oxirgi snapshoti. Teng ko'rishda oldinroq yuborilgan video yuqorida
 * (`StatsService.reelRanking` qoidasi).
 *
 * Holat (bloklangan, chetlatilgan, video holati) — joriy; o'tgan kunlar uchun ham shu qo'llanadi.
 */
export function rankReelsOn(participants: readonly Participant[], day: string): RankedReelOnDay[] {
  const rows = participants.flatMap((participant) => {
    if (participant.status !== "ACTIVE" || !participant.firstName) return [];
    return participant.reels.flatMap((reel) => {
      const views = reel.status === "ACCEPTED" ? viewsOn(reel.history, day) : null;
      return views === null ? [] : [{ participant, reel, views }];
    });
  });
  rows.sort(
    (a, b) =>
      b.views - a.views ||
      a.reel.submittedAt.getTime() - b.reel.submittedAt.getTime() ||
      a.participant.telegramId - b.participant.telegramId ||
      a.reel.shortcode.localeCompare(b.reel.shortcode),
  );
  return rows.map((row, i) => ({ ...row, rank: i + 1 }));
}

/**
 * Kunlik reyting — har bir video alohida qator. Kun tanlov boshidan bugungacha (tugash kunidan
 * oshmagan) oraliqqa qisiladi. Tanlov hali boshlanmagan bo'lsa — boshlanish kuni, reyting bo'sh.
 * Birinchi kunda "oldingi o'rin" yo'q — hamma yangi.
 */
export function buildDailyRating(input: DailyRatingInput): DailyRating {
  const range = reportWindow(input.startsOn, input.endsOn, input.today);
  const date = clampDay(input.date ?? input.today, range.from, range.to);
  // Kelajakdagi kun (tanlov boshlanmagan) — ma'lumot yo'q.
  const ranking = date > input.today ? [] : rankReelsOn(input.participants, date);
  const previousDay = addDays(date, -1);
  const previousRanking =
    date > input.startsOn && ranking.length > 0 ? rankReelsOn(input.participants, previousDay) : [];
  const previousRank = new Map(previousRanking.map((e) => [e.reel, e.rank]));
  const withTarget = new Set(
    input.cases.filter((c) => c.status !== "DISMISSED" && c.detectedOn <= date).map((c) => c.telegramId),
  );

  const entries: RatingEntry[] = ranking.map(({ participant: p, reel, views, rank }) => ({
    rank,
    shortcode: reel.shortcode,
    participantId: String(p.telegramId),
    firstName: p.firstName ?? "",
    lastName: p.lastName ?? "",
    instagramUsername: reel.owner,
    reelUrl: reel.url,
    views,
    viewsGrowth: views - (viewsOn(reel.history, previousDay) ?? 0),
    previousRank: previousRank.get(reel) ?? null,
    hasTarget: withTarget.has(p.telegramId),
  }));

  return {
    date,
    availableRange: range,
    entries,
    summary: {
      participants: new Set(entries.map((e) => e.participantId)).size,
      videos: entries.length,
      totalViews: entries.reduce((sum, e) => sum + e.views, 0),
      totalGrowth: entries.reduce((sum, e) => sum + e.viewsGrowth, 0),
      newEntries: entries.filter((e) => e.previousRank === null).length,
    },
  };
}
