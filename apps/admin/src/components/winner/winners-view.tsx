"use client";

import { useQuery } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, Car, Ticket, Trophy, type LucideIcon } from "lucide-react";

import {
  prizeQuantityLabel,
  RatingPrizeHeading,
  RatingPrizeRule,
  RatingPrizeTable,
} from "@/components/prizes/rating-prize-table";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Segmented } from "@/components/ui/segmented";
import { Spinner } from "@/components/ui/spinner";
import { getRatingPrizes } from "@/lib/api";
import { errorMessage } from "@/lib/api-error";
import { formatDateTime, formatNumber, formatViewsRange } from "@/lib/format";
import { RATING_PRIZE_LABELS } from "@/lib/labels";

import { VoucherWinners } from "./voucher-winners";
import { WinnerView } from "./winner-view";

type Tab = "main" | "vouchers";

/**
 * "G'oliblar" bo'limi. Ikki tab: "Asosiy sovrinlar" — bosh sovrin (avtomobil) g'olibini aniqlash
 * oqimi va reyting bo'yicha sayohat / iPhone / planshet; "Voucher g'oliblari" — random tanlovlar natijasi.
 * URL: `?tab=vouchers`.
 */
export function WinnersView() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tab: Tab = searchParams.get("tab") === "vouchers" ? "vouchers" : "main";

  return (
    <div className="space-y-6">
      <Segmented<Tab>
        label="G'oliblar bo'limi"
        value={tab}
        onChange={(next) => router.replace(next === "vouchers" ? `${pathname}?tab=vouchers` : pathname, { scroll: false })}
        options={[
          { value: "main", label: "Asosiy sovrinlar", icon: Trophy },
          { value: "vouchers", label: "Voucher g'oliblari", icon: Ticket },
        ]}
      />
      {tab === "main" ? <MainPrizes /> : <VoucherWinners />}
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
        {car && car.eligibleCount === 0 && (
          <p className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-sm text-amber-800">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
            Hozircha hech kimning videosi {formatNumber(car.minViews)} ko&apos;rishga yetmagan. Quyida joriy yetakchi.
          </p>
        )}
        <WinnerView />
      </section>

      <section className="space-y-4" aria-labelledby="rating-prizes-title">
        <SectionTitle
          id="rating-prizes-title"
          icon={Trophy}
          title="Boshqa asosiy sovrinlar"
          meta={
            prizes.data?.updatedAt
              ? `Reyting bo'yicha, random emas · ko'rishlar ${formatDateTime(prizes.data.updatedAt)} holatiga`
              : "Reyting bo'yicha, random emas"
          }
        />
        {prizes.isPending ? (
          <Spinner />
        ) : prizes.isError ? (
          <p role="alert" className="text-sm text-red-700">
            {errorMessage(prizes.error)}
          </p>
        ) : (
          others.map((tier) => (
            <Card key={tier.kind}>
              <CardHeader>
                <RatingPrizeHeading tier={tier} />
              </CardHeader>
              <CardContent className="space-y-3">
                <RatingPrizeRule tier={tier} />
                <RatingPrizeTable tier={tier} />
              </CardContent>
            </Card>
          ))
        )}
      </section>
    </div>
  );
}

function SectionTitle({
  id,
  icon: Icon,
  title,
  meta,
}: {
  id: string;
  icon: LucideIcon;
  title: string;
  meta: string | null;
}) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <h2 id={id} className="flex items-center gap-2 text-lg font-semibold tracking-tight text-ink">
        <Icon className="size-5 text-brand-600" aria-hidden />
        {title}
      </h2>
      {meta && <p className="text-sm text-muted tabular-nums">{meta}</p>}
    </div>
  );
}
