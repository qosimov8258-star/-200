"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Car, Ticket, Trophy } from "lucide-react";

import { DrawDrumSection } from "@/components/draws/draw-drum";
import { DrawResult } from "@/components/draws/draw-result";
import { prizeQuantityLabel } from "@/components/prizes/rating-prize";
import { Segmented } from "@/components/ui/segmented";
import { Spinner } from "@/components/ui/spinner";
import { getDraw, getRatingPrizes } from "@/lib/api";
import { errorMessage } from "@/lib/api-error";
import { formatViewsRange } from "@/lib/format";
import { RATING_PRIZE_LABELS } from "@/lib/labels";
import type { RatingPrizeKind, VoucherDraw } from "@/lib/types";
import { voucherTabHref, WINNER_PATH, winnerTabOf, type WinnerTab } from "@/lib/winner-links";

import { RatingPrizeTile } from "./rating-prize-tile";
import { SectionTitle } from "./section-title";
import { VoucherTab } from "./voucher-tab";
import { WinnerView } from "./winner-view";

/**
 * "G'oliblar" bo'limi. Tepada — "Baraban": sovrinni tanlab aylantirish (asosiy sovrinlarda 1 tadan,
 * voucherda 10 tadan g'olib chiqadi). Pastda ikki tab: "Asosiy sovrinlar" — oferta 6.2: har bir sovrin (avtomobil, sayohat,
 * iPhone, planshet) o'z ko'rishlar oralig'idagi ishtirokchilar orasidan random tanlov bilan; avtomobil
 * g'olibi keyin tekshiriladi, tasdiqlanadi va e'lon qilinadi. "Voucher" — oylik voucherlar uchun random
 * tanlov (sozlamalar, bosqich, "Tanlash", natija, tarix) va voucher g'oliblari.
 * URL: `?tab=voucher`, ochiq tanlov — `&draw=<id>`; asosiy sovrin tanlovi natijasi — "Asosiy sovrinlar"
 * tabida `?draw=<id>` (`src/lib/winner-links.ts`).
 */
export function WinnersView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = winnerTabOf(searchParams.get("tab"));
  const drawId = searchParams.get("draw");
  // Barabandagi tanlangan sovrin har bir havolada saqlanadi.
  const prize = searchParams.get("prize");

  return (
    <div className="space-y-6">
      <DrawDrumSection />
      <Segmented<WinnerTab>
        label="G'oliblar bo'limi"
        value={tab}
        onChange={(next) => {
          router.replace(keepPrize(next === "voucher" ? voucherTabHref() : WINNER_PATH, prize), { scroll: false });
        }}
        options={[
          { value: "main", label: "Asosiy sovrinlar", icon: Trophy },
          { value: "voucher", label: "Voucher", icon: Ticket },
        ]}
      />
      {tab === "voucher" ? (
        <VoucherTab />
      ) : drawId ? (
        <MainDrawResult key={drawId} id={drawId} backHref={keepPrize(WINNER_PATH, prize)} />
      ) : (
        <MainPrizes />
      )}
    </div>
  );
}

/** `href` ga barabandagi sovrinni (`?prize=`) qo'shadi. */
function keepPrize(href: string, prize: string | null): string {
  if (!prize) return href;
  return `${href}${href.includes("?") ? "&" : "?"}prize=${encodeURIComponent(prize)}`;
}

function MainPrizes() {
  const prizes = useQuery({ queryKey: ["rating-prizes"], queryFn: getRatingPrizes });
  const car = prizes.data?.tiers.find((tier) => tier.kind === "car");
  const others = prizes.data?.tiers.filter((tier) => tier.kind !== "car") ?? [];

  return (
    <div className="space-y-8">
      {/* Bosh sovrin — o'z kartochkasida (tanlov natijasi, tekshiruv, e'lon). */}
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

function isRatingPrizeKind(value: string): value is RatingPrizeKind {
  return Object.prototype.hasOwnProperty.call(RATING_PRIZE_LABELS, value);
}

/** Asosiy sovrin nomi (`main-car` → "BYD Chazor"); boshqa tanlovda — sovg'a nomi. */
function prizeName(draw: VoucherDraw): string {
  const kind = draw.prizeId.replace(/^main-/, "");
  return isRatingPrizeKind(kind) ? RATING_PRIZE_LABELS[kind] : draw.prizeTitle;
}

/**
 * Asosiy sovrin tanlovi natijasi ("Asosiy sovrinlar" tabida, `?draw=<id>`): orqaga qaytish, sarlavha va
 * natija — holati va keyingi qadam (avtomobilda — g'olib kartasiga o'tish).
 */
function MainDrawResult({ id, backHref }: { id: string; backHref: string }) {
  // Natija o'zgarsa (tasdiqlansa, yuborilsa, g'olib almashtirilsa), sovrin kartochkalari va avtomobil
  // g'olibi keshini DrawResult o'zi yangilaydi.
  const draw = useQuery({ queryKey: ["draw", id], queryFn: () => getDraw(id) });

  return (
    // id — baraban va sovrin kartochkasidagi havolalar sahifani shu yerga suradi (`#main-draw-result`).
    <section id="main-draw-result" className="scroll-mt-24 space-y-4" aria-labelledby="main-draw-title">
      <Link
        href={backHref}
        scroll={false}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:underline"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Asosiy sovrinlarga qaytish
      </Link>
      <SectionTitle
        id="main-draw-title"
        icon={Trophy}
        title={draw.data ? `${prizeName(draw.data)} — tanlov natijasi` : "Tanlov natijasi"}
      />
      {draw.isPending ? (
        <Spinner />
      ) : draw.isError ? (
        <p role="alert" className="text-sm text-red-700">
          {errorMessage(draw.error)}
        </p>
      ) : (
        <DrawResult draw={draw.data} />
      )}
    </section>
  );
}
