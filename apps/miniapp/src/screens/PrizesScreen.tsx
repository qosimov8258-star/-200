import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import {
  ArrowRight,
  CalendarDays,
  CarFront,
  Check,
  Crown,
  Dices,
  Info,
  Plane,
  ShoppingCart,
  Smartphone,
  Sparkles,
  Tablet,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";

import { SoapIcon } from "../components/SoapIcon";
import { Snowfall } from "../components/Snowfall";
import { Card, ErrorBlock, PageHeader, Spinner } from "../components/ui";
import { t } from "../i18n/uz";
import * as api from "../lib/api";
import { daysBetween, formatCount, formatDayMonth, tashkentToday } from "../lib/format";
import { PRIZE_PHOTO_HAS_BACKGROUND, prizePhoto, type PrizePhotoKey } from "../lib/prize-photos";
import type { ContestPrizes, PrizeStage, PrizeTier, PrizeTierKind } from "../lib/types";

/** Har bir toifaning rangi va belgisi. */
const TIER_STYLE: Record<
  PrizeTierKind,
  { icon: LucideIcon; card: string; node: string; chip: string }
> = {
  tablet: {
    icon: Tablet,
    card: "bg-[linear-gradient(135deg,#22c1ad,#0f7a8a)]",
    node: "bg-[#14a097]",
    chip: "bg-[#14a097]/15 text-[#0f7a8a]",
  },
  phone: {
    icon: Smartphone,
    card: "bg-[linear-gradient(135deg,#8173ff,#4330c9)]",
    node: "bg-[#5b49e6]",
    chip: "bg-[#5b49e6]/15 text-[#4330c9]",
  },
  travel: {
    icon: Plane,
    card: "bg-[linear-gradient(135deg,#ffa25c,#e2457a)]",
    node: "bg-[#f06a6a]",
    chip: "bg-[#f06a6a]/15 text-[#d2445f]",
  },
  car: {
    icon: CarFront,
    card: "bg-[linear-gradient(150deg,#2a2b30,#14151a_55%,#3a3020)]",
    node: "bg-gold",
    chip: "bg-gold/20 text-[#9a6c12]",
  },
};

const rise = (i: number): CSSProperties => ({ animationDelay: `${i * 80}ms` });

export function PrizesScreen({ onOpenReel, guest = false }: { onOpenReel: () => void; guest?: boolean }) {
  const prizes = useQuery({ queryKey: ["prizes"], queryFn: api.getPrizes });
  // Mehmonning videosi yo'q — so'ralmaydi (aks holda 401).
  const reels = useQuery({ queryKey: ["reels"], queryFn: api.getMyReels, enabled: !guest });

  return (
    <div className="space-y-6">
      <PageHeader title={t.prizesTitle} subtitle={t.prizesSubtitle} />
      {prizes.isPending ? (
        <Spinner />
      ) : prizes.isError ? (
        <ErrorBlock onRetry={() => void prizes.refetch()} />
      ) : (
        <>
          <FundHero prizes={prizes.data} style={rise(0)} />
          <MonthlySection prizes={prizes.data} style={rise(1)} />
          <TierLadder
            tiers={prizes.data.tiers}
            // Eng ko'p ko'rilgan qabul qilingan video ko'rishlari (videolar qo'shilmaydi);
            // birorta ham video yo'q bo'lsa — null.
            views={reels.data && reels.data.reels.length > 0 ? reels.data.bestViews : null}
            loading={!guest && reels.isPending}
            onOpenReel={onOpenReel}
            style={rise(2)}
          />
          <Notes notes={prizes.data.notes} style={rise(3)} />
          <p className="flex animate-rise items-center justify-center gap-2 pt-1 text-[22px] font-bold tracking-tight" style={rise(4)}>
            <SoapIcon className="size-10 -translate-y-1" />
            {t.goodLuck}
          </p>
        </>
      )}
    </div>
  );
}

// --- Sovrin fondi ------------------------------------------------------------

/** 0 dan `target` gacha sanab chiqadi (harakat kamaytirilgan bo'lsa — darhol). */
function useCountUp(target: number, durationMs = 1100): number {
  const [reduced] = useState(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (reduced) return;
    let frame = 0;
    const started = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - started) / durationMs);
      setValue(Math.round(target * (1 - (1 - p) ** 3)));
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, durationMs, reduced]);
  return reduced ? target : value;
}

function FundHero({ prizes, style }: { prizes: ContestPrizes; style: CSSProperties }) {
  const total = prizes.monthly.total + prizes.tiers.reduce((sum, tier) => sum + tier.quantity, 0);
  const count = useCountUp(total);
  const chips: { key: string; icon: LucideIcon; count: number; node: string }[] = [
    { key: "voucher", icon: ShoppingCart, count: prizes.monthly.total, node: "bg-[#18a058]" },
    ...prizes.tiers.map((tier) => ({
      key: tier.kind,
      icon: TIER_STYLE[tier.kind].icon,
      count: tier.quantity,
      node: TIER_STYLE[tier.kind].node,
    })),
  ];

  return (
    <section
      className="relative isolate animate-rise overflow-hidden rounded-card bg-[linear-gradient(160deg,#17181c,#25213a_55%,#1a1712)] p-[22px] text-white"
      style={style}
    >
      {/* Suzuvchi rangli nurlar */}
      <div aria-hidden className="absolute -top-16 -left-10 -z-10 size-56 animate-float rounded-full bg-[#7b4dff]/45 blur-3xl" />
      <div
        aria-hidden
        className="absolute -right-12 -bottom-20 -z-10 size-64 animate-float rounded-full bg-gold/35 blur-3xl [animation-delay:-4s]"
      />
      <div aria-hidden className="absolute top-10 right-8 -z-10 size-28 animate-float rounded-full bg-[#22c1ad]/30 blur-2xl [animation-delay:-2s]" />
      <Sparkles aria-hidden className="absolute top-5 right-5 size-5 animate-pulse text-gold" />
      <Snowfall density={0.8} />

      <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[12px] font-semibold tracking-wide text-white/85 uppercase backdrop-blur">
        <Sparkles className="size-3.5" />
        {t.fundLabel}
      </span>
      <p className="mt-4 flex items-end gap-2.5">
        <span className="bg-[linear-gradient(180deg,#ffffff,#ffe2aa)] bg-clip-text text-[68px] leading-[0.9] font-black tracking-tighter text-transparent tabular-nums">
          {count}
        </span>
        <span className="pb-1.5 text-lg font-semibold text-white/80">{t.fundTotal}</span>
      </p>
      <p className="mt-3 text-[14.5px] leading-snug text-white/70">{t.fundBody}</p>

      <div className="mt-5 grid grid-cols-5 gap-2">
        {chips.map(({ key, icon: Icon, count: n, node }) => (
          <div
            key={key}
            className="flex flex-col items-center gap-1.5 rounded-[18px] border border-white/10 bg-white/[0.07] px-1 py-2.5 backdrop-blur"
          >
            <span className={clsx("grid size-9 place-items-center rounded-full text-white shadow-[0_4px_12px_rgba(0,0,0,0.35)]", node)}>
              <Icon className="size-[18px]" strokeWidth={2.2} />
            </span>
            <span className="text-[13px] font-bold tabular-nums">{formatCount(n)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

// --- Har oylik voucher va bosqichlar -------------------------------------------

function MonthlySection({ prizes, style }: { prizes: ContestPrizes; style: CSSProperties }) {
  const { monthly, stages } = prizes;
  return (
    <section className="animate-rise space-y-3" style={style}>
      {/* Kupon: tepa qism, teshikli chiziq, pastki qism */}
      <div className="relative isolate overflow-hidden rounded-card bg-[linear-gradient(140deg,#1fb36a,#0c6b3b)] text-white shadow-[0_14px_30px_rgba(16,120,70,0.28)]">
        <div aria-hidden className="absolute -top-14 -right-10 -z-10 size-44 rounded-full bg-white/10" />
        <div aria-hidden className="absolute top-16 -right-16 -z-10 size-44 rounded-full bg-white/[0.07]" />
        {prizePhoto("voucher") ? (
          <CornerPhoto kind="voucher" alt={monthly.title} className="top-4 right-4 h-[66px] w-[86px] rotate-[-5deg]" />
        ) : (
          <ShoppingCart aria-hidden className="absolute top-6 right-5 -z-10 size-20 -rotate-12 text-white/15" strokeWidth={1.6} />
        )}

        <div className="px-[22px] pt-5 pb-4">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-[12px] font-bold tracking-wide uppercase">
            <CalendarDays className="size-3.5" />
            {t.monthlyTag}
          </span>
          <p className="mt-3 text-[15px] font-semibold text-white/85">{monthly.title}</p>
          <p className="mt-0.5 flex items-baseline gap-2">
            <span className="text-[46px] leading-none font-black tracking-tight tabular-nums">
              {formatCount(monthly.amount)}
            </span>
            <span className="text-lg font-bold text-white/85">{t.sum}</span>
          </p>
        </div>

        <div aria-hidden className="relative h-6">
          <span className="absolute top-0 -left-3 size-6 rounded-full bg-bg" />
          <span className="absolute top-0 -right-3 size-6 rounded-full bg-bg" />
          <span className="absolute inset-x-5 top-1/2 border-t-2 border-dashed border-white/35" />
        </div>

        <div className="grid grid-cols-3 divide-x divide-white/20 px-2 pt-2 pb-5 text-center">
          <TicketStat value={formatCount(monthly.perMonth)} label={t.perMonth} />
          <TicketStat value={formatCount(monthly.total)} label={t.totalPieces} />
          <TicketStat value={<Dices className="mx-auto size-7" strokeWidth={2} />} label={t.randomDraw} />
        </div>
      </div>

      <Card className="space-y-4">
        <div className="flex gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-positive/12 text-positive">
            <Users className="size-5" />
          </span>
          <p className="text-[14.5px] leading-snug">
            {t.monthlyWho(formatCount(monthly.minViews), formatCount(monthly.maxViews))}
            <span className="mt-1 block text-[13px] text-muted">{t.monthlyDraw}</span>
          </p>
        </div>
        <Stages stages={stages} />
      </Card>
    </section>
  );
}

function TicketStat({ value, label }: { value: ReactNode; label: string }) {
  return (
    <div className="px-1">
      <div className="flex h-8 items-center justify-center text-[24px] leading-none font-black tabular-nums">{value}</div>
      <div className="mt-1 text-[12px] font-medium text-white/80">{label}</div>
    </div>
  );
}

type StageState = "done" | "now" | "soon";

function stageState(stage: PrizeStage, today: string): StageState {
  if (today > stage.endsOn) return "done";
  if (today >= stage.startsOn) return "now";
  return "soon";
}

const yearsOf = (s: PrizeStage) => {
  const a = s.startsOn.slice(0, 4);
  const b = s.endsOn.slice(0, 4);
  return a === b ? a : `${a}–${b}`;
};

function Stages({ stages }: { stages: PrizeStage[] }) {
  const today = tashkentToday();
  const states = stages.map((s) => stageState(s, today));
  const nowIndex = states.indexOf("now");
  const soonIndex = states.indexOf("soon");

  let status: string;
  let progress: number | null = null;
  if (nowIndex >= 0) {
    const s = stages[nowIndex];
    status = t.stageEndsIn(nowIndex + 1, daysBetween(today, s.endsOn));
    progress = (daysBetween(s.startsOn, today) + 1) / (daysBetween(s.startsOn, s.endsOn) + 1);
  } else if (soonIndex >= 0) {
    status = t.stageStartsIn(soonIndex + 1, daysBetween(today, stages[soonIndex].startsOn));
  } else {
    status = t.stagesFinished;
  }
  const focus = nowIndex >= 0 ? nowIndex : soonIndex;

  return (
    <div>
      <h3 className="flex items-center gap-2 font-bold">
        <CalendarDays className="size-[18px]" />
        {t.stagesTitle}
      </h3>
      <ol className="mt-3 grid grid-cols-3 gap-2">
        {stages.map((stage, i) => {
          const state = states[i];
          const focused = i === focus;
          return (
            <li
              key={stage.startsOn}
              className={clsx(
                "relative rounded-[18px] px-2.5 pt-2.5 pb-3 transition",
                focused ? "bg-ink text-white shadow-[0_8px_18px_rgba(30,31,34,0.22)]" : "bg-chip",
              )}
            >
              <div className="flex items-center justify-between">
                <span
                  className={clsx(
                    "grid size-6 place-items-center rounded-full text-[12px] font-black",
                    state === "done"
                      ? "bg-positive text-white"
                      : focused
                        ? "bg-gold text-ink"
                        : "bg-surface text-ink",
                  )}
                >
                  {state === "done" ? <Check className="size-3.5" strokeWidth={3} /> : i + 1}
                </span>
                {state === "now" && <span className="size-2 animate-pulse rounded-full bg-[#3ee089]" />}
              </div>
              <p className="mt-2.5 text-[13px] leading-tight font-bold whitespace-nowrap">
                {formatDayMonth(stage.startsOn)} – {formatDayMonth(stage.endsOn)}
              </p>
              <p className={clsx("mt-0.5 text-[11px]", focused ? "text-white/60" : "text-muted")}>{yearsOf(stage)}</p>
              <p
                className={clsx(
                  "mt-2 text-[11px] font-semibold",
                  state === "now" ? "text-[#3ee089]" : state === "done" ? "text-positive" : focused ? "text-gold" : "text-muted",
                )}
              >
                {state === "now" ? t.stageNow : state === "done" ? t.stageDone : t.stageSoon}
              </p>
            </li>
          );
        })}
      </ol>
      <p className="mt-3 text-[13.5px] font-medium">{status}</p>
      {progress !== null && (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-chip">
          <div className="h-full rounded-full bg-positive" style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>
      )}
    </div>
  );
}

// --- Asosiy sovrinlar zinapoyasi -----------------------------------------------

const rangeLabel = (tier: PrizeTier) =>
  tier.maxViews === null
    ? `${formatCount(tier.minViews)} ${t.viewsWord} ${t.andMore}`
    : `${formatCount(tier.minViews)} – ${formatCount(tier.maxViews)} ${t.viewsWord}`;

/**
 * Pastdan yuqoriga "cho'qqiga chiqish": eng pastda — ishtirokchining eng ko'p ko'rilgan videosi
 * ko'rishlari, tepada — bosh sovrin. Tugunlar orasidagi chiziq ko'rishlar soniga qarab to'ladi.
 */
function TierLadder({
  tiers,
  views,
  loading,
  onOpenReel,
  style,
}: {
  tiers: PrizeTier[];
  views: number | null;
  loading: boolean;
  onOpenReel: () => void;
  style: CSSProperties;
}) {
  const v = views ?? 0;
  const next = tiers.find((tier) => tier.minViews > v) ?? null;
  // Yuqoridan pastga: avtomobil → … → planshet.
  const rows = [...tiers].reverse();

  return (
    <section className="animate-rise" style={style}>
      <h2 className="text-[22px] font-bold tracking-tight">{t.mainTitle}</h2>
      <p className="mt-1 text-[13px] text-muted">{t.mainSubtitle}</p>

      <ol className="mt-5 space-y-4">
        {rows.map((tier) => {
          const reached = v >= tier.minViews;
          const current = reached && (tier.maxViews === null || v <= tier.maxViews);
          return (
            <TierRow
              key={tier.kind}
              tier={tier}
              reached={reached}
              current={current}
              isNext={next === tier}
              left={tier.minViews - v}
              views={v}
            />
          );
        })}
        <StartRow views={views} loading={loading} next={next} onOpenReel={onOpenReel} />
      </ol>
    </section>
  );
}

function TierRow({
  tier,
  reached,
  current,
  isNext,
  left,
  views,
}: {
  tier: PrizeTier;
  reached: boolean;
  current: boolean;
  isNext: boolean;
  left: number;
  views: number;
}) {
  const style = TIER_STYLE[tier.kind];
  const Icon = style.icon;
  const isCar = tier.kind === "car";
  const hasPhoto = prizePhoto(tier.kind) !== null;
  const inTier =
    current && tier.maxViews !== null
      ? (views - tier.minViews) / (tier.maxViews - tier.minViews)
      : null;

  const card = (
    <div
      className={clsx(
        "relative isolate overflow-hidden p-4 text-white",
        isCar ? "rounded-[23px]" : "rounded-[24px]",
        style.card,
      )}
    >
      {hasPhoto ? (
        <CornerPhoto
          kind={tier.kind}
          alt={tier.title}
          className={isCar ? "right-3 bottom-3 h-[84px] w-[132px]" : "right-3 bottom-3 size-[92px]"}
        />
      ) : (
        <Icon
          aria-hidden
          className="absolute -right-5 -bottom-6 -z-10 size-32 -rotate-12 text-white/15"
          strokeWidth={1.4}
        />
      )}
      {isCar && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-0 -z-10 w-1/3 animate-sheen bg-[linear-gradient(90deg,transparent,rgba(255,226,170,0.22),transparent)]"
        />
      )}

      <div className="flex items-center justify-between gap-2">
        <span
          className={clsx(
            "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-bold backdrop-blur",
            isCar ? "bg-gold text-ink" : "bg-white/20",
          )}
        >
          {isCar && <Crown className="size-3.5" strokeWidth={2.4} />}
          {isCar ? t.mainPrize : t.pieces(tier.quantity, tier.unit)}
        </span>
        {current ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-[12px] font-bold text-ink">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-positive opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-positive" />
            </span>
            {t.youAreHere}
          </span>
        ) : reached ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-1 text-[12px] font-bold">
            <Check className="size-3.5" strokeWidth={3} />
            {t.tierReached}
          </span>
        ) : isNext ? (
          <span className="rounded-full bg-black/25 px-2.5 py-1 text-[12px] font-bold whitespace-nowrap tabular-nums">
            {t.viewsLeft(formatCount(left))}
          </span>
        ) : null}
      </div>

      {/* Matn rasm ustiga chiqmasin — o'ngda rasm eni qadar joy. */}
      <div className={clsx(hasPhoto && (isCar ? "pr-[144px]" : "pr-[104px]"))}>
        <h3 className={clsx("mt-3 leading-tight font-bold tracking-tight", isCar ? "text-[24px]" : "text-[20px]")}>
          {tier.title}
        </h3>
        <p className="mt-1 text-[13px] font-medium text-white/80 tabular-nums">{rangeLabel(tier)}</p>

        {inTier !== null && (
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/25">
            <div className="h-full rounded-full bg-white" style={{ width: `${Math.max(4, Math.round(inTier * 100))}%` }} />
          </div>
        )}
        <p className="mt-2.5 text-[12px] text-white/75">{t.tierWinners(tier.quantity)}</p>
      </div>
    </div>
  );

  return (
    <li>
      <div className="min-w-0">
        {isCar ? (
          <div className="rounded-[24px] bg-[linear-gradient(135deg,#ffe2aa,#c8922a_45%,#ffe2aa)] p-[1.5px] shadow-[0_14px_30px_rgba(200,146,42,0.3)]">
            {card}
          </div>
        ) : (
          card
        )}
      </div>
    </li>
  );
}

function StartRow({
  views,
  loading,
  next,
  onOpenReel,
}: {
  views: number | null;
  loading: boolean;
  next: PrizeTier | null;
  onOpenReel: () => void;
}) {
  return (
    <li>
      <Card className="min-w-0 rounded-[24px] p-4">
        <p className="text-[12.5px] font-medium text-muted">{t.startLabel}</p>
        {loading ? (
          <p className="mt-1 text-[28px] font-black text-muted">…</p>
        ) : views === null ? (
          <>
            <p className="mt-1 text-[14.5px] leading-snug">{t.startNoReel}</p>
            <button
              type="button"
              onClick={onOpenReel}
              className="mt-3 inline-flex h-11 items-center gap-2 rounded-full bg-ink px-5 text-[14px] font-semibold text-white transition active:scale-[0.98]"
            >
              {t.startSendVideo}
              <ArrowRight className="size-4" />
            </button>
          </>
        ) : (
          <>
            <p className="mt-0.5 flex items-baseline gap-1.5">
              <span className="text-[30px] font-black tracking-tight tabular-nums">{formatCount(views)}</span>
              <span className="text-[14px] font-semibold text-muted">{t.viewsWord}</span>
            </p>
            <p className="mt-1.5 text-[13px] leading-snug text-muted">
              {next ? t.startNext(next.title, formatCount(next.minViews - views)) : t.startTop}
            </p>
          </>
        )}
      </Card>
    </li>
  );
}

// --- Muhim -------------------------------------------------------------------

function Notes({ notes, style }: { notes: string[]; style: CSSProperties }) {
  return (
    <Card className="animate-rise" style={style}>
      <h2 className="flex items-center gap-2 text-lg font-bold">
        <Info className="size-5" />
        {t.notesTitle}
      </h2>
      <ul className="mt-3 space-y-3">
        {notes.map((note, i) => (
          <li key={note} className="flex gap-3 text-[14.5px] leading-snug">
            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-gold/20 text-[12px] font-black text-[#9a6c12]">
              {i + 1}
            </span>
            {note}
          </li>
        ))}
      </ul>
    </Card>
  );
}

/**
 * Kartaning burchagidagi sovg'a rasmi — oq, yumaloq plitkada. Shaffof rasm (avtomobil, telefon)
 * plitka ichida to'liq ko'rinadi; o'z foni bor rasm (planshet, sayohat, voucher) plitkani to'ldiradi.
 */
function CornerPhoto({ kind, alt, className }: { kind: PrizePhotoKey; alt: string; className: string }) {
  const src = prizePhoto(kind);
  if (!src) return null;
  return (
    <div
      className={clsx(
        "pointer-events-none absolute overflow-hidden rounded-[18px] bg-white shadow-[0_10px_22px_-10px_rgba(0,0,0,0.55)] ring-2 ring-white/60",
        className,
      )}
    >
      <img
        src={src}
        alt={alt}
        draggable={false}
        className={clsx("size-full", PRIZE_PHOTO_HAS_BACKGROUND[kind] ? "object-cover" : "object-contain p-1.5")}
      />
    </div>
  );
}
