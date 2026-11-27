"use client";

import { useId } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  CalendarClock,
  CircleAlert,
  CircleCheck,
  ClipboardCheck,
  Crosshair,
  LifeBuoy,
  Ticket,
  Trophy,
  type LucideIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { getDraws, getDrawSetup, getManualReviews, getSupportTickets, getTargetCases } from "@/lib/api";
import { formatDate, formatNumber } from "@/lib/format";
import { RATING_PRIZE_LABELS } from "@/lib/labels";
import type {
  DrawSetup,
  ManualReviewListQuery,
  SupportTicketListQuery,
  TargetCaseListQuery,
  VoucherDrawSummary,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import { drawHref, voucherTabHref, WINNER_PATH } from "@/lib/winner-links";

/** Faqat sonlar kerak — ro'yxatning o'zi emas (`statusCounts` filtrdan qat'i nazar keladi). */
const MANUAL_QUERY: ManualReviewListQuery = { status: "OPEN", pageSize: 1 };
const TARGET_QUERY: TargetCaseListQuery = { status: "NEW", pageSize: 1 };
const SUPPORT_QUERY: SupportTicketListQuery = { status: "NEW", pageSize: 1 };

const LINK_BASE =
  "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-[10px] px-3.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500";
const LINK_PRIMARY = "bg-brand-500 text-white shadow-[0_6px_14px_-6px_rgba(124,98,219,0.8)] hover:bg-brand-600";
const LINK_SECONDARY = "border border-line bg-white text-ink hover:border-brand-200 hover:bg-brand-50/50";

/** Bugun qilinadigan bitta ish: matn, qisqa izoh va bitta tugma. */
interface Todo {
  key: string;
  icon: LucideIcon;
  /** Ikonka foni va rangi. */
  tone: string;
  text: React.ReactNode;
  meta?: string | null;
  action: string;
  href: string;
}

const isMainPrize = (draw: VoucherDrawSummary) => draw.prizeId.startsWith("main-");

/**
 * Sovrin nomi, barabandagi kabi: asosiy sovrin — `RATING_PRIZE_LABELS` dan ("BYD Chazor"),
 * aks holda sovg'a nomi; topilmasa — `fallback`.
 */
function prizeLabel(setup: DrawSetup, prizeId: string, fallback: string): string {
  const prize = setup.prizes.find((item) => item.id === prizeId);
  if (prize?.kind) return RATING_PRIZE_LABELS[prize.kind];
  return prize?.title ?? fallback;
}

/** Tanlov nomi: "2-bosqich voucher", maxsus davr voucheri yoki asosiy sovrin nomi. */
function drawLabel(setup: DrawSetup, draw: VoucherDrawSummary): string {
  if (isMainPrize(draw)) return prizeLabel(setup, draw.prizeId, draw.prizeTitle);
  if (draw.stage !== null) return `${draw.stage}-bosqich voucher`;
  return `${formatDate(draw.periodFrom)} – ${formatDate(draw.periodTo)} voucher`;
}

/**
 * Tanlov natijasi manzili — barabandagi havola kabi: barabanda shu sovrin tanlangan bo'ladi, sahifa
 * esa natija sarlavhasiga suriladi (`winners-view.tsx` va `voucher-tab.tsx`).
 */
function drawResultHref(draw: VoucherDrawSummary): string {
  const main = isMainPrize(draw);
  const prize = main ? draw.prizeId : draw.stage !== null ? `monthly-${draw.stage}` : null;
  return `${drawHref(draw, prize)}#${main ? "main-draw-result" : "voucher-draw-title"}`;
}

/**
 * Random tanlov bo'yicha ishlar: tasdiqlanmagan yoki yuborilmagan natijalar, tugagan bosqich
 * (voucher g'oliblari hali aniqlanmagan) va aksiya tugagach — asosiy sovrinlar. `info` — navbatdagi
 * bosqich qachon tugashi (tugagan, lekin o'tkazilmagan bosqich bo'lmasa).
 */
function drawTodos(setup: DrawSetup, draws: VoucherDrawSummary[]): { todos: Todo[]; info: string | null } {
  const live = draws.filter((draw) => draw.status !== "CANCELLED");
  const todos: Todo[] = [];

  for (const draw of live) {
    if (draw.status !== "DRAFT" && draw.status !== "CONFIRMED") continue;
    const label = <strong className="font-semibold">{drawLabel(setup, draw)}</strong>;
    const draft = draw.status === "DRAFT";
    todos.push({
      key: `draw-${draw.id}`,
      icon: isMainPrize(draw) ? Trophy : Ticket,
      tone: "bg-[#fdf3e2] text-[#a7650f]",
      text: draft ? (
        <>{label} natijasi hali tasdiqlanmagan</>
      ) : (
        <>{label} g&apos;oliblariga hali xabar yuborilmagan</>
      ),
      meta: draft
        ? "Natijani tekshiring va tasdiqlang — keyin g'oliblarga xabar yuboriladi"
        : "Natija tasdiqlangan — endi g'oliblarga bot orqali xabar yuboring",
      action: draft ? "Natijani tasdiqlash" : "Xabar yuborish",
      href: drawResultHref(draw),
    });
  }

  const missingStages = setup.stages.filter(
    (stage) => stage.finished && !live.some((draw) => !isMainPrize(draw) && draw.stage === stage.index),
  );
  for (const stage of missingStages) {
    todos.push({
      key: `stage-${stage.index}`,
      icon: Ticket,
      tone: "bg-brand-50 text-brand-500",
      text: (
        <>
          <strong className="font-semibold">{stage.index}-bosqich tugadi</strong> — voucher g&apos;oliblarini aniqlang
        </>
      ),
      meta: `${formatDate(stage.startsOn)} – ${formatDate(stage.endsOn)} · ${formatNumber(setup.defaults.winnersCount)} ta voucher barabanda random o'ynaladi`,
      action: "Barabanga o'tish",
      href: `${voucherTabHref()}&prize=monthly-${stage.index}#baraban`,
    });
  }

  // Oferta 6.2.1: asosiy sovrinlar aksiya tugagach o'ynaladi.
  const missingMain = setup.mainDefaults.filter(
    (settings) => setup.today > settings.periodTo && !live.some((draw) => draw.prizeId === settings.prizeId),
  );
  if (missingMain.length > 0) {
    todos.push({
      key: "main-prizes",
      icon: Trophy,
      tone: "bg-[#fdf3e2] text-[#a7650f]",
      text: (
        <>
          Aksiya tugadi — <strong className="font-semibold">{missingMain.length} ta asosiy sovrin</strong> g&apos;olibi
          hali aniqlanmagan
        </>
      ),
      meta: missingMain.map((settings) => prizeLabel(setup, settings.prizeId, settings.prizeId)).join(", "),
      action: "Barabanga o'tish",
      href: `${WINNER_PATH}?prize=${encodeURIComponent(missingMain[0].prizeId)}#baraban`,
    });
  }

  let info: string | null = null;
  const next = setup.stages.find((stage) => !stage.finished);
  if (missingStages.length === 0 && next) {
    if (setup.today < next.startsOn) {
      info = `${next.index}-bosqich ${formatDate(next.startsOn)} da boshlanadi.`;
    } else if (next.endsOn === setup.today) {
      info = `${next.index}-bosqich bugun tugaydi — ertadan voucher g'oliblarini aniqlash mumkin.`;
    } else {
      info = `${next.index}-bosqich ${formatDate(next.endsOn)} da tugaydi — shundan keyin voucher g'oliblarini aniqlaysiz.`;
    }
  }

  return { todos, info };
}

/**
 * "Bugun nima qilish kerak" — bosh sahifaning asosiy vazifasi. Faqat soni noldan katta ishlar
 * ko'rinadi, har birida bitta tugma; hammasi nol bo'lsa — bitta yashil qator. Davrga ham, bosh
 * sahifa raqamlariga ham bog'liq emas: hamma son hozirgi holat bo'yicha, o'z so'rovlari bilan
 * (kalitlari tegishli sahifalardagi bilan bir xil — qarordan keyin bu ro'yxat ham yangilanadi).
 */
export function TodoList() {
  const baseId = useId();
  const manual = useQuery({ queryKey: ["manual-reviews", MANUAL_QUERY], queryFn: () => getManualReviews(MANUAL_QUERY) });
  const support = useQuery({ queryKey: ["support-tickets", SUPPORT_QUERY], queryFn: () => getSupportTickets(SUPPORT_QUERY) });
  const targets = useQuery({ queryKey: ["target-cases", TARGET_QUERY], queryFn: () => getTargetCases(TARGET_QUERY) });
  const setup = useQuery({ queryKey: ["draw-setup"], queryFn: getDrawSetup });
  const draws = useQuery({ queryKey: ["draws"], queryFn: getDraws });

  const queries = [manual, support, targets, setup, draws];
  const pending = queries.some((query) => query.isPending);
  const failed = queries.filter((query) => query.isError);

  const todos: Todo[] = [];
  const manualOpen = manual.data?.statusCounts.OPEN ?? 0;
  if (manualOpen > 0) {
    todos.push({
      key: "manual",
      icon: ClipboardCheck,
      tone: "bg-brand-50 text-brand-500",
      text: (
        <>
          <strong className="font-semibold">{formatNumber(manualOpen)} ta video</strong> qo&apos;lda tekshiruvni kutyapti
        </>
      ),
      meta: "Tizim o'zi tekshira olmagan videolar — siz tasdiqlaysiz yoki rad etasiz",
      action: "Tekshirish",
      href: "/manual-review",
    });
  }
  const supportNew = support.data?.statusCounts.NEW ?? 0;
  const supportInProgress = support.data?.statusCounts.IN_PROGRESS ?? 0;
  if (supportNew > 0) {
    todos.push({
      key: "support",
      icon: LifeBuoy,
      tone: "bg-[#e9f6ee] text-up",
      text: (
        <>
          <strong className="font-semibold">{formatNumber(supportNew)} ta yangi murojaat</strong> javob kutyapti
        </>
      ),
      meta: supportInProgress > 0 ? `Yana ${formatNumber(supportInProgress)} tasi ko'rib chiqilmoqda` : null,
      action: "Javob berish",
      href: "/support?status=NEW",
    });
  }
  const targetNew = targets.data?.statusCounts.NEW ?? 0;
  if (targetNew > 0) {
    todos.push({
      key: "targets",
      icon: Crosshair,
      tone: "bg-[#fdecea] text-down",
      text: (
        <>
          <strong className="font-semibold">{formatNumber(targetNew)} ta yangi target</strong> (pullik reklama) shubhasi
        </>
      ),
      meta: "Har biri bo'yicha qaror qiling: ogohlantirish, tanlovdan chetlatish yoki xato signal",
      action: "Ko'rish",
      href: "/targets?status=NEW",
    });
  }
  const draw = setup.data && draws.data ? drawTodos(setup.data, draws.data) : { todos: [], info: null };
  todos.push(...draw.todos);

  const titleId = `${baseId}-title`;

  return (
    <Card className="overflow-hidden">
      <section aria-labelledby={titleId} aria-busy={pending || undefined}>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-4">
          <h2 id={titleId} className="text-[15px] font-semibold tracking-tight text-ink">
            Bugun nima qilish kerak
          </h2>
          {!pending && todos.length > 0 && <Badge tone="warning">{todos.length} ta ish</Badge>}
        </div>

        {pending ? (
          <Spinner label="Ishlar tekshirilmoqda…" className="px-5 py-4" />
        ) : (
          <>
            {todos.length > 0 ? (
              <ul className="divide-y divide-line">
                {todos.map((todo, index) => {
                  const Icon = todo.icon;
                  const textId = `${baseId}-${todo.key}`;
                  return (
                    <li key={todo.key} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5">
                      <span className={cn("grid size-9 shrink-0 place-items-center rounded-xl", todo.tone)}>
                        <Icon className="size-4" aria-hidden />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p id={textId} className="text-sm text-ink tabular-nums">
                          {todo.text}
                        </p>
                        {todo.meta && <p className="mt-0.5 text-xs text-muted">{todo.meta}</p>}
                      </div>
                      {/* Bitta asosiy tugma — ro'yxatdagi birinchi ish; qolganlari oddiy. */}
                      <Link
                        href={todo.href}
                        aria-describedby={textId}
                        className={cn(LINK_BASE, index === 0 ? LINK_PRIMARY : LINK_SECONDARY)}
                      >
                        {todo.action}
                        <ArrowRight className="size-4" aria-hidden />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : (
              failed.length === 0 && (
                <p className="flex items-center gap-2.5 px-5 py-4 text-sm font-medium text-up">
                  <CircleCheck className="size-5 shrink-0" aria-hidden />
                  Hozircha shoshilinch ish yo&apos;q — hammasi joyida.
                </p>
              )
            )}

            {failed.length > 0 && (
              <div
                role="alert"
                className={cn(
                  "flex flex-wrap items-center gap-3 px-5 py-3 text-sm text-[#a7650f]",
                  todos.length > 0 && "border-t border-line",
                )}
              >
                <CircleAlert className="size-4 shrink-0" aria-hidden />
                <span className="min-w-0 flex-1">
                  Ba&apos;zi ishlarni tekshirib bo&apos;lmadi — ro&apos;yxat to&apos;liq bo&apos;lmasligi mumkin.
                </span>
                <Button variant="secondary" size="sm" onClick={() => failed.forEach((query) => void query.refetch())}>
                  Qayta urinish
                </Button>
              </div>
            )}

            {draw.info && (
              <p className="flex items-center gap-2.5 border-t border-line bg-[#fbfbfd] px-5 py-3 text-xs text-muted">
                <CalendarClock className="size-4 shrink-0" aria-hidden />
                {draw.info}
              </p>
            )}
          </>
        )}
      </section>
    </Card>
  );
}
