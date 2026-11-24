import type { ContestPrizes } from "../miniapp/prizes";
import { topReel, type Participant, type Reel } from "../participants/participants.service";
import type { CaseInfo } from "./participants";

/**
 * Asosiy sovrinlar (avtomobil, sayohat, iPhone, planshet) — RANDOM EMAS, faqat reyting bo'yicha:
 * har bir sovrinning ko'rishlar oralig'iga eng ko'p ko'rilgan videosi tushgan ishtirokchilar reyting
 * tartibida, birinchi `quantity` tasi yutadi. Oraliqlar kesishmaydi — bir kishiga bitta asosiy sovrin.
 * Tiplar `apps/admin/src/lib/types.ts` → RatingPrizes bilan bir xil (sof funksiyalar).
 */

export type RatingPrizeKind = ContestPrizes["tiers"][number]["kind"];

export interface RatingPrizeEntry {
  /** Shu sovrin ichidagi o'rin (navbatdagilar raqamlashni davom ettiradi). */
  place: number;
  /** Umumiy reytingdagi o'rin (eng ko'p ko'rilgan videosining joyi). */
  rank: number;
  participant: { id: string; firstName: string; lastName: string; phone: string; instagramUsername: string | null };
  /** Eng ko'p ko'rilgan qabul qilingan videosining ko'rishlari. */
  views: number;
  reelUrl: string;
  /** Ochiq (ro'yxatdan chiqarilmagan) target holati bor. */
  hasTarget: boolean;
  /** Shu videoda nakrutka belgilari bor. */
  flagged: boolean;
}

export interface RatingPrizeTier {
  kind: RatingPrizeKind;
  title: string;
  quantity: number;
  unit: string | null;
  minViews: number;
  maxViews: number | null;
  /** Ko'rishlari shu oraliqdagi ishtirokchilar soni. */
  eligibleCount: number;
  /** Reyting bo'yicha birinchi `quantity` tasi. */
  winners: RatingPrizeEntry[];
  /** Navbatdagilar (zaxira) — ko'pi bilan `NEXT_COUNT` ta. */
  next: RatingPrizeEntry[];
}

export interface RatingPrizes {
  /** Ko'rishlar oxirgi marta muvaffaqiyatli yig'ilgan vaqt (ISO) yoki null. */
  updatedAt: string | null;
  /** Eng qimmatidan: avtomobil, sayohat, iPhone, planshet. */
  tiers: RatingPrizeTier[];
}

/** Har bir sovrin uchun ko'rsatiladigan navbatdagilar soni. */
export const NEXT_COUNT = 5;

/** Reyting qatori (`StatsService.ranking()` dan kerakli qismi): ko'rishlar kamayishi tartibida. */
export interface RankedParticipant {
  participant: Participant;
  /** Qabul qilingan videolari. */
  reels: Reel[];
  views: number;
  rank: number;
}

const inRange = (views: number, tier: { minViews: number; maxViews: number | null }) =>
  views >= tier.minViews && (tier.maxViews === null || views <= tier.maxViews);

export function buildRatingPrizes(input: {
  ranking: readonly RankedParticipant[];
  tiers: ContestPrizes["tiers"];
  cases: readonly CaseInfo[];
  updatedAt: string | null;
}): RatingPrizes {
  const withTarget = new Set(input.cases.filter((c) => c.status !== "DISMISSED").map((c) => c.telegramId));
  const toEntry = (row: RankedParticipant, place: number): RatingPrizeEntry => {
    const best = topReel(row.reels);
    const p = row.participant;
    return {
      place,
      rank: row.rank,
      participant: {
        id: String(p.telegramId),
        firstName: p.firstName ?? "",
        lastName: p.lastName ?? "",
        phone: p.phone ?? "",
        instagramUsername: best?.owner ?? null,
      },
      views: row.views,
      reelUrl: best?.url ?? "",
      hasTarget: withTarget.has(p.telegramId),
      flagged: (best?.flags.length ?? 0) > 0,
    };
  };

  const tiers = [...input.tiers]
    .sort((a, b) => b.minViews - a.minViews)
    .map((tier): RatingPrizeTier => {
      const rows = input.ranking.filter((row) => inRange(row.views, tier));
      return {
        kind: tier.kind,
        title: tier.title,
        quantity: tier.quantity,
        unit: tier.unit,
        minViews: tier.minViews,
        maxViews: tier.maxViews,
        eligibleCount: rows.length,
        winners: rows.slice(0, tier.quantity).map((row, i) => toEntry(row, i + 1)),
        next: rows
          .slice(tier.quantity, tier.quantity + NEXT_COUNT)
          .map((row, i) => toEntry(row, tier.quantity + i + 1)),
      };
    });
  return { updatedAt: input.updatedAt, tiers };
}
