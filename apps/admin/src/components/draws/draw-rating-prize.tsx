"use client";

import { ListOrdered } from "lucide-react";

import { RatingPrizeHeading, RatingPrizeRule, RatingPrizeTable } from "@/components/prizes/rating-prize-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { formatDateTime } from "@/lib/format";
import type { RatingPrizeTier } from "@/lib/types";

interface DrawRatingPrizeProps {
  tier: RatingPrizeTier;
  updatedAt: string | null;
  /** G'oliblar ko'rsatilganmi (tugma bosilgan). */
  shown: boolean;
  loading: boolean;
  onShow: () => void;
}

/** Reyting bo'yicha beriladigan asosiy sovrin: qoida, bitta tugma va g'oliblar jadvali. */
export function DrawRatingPrize({ tier, updatedAt, shown, loading, onShow }: DrawRatingPrizeProps) {
  return (
    <Card>
      <CardHeader className="flex flex-wrap items-start justify-between gap-3">
        <RatingPrizeHeading tier={tier} />
        {shown && updatedAt && (
          <p className="text-xs text-muted">Ko&apos;rishlar: {formatDateTime(updatedAt)} holatiga</p>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <RatingPrizeRule tier={tier} className="rounded-xl bg-[#f7f6fb] px-4 py-3" />
        {shown && !loading ? (
          <RatingPrizeTable tier={tier} />
        ) : (
          <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center">
            <Button className="h-11 px-5 text-base" onClick={onShow} loading={loading}>
              <ListOrdered className="size-5" aria-hidden />
              G&apos;oliblarni ko&apos;rsatish
            </Button>
            <p className="text-xs text-muted">Joriy reyting bo&apos;yicha — tasodif yo&apos;q.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
