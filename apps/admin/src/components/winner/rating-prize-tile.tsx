"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Dices, ExternalLink } from "lucide-react";

import { RATING_PRIZE_ICONS } from "@/components/prizes/rating-prize";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getDrawSetup } from "@/lib/api";
import { formatDate, formatNumber, formatViewsRange } from "@/lib/format";
import { DRAW_STATUS_LABELS, DRAW_STATUS_TONES, RATING_PRIZE_LABELS } from "@/lib/labels";
import type { RatingPrizeEntry, RatingPrizeTier } from "@/lib/types";
import { cn } from "@/lib/utils";
import { voucherTabHref, WINNER_PATH } from "@/lib/winner-links";

/**
 * Asosiy sovrin kartochkasi (G'oliblar sahifasi): eni 350, bo'yi 420 px — yonma-yon turadi (tor
 * telefonda eni ekranga sig'adigan qilib qisqaradi). Oferta 6.2: g'oliblar shu sovrin oralig'idagi
 * ishtirokchilar (umumiy tasdiqlangan ko'rishlar bo'yicha) orasidan **random tanlov** bilan aniqlanadi.
 * Tanlov o'tkazilmagan bo'lsa — oraliqdagilar va "Random tanlov o'tkazish"; o'tkazilgan bo'lsa —
 * g'oliblar, zaxira va tanlovni ochish (tasdiqlash, almashtirish, xabar yuborish).
 */
export function RatingPrizeTile({ tier }: { tier: RatingPrizeTier }) {
  const Icon = RATING_PRIZE_ICONS[tier.kind];
  const label = RATING_PRIZE_LABELS[tier.kind];
  const draw = tier.draw;

  return (
    <Card className="flex h-[420px] w-[350px] max-w-full shrink-0 flex-col overflow-hidden">
      <div className="border-b border-line px-4 pt-4 pb-3">
        <div className="flex items-start gap-2.5">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600">
            <Icon className="size-[18px]" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="text-[15px] leading-tight font-semibold tracking-tight text-ink">{label}</h3>
            <span className="mt-1 inline-flex flex-wrap gap-1">
              <Badge className="px-2 text-[11px]">Random tanlov</Badge>
              {draw && (
                <Badge tone={DRAW_STATUS_TONES[draw.status]} className="px-2 text-[11px]">
                  #{draw.number} · {DRAW_STATUS_LABELS[draw.status]}
                </Badge>
              )}
            </span>
          </div>
        </div>
        <p className="mt-2.5 text-xs text-muted tabular-nums">
          {formatNumber(tier.quantity)} ta ·{" "}
          <span className="whitespace-nowrap">{formatViewsRange(tier.minViews, tier.maxViews)}</span> ko&apos;rish
          (jami) · <span className="whitespace-nowrap">{formatNumber(tier.eligibleCount)} ishtirokchi</span>
        </p>
      </div>

      {draw ? <DrawResult tier={tier} drawId={draw.id} /> : <BeforeDraw tier={tier} />}
    </Card>
  );
}

function DrawResult({ tier, drawId }: { tier: RatingPrizeTier; drawId: string }) {
  const label = RATING_PRIZE_LABELS[tier.kind];
  return (
    <>
      <div
        // Ro'yxat uzun bo'lsa aylanadi — klaviatura bilan ham aylantirish uchun fokuslanadi.
        tabIndex={0}
        role="region"
        aria-label={`${label}: g'oliblar va zaxira`}
        className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-2 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-500"
      >
        {tier.winners.length === 0 ? (
          <p className="px-2 py-3 text-sm text-muted">Faol g&apos;olib yo&apos;q.</p>
        ) : (
          <EntryList entries={tier.winners} />
        )}
        {tier.next.length > 0 && (
          <>
            <p className="px-2 pt-3 pb-1 text-[11px] font-medium text-slate-400">Zaxira g&apos;oliblar</p>
            <EntryList entries={tier.next} muted />
          </>
        )}
      </div>
      <div className="border-t border-line px-4 py-3">
        {tier.kind === "car" && (
          <p className="mb-2 text-xs text-muted">
            G&apos;olib quyida tekshiriladi va «E&apos;lon qilish» orqali tabriklanadi.
          </p>
        )}
        <Link
          href={voucherTabHref(drawId)}
          className="inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:underline"
        >
          Tanlovni ochish
          <ArrowRight className="size-3.5" aria-hidden />
        </Link>
      </div>
    </>
  );
}

function BeforeDraw({ tier }: { tier: RatingPrizeTier }) {
  const router = useRouter();
  const label = RATING_PRIZE_LABELS[tier.kind];
  const setup = useQuery({ queryKey: ["draw-setup"], queryFn: getDrawSetup });
  const settings = setup.data?.mainDefaults.find((item) => item.prizeId === `main-${tier.kind}`) ?? null;
  // Oferta 6.2.1, 7.5: asosiy sovrinlar aksiya yakunida — oxirgi kundan keyin (backend ham tekshiradi).
  const tooEarly = settings !== null && setup.data !== undefined && setup.data.today <= settings.periodTo;

  return (
    <>
      {tier.eligible.length === 0 ? (
        <p className="grid flex-1 place-items-center px-4 text-center text-sm text-muted">
          Bu oraliqda hozircha ishtirokchi yo&apos;q
        </p>
      ) : (
        <div
          tabIndex={0}
          role="region"
          aria-label={`${label}: oraliqdagi ishtirokchilar`}
          className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-2 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-500"
        >
          <p className="px-2 pb-1 text-[11px] font-medium text-slate-400">
            Oraliqdagi ishtirokchilar (nomzodlar){tier.eligibleCount > tier.eligible.length ? " — birinchilari" : ""}
          </p>
          <EntryList entries={tier.eligible} muted />
        </div>
      )}
      <div className="space-y-2 border-t border-line px-4 py-3">
        {/* Tanlov — tepadagi barabanda (g'oliblar birma-bir chiqadi). */}
        <Button
          size="sm"
          className="w-full"
          disabled={!settings || tier.eligibleCount === 0}
          onClick={() => router.replace(`${WINNER_PATH}?prize=main-${tier.kind}#baraban`, { scroll: false })}
        >
          <Dices className="size-4" aria-hidden />
          Barabanda aylantirish
        </Button>
        <p className="text-[11px] text-muted">
          {tooEarly && settings
            ? `Aksiya tugagach (${formatDate(settings.periodTo)} dan keyin) yakuniy ko'rishlar bo'yicha o'tkaziladi.`
            : "G'oliblar va zaxira tasodifiy tanlanadi (oferta 6.4); natija tasdiqlanmaguncha qoralama bo'lib turadi."}
        </p>
      </div>
    </>
  );
}

function EntryList({ entries, muted = false }: { entries: RatingPrizeEntry[]; muted?: boolean }) {
  return (
    <ol>
      {entries.map((entry) => (
        <EntryItem key={entry.participant.id} entry={entry} muted={muted} />
      ))}
    </ol>
  );
}

function EntryItem({ entry, muted }: { entry: RatingPrizeEntry; muted: boolean }) {
  const name = `${entry.participant.firstName} ${entry.participant.lastName}`;
  return (
    <li className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50">
      <span
        className={cn(
          "w-5 shrink-0 text-center text-xs font-semibold tabular-nums",
          muted ? "text-slate-400" : "text-ink",
        )}
      >
        {entry.place}
      </span>
      <div className="min-w-0 flex-1">
        <p className={cn("truncate text-sm font-medium", muted ? "text-slate-500" : "text-ink")} title={name}>
          {name}
        </p>
        <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted tabular-nums">
          <span>{formatNumber(entry.views)} ko&apos;rish</span>
          {entry.hasTarget && <Flag tone="danger" label="Target" rest="aniqlangan" />}
          {entry.flagged && <Flag tone="warning" label="Nakrutka" rest="shubhasi" />}
        </p>
      </div>
      {entry.reelUrl && (
        <a
          href={entry.reelUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${name}: Reelni ochish`}
          title="Eng ko'p ko'rilgan Reelni ochish"
          className="grid size-7 shrink-0 place-items-center rounded-md text-brand-700 hover:bg-brand-50"
        >
          <ExternalLink className="size-3.5" aria-hidden />
        </a>
      )}
    </li>
  );
}

/** Kichik belgi: rangli nuqta + bir so'z; to'liq matni ("Target aniqlangan") — sichqoncha va ekran o'quvchi uchun. */
function Flag({ tone, label, rest }: { tone: "danger" | "warning"; label: string; rest: string }) {
  return (
    <span
      title={`${label} ${rest}`}
      className={cn(
        "inline-flex items-center gap-1 font-medium",
        tone === "danger" ? "text-[#c2412b]" : "text-[#a7650f]",
      )}
    >
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      {label}
      <span className="sr-only"> {rest}</span>
    </span>
  );
}
