/**
 * MOCK backend: asosiy sovrinlar reyting bo'yicha (random emas). Haqiqiy backendda:
 *   GET /api/v1/admin/winner/prizes   (`apps/backend/src/reports/rating-prizes.ts`)
 *
 * Har bir sovrinning ko'rishlar oralig'iga eng ko'p ko'rilgan videosi tushgan ishtirokchilar
 * reyting tartibida, birinchi `quantity` tasi — g'oliblar, keyingi 5 tasi — navbatdagilar.
 * Oraliqlar kesishmaydi — bir kishiga bitta asosiy sovrin.
 */
import type { DrawEntry, RatingPrizeEntry, RatingPrizes, RatingPrizeTier } from "../types";
import { mainDrawOf } from "./draws";
import { getContestData } from "./contest";
import { computeRanking, type MockRankingEntry } from "./ranking";
import { effectiveSettings, lastSyncAt } from "./settings";
import { readStore } from "./store";
import { targetCaseStatus } from "./targets";

/** Har bir sovrin uchun ko'rsatiladigan navbatdagilar soni (backend `PREVIEW_COUNT`). */
const PREVIEW_COUNT = 30;

/** Backend `miniapp/prizes.ts` → `tiers` bilan bir xil; eng qimmatidan. */
/** Ommaviy oferta 6.2.1 (backend `miniapp/prizes.ts` bilan bir xil). */
export const MAIN_TIERS: Array<Pick<RatingPrizeTier, "kind" | "title" | "quantity" | "unit" | "minViews" | "maxViews">> = [
  { kind: "car", title: "BYD Chazor avtomobili", quantity: 1, unit: null, minViews: 4_000_001, maxViews: null },
  {
    kind: "travel",
    title: "Tailandga 2 kishilik sayohat yo'llanmasi",
    quantity: 3,
    unit: null,
    minViews: 1_500_001,
    maxViews: 4_000_000,
  },
  { kind: "phone", title: "iPhone 18 Pro smartfoni", quantity: 15, unit: null, minViews: 500_001, maxViews: 1_500_000 },
  { kind: "tablet", title: "Planshet", quantity: 25, unit: null, minViews: 100_001, maxViews: 500_000 },
];
const TIERS = MAIN_TIERS;

const inRange = (views: number, tier: { minViews: number; maxViews: number | null }) =>
  views >= tier.minViews && (tier.maxViews === null || views <= tier.maxViews);

export function getRatingPrizes(): RatingPrizes {
  const store = readStore();
  const data = getContestData();
  const settings = effectiveSettings(store);
  // G'olib bo'limi bilan bir xil kun: tanlov tugagan bo'lsa — oxirgi kuni, aks holda bugun.
  const date = data.today < settings.endsOn ? data.today : settings.endsOn;
  const ranking = computeRanking(date, store);

  const participants = new Map(data.participants.map((item) => [item.id, item]));
  const reels = new Map(data.reels.map((reel) => [reel.id, reel]));
  const withTarget = new Set(
    data.targets.filter((target) => targetCaseStatus(target, store) !== "DISMISSED").map((target) => target.participantId),
  );

  const toEntry = (row: MockRankingEntry, place: number): RatingPrizeEntry[] => {
    const participant = participants.get(row.participantId);
    const reel = reels.get(row.topReelId);
    if (!participant || !reel) return [];
    return [
      {
        place,
        rank: row.rank,
        participant: {
          id: participant.id,
          firstName: participant.firstName,
          lastName: participant.lastName,
          phone: participant.phone,
          instagramUsername: reel.owner ?? participant.instagramUsername,
        },
        views: row.views,
        reelUrl: reel.url,
        hasTarget: withTarget.has(participant.id),
        flagged: reel.flags.length > 0,
      },
    ];
  };

  const byId = new Map(ranking.map((row) => [row.participantId, row]));
  const fromDraw = (entry: DrawEntry): RatingPrizeEntry => ({
    place: entry.position,
    rank: byId.get(entry.candidate.participantId)?.rank ?? 0,
    participant: {
      id: entry.candidate.participantId,
      firstName: entry.candidate.firstName,
      lastName: entry.candidate.lastName,
      phone: entry.candidate.phone,
      instagramUsername: entry.candidate.instagramUsername,
    },
    views: entry.candidate.views,
    reelUrl: entry.candidate.reelUrl,
    hasTarget: withTarget.has(entry.candidate.participantId),
    flagged: false,
  });

  const tiers = TIERS.map((tier): RatingPrizeTier => {
    const rows = ranking.filter((row) => inRange(row.views, tier));
    const draw = mainDrawOf(tier.kind);
    return {
      ...tier,
      eligibleCount: rows.length,
      draw: draw
        ? { id: draw.id, number: draw.number, status: draw.status, viewsAsOf: draw.viewsAsOf, poolSize: draw.poolSize }
        : null,
      winners: draw ? draw.winnerEntries.filter((e) => e.state === "ACTIVE").map(fromDraw) : [],
      next: draw ? draw.reserveEntries.filter((e) => e.state === "ACTIVE").map(fromDraw) : [],
      eligible: draw ? [] : rows.slice(0, PREVIEW_COUNT).flatMap((row, i) => toEntry(row, i + 1)),
    };
  });

  return { updatedAt: lastSyncAt(data.today, settings.syncTime), tiers };
}
