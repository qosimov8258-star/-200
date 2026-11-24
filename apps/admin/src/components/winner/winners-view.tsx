"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { Car, Ticket, Trophy } from "lucide-react";

import { prizeQuantityLabel } from "@/components/prizes/rating-prize";
import { Segmented } from "@/components/ui/segmented";
import { Spinner } from "@/components/ui/spinner";
import { getRatingPrizes } from "@/lib/api";
import { errorMessage } from "@/lib/api-error";
import { formatViewsRange } from "@/lib/format";
import { RATING_PRIZE_LABELS } from "@/lib/labels";
import { voucherTabHref, WINNER_PATH, winnerTabOf, type WinnerTab } from "@/lib/winner-links";

import { RatingPrizeTile } from "./rating-prize-tile";
import { SectionTitle } from "./section-title";
import { VoucherTab } from "./voucher-tab";
import { WinnerView } from "./winner-view";

/**
 * "G'oliblar" bo'limi. Ikki tab: "Asosiy sovrinlar" — bosh sovrin (avtomobil) g'olibini aniqlash
 * oqimi va reyting bo'yicha sayohat / iPhone / planshet; "Voucher" — oylik voucherlar uchun random
 * tanlov (sozlamalar, bosqich, "Tanlash", natija, tarix) va voucher g'oliblari.
 * URL: `?tab=voucher`, ochiq tanlov — `&draw=<id>` (`src/lib/winner-links.ts`).
 */
export function WinnersView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = winnerTabOf(searchParams.get("tab"));

  return (
    <div className="space-y-6">
      <Segmented<WinnerTab>
        label="G'oliblar bo'limi"
        value={tab}
        onChange={(next) => router.replace(next === "voucher" ? voucherTabHref() : WINNER_PATH, { scroll: false })}
        options={[
          { value: "main", label: "Asosiy sovrinlar", icon: Trophy },
          { value: "voucher", label: "Voucher", icon: Ticket },
        ]}
      />
      {tab === "main" ? <MainPrizes /> : <VoucherTab />}
    </div>
  );
}

function MainPrizes() {
  const prizes = useQuery({ queryKey: ["rating-prizes"], queryFn: getRatingPrizes });
  const car = prizes.data?.tiers.find((tier) => tier.kind === "car");
  const others = prizes.data?.tiers.filter((tier) => tier.kind !== "car") ?? [];

  return (
    <div className="space-y-8">
      <section className="space-y-4" aria-labelledby="main-prize-title">
        <SectionTitle
          id="main-prize-title"
          icon={Car}
          title={`Bosh sovrin — ${RATING_PRIZE_LABELS.car}`}
          meta={car ? `${prizeQuantityLabel(car)} · ${formatViewsRange(car.minViews, car.maxViews)} ko'rish` : null}
        />
        <WinnerView />
      </section>

      <section className="space-y-4" aria-labelledby="rating-prizes-title">
        <SectionTitle id="rating-prizes-title" icon={Trophy} title="Boshqa asosiy sovrinlar" />
        {prizes.isPending ? (
          <Spinner />
        ) : prizes.isError ? (
          <p role="alert" className="text-sm text-red-700">
            {errorMessage(prizes.error)}
          </p>
        ) : (
          <div className="flex flex-wrap gap-4">
            {others.map((tier) => (
              <RatingPrizeTile key={tier.kind} tier={tier} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
