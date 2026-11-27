"use client";

import { useQuery } from "@tanstack/react-query";

import { RATING_PRIZE_ICONS } from "@/components/prizes/rating-prize";
import { Badge } from "@/components/ui/badge";
import { getRatingPrizes } from "@/lib/api";
import { formatNumber, formatViewsRange } from "@/lib/format";
import { RATING_PRIZE_LABELS } from "@/lib/labels";
import type { ParticipantStatus, RatingPrizeKind, RatingPrizeTier } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Ko'rishlar oralig'i; null — o'sha tomonda chegara yo'q (ikkala chegara ham kiradi). */
export interface ViewsRange {
  min: number | null;
  max: number | null;
}

/** Tez tanlash tugmasi: oraliq va yozuv; asosiy sovrin oralig'i bo'lsa — uning turi. */
export interface ViewsPreset extends ViewsRange {
  label: string;
  kind: RatingPrizeKind | null;
}

/** Asosiy sovrin oralig'i (oferta 6.2): shu oraliqdagi ishtirokchilar orasida random tanlov. */
export type PrizeRange = Pick<RatingPrizeTier, "kind" | "minViews" | "maxViews">;

/** Sovrinlar yuklanguncha (yoki yuklab bo'lmasa) — umumiy oraliqlar. */
const FALLBACK_PRESETS: ViewsPreset[] = [
  { label: "10 minggacha", min: null, max: 10_000, kind: null },
  { label: "10 ming – 100 ming", min: 10_000, max: 100_000, kind: null },
  { label: "100 ming – 1 mln", min: 100_000, max: 1_000_000, kind: null },
  { label: "1 mln dan ko'p", min: 1_000_000, max: null, kind: null },
];

/** Sovrinlar oraliqlari kamdan-kam o'zgaradi — har safar qayta so'ralmaydi. */
const PRIZES_STALE_MS = 5 * 60_000;

/**
 * Asosiy sovrinlar oraliqlari — G'oliblar sahifasi bilan bir xil so'rov (`["rating-prizes"]`),
 * shuning uchun keshdan olinadi. Yuklanguncha — `undefined`.
 */
export function usePrizeRanges(): PrizeRange[] | undefined {
  const { data } = useQuery({
    queryKey: ["rating-prizes"],
    queryFn: getRatingPrizes,
    staleTime: PRIZES_STALE_MS,
  });
  return data?.tiers;
}

/**
 * Bloklangan va chetlatilganlar reytingga ham, sovrin tanloviga ham kirmaydi — ularga sovrin
 * oralig'i ko'rsatilmaydi.
 */
export function showsPrizeRange(status: ParticipantStatus): boolean {
  return status !== "BLOCKED" && status !== "DISQUALIFIED";
}

/** Umumiy ko'rishlar qaysi asosiy sovrin oralig'iga tushadi; hech biriga — null. */
export function prizeRangeFor(ranges: readonly PrizeRange[] | undefined, views: number): PrizeRange | null {
  if (!ranges) return null;
  return ranges.find((range) => views >= range.minViews && (range.maxViews === null || views <= range.maxViews)) ?? null;
}

/**
 * Tez tanlash oraliqlari — asosiy sovrinlar oraliqlari (arzonidan qimmatiga), oxirida — eng
 * pastki chegaragacha bo'lganlar ("asosiy sovringa kirmaydi"). Sovrinlar hali yuklanmagan bo'lsa —
 * umumiy oraliqlar.
 */
export function viewsPresets(ranges: readonly PrizeRange[] | undefined): ViewsPreset[] {
  if (!ranges || ranges.length === 0) return FALLBACK_PRESETS;
  const sorted = [...ranges].sort((a, b) => a.minViews - b.minViews);
  const presets: ViewsPreset[] = sorted.map((range) => ({
    label: `${RATING_PRIZE_LABELS[range.kind]} · ${formatViewsRange(range.minViews, range.maxViews)}`,
    min: range.minViews,
    max: range.maxViews,
    kind: range.kind,
  }));
  const lowest = sorted[0].minViews;
  if (lowest > 0) {
    presets.push({
      label: `${formatNumber(lowest - 1)} gacha (asosiy sovringa kirmaydi)`,
      min: null,
      max: lowest - 1,
      kind: null,
    });
  }
  return presets;
}

/** Tez tanlash oraliqlari (sovrinlar yuklangach — ular bo'yicha). */
export function useViewsPresets(): ViewsPreset[] {
  return viewsPresets(usePrizeRanges());
}

/** Kichik belgi (sovrin ikonkasi bilan): "iPhone 18 Pro oralig'ida" — umumiy ko'rishlar shu sovrin oralig'ida. */
export function PrizeRangeChip({ kind, className }: { kind: RatingPrizeKind; className?: string }) {
  const Icon = RATING_PRIZE_ICONS[kind];
  const label = RATING_PRIZE_LABELS[kind];

  return (
    <Badge
      tone="brand"
      className={cn("gap-1", className)}
      title={`Umumiy ko'rishlari «${label}» oralig'ida. G'olib o'rin bo'yicha emas — baraban orqali random aniqlanadi.`}
    >
      <Icon className="size-3 shrink-0" aria-hidden />
      {label} oralig&apos;ida
    </Badge>
  );
}
