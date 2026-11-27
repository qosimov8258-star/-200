"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Dices,
  Flag,
  Megaphone,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";

import { CAR_PRIZE_ID, CAR_WINNER_ANCHOR, MAIN_DRAW_RESULT_ANCHOR, drumHref } from "@/components/prizes/rating-prize";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { IosIcon, type IosTint } from "@/components/ui/ios-icon";
import { MoreDetails } from "@/components/ui/more-details";
import { ReasonDialog } from "@/components/ui/reason-dialog";
import { Spinner } from "@/components/ui/spinner";
import { Step, type StepState } from "@/components/ui/steps";
import {
  announceWinner,
  cancelWinnerConfirmation,
  confirmWinner,
  getRatingPrizes,
  getWinnerOverview,
  setWinnerManualCheck,
  skipWinnerCandidate,
} from "@/lib/api";
import { errorMessage } from "@/lib/api-error";
import { formatDate, formatDateTime, formatViewsRange } from "@/lib/format";
import { RATING_PRIZE_LABELS } from "@/lib/labels";
import type { RatingPrizeTier, WinnerManualCheckKey, WinnerOverview } from "@/lib/types";
import { drawHref } from "@/lib/winner-links";

import { LinkButton } from "./link-button";
import {
  CandidateSummary,
  CheckList,
  candidateName,
  checkCounts,
  type ManualCheckAction,
  type WinnerAction,
} from "./winner-candidate";
import { RunnersUpList, SkippedList } from "./winner-side";

const QUERY_KEY = ["winner"];
const NOTICE_TIMEOUT_MS = 5000;

/** Qo'lda tekshiriladigan bandlar oynasining matnlari. */
const MANUAL_DIALOGS: Record<
  WinnerManualCheckKey,
  {
    title: [string, string];
    question: React.ReactNode;
    placeholder: [string, string];
    confirmLabel: [string, string];
    notice: string;
  }
> = {
  AD_TOOLS_REVIEWED: {
    title: ["Reklama tarixi toza", "Reklama topildi"],
    question: (
      <>
        bilan uchrashuvda uning telefonida Instagram → Professional panel → &quot;Reklama
        vositalari&quot; bo&apos;limini oching. Tanlov davrida video yoki akkaunt reklama
        qilinganmi? Nimani ko&apos;rdingiz?
      </>
    ),
    placeholder: [
      "Masalan: Reklama vositalari bo'sh, 2 ta xodim ko'rdi, skrinshot olindi",
      "Masalan: 12.12.2026 da video reklama qilingan, 3 kun, 150 000 so'm",
    ],
    confirmLabel: ["Reklama yo'q", "Reklama bor"],
    notice: "Reklama tarixi tekshiruvi saqlandi.",
  },
};

/**
 * Bosh sovrin (avtomobil) g'olibi — bitta karta: tepada bir qatorlik holat, keyin to'rt qadam
 * (1. Barabanda aylantirish → 2. Yuzma-yuz tekshirish → 3. Tasdiqlash → 4. E'lon qilish). Joriy
 * qadam ajralib turadi va asosiy tugmasi shu qadam ichida. Zaxira va rad etilganlar — "Batafsil" da.
 * Langar: `#car-winner` (`CAR_WINNER_HREF`) — tanlov natijasidan shu yerga o'tiladi.
 */
export function WinnerView() {
  const queryClient = useQueryClient();
  const { data, error, isPending, isError, refetch } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: getWinnerOverview,
  });
  // Ko'rishlar oralig'i va avtomobil tanlovi (raqami, havolasi) — "Asosiy sovrinlar" bilan umumiy kesh.
  const prizes = useQuery({ queryKey: ["rating-prizes"], queryFn: getRatingPrizes });
  const car = prizes.data?.tiers.find((tier) => tier.kind === "car") ?? null;

  const [action, setAction] = useState<WinnerAction | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), NOTICE_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [notice]);

  /** Amal natijasini keshga yozish va xabar ko'rsatish. */
  function done(overview: WinnerOverview, message: string) {
    queryClient.setQueryData(QUERY_KEY, overview);
    void queryClient.invalidateQueries({ queryKey: ["audit-log"] });
    setAction(null);
    setNotice(message);
  }

  if (isPending) {
    return (
      <Card id={CAR_WINNER_ANCHOR} className="flex scroll-mt-24 justify-center py-16">
        <Spinner />
      </Card>
    );
  }

  if (isError || !data) {
    return (
      <Card id={CAR_WINNER_ANCHOR} className="flex scroll-mt-24 flex-col items-center gap-3 px-4 py-12 text-center">
        <IosIcon icon={AlertTriangle} tint="orange" size={48} />
        <p className="text-sm text-slate-600">{errorMessage(error)}</p>
        <Button variant="secondary" onClick={() => refetch()}>
          Qayta urinish
        </Button>
      </Card>
    );
  }

  // Tanlov o'tkazilganmi — avtomobil tanlovi (`rating-prizes`) asosiy manba; u yuklanmagan bo'lsa,
  // nomzod borligi (serverda nomzod va zaxira faqat shu tanlovdan olinadi). Tasdiqlangan yoki e'lon
  // qilingan g'olib serverda muzlatilgan — u har doim ko'rinadi (aks holda "E'lon qilish" ishlamaydi).
  const decided = data.stage === "CONFIRMED" || data.stage === "ANNOUNCED";
  const drawn = decided || (prizes.data ? car?.draw != null : data.candidate !== null);
  const candidate = drawn ? data.candidate : null;
  const runnersUp = drawn ? data.runnersUp : [];
  const manual = typeof action === "object" ? action : null;
  const name = candidate ? candidateName(candidate) : "";
  const extra = runnersUp.length + data.skipped.length;

  return (
    <div id={CAR_WINNER_ANCHOR} className="scroll-mt-24 space-y-3">
      <Card className="overflow-hidden">
        <StatusLine overview={data} car={car} drawn={drawn} />

        <div role="status" aria-live="polite" className="px-5">
          {notice && (
            <p className="mb-4 flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
              <CheckCircle2 className="size-4 shrink-0" aria-hidden />
              {notice}
            </p>
          )}
        </div>

        <CarSteps overview={data} car={car} drawn={drawn} onAction={setAction} />
      </Card>

      {extra > 0 && (
        <MoreDetails
          title={
            data.skipped.length > 0
              ? `Batafsil: zaxira (${runnersUp.length}) va rad etilganlar (${data.skipped.length})`
              : `Batafsil: zaxira nomzodlar (${runnersUp.length})`
          }
        >
          <div className="grid gap-5 md:grid-cols-2">
            <RunnersUpList runnersUp={runnersUp} />
            <SkippedList skipped={data.skipped} />
          </div>
        </MoreDetails>
      )}

      {candidate && manual && (
        <ManualCheckDialog
          action={manual}
          candidateName={name}
          onConfirm={async (note) => {
            const overview = await setWinnerManualCheck({
              participantId: candidate.participant.id,
              check: manual.check,
              passed: manual.passed,
              note,
            });
            done(overview, MANUAL_DIALOGS[manual.check].notice);
          }}
          onClose={() => setAction(null)}
        />
      )}

      {candidate && action === "skip" && (
        <ReasonDialog
          title="Nomzodni rad etish"
          description={
            <>
              <strong className="font-medium text-slate-900">{name}</strong> g&apos;olib bo&apos;la olmaydi —
              o&apos;rniga navbatdagi zaxira nomzod bo&apos;ladi. Ishtirokchining tanlovdagi holati o&apos;zgarmaydi.
            </>
          }
          placeholder="Masalan: 5 kun ichida bog'lanmadi"
          confirmLabel="Rad etish"
          variant="danger"
          onConfirm={async (reason) => {
            const overview = await skipWinnerCandidate({
              participantId: candidate.participant.id,
              reason,
            });
            done(overview, `${name} rad etildi. Keyingi nomzod tekshiruvga chiqdi.`);
          }}
          onClose={() => setAction(null)}
          onDone={() => undefined}
        />
      )}

      {candidate && action === "confirm" && (
        <ConfirmDialog
          title="G'olibni tasdiqlash"
          description={
            <>
              <strong className="font-medium text-slate-900">{name}</strong> tanlov g&apos;olibi sifatida
              tasdiqlanadi. E&apos;lon qilinmaguncha tasdiqni bekor qilish mumkin.
            </>
          }
          confirmLabel="Tasdiqlash"
          onConfirm={async () => {
            done(await confirmWinner(candidate.participant.id), `${name} g'olib sifatida tasdiqlandi.`);
          }}
          onClose={() => setAction(null)}
          onDone={() => undefined}
        />
      )}

      {action === "unconfirm" && (
        <ConfirmDialog
          title="Tasdiqni bekor qilish"
          description="G'olib nomzod yana tekshiruv qadamiga qaytadi."
          confirmLabel="Bekor qilish"
          variant="danger"
          onConfirm={async () => {
            done(await cancelWinnerConfirmation(), "Tasdiq bekor qilindi.");
          }}
          onClose={() => setAction(null)}
          onDone={() => undefined}
        />
      )}

      {candidate && action === "announce" && (
        <ConfirmDialog
          title="G'olibni e'lon qilish"
          description={
            <>
              Barcha ishtirokchilar ilovada{" "}
              <strong className="font-medium text-slate-900">{name}</strong> g&apos;olib bo&apos;lganini
              ko&apos;radi, g&apos;olibga bot orqali tabrik xabari boradi.{" "}
              <strong className="font-medium text-red-700">E&apos;lonni qaytarib bo&apos;lmaydi.</strong>
            </>
          }
          confirmLabel="E'lon qilish"
          onConfirm={async () => {
            done(await announceWinner(), "G'olib e'lon qilindi.");
          }}
          onClose={() => setAction(null)}
          onDone={() => undefined}
        />
      )}
    </div>
  );
}

function ManualCheckDialog({
  action,
  candidateName: name,
  onConfirm,
  onClose,
}: {
  action: ManualCheckAction;
  candidateName: string;
  onConfirm: (note: string) => Promise<void>;
  onClose: () => void;
}) {
  const texts = MANUAL_DIALOGS[action.check];
  const pick = ([pass, fail]: [string, string]) => (action.passed ? pass : fail);
  return (
    <ReasonDialog
      title={pick(texts.title)}
      description={
        <>
          <strong className="font-medium text-slate-900">{name}</strong> {texts.question}
        </>
      }
      fieldLabel="Izoh"
      placeholder={pick(texts.placeholder)}
      confirmLabel={pick(texts.confirmLabel)}
      variant={action.passed ? "primary" : "danger"}
      onConfirm={onConfirm}
      onClose={onClose}
      onDone={() => undefined}
    />
  );
}

// ---------------------------------------------------------------------------
// Holat qatori
// ---------------------------------------------------------------------------

interface Status {
  icon: LucideIcon;
  tint: IosTint;
  title: string;
}

/** Hozirgi holat bir gap bilan: aksiya davom etmoqdami, nomzod kim, keyingi ish nima. */
function statusOf(overview: WinnerOverview, drawn: boolean): Status {
  const { contest, stage, candidate } = overview;
  const name = drawn && candidate ? candidateName(candidate) : null;
  if (stage === "ANNOUNCED") {
    return { icon: Flag, tint: "green", title: name ? `G'olib e'lon qilindi: ${name}.` : "G'olib e'lon qilindi." };
  }
  if (stage === "CONFIRMED") {
    return { icon: ShieldCheck, tint: "green", title: `G'olib tasdiqlandi${name ? `: ${name}` : ""} — endi e'lon qiling.` };
  }
  if (!contest.ended) {
    const next = drawn ? "G'olibni tasdiqlash aksiya tugagach ochiladi." : "G'olib aksiya tugagach barabanda aniqlanadi.";
    return { icon: CalendarClock, tint: "blue", title: `Aksiya davom etmoqda — ${contest.daysLeft} kun qoldi. ${next}` };
  }
  if (!drawn) {
    return { icon: Dices, tint: "orange", title: "Aksiya tugadi — endi barabanda avtomobil g'olibini aniqlang." };
  }
  if (!name) {
    return { icon: AlertTriangle, tint: "orange", title: "Nomzod qolmadi — tanlovni qayta o'tkazish kerak." };
  }
  return { icon: ShieldCheck, tint: "blue", title: `G'olib nomzodi: ${name}. Yuzma-yuz tekshirib, tasdiqlang.` };
}

/** Kartaning tepasi: hozir nima bo'lyapti — bir gap, ostida aksiya sanalari va kim qatnashadi. */
function StatusLine({
  overview,
  car,
  drawn,
}: {
  overview: WinnerOverview;
  car: RatingPrizeTier | null;
  drawn: boolean;
}) {
  const { contest } = overview;
  const { icon, tint, title } = statusOf(overview, drawn);

  return (
    <div className="flex items-start gap-3 px-5 py-4">
      <IosIcon icon={icon} tint={tint} size={40} />
      <div className="min-w-0 flex-1">
        <p className="font-medium text-ink">{title}</p>
        <p className="text-sm text-muted tabular-nums">
          Aksiya: {formatDate(contest.startsOn)} – {formatDate(contest.endsOn)}
          {car && (
            <>
              <span aria-hidden> · </span>
              {formatViewsRange(car.minViews, car.maxViews)} ko&apos;rish yig&apos;ganlar orasidan
            </>
          )}
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Qadamlar
// ---------------------------------------------------------------------------

function CarSteps({
  overview,
  car,
  drawn,
  onAction,
}: {
  overview: WinnerOverview;
  car: RatingPrizeTier | null;
  /** Avtomobil tanlovi o'tkazilganmi; yo'q bo'lsa nomzod ko'rsatilmaydi. */
  drawn: boolean;
  onAction: (action: WinnerAction) => void;
}) {
  const searchParams = useSearchParams();
  const { stage, contest } = overview;
  const candidate = drawn ? overview.candidate : null;
  const draw = car?.draw ?? null;
  const counts = candidate ? checkCounts(candidate) : null;
  // Qo'lda bandlarni belgilash mumkin (backend ham tasdiqlangandan keyin rad etadi).
  const checking = stage === "NOT_STARTED" || stage === "CANDIDATE";
  const decided = stage === "CONFIRMED" || stage === "ANNOUNCED";
  // Natija "Asosiy sovrinlar" tabida ochiladi va sahifa unga suriladi; barabandagi sovrin saqlanadi.
  const drawLink = draw
    ? `${drawHref({ id: draw.id, prizeId: CAR_PRIZE_ID }, searchParams.get("prize"))}#${MAIN_DRAW_RESULT_ANCHOR}`
    : null;
  // Nomzod tanlovning zaxirasidan o'tganmi (oldingi nomzod rad etilgan) — uning zaxira raqami.
  const reservePlace = candidate
    ? (car?.next.find((entry) => entry.participant.id === candidate.participant.id)?.place ?? null)
    : null;
  const prizeLabel = RATING_PRIZE_LABELS.car;

  const drumState: StepState = drawn ? "done" : "current";
  const checkState: StepState = !drawn ? "todo" : decided || counts?.allPassed ? "done" : "current";
  const confirmState: StepState = decided ? "done" : stage === "CANDIDATE" && counts?.allPassed ? "current" : "todo";
  const announceState: StepState = stage === "ANNOUNCED" ? "done" : stage === "CONFIRMED" ? "current" : "todo";

  // Nomzodni rad etish — faqat aksiya tugagach, tasdiqlanmagan nomzod uchun; joriy qadamda turadi.
  const canSkip = stage === "CANDIDATE" && candidate !== null;
  const skipButton = (variant: "ghost" | "danger") => (
    <Button variant={variant} size="sm" onClick={() => onAction("skip")}>
      Nomzodni rad etish
    </Button>
  );

  return (
    <ol className="space-y-3 px-5 pb-5" aria-label="Avtomobil g'olibini aniqlash qadamlari">
      <Step
        number={1}
        title="Barabanda aylantirish"
        state={drumState}
        actions={
          drumState === "current" && (
            <LinkButton href={drumHref(CAR_PRIZE_ID)} variant={contest.ended ? "primary" : "secondary"}>
              <Dices className="size-4" aria-hidden />
              Barabanga o&apos;tish
            </LinkButton>
          )
        }
      >
        {drawn ? (
          <>
            G&apos;olib va zaxiralar barabanda tasodifiy aniqlandi{draw ? ` (tanlov #${draw.number})` : ""}.{" "}
            {drawLink && (
              <Link href={drawLink} className="inline-flex items-center gap-1 font-medium text-brand-700 hover:underline">
                Tanlov natijasini ochish
                <ArrowRight className="size-3.5" aria-hidden />
              </Link>
            )}
          </>
        ) : contest.ended ? (
          <>
            Barabanda «{prizeLabel}»ni tanlab, «Aylantirish»ni bosing — g&apos;olib va zaxiralar tasodifiy
            aniqlanadi.
          </>
        ) : (
          <>
            Aksiya {formatDate(contest.endsOn)} kuni tugaydi. Shundan keyin barabanda «{prizeLabel}»ni tanlab
            aylantirasiz — g&apos;olib va zaxiralar tasodifiy aniqlanadi.
          </>
        )}
      </Step>

      <Step
        number={2}
        title="Yuzma-yuz tekshirish"
        state={checkState}
        actions={
          checkState === "current" &&
          (candidate
            ? canSkip && skipButton(counts && counts.failed > 0 ? "danger" : "ghost")
            : drawLink && (
                <LinkButton href={drawLink}>
                  Tanlov natijasini ochish
                  <ArrowRight className="size-4" aria-hidden />
                </LinkButton>
              ))
        }
      >
        {!drawn ? (
          "Barabandan keyin g'olib bilan uchrashib, uning telefonida Instagram'dagi reklama tarixini ko'rasiz."
        ) : !candidate || !counts ? (
          <>
            Nomzod qolmadi: barcha nomzodlar rad etilgan yoki talabga javob bermaydi. Tanlov natijasini ochib, uni
            bekor qiling va barabanda qayta aylantiring.
          </>
        ) : (
          <div className="space-y-3">
            <CandidateSummary candidate={candidate} stage={stage} reservePlace={reservePlace} />
            {checkState === "current" ? (
              <>
                <p>
                  G&apos;olib bilan yuzma-yuz uchrashing: uning telefonida Instagram&apos;dagi reklama tarixini
                  ko&apos;rib, quyida belgilang.
                </p>
                <CheckList candidate={candidate} editable={checking} onAction={onAction} />
                {counts.failed > 0 && (
                  <p className="flex gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-red-800">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
                    <span>
                      Bandlardan biri o&apos;tmadi — bu nomzod g&apos;olib bo&apos;la olmaydi.{" "}
                      {canSkip
                        ? "«Nomzodni rad etish»ni bosing: o'rniga navbatdagi zaxira o'tadi."
                        : "Aksiya tugagach uni rad etib, navbatdagi zaxirani tekshirasiz."}
                    </span>
                  </p>
                )}
              </>
            ) : (
              <MoreDetails
                title="Tekshiruv ro'yxati"
                meta={`${counts.total} tadan ${counts.passed} tasi o'tdi`}
                contentClassName="p-3"
              >
                <CheckList candidate={candidate} editable={checking} onAction={onAction} />
              </MoreDetails>
            )}
          </div>
        )}
      </Step>

      <Step
        number={3}
        title="Tasdiqlash"
        state={confirmState}
        actions={
          confirmState === "current" ? (
            <>
              <Button size="sm" onClick={() => onAction("confirm")}>
                <ShieldCheck className="size-4" aria-hidden />
                G&apos;olibni tasdiqlash
              </Button>
              {canSkip && skipButton("ghost")}
            </>
          ) : (
            stage === "CONFIRMED" && (
              <Button variant="ghost" size="sm" onClick={() => onAction("unconfirm")}>
                Tasdiqni bekor qilish
              </Button>
            )
          )
        }
      >
        {decided ? (
          overview.confirmed ? (
            <>
              Tasdiqlandi — {formatDateTime(overview.confirmed.at)}, {overview.confirmed.by}.
            </>
          ) : (
            "Tasdiqlandi."
          )
        ) : confirmState === "current" ? (
          "Hamma bandlar o'tdi. Tasdiqlagandan keyin ham, e'lon qilinmaguncha tasdiqni bekor qilish mumkin."
        ) : stage === "NOT_STARTED" ? (
          <>
            Aksiya tugagach ochiladi (yakuniy ko&apos;rishlar {formatDate(contest.endsOn)} 23:59 holatida).
          </>
        ) : (
          "Hamma tekshiruv bandlari o'tgach ochiladi."
        )}
      </Step>

      <Step
        number={4}
        title="E'lon qilish"
        state={announceState}
        actions={
          announceState === "current" && (
            <Button size="sm" onClick={() => onAction("announce")}>
              <Megaphone className="size-4" aria-hidden />
              G&apos;olibni e&apos;lon qilish
            </Button>
          )
        }
      >
        {announceState === "done" ? (
          <>
            E&apos;lon qilindi
            {overview.announced && ` — ${formatDateTime(overview.announced.at)}, ${overview.announced.by}`}. Ilovada
            «G&apos;olib e&apos;loni» ekrani ko&apos;rinmoqda.
          </>
        ) : announceState === "current" ? (
          <>
            Ilovada hamma ishtirokchilar g&apos;olibni ko&apos;radi, g&apos;olibga bot orqali tabrik xabari boradi.
            E&apos;lonni qaytarib bo&apos;lmaydi.
          </>
        ) : (
          "Tasdiqlangandan keyin: ilovada hamma g'olibni ko'radi, g'olibga tabrik xabari boradi."
        )}
      </Step>
    </ol>
  );
}
