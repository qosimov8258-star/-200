"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, CheckCircle2, Dices, ExternalLink } from "lucide-react";

import { drumHref, mainPrizeId, RATING_PRIZE_ICONS } from "@/components/prizes/rating-prize";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getDrawSetup } from "@/lib/api";
import { formatDate, formatNumber, formatViewsRange } from "@/lib/format";
import { DRAW_STATUS_LABELS, DRAW_STATUS_TONES, RATING_PRIZE_LABELS } from "@/lib/labels";
import type { DrawStatus, RatingPrizeEntry, RatingPrizeTier } from "@/lib/types";
import { cn } from "@/lib/utils";
import { drawHref } from "@/lib/winner-links";

type TierDraw = NonNullable<RatingPrizeTier["draw"]>;

/** Tanlovdan keyingi qadam — plitka pastidagi asosiy havola. */
const NEXT_STEP_LABELS: Record<DrawStatus, string> = {
  DRAFT: "Natijani tasdiqlash",
  CONFIRMED: "G'oliblarga xabar yuborish",
  SENT: "Natijani ko'rish",
  CANCELLED: "Natijani ko'rish",
};

/** "Asosiy sovrinlar" tabidagi natija bo'limi (winners-view.tsx) — havola sahifani shu joyga suradi. */
const RESULT_ANCHOR = "main-draw-result";

/**
 * Asosiy sovrin kartochkasi (G'oliblar sahifasi): eni 350, bo'yi 420 px — yonma-yon turadi (tor
 * telefonda eni ekranga sig'adigan qilib qisqaradi). Oferta 6.2: g'oliblar shu sovrin oralig'idagi
 * ishtirokchilar (umumiy tasdiqlangan ko'rishlar bo'yicha) orasidan tasodifiy tanlanadi.
 * Tanlov o'tkazilmagan bo'lsa — oraliqdagilar va "Barabanda aylantirish"; o'tkazilgan bo'lsa —
 * g'oliblar, zaxira va holatga qarab keyingi qadam (tasdiqlash, xabar yuborish yoki natijani ko'rish).
 * Avtomobil uchun ishlatilmaydi: uning g'olibi tasdiqlash/xabar o'rniga g'olib kartasida tekshirilib,
 * e'lon qilinadi (`winner-view.tsx`).
 */
export function RatingPrizeTile({ tier }: { tier: RatingPrizeTier }) {
  const Icon = RATING_PRIZE_ICONS[tier.kind];
  const label = RATING_PRIZE_LABELS[tier.kind];

  return (
    <Card className="flex h-[420px] w-[350px] max-w-full shrink-0 flex-col overflow-hidden">
      <div className="border-b border-line px-4 pt-4 pb-3">
        <div className="flex items-start gap-2.5">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600">
            <Icon className="size-[18px]" aria-hidden />
          </span>
          <h3 className="min-w-0 flex-1 self-center text-[15px] leading-tight font-semibold tracking-tight text-ink">
            {label}
          </h3>
        </div>
        <p className="mt-2.5 text-xs text-muted tabular-nums">
          {formatNumber(tier.quantity)} ta ·{" "}
          <span className="whitespace-nowrap">{formatViewsRange(tier.minViews, tier.maxViews)}</span> ko&apos;rish
          (jami) · <span className="whitespace-nowrap">{formatNumber(tier.eligibleCount)} ishtirokchi</span>
        </p>
      </div>

      {tier.draw ? <DrawOutcome tier={tier} draw={tier.draw} /> : <BeforeDraw tier={tier} />}
    </Card>
  );
}

/** Tanlov o'tkazilgan: g'oliblar, zaxira va pastda — holat hamda keyingi qadam. */
function DrawOutcome({ tier, draw }: { tier: RatingPrizeTier; draw: TierDraw }) {
  const searchParams = useSearchParams();
  const label = RATING_PRIZE_LABELS[tier.kind];
  // Natija "Asosiy sovrinlar" tabida ochiladi; barabandagi tanlangan sovrin (`?prize=`) saqlanadi.
  const href = `${drawHref({ id: draw.id, prizeId: mainPrizeId(tier.kind) }, searchParams.get("prize"))}#${RESULT_ANCHOR}`;
  const step = NEXT_STEP_LABELS[draw.status];

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
        {draw.status === "SENT" ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Badge tone="success" className="gap-1">
              <CheckCircle2 className="size-3.5" aria-hidden />
              {DRAW_STATUS_LABELS.SENT}
            </Badge>
            <Link
              href={href}
              aria-label={`${label}: ${step.toLowerCase()}`}
              className="inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:underline"
            >
              {step}
              <ArrowRight className="size-3.5" aria-hidden />
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
              Tanlov #{draw.number}
              <Badge tone={DRAW_STATUS_TONES[draw.status]} className="px-2 text-[11px]">
                {DRAW_STATUS_LABELS[draw.status]}
              </Badge>
            </p>
            <Link
              href={href}
              aria-label={`${label}: ${step.toLowerCase()}`}
              className={cn(
                "inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-[10px] px-3 text-sm font-medium transition-colors",
                draw.status === "CANCELLED"
                  ? "border border-line bg-white text-ink hover:bg-brand-50/50"
                  : "bg-brand-500 text-white shadow-[0_6px_14px_-6px_rgba(124,98,219,0.8)] hover:bg-brand-600",
              )}
            >
              {step}
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
        )}
      </div>
    </>
  );
}

/** Tanlov hali o'tkazilmagan: oraliqdagi ishtirokchilar va "Barabanda aylantirish". */
function BeforeDraw({ tier }: { tier: RatingPrizeTier }) {
  const router = useRouter();
  const label = RATING_PRIZE_LABELS[tier.kind];
  const setup = useQuery({ queryKey: ["draw-setup"], queryFn: getDrawSetup });
  const prizeId = mainPrizeId(tier.kind);
  const settings = setup.data?.mainDefaults.find((item) => item.prizeId === prizeId) ?? null;
  // Oferta 6.2.1, 7.5: asosiy sovrinlar aksiya yakunida — oxirgi kundan keyin (backend ham tekshiradi).
  const tooEarly = settings !== null && setup.data !== undefined && setup.data.today <= settings.periodTo;

  /** Tepadagi barabanda shu sovrinni tanlaydi va sahifani o'sha yerga suradi (fokus ham o'sha yerga). */
  const openDrum = () => {
    router.replace(drumHref(prizeId), { scroll: false });
    // `scroll: false` da Next hash bo'yicha surmaydi — o'zimiz suramiz.
    const drum = document.getElementById("baraban");
    if (!drum) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    drum.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
    drum.focus({ preventScroll: true });
  };

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
        <Button size="sm" className="w-full" disabled={!settings || tier.eligibleCount === 0} onClick={openDrum}>
          <Dices className="size-4" aria-hidden />
          Barabanda aylantirish
        </Button>
        <p className="text-[11px] text-muted">
          {tooEarly && settings
            ? `Aksiya tugagach (${formatDate(settings.periodTo)} dan keyin) yakuniy ko'rishlar bo'yicha o'tkaziladi.`
            : "G'oliblar tasodifiy chiqadi. Natijani tasdiqlamaguningizcha hech kimga xabar bormaydi."}
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
