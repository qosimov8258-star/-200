"use client";

import { useCallback, useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import { flushSync } from "react-dom";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { queryOptions, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowRight,
  Dices,
  FastForward,
  PartyPopper,
  RefreshCw,
  RotateCcw,
  Ticket,
  type LucideIcon,
} from "lucide-react";

import { CAR_PRIZE_ID, CAR_WINNER_ANCHOR, RATING_PRIZE_ICONS } from "@/components/prizes/rating-prize";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { SectionTitle } from "@/components/winner/section-title";
import { API_MODE, getDraw, getDraws, getDrawSetup, previewDraw, runDraw } from "@/lib/api";
import { errorMessage } from "@/lib/api-error";
import { periodLabel } from "@/lib/draw-rules";
import { formatDate, formatNumber, formatViewsRange } from "@/lib/format";
import { DRAW_STATUS_LABELS, DRAW_STATUS_TONES, RATING_PRIZE_LABELS } from "@/lib/labels";
import type {
  DrawEntry,
  DrawSettings,
  DrawSetup,
  DrawStatus,
  RatingPrizeKind,
  VoucherDraw,
  VoucherDrawSummary,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import { drawHref, WINNER_PATH } from "@/lib/winner-links";

/**
 * Lentaning aylanish vaqti (jonli efirda tomoshabin kuzatib tursin), ms: bosh sovrin — avtomobil —
 * eng uzoq. Voucherda ko'p aylanish bo'lsa — "Qolganini birdaniga ko'rsatish" bor.
 */
const SPIN_MS: Record<RatingPrizeKind, number> = { car: 15_000, travel: 7_000, phone: 10_000, tablet: 7_000 };
const VOUCHER_SPIN_MS = 6_000;
/** Lenta tezligi: soniyasiga shuncha ism o'tadi (o'rtacha) — vaqt uzaysa, yo'l ham uzayadi. */
const ROWS_PER_SECOND = 11;
/** Asosiy sovrinlar tartibi — qimmatidan. */
const MAIN_ORDER: RatingPrizeKind[] = ["car", "travel", "phone", "tablet"];
/** `maxViews` shundan katta bo'lsa — yuqori chegara yo'q ("4 000 001+"). */
const NO_UPPER_LIMIT = 1_000_000_000;
/**
 * G'oliblar ko'rinadigan so'rovlar (sovrin kartochkalari, voucher g'oliblari, avtomobil g'olibi):
 * baraban hamma g'olibni ochib bo'lmaguncha yangilanmaydi — natija oldindan ko'rinib qolmasin.
 */
const RESULT_QUERY_KEYS = ["draws", "rating-prizes", "winner"] as const;
/** Hamma g'olib ochilgandan keyingi qadam: izoh va havola matni (holat bo'yicha). */
const NEXT_STEPS: Record<DrawStatus, { text: string; label: string }> = {
  DRAFT: {
    text: "Hamma g'oliblar aniqlandi. Endi natijani tekshirib tasdiqlang, keyin g'oliblarga xabar yuborasiz.",
    label: "Natijani tasdiqlash",
  },
  CONFIRMED: { text: "Natija tasdiqlangan — g'oliblarga xabar yuborish qoldi.", label: "G'oliblarga xabar yuborish" },
  SENT: { text: "Bu sovrin bo'yicha g'oliblarga xabar yuborilgan.", label: "Natijani ko'rish" },
  CANCELLED: { text: "Bu tanlov bekor qilingan.", label: "Natijani ko'rish" },
};
/**
 * Avtomobilda natija tasdiqlanmaydi va xabar yuborilmaydi: g'olib avtomobil g'olibi kartasida
 * yuzma-yuz tekshiriladi, tasdiqlanadi va e'lon qilinadi (tabrik e'lon bilan birga boradi).
 */
const CAR_NEXT_STEP = {
  text: "G'olib aniqlandi. Uni yuzma-yuz tekshirish, tasdiqlash va e'lon qilish — avtomobil g'olibi kartasida.",
  label: "G'olib kartasini ochish",
};

/** Barabanda o'ynaladigan bitta sovrin: asosiy sovrin yoki bir bosqich voucherlari. */
interface DrumPrize {
  /** `main-car` … yoki `monthly-1` … — URL dagi `?prize=`. */
  key: string;
  label: string;
  prizeTitle: string;
  icon: LucideIcon;
  /** Nechta g'olib aniqlanadi. */
  quantity: number;
  /** Bir aylanishda nechta g'olib chiqadi: asosiy sovrinlarda 1 ta, voucherda 10 ta. */
  batch: number;
  /** Bir aylanish qancha davom etadi, ms. */
  spinMs: number;
  settings: DrawSettings;
  /** Shu sovrin (bosqich) uchun o'tkazilgan, bekor qilinmagan tanlov. */
  existing: VoucherDrawSummary | null;
  /** Hozir aylantirib bo'lmasligi sababi; null — mumkin. */
  blocker: string | null;
  /** Ogohlantirish (bosqich tugamagan, sinov rejimi). */
  note: string | null;
}

/** Shu sahifada barabanda ochilayotgan tanlov: g'oliblar aylanish bo'yicha birma-bir (10 tadan) ochiladi. */
interface DrumReveal {
  drawId: string;
  /** Nechta g'olib ochilgan. */
  revealed: number;
  /** Oxirgi aylanishda ochilganlarning boshi — yangilari ajratib ko'rsatiladi. */
  freshFrom: number;
}

function drumPrizes(setup: DrawSetup, draws: VoucherDrawSummary[]): DrumPrize[] {
  const active = (prizeId: string, stage: number | null) =>
    draws.find((d) => d.prizeId === prizeId && d.stage === stage && d.status !== "CANCELLED") ?? null;

  const main = MAIN_ORDER.flatMap((kind): DrumPrize[] => {
    const prize = setup.prizes.find((p) => p.kind === kind);
    const settings = prize ? setup.mainDefaults.find((s) => s.prizeId === prize.id) : undefined;
    if (!prize || !settings) return [];
    // Oferta 6.2.1: asosiy sovrinlar aksiya yakunida — oxirgi kundan keyin (backend ham tekshiradi).
    const tooEarly = setup.today <= settings.periodTo;
    const mock = API_MODE === "mock";
    return [
      {
        key: prize.id,
        label: RATING_PRIZE_LABELS[kind],
        prizeTitle: prize.title,
        icon: RATING_PRIZE_ICONS[kind],
        quantity: settings.winnersCount,
        batch: 1,
        spinMs: SPIN_MS[kind],
        settings,
        existing: active(prize.id, settings.stage),
        blocker:
          tooEarly && !mock
            ? `Asosiy sovrinlar aksiya tugagach — ${formatDate(settings.periodTo)} dan keyin o'ynaladi (oferta 6.2.1).`
            : null,
        note: tooEarly && mock ? "Sinov rejimi: haqiqiy panelda bu tanlov aksiya tugagach ochiladi." : null,
      },
    ];
  });

  const monthly = setup.prizes.find((p) => p.id === setup.defaults.prizeId);
  const vouchers = setup.stages.map((stage): DrumPrize => {
    const settings: DrawSettings = {
      ...setup.defaults,
      stage: stage.index,
      periodFrom: stage.startsOn,
      periodTo: stage.endsOn,
    };
    const notStarted = setup.today < stage.startsOn;
    return {
      key: `monthly-${stage.index}`,
      label: `Voucher · ${stage.index}-bosqich`,
      prizeTitle: monthly?.title ?? "Voucher",
      icon: Ticket,
      quantity: settings.winnersCount,
      batch: 10,
      spinMs: VOUCHER_SPIN_MS,
      settings,
      existing: active(settings.prizeId, stage.index),
      blocker: notStarted ? `${stage.index}-bosqich hali boshlanmagan (${formatDate(stage.startsOn)} dan).` : null,
      note:
        !notStarted && !stage.finished ? "Bosqich hali tugamagan — ko'rishlar bugungi holat bo'yicha olinadi." : null,
    };
  });

  return [...main, ...vouchers];
}

/**
 * G'oliblar → "Baraban": sovrinni tanlab, barabanni aylantirish. Asosiy sovrinlarda (avtomobil,
 * sayohat, iPhone, planshet) har aylanishda 1 ta g'olib, voucherda — 10 ta. Qatnashuvchilar —
 * sovrin oralig'idagi ko'rishlarga ega ishtirokchilar (oferta 6.1–6.2).
 *
 * Adolat: birinchi aylanishda server tanlovni o'tkazadi (kriptografik kalit, nomzodlar izi — o'zgarmaydi);
 * baraban g'oliblarni shu natija tartibida birma-bir ochib beradi. Natija tasdiqlanmagan holda turadi —
 * keyin natija sahifasida tekshirib, tasdiqlanadi va g'oliblarga yuboriladi (avtomobilda esa g'olib
 * avtomobil g'olibi kartasida tekshirilib, e'lon qilinadi).
 *
 * Aylanish paytida boshqa sovrinni tanlab bo'lmaydi; ochilish holati shu bo'limda saqlanadi — sovrin
 * almashtirib qaytilsa, qolgan g'oliblarni ochish davom etadi.
 */
export function DrawDrumSection() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setup = useQuery({ queryKey: ["draw-setup"], queryFn: getDrawSetup });
  const draws = useQuery({ queryKey: ["draws"], queryFn: getDraws });
  /** Hozir aylanayotgan sovrin: aylanish tugaguncha baraban shu sovrinda qoladi (URL o'zgarsa ham). */
  const [spinningKey, setSpinningKey] = useState<string | null>(null);
  /** Ochilayotgan tanlovlar — sovrin kaliti bo'yicha. */
  const [reveals, setReveals] = useState<Partial<Record<string, DrumReveal>>>({});

  const prizes = setup.data && draws.data ? drumPrizes(setup.data, draws.data) : [];
  const fallback = setup.data ? `monthly-${setup.data.defaults.stage ?? 1}` : null;
  const wanted = searchParams.get("prize") ?? fallback;
  const selected =
    prizes.find((p) => p.key === spinningKey) ??
    prizes.find((p) => p.key === wanted) ??
    prizes.find((p) => p.key === fallback) ??
    prizes[0] ??
    null;

  const choose = (key: string) => {
    if (spinningKey !== null) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("prize", key);
    params.delete("draw");
    router.replace(`?${params.toString()}#baraban`, { scroll: false });
  };

  const saveReveal = (key: string, next: DrumReveal) => setReveals((prev) => ({ ...prev, [key]: next }));
  const markSpinning = (key: string, on: boolean) =>
    setSpinningKey((prev) => (on ? key : prev === key ? null : prev));

  return (
    // tabIndex: sovrin kartochkasidagi "Barabanda aylantirish" fokusni shu yerga olib keladi.
    <section id="baraban" tabIndex={-1} className="scroll-mt-24 space-y-4 outline-none" aria-labelledby="drum-title">
      <SectionTitle
        id="drum-title"
        icon={Dices}
        title="Baraban — tasodifiy tanlov"
        meta="Sovrinni tanlang va aylantiring"
      />
      <Card className="overflow-hidden">
        {setup.isPending || draws.isPending ? (
          <Spinner className="p-6" />
        ) : !setup.data || !draws.data ? (
          // Faqat ma'lumot umuman yo'q bo'lsa: fonda qayta yuklash xatosi barabanni yopib qo'ymaydi.
          <p role="alert" className="p-6 text-sm text-red-700">
            {errorMessage(setup.error ?? draws.error)}
          </p>
        ) : (
          <>
            <div className="border-b border-line p-4">
              <div role="tablist" aria-label="Sovrin" className="flex flex-wrap gap-2">
                {prizes.map((prize) => {
                  const Icon = prize.icon;
                  const on = prize.key === selected?.key;
                  const locked = spinningKey !== null && !on;
                  return (
                    <button
                      key={prize.key}
                      type="button"
                      role="tab"
                      aria-selected={on}
                      disabled={locked}
                      onClick={() => choose(prize.key)}
                      className={cn(
                        "inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                        on
                          ? "border-brand-500 bg-brand-500 text-white shadow-[0_6px_14px_-6px_rgba(124,98,219,0.8)]"
                          : "border-line bg-white text-ink enabled:hover:bg-brand-50",
                      )}
                    >
                      <Icon className="size-4" aria-hidden />
                      {prize.label}
                      <span className={cn("tabular-nums", on ? "text-white/80" : "text-muted")}>
                        · {formatNumber(prize.quantity)} ta
                      </span>
                      {prize.existing && (
                        <span
                          role="img"
                          aria-label="tanlov o'tkazilgan"
                          className={cn("size-2 rounded-full", on ? "bg-white" : "bg-up-bar")}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
              {spinningKey !== null && (
                <p className="mt-2 text-xs text-muted">
                  Baraban aylanmoqda — tugagach boshqa sovrinni tanlashingiz mumkin.
                </p>
              )}
            </div>
            {selected && (
              <PrizeDrum
                key={selected.key}
                prize={selected}
                reveal={reveals[selected.key] ?? null}
                onReveal={(next) => saveReveal(selected.key, next)}
                spinning={spinningKey === selected.key}
                onSpinningChange={(on) => markSpinning(selected.key, on)}
              />
            )}
          </>
        )}
      </Card>
    </section>
  );
}

const fullName = (entry: DrawEntry) => `${entry.candidate.firstName} ${entry.candidate.lastName}`.trim();

function activeWinners(draw: VoucherDraw | null): DrawEntry[] {
  if (!draw) return [];
  return draw.winnerEntries.filter((entry) => entry.state === "ACTIVE").sort((a, b) => a.position - b.position);
}

/** Tanlov — doim keshdan (`["draw", id]`): natija sahifasidagi o'zgarishlar barabanda ham ko'rinadi. */
function drawQuery(id: string | null) {
  return queryOptions({
    queryKey: ["draw", id],
    queryFn: () => (id ? getDraw(id) : Promise.reject(new Error("Tanlov topilmadi."))),
    enabled: id !== null,
  });
}

/** Bekor qilingan tanlov barabanda ko'rsatilmaydi — baraban yangi tanlovga tayyor turadi. */
function liveDraw(draw: VoucherDraw | undefined): VoucherDraw | null {
  return draw && draw.status !== "CANCELLED" ? draw : null;
}

/**
 * Hamma g'olib ochilgandan keyingi qadam: izoh, havola matni va manzili. Barabandagi tanlangan sovrin
 * (`?prize=`) saqlanadi va sahifa kerakli joyga suriladi.
 */
function nextStep(draw: VoucherDraw, prizeKey: string): { text: string; label: string; href: string } {
  if (draw.prizeId === CAR_PRIZE_ID) {
    return { ...CAR_NEXT_STEP, href: `${WINNER_PATH}?prize=${encodeURIComponent(prizeKey)}#${CAR_WINNER_ANCHOR}` };
  }
  // Natija joyi: winners-view.tsx ("Asosiy sovrinlar" tabi) va voucher-tab.tsx ("Voucher" tabi).
  const anchor = draw.prizeId.startsWith("main-") ? "main-draw-result" : "voucher-draw-title";
  return { ...NEXT_STEPS[draw.status], href: `${drawHref(draw, prizeKey)}#${anchor}` };
}

function PrizeDrum({
  prize,
  reveal,
  onReveal,
  spinning,
  onSpinningChange,
}: {
  prize: DrumPrize;
  /** Shu sovrin bo'yicha ochilayotgan tanlov (bo'limda saqlanadi); null — yo'q. */
  reveal: DrumReveal | null;
  onReveal: (next: DrumReveal) => void;
  spinning: boolean;
  onSpinningChange: (spinning: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const existingId = prize.existing?.id ?? null;
  const revealId = reveal?.drawId ?? null;
  const revealQuery = useQuery(drawQuery(revealId));
  const existingQuery = useQuery(drawQuery(existingId));

  const revealDraw = liveDraw(revealQuery.data);
  /** Shu sahifada ochilayotgan tanlov — g'oliblar aylanish bo'yicha ochiladi. */
  const progress = revealDraw && reveal ? reveal : null;
  const current = revealDraw ?? liveDraw(existingQuery.data);
  /** Oldindan o'tkazilgan tanlov (shu yerda ochilmagan) — hamma g'olib birdan ko'rinadi. */
  const settled = progress === null ? current : null;
  /** Ko'rsatiladigan tanlov hali yuklanmagan bo'lsa — shu so'rov. */
  const waiting =
    revealId !== null && revealQuery.data === undefined
      ? revealQuery
      : revealDraw === null && existingId !== null && existingQuery.data === undefined
        ? existingQuery
        : null;
  const loading = waiting !== null;

  const preview = useQuery({
    queryKey: ["draw-preview", prize.settings],
    queryFn: () => previewDraw(prize.settings),
    // Faqat tanlov yo'q paytda; aylanish boshlangach lenta shu (keshdagi) ro'yxatda qoladi.
    enabled: current === null && !loading,
  });

  const [error, setError] = useState<string | null>(null);
  const reel = useRef<NameReelHandle>(null);

  const winners = activeWinners(current);
  const shownCount = progress ? Math.min(progress.revealed, winners.length) : winners.length;
  const shown = winners.slice(0, shownCount);
  const freshFrom = progress ? progress.freshFrom : shownCount;
  const done = current !== null && shownCount >= winners.length;
  const eligible = current?.poolSize ?? preview.data?.eligibleCount ?? null;
  // Lentadagi ismlar: talabga javob beradigan barcha nomzodlar (oldindan o'tkazilgan tanlovda —
  // g'oliblar va zaxira).
  const pool = preview.data?.names ?? (current ? [...winners, ...current.reserveEntries].map(fullName) : []);
  // Ramkada boshida turadigan ismlar: oldindan o'tkazilgan tanlovda — birinchi g'olib(lar); ochilish
  // davom etayotgan bo'lsa (sovrin almashtirib qaytilganda) — oxirgi ochilganlar.
  const reelInitial = settled
    ? winners.slice(0, prize.batch).map(fullName)
    : progress && shownCount > 0
      ? shown.slice(freshFrom).map(fullName)
      : null;

  const blocker =
    prize.blocker ??
    (current === null && !loading && preview.data?.eligibleCount === 0 ? "Bu oraliqda hozircha ishtirokchi yo'q." : null);
  const canSpin = !spinning && !loading && blocker === null && !done && settled === null;
  const nextBatch = Math.min(prize.batch, Math.max(0, winners.length - shownCount)) || prize.batch;
  const isCar = prize.settings.prizeId === CAR_PRIZE_ID;
  /** Hamma g'olib ochilgach — keyingi qadam (natijani tasdiqlash, xabar yuborish yoki g'olib kartasi). */
  const step = done && current ? nextStep(current, prize.key) : null;

  const refreshResults = useCallback(() => {
    for (const key of RESULT_QUERY_KEYS) void queryClient.invalidateQueries({ queryKey: [key] });
  }, [queryClient]);

  // Ochilish tugamay baraban yopilsa (boshqa sovrin yoki sahifa) — natijalar keshi eskirib qolmasin.
  const revealingId = progress?.drawId ?? null;
  useEffect(() => {
    if (revealingId === null) return;
    return refreshResults;
  }, [revealingId, refreshResults]);

  const spin = async () => {
    if (!canSpin) return;
    setError(null);
    onSpinningChange(true);
    const from = progress ? progress.revealed : 0;
    let target = progress ? revealDraw : null;
    if (!target) {
      try {
        target = await runDraw(prize.settings);
      } catch (e) {
        onSpinningChange(false);
        setError(errorMessage(e));
        // Masalan, tanlov boshqa oynada o'tkazilgan (409) — ro'yxat yangilansa, baraban uni ko'rsatadi.
        void queryClient.invalidateQueries({ queryKey: ["draws"] });
        return;
      }
      queryClient.setQueryData(["draw", target.id], target);
      onReveal({ drawId: target.id, revealed: 0, freshFrom: 0 });
      // Darhol — faqat g'oliblarni ko'rsatmaydigan so'rovlar; qolganlari hamma g'olib ochilgach.
      void queryClient.invalidateQueries({ queryKey: ["draw-preview"] });
      void queryClient.invalidateQueries({ queryKey: ["audit-log"] });
    }
    const list = activeWinners(target);
    const landing = list.slice(from, from + prize.batch).map(fullName);
    await reel.current?.spinTo(landing, prize.spinMs, target.id);
    const next = Math.min(from + prize.batch, list.length);
    onSpinningChange(false);
    onReveal({ drawId: target.id, revealed: next, freshFrom: from });
    if (next >= list.length) refreshResults();
  };

  const revealAll = () => {
    if (!progress) return;
    onReveal({ drawId: progress.drawId, revealed: winners.length, freshFrom: shownCount });
    refreshResults();
  };

  /**
   * Oldindan o'tkazilgan (tasdiqlanmagan) tanlov g'oliblarini barabanda boshidan qayta ko'rsatish —
   * masalan, efirda. Yangi tanlov o'tkazilmaydi: g'oliblar o'sha-o'sha.
   */
  const replay = () => {
    if (!settled) return;
    setError(null);
    onReveal({ drawId: settled.id, revealed: 0, freshFrom: 0 });
  };

  const maxViews = prize.settings.maxViews >= NO_UPPER_LIMIT ? null : prize.settings.maxViews;

  return (
    <div className="grid gap-6 p-5 lg:grid-cols-[320px_minmax(0,1fr)]">
      <div className="space-y-4">
        <NameReel ref={reel} pool={pool} batch={prize.batch} initial={reelInitial} drawId={progress?.drawId ?? null} />
        {waiting ? (
          waiting.isError ? (
            <div
              role="alert"
              className="space-y-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
            >
              <p className="flex items-start gap-2">
                <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
                Tanlovni yuklab bo&apos;lmadi: {errorMessage(waiting.error)}
              </p>
              <Button variant="secondary" size="sm" onClick={() => void waiting.refetch()}>
                <RefreshCw className="size-4" aria-hidden />
                Qayta urinish
              </Button>
            </div>
          ) : (
            <Spinner className="h-12 justify-center" label="Tanlov yuklanmoqda…" />
          )
        ) : settled ? (
          settled.status === "DRAFT" && (
            <button
              type="button"
              onClick={replay}
              className="mx-auto flex items-center gap-1.5 text-xs font-medium text-brand-700 hover:underline"
            >
              <RotateCcw className="size-3.5" aria-hidden />
              Barabanda qayta ko&apos;rsatish (g&apos;oliblar o&apos;zgarmaydi)
            </button>
          )
        ) : (
          <Button className="h-12 w-full text-base" disabled={!canSpin} onClick={() => void spin()}>
            <RefreshCw className={cn("size-5", spinning && "animate-spin")} aria-hidden />
            {spinning
              ? "Aylanmoqda…"
              : done
                ? "Hammasi aniqlandi"
                : progress && shownCount > 0
                  ? `Yana aylantirish (${formatNumber(nextBatch)} ta)`
                  : "Aylantirish"}
          </Button>
        )}
        {progress && !done && !spinning && winners.length - shownCount > prize.batch && (
          <button
            type="button"
            onClick={revealAll}
            className="mx-auto flex items-center gap-1.5 text-xs font-medium text-brand-700 hover:underline"
          >
            <FastForward className="size-3.5" aria-hidden />
            Qolganini birdaniga ko&apos;rsatish
          </button>
        )}
      </div>

      <div className="min-w-0 space-y-4">
        <dl className="grid gap-3 sm:grid-cols-3">
          <Fact label="Sovrin" value={`${prize.prizeTitle} — ${formatNumber(prize.quantity)} ta`} />
          <Fact
            label="Kim qatnashadi"
            value={`${formatViewsRange(prize.settings.minViews, maxViews)} ko'rish`}
            hint={
              <>
                {prize.batch > 1 ? `${periodLabel(prize.settings.periodFrom, prize.settings.periodTo)} · ` : "Aksiya davomida · "}
                {eligible === null ? "…" : `${formatNumber(eligible)} kishi`}
              </>
            }
          />
          <Fact label="Bir aylanishda" value={`${formatNumber(prize.batch)} ta g'olib`} />
        </dl>

        {(blocker ?? prize.note) && (
          <p className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
            {blocker ?? prize.note}
          </p>
        )}
        {error && (
          <p role="alert" className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
            {error}
          </p>
        )}

        {current ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p role="status" aria-live="polite" className="text-sm font-semibold text-ink tabular-nums">
                Aniqlandi: {formatNumber(shownCount)} / {formatNumber(winners.length)} g&apos;olib
              </p>
              {isCar ? (
                // Avtomobil tanlovi tasdiqlanmaydi — holati g'olib kartasida (tekshiruv, e'lon).
                <Badge>Tanlov #{current.number}</Badge>
              ) : (
                <Badge tone={DRAW_STATUS_TONES[current.status]}>
                  #{current.number} · {DRAW_STATUS_LABELS[current.status]}
                </Badge>
              )}
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-brand-500 transition-[width] duration-500"
                style={{ width: `${winners.length ? (shownCount / winners.length) * 100 : 0}%` }}
              />
            </div>
            {shown.length > 0 && (
              <ol className="grid max-h-[420px] gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
                {/* Yangi chiqqanlari tepada. */}
                {shown
                  .map((entry, index) => ({ entry, fresh: index >= freshFrom }))
                  .reverse()
                  .map(({ entry, fresh }) => (
                    <WinnerChip key={entry.candidate.participantId} entry={entry} fresh={fresh} />
                  ))}
              </ol>
            )}
            {step && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-green-200 bg-green-50 px-4 py-3">
                <p className="flex items-start gap-2 text-sm text-green-900">
                  <PartyPopper className="mt-0.5 size-4 shrink-0 text-green-700" aria-hidden />
                  {step.text}
                </p>
                <Link
                  href={step.href}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-green-700 px-3.5 py-2 text-sm font-semibold text-white hover:bg-green-800"
                >
                  {step.label}
                  <ArrowRight className="size-4" aria-hidden />
                </Link>
              </div>
            )}
          </div>
        ) : loading ? null : (
          <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
            «Aylantirish» ni bosing — ismlar pastdan tepaga aylanadi va ramkada{" "}
            {prize.batch > 1 ? `${formatNumber(prize.batch)} ta g'olib` : "g'olib"} ismida to&apos;xtaydi. Yana bosib,
            keyingilarini chiqarasiz. Hamma {formatNumber(prize.quantity)} ta g&apos;olib (va zaxira) birinchi aylanishda
            tasodifiy aniqlanadi — lenta ularni ochib beradi.{" "}
            {isCar
              ? "G'olibni e'lon qilmaguningizcha hech kimga xabar bormaydi."
              : "Natijani tasdiqlamaguningizcha hech kimga xabar bormaydi."}
          </p>
        )}
      </div>
    </div>
  );
}

function Fact({ label, value, hint }: { label: string; value: string; hint?: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-2.5">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-0.5 text-sm font-semibold text-ink">{value}</dd>
      {hint && <dd className="text-xs text-muted tabular-nums">{hint}</dd>}
    </div>
  );
}

function WinnerChip({ entry, fresh }: { entry: DrawEntry; fresh: boolean }) {
  const { candidate } = entry;
  const name = `${candidate.firstName} ${candidate.lastName}`.trim();
  return (
    <li
      className={cn(
        "flex items-center gap-2.5 rounded-xl border px-3 py-2",
        fresh ? "reveal-in border-brand-200 bg-brand-50/70" : "border-line bg-white",
      )}
    >
      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-brand-500 text-xs font-bold text-white tabular-nums">
        {entry.position}
      </span>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-ink" title={name}>
          {name}
        </p>
        <p className="truncate text-xs text-muted tabular-nums">
          {formatNumber(candidate.views)} ko&apos;rish · {candidate.phone}
        </p>
      </div>
    </li>
  );
}

interface NameReelHandle {
  /**
   * Lenta aylanadi va `names` ramkada to'xtaydi; tugaganda resolve bo'ladi. `drawId` — qaysi tanlov
   * g'oliblari: to'xtagan holat faqat shu tanlov ko'rsatilayotganda saqlanadi.
   */
  spinTo: (names: string[], durationMs: number, drawId: string) => Promise<void>;
}

/** Lenta o'lchamlari: asosiy sovrinda — 5 qator, ramka o'rtada (1 ta); voucherda — ramka 10 qator. */
function reelGeometry(batch: number) {
  return batch > 1 ? { row: 34, visible: batch + 2, frame: 1 } : { row: 52, visible: 5, frame: 2 };
}

/** `pool` dan tasodifiy `n` ta ism (yonma-yon takrorlanmasdan); bo'sh bo'lsa — tire. */
function pickNames(pool: string[], n: number): string[] {
  if (pool.length === 0) return Array.from({ length: n }, () => "—");
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    let name = pool[Math.floor(Math.random() * pool.length)];
    if (pool.length > 1 && name === out[i - 1]) name = pool[(pool.indexOf(name) + 1) % pool.length];
    out.push(name);
  }
  return out;
}

/** Ramkaning g'olibsiz qatorlari — bo'sh (boshqa ism g'olibdek ko'rinib qolmasin). */
function emptyRows(n: number): string[] {
  return Array.from({ length: Math.max(0, n) }, () => "");
}

/**
 * Ismlar lentasi (baraban): nomzodlarning to'liq ismlari ustun bo'lib turadi; aylantirilganda pastdan
 * tepaga yuradi, sekinlashib, ramkada g'olib(lar) ismida to'xtaydi. Hamma ko'rib turishi uchun oddiy,
 * yirik yozuv; ortiqcha bezaksiz.
 */
function NameReel({
  pool,
  batch,
  initial,
  drawId,
  ref,
}: {
  pool: string[];
  batch: number;
  /** Boshida ramkada turadigan ismlar (oldindan o'tkazilgan tanlov g'oliblari); null — oddiy ro'yxat. */
  initial: string[] | null;
  /** Hozir ochilayotgan tanlov; boshqasi bo'lsa (masalan, bekor qilingan) — oldingi to'xtash unutiladi. */
  drawId: string | null;
  ref: Ref<NameReelHandle>;
}) {
  const { row, visible, frame } = reelGeometry(batch);
  const stripRef = useRef<HTMLDivElement>(null);
  /** Aylanish paytidagi butun lenta; null — tinch holat. */
  const [strip, setStrip] = useState<string[] | null>(null);
  /** Oxirgi to'xtagan oyna, ramkadagi g'oliblar soni va ular qaysi tanlovdan. */
  const [landed, setLanded] = useState<{ rows: string[]; count: number; drawId: string } | null>(null);
  const stopped = landed !== null && landed.drawId === drawId ? landed : null;

  // Tinch holat: ro'yxat boshidan (render toza — tasodif faqat aylantirishda).
  const idle = Array.from({ length: visible }, (_, i) => (pool.length > 0 ? pool[i % pool.length] : "—"));
  const framed = initial ? initial.slice(0, batch) : null;
  if (framed) idle.splice(frame, batch, ...framed, ...emptyRows(batch - framed.length));
  const rows = strip ?? stopped?.rows ?? idle;
  const highlighted = strip ? 0 : (stopped?.count ?? framed?.length ?? 0);

  useImperativeHandle(ref, () => ({
    spinTo: (names, durationMs, targetId) =>
      new Promise<void>((resolve) => {
        const start = stopped?.rows ?? idle;
        const fillers = pickNames(pool, Math.round((durationMs / 1000) * ROWS_PER_SECOND));
        // Ramka to'liq to'lmasa (oxirgi to'plam) — qolgan qatorlari bo'sh, ramkadan keyin — tasodifiy ismlar.
        const below = [...emptyRows(batch - names.length), ...pickNames(pool, Math.max(0, visible - frame - batch))];
        const all = [...start, ...fillers, ...names, ...below];
        const target = start.length + fillers.length - frame;
        flushSync(() => setStrip(all));

        let animation: Animation | null = null;
        const finish = () => {
          flushSync(() => {
            setStrip(null);
            setLanded({ rows: all.slice(target, target + visible), count: names.length, drawId: targetId });
          });
          animation?.cancel();
          resolve();
        };
        const element = stripRef.current;
        const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        if (!element || reduced || typeof element.animate !== "function") {
          finish();
          return;
        }
        // 60% vaqt — bir xil tezlikda (yo'lning 75%), qolgani — silliq sekinlashib to'xtaydi
        // (ikkinchi bo'lak boshidagi tezlik birinchisiniki bilan teng — sakrash yo'q).
        const distance = target * row;
        animation = element.animate(
          [
            { transform: "translateY(0)", offset: 0, easing: "linear" },
            { transform: `translateY(-${distance * 0.75}px)`, offset: 0.6, easing: "cubic-bezier(0.25, 0.5, 0.5, 1)" },
            { transform: `translateY(-${distance}px)`, offset: 1 },
          ],
          { duration: durationMs, fill: "forwards" },
        );
        animation.finished.then(finish, finish);
      }),
  }));

  return (
    <div
      aria-hidden
      className="relative overflow-hidden rounded-2xl border border-line bg-white"
      style={{ height: visible * row }}
    >
      {/* Ramka — shu yerda to'xtagan ism(lar) g'olib. */}
      <div
        className="absolute inset-x-2 rounded-lg border-y-2 border-brand-500 bg-brand-50"
        style={{ top: frame * row, height: batch * row }}
      />
      <div
        className="absolute inset-0"
        style={{
          maskImage: "linear-gradient(to bottom, transparent, #000 14%, #000 86%, transparent)",
          WebkitMaskImage: "linear-gradient(to bottom, transparent, #000 14%, #000 86%, transparent)",
        }}
      >
        <div ref={stripRef} className="will-change-transform">
          {rows.map((name, i) => {
            const winner = i >= frame && i < frame + highlighted;
            return (
              <div
                key={i}
                className={cn(
                  "flex items-center justify-center truncate px-4 text-center",
                  batch > 1 ? "text-[14px]" : "text-[18px]",
                  winner ? "font-semibold text-ink" : "text-slate-500",
                )}
                style={{ height: row }}
              >
                {name}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
