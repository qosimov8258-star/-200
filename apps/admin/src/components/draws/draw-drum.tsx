"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, ArrowRight, Dices, FastForward, PartyPopper, RefreshCw, Ticket, type LucideIcon } from "lucide-react";

import { RATING_PRIZE_ICONS } from "@/components/prizes/rating-prize";
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
import type { DrawEntry, DrawSettings, DrawSetup, RatingPrizeKind, VoucherDraw, VoucherDrawSummary } from "@/lib/types";
import { cn } from "@/lib/utils";
import { voucherTabHref } from "@/lib/winner-links";

/** Birinchi aylanish (server g'oliblarni aniqlaydi) va keyingilari, ms. */
const FIRST_SPIN_MS = 2600;
const SPIN_MS = 1800;
/** Baraban ichidagi sharlar soni (nomzodlar namunasidan). */
const BALLS = 14;
const BALL_COLORS = ["#7c62db", "#f45a42", "#22a99a", "#e2a325", "#3b82f6", "#db4a8c", "#16a36a", "#8b5cf6"];
/** Asosiy sovrinlar tartibi — qimmatidan. */
const MAIN_ORDER: RatingPrizeKind[] = ["car", "travel", "phone", "tablet"];
/** `maxViews` shundan katta bo'lsa — yuqori chegara yo'q ("4 000 001+"). */
const NO_UPPER_LIMIT = 1_000_000_000;

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
  settings: DrawSettings;
  /** Shu sovrin (bosqich) uchun o'tkazilgan, bekor qilinmagan tanlov. */
  existing: VoucherDrawSummary | null;
  /** Hozir aylantirib bo'lmasligi sababi; null — mumkin. */
  blocker: string | null;
  /** Ogohlantirish (bosqich tugamagan, sinov rejimi). */
  note: string | null;
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
 * baraban g'oliblarni shu natija tartibida birma-bir ochib beradi. Natija qoralama — keyin
 * "Natijani ochish" da tekshirib, tasdiqlanadi va g'oliblarga yuboriladi.
 */
export function DrawDrumSection() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setup = useQuery({ queryKey: ["draw-setup"], queryFn: getDrawSetup });
  const draws = useQuery({ queryKey: ["draws"], queryFn: getDraws });

  const prizes = setup.data && draws.data ? drumPrizes(setup.data, draws.data) : [];
  const fallback = setup.data ? `monthly-${setup.data.defaults.stage ?? 1}` : null;
  const wanted = searchParams.get("prize") ?? fallback;
  const selected = prizes.find((p) => p.key === wanted) ?? prizes.find((p) => p.key === fallback) ?? prizes[0] ?? null;

  const choose = (key: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("prize", key);
    params.delete("draw");
    router.replace(`?${params.toString()}#baraban`, { scroll: false });
  };

  return (
    <section id="baraban" className="scroll-mt-24 space-y-4" aria-labelledby="drum-title">
      <SectionTitle
        id="drum-title"
        icon={Dices}
        title="Baraban — tasodifiy tanlov"
        meta="Sovrinni tanlang va aylantiring"
      />
      <Card className="overflow-hidden">
        {setup.isPending || draws.isPending ? (
          <Spinner className="p-6" />
        ) : setup.isError || draws.isError ? (
          <p role="alert" className="p-6 text-sm text-red-700">
            {errorMessage(setup.error ?? draws.error)}
          </p>
        ) : (
          <>
            <div role="tablist" aria-label="Sovrin" className="flex flex-wrap gap-2 border-b border-line p-4">
              {prizes.map((prize) => {
                const Icon = prize.icon;
                const on = prize.key === selected?.key;
                return (
                  <button
                    key={prize.key}
                    type="button"
                    role="tab"
                    aria-selected={on}
                    onClick={() => choose(prize.key)}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-medium transition-colors",
                      on
                        ? "border-brand-500 bg-brand-500 text-white shadow-[0_6px_14px_-6px_rgba(124,98,219,0.8)]"
                        : "border-line bg-white text-ink hover:bg-brand-50",
                    )}
                  >
                    <Icon className="size-4" aria-hidden />
                    {prize.label}
                    <span className={cn("tabular-nums", on ? "text-white/80" : "text-muted")}>
                      · {formatNumber(prize.quantity)} ta
                    </span>
                    {prize.existing && (
                      <span
                        aria-label="tanlov o'tkazilgan"
                        className={cn("size-2 rounded-full", on ? "bg-white" : "bg-up-bar")}
                      />
                    )}
                  </button>
                );
              })}
            </div>
            {selected && <PrizeDrum key={selected.key} prize={selected} />}
          </>
        )}
      </Card>
    </section>
  );
}

function activeWinners(draw: VoucherDraw | null): DrawEntry[] {
  if (!draw) return [];
  return draw.winnerEntries.filter((entry) => entry.state === "ACTIVE").sort((a, b) => a.position - b.position);
}

function PrizeDrum({ prize }: { prize: DrumPrize }) {
  const queryClient = useQueryClient();
  const existingId = prize.existing?.id ?? null;
  const preview = useQuery({
    queryKey: ["draw-preview", prize.settings],
    queryFn: () => previewDraw(prize.settings),
    enabled: existingId === null,
  });
  const existing = useQuery({
    queryKey: ["draw", existingId],
    queryFn: () => (existingId ? getDraw(existingId) : Promise.reject(new Error("Tanlov topilmadi."))),
    enabled: existingId !== null,
  });

  /** Shu sahifada hozir aylantirilgan tanlov — g'oliblar birma-bir (10 tadan) ochiladi. */
  const [draw, setDraw] = useState<VoucherDraw | null>(null);
  const [revealed, setRevealed] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );

  const current = draw ?? existing.data ?? null;
  const winners = activeWinners(current);
  // Oldindan o'tkazilgan tanlov — hammasi ochiq; shu yerda aylantirilgani — aylanish bo'yicha.
  const shownCount = draw ? revealed : winners.length;
  const shown = winners.slice(0, shownCount);
  const freshFrom = draw ? Math.max(0, revealed - prize.batch) : shownCount;
  const done = current !== null && shownCount >= winners.length;
  const eligible = current?.poolSize ?? preview.data?.eligibleCount ?? null;
  const ballNames = (
    current ? winners.map((e) => e.candidate) : (preview.data?.sample ?? [])
  ).map((c) => `${c.firstName} ${c.lastName}`);

  const blocker =
    prize.blocker ?? (existingId === null && preview.data?.eligibleCount === 0 ? "Bu oraliqda hozircha ishtirokchi yo'q." : null);
  const canSpin = !spinning && blocker === null && !done && (current === null || draw !== null);
  const nextBatch = Math.min(prize.batch, Math.max(0, winners.length - shownCount)) || prize.batch;

  const spin = async () => {
    if (!canSpin) return;
    setError(null);
    setSpinning(true);
    const startedAt = Date.now();
    let target = draw;
    try {
      if (!target) {
        target = await runDraw(prize.settings);
        setDraw(target);
        setRevealed(0);
        queryClient.setQueryData(["draw", target.id], target);
        void Promise.all(
          ["draws", "rating-prizes", "draw-preview", "audit-log", "winner"].map((key) =>
            queryClient.invalidateQueries({ queryKey: [key] }),
          ),
        );
      }
    } catch (e) {
      setSpinning(false);
      setError(errorMessage(e));
      return;
    }
    const total = activeWinners(target).length;
    const minimum = draw ? SPIN_MS : FIRST_SPIN_MS;
    timer.current = window.setTimeout(
      () => {
        setSpinning(false);
        setRevealed((n) => Math.min(n + prize.batch, total));
      },
      Math.max(600, minimum - (Date.now() - startedAt)),
    );
  };

  const maxViews = prize.settings.maxViews >= NO_UPPER_LIMIT ? null : prize.settings.maxViews;
  const Icon = prize.icon;

  return (
    <div className="grid gap-6 p-5 lg:grid-cols-[320px_minmax(0,1fr)]">
      <div className="space-y-4">
        <Drum names={ballNames} spinning={spinning} icon={Icon} />
        {current && !draw ? null : (
          <Button className="h-12 w-full text-base" disabled={!canSpin} onClick={() => void spin()}>
            <RefreshCw className={cn("size-5", spinning && "animate-spin")} aria-hidden />
            {spinning
              ? "Aylanmoqda…"
              : done
                ? "Hammasi aniqlandi"
                : draw
                  ? `Yana aylantirish (${formatNumber(nextBatch)} ta)`
                  : "Aylantirish"}
          </Button>
        )}
        {draw && !done && !spinning && winners.length - shownCount > prize.batch && (
          <button
            type="button"
            onClick={() => setRevealed(winners.length)}
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
              <Badge tone={DRAW_STATUS_TONES[current.status]}>
                #{current.number} · {DRAW_STATUS_LABELS[current.status]}
              </Badge>
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
                {[...shown].reverse().map((entry) => {
                  const index = entry.position - 1;
                  const fresh = index >= freshFrom;
                  return (
                    <WinnerChip
                      key={entry.candidate.participantId}
                      entry={entry}
                      fresh={fresh}
                      delayMs={fresh ? (index - freshFrom) * 70 : 0}
                    />
                  );
                })}
              </ol>
            )}
            {done && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-green-200 bg-green-50 px-4 py-3">
                <p className="flex items-start gap-2 text-sm text-green-900">
                  <PartyPopper className="mt-0.5 size-4 shrink-0 text-green-700" aria-hidden />
                  {current.status === "DRAFT"
                    ? "Hamma g'oliblar aniqlandi. Endi natijani tekshirib, tasdiqlang va g'oliblarga yuboring."
                    : "Bu sovrin bo'yicha tanlov o'tkazilgan."}
                </p>
                <Link
                  href={voucherTabHref(current.id)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-green-700 px-3.5 py-2 text-sm font-semibold text-white hover:bg-green-800"
                >
                  {current.status === "DRAFT" ? "Tasdiqlash va yuborish" : "Natijani ochish"}
                  <ArrowRight className="size-4" aria-hidden />
                </Link>
              </div>
            )}
          </div>
        ) : (
          <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
            «Aylantirish» ni bosing — baraban aylanadi va{" "}
            {prize.batch > 1 ? `${formatNumber(prize.batch)} ta g'olib chiqadi` : "1 ta g'olib chiqadi"}. Yana bosib, keyingilarini
            chiqarasiz. Hamma {formatNumber(prize.quantity)} ta g&apos;olib (va zaxira) birinchi aylanishda server
            tomonidan tasodifiy aniqlanadi — baraban ularni ochib beradi.
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

function WinnerChip({ entry, fresh, delayMs }: { entry: DrawEntry; fresh: boolean; delayMs: number }) {
  const { candidate } = entry;
  const name = `${candidate.firstName} ${candidate.lastName}`.trim();
  return (
    <li
      className={cn(
        "flex items-center gap-2.5 rounded-xl border px-3 py-2",
        fresh ? "drum-pop border-brand-300 bg-brand-50" : "border-line bg-white",
      )}
      style={fresh ? { animationDelay: `${delayMs}ms` } : undefined}
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

/** Shisha baraban: ichida nomzodlar sharlari aylanadi; aylantirilganda baraban tez aylanadi. */
function Drum({ names, spinning, icon: Icon }: { names: string[]; spinning: boolean; icon: LucideIcon }) {
  const balls = (names.length > 0 ? names : Array.from({ length: 8 }, () => "")).slice(0, BALLS);
  return (
    <div
      aria-hidden
      className="relative mx-auto aspect-square w-full max-w-[300px] overflow-hidden rounded-full bg-[radial-gradient(circle_at_50%_45%,#ffffff_0%,#ebe7f8_55%,#c5b9ea_100%)] shadow-[inset_0_-14px_36px_rgba(90,64,184,0.28),0_26px_50px_-26px_rgba(90,64,184,0.7)] ring-8 ring-white"
    >
      <div className={cn("absolute inset-0", spinning && "drum-spinning")}>
        {balls.map((name, i) => {
          const seconds = 6 + (i % 5) * 1.4;
          return (
            <span
              key={i}
              className="drum-ball grid size-[42px] place-items-center rounded-full text-[11px] font-bold text-white shadow-[0_4px_10px_-3px_rgba(0,0,0,0.35)]"
              style={
                {
                  "--orbit": `${48 + (i % 4) * 24}px`,
                  animationDuration: `${seconds}s`,
                  // Boshlanishda sharlar aylana bo'ylab teng tarqalgan bo'lsin.
                  animationDelay: `-${((i / balls.length) * seconds).toFixed(2)}s`,
                  backgroundColor: BALL_COLORS[i % BALL_COLORS.length],
                } as CSSProperties
              }
            >
              {initials(name)}
            </span>
          );
        })}
      </div>
      {/* Shisha yaltirog'i */}
      <div className="pointer-events-none absolute inset-0 rounded-full bg-[radial-gradient(circle_at_30%_22%,rgba(255,255,255,0.85),transparent_38%)]" />
      <div className="absolute top-1/2 left-1/2 grid size-14 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white text-brand-600 shadow-lg">
        <Icon className="size-6" />
      </div>
    </div>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts.length === 0 ? "?" : parts.slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("");
}
