import type { DrawCandidate, DrawEntry, DrawStatus, VoucherDraw } from "../draws/draws.service";
import type { ContestPrizes } from "../miniapp/prizes";
import { topReel, type Participant, type Reel } from "../participants/participants.service";
import type { CaseInfo } from "./participants";

/**
 * Asosiy sovrinlar (avtomobil, sayohat, iPhone, planshet) — ommaviy oferta 6.2: har bir sovrin
 * aksiya davomidagi **umumiy tasdiqlangan ko'rishlari** (barcha videolari yig'indisi) shu sovrin
 * oralig'iga tushgan ishtirokchilar orasida **tasodifiy tanlov (random)** orqali o'ynaladi. Reyting va
 * o'rin g'olibni aniqlamaydi (9.1). Oraliqlar kesishmaydi — bir kishiga bitta asosiy sovrin.
 *
 * Bu hisobot: har bir oraliqdagi ishtirokchilar (nomzodlar) va shu sovrin bo'yicha o'tkazilgan random
 * tanlov natijasi (g'oliblar va zaxira). Tiplar `apps/admin/src/lib/types.ts` → RatingPrizes bilan bir xil.
 */

export type RatingPrizeKind = ContestPrizes["tiers"][number]["kind"];

export interface RatingPrizeEntry {
  /** Tanlovdagi navbat (g'olib yoki zaxira raqami); tanlov bo'lmasa — oraliqdagi tartib raqami. */
  place: number;
  /** Ishtirokchilar reytingidagi o'rni (faqat ma'lumot uchun); reytingda bo'lmasa — 0. */
  rank: number;
  participant: { id: string; firstName: string; lastName: string; phone: string; instagramUsername: string | null };
  /** Umumiy tasdiqlangan ko'rishlari (barcha qabul qilingan videolari yig'indisi). */
  views: number;
  /** Eng ko'p ko'rilgan videosi (tekshirish uchun). */
  reelUrl: string;
  /** Ochiq (ro'yxatdan chiqarilmagan) target holati bor. */
  hasTarget: boolean;
  /** Videolaridan birida nakrutka belgilari bor. */
  flagged: boolean;
}

export interface RatingPrizeTier {
  kind: RatingPrizeKind;
  title: string;
  quantity: number;
  unit: string | null;
  minViews: number;
  maxViews: number | null;
  /** Umumiy ko'rishlari shu oraliqdagi ishtirokchilar soni (joriy holat). */
  eligibleCount: number;
  /** Shu sovrin bo'yicha amaldagi random tanlov; hali o'tkazilmagan — null. */
  draw: { id: string; number: number; status: DrawStatus; viewsAsOf: string; poolSize: number } | null;
  /** Tanlov g'oliblari (tanlov bo'lmasa — bo'sh). */
  winners: RatingPrizeEntry[];
  /** Tanlov zaxiralari — navbat tartibida (tanlov bo'lmasa — bo'sh). */
  next: RatingPrizeEntry[];
  /** Tanlov hali o'tkazilmagan bo'lsa — oraliqdagi ishtirokchilar (ko'rishlar kamayishi, ko'pi bilan `PREVIEW_COUNT`). */
  eligible: RatingPrizeEntry[];
}

export interface RatingPrizes {
  /** Ko'rishlar oxirgi marta muvaffaqiyatli yig'ilgan vaqt (ISO) yoki null. */
  updatedAt: string | null;
  /** Eng qimmatidan: avtomobil, sayohat, iPhone, planshet. */
  tiers: RatingPrizeTier[];
}

/** Tanlovdan oldin har bir oraliq uchun ko'rsatiladigan nomzodlar soni. */
export const PREVIEW_COUNT = 30;

/** Reyting qatori (`StatsService.ranking()` dan kerakli qismi): ko'rishlar kamayishi tartibida. */
export interface RankedParticipant {
  participant: Participant;
  /** Qabul qilingan videolari. */
  reels: Reel[];
  /** Umumiy ko'rishlar (yig'indi). */
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
  /** Shu sovrin bo'yicha amaldagi random tanlov (`DrawsService.mainDraw`). */
  drawFor: (kind: RatingPrizeKind) => VoucherDraw | null;
}): RatingPrizes {
  const withTarget = new Set(input.cases.filter((c) => c.status !== "DISMISSED").map((c) => c.telegramId));
  const byId = new Map(input.ranking.map((row) => [String(row.participant.telegramId), row]));

  const fromRanking = (row: RankedParticipant, place: number): RatingPrizeEntry => {
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
      flagged: row.reels.some((r) => r.flags.length > 0),
    };
  };

  const fromDraw = (entry: DrawEntry): RatingPrizeEntry => {
    const c: DrawCandidate = entry.candidate;
    const row = byId.get(c.participantId);
    return {
      place: entry.position,
      rank: row?.rank ?? 0,
      participant: {
        id: c.participantId,
        firstName: c.firstName,
        lastName: c.lastName,
        phone: c.phone,
        instagramUsername: c.instagramUsername,
      },
      views: c.views,
      reelUrl: c.reelUrl,
      hasTarget: withTarget.has(Number(c.participantId)),
      flagged: row?.reels.some((r) => r.flags.length > 0) ?? false,
    };
  };

  const tiers = [...input.tiers]
    .sort((a, b) => b.minViews - a.minViews)
    .map((tier): RatingPrizeTier => {
      const rows = input.ranking.filter((row) => inRange(row.views, tier));
      const draw = input.drawFor(tier.kind);
      return {
        kind: tier.kind,
        title: tier.title,
        quantity: tier.quantity,
        unit: tier.unit,
        minViews: tier.minViews,
        maxViews: tier.maxViews,
        eligibleCount: rows.length,
        draw: draw
          ? { id: draw.id, number: draw.number, status: draw.status, viewsAsOf: draw.viewsAsOf, poolSize: draw.poolSize }
          : null,
        winners: draw ? draw.winnerEntries.filter((e) => e.state === "ACTIVE").map(fromDraw) : [],
        next: draw ? draw.reserveEntries.filter((e) => e.state === "ACTIVE").map(fromDraw) : [],
        eligible: draw ? [] : rows.slice(0, PREVIEW_COUNT).map((row, i) => fromRanking(row, i + 1)),
      };
    });
  return { updatedAt: input.updatedAt, tiers };
}
