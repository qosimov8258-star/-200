"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CalendarClock, CheckCircle2, Flag } from "lucide-react";

import { IosIcon } from "@/components/ui/ios-icon";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ReasonDialog } from "@/components/ui/reason-dialog";
import { Spinner } from "@/components/ui/spinner";
import {
  announceWinner,
  cancelWinnerConfirmation,
  confirmWinner,
  getWinnerOverview,
  setWinnerManualCheck,
  skipWinnerCandidate,
} from "@/lib/api";
import { errorMessage } from "@/lib/api-error";
import { formatDate } from "@/lib/format";
import type { WinnerManualCheckKey, WinnerOverview } from "@/lib/types";
import { cn } from "@/lib/utils";

import { WinnerCandidateCard, type ManualCheckAction, type WinnerAction } from "./winner-candidate";
import { RunnersUpCard, SkippedCard } from "./winner-side";

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
        vositalari&quot; bo&apos;limini oching. Tanlov davrida Reel yoki akkaunt reklama
        qilinganmi? Nimani ko&apos;rdingiz?
      </>
    ),
    placeholder: [
      "Masalan: Reklama vositalari bo'sh, 2 ta xodim ko'rdi, skrinshot olindi",
      "Masalan: 12.12.2026 da Reel reklama qilingan, 3 kun, 150 000 so'm",
    ],
    confirmLabel: ["Reklama yo'q", "Reklama bor"],
    notice: "Reklama tarixi tekshiruvi saqlandi.",
  },
};

export function WinnerView() {
  const queryClient = useQueryClient();
  const { data, error, isPending, isError, refetch } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: getWinnerOverview,
  });

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
    setAction(null);
    setNotice(message);
  }

  if (isPending) {
    return (
      <Card className="flex justify-center py-16">
        <Spinner />
      </Card>
    );
  }

  if (isError || !data) {
    return (
      <Card className="flex flex-col items-center gap-3 px-4 py-12 text-center">
        <IosIcon icon={AlertTriangle} tint="orange" size={48} />
        <p className="text-sm text-slate-600">{errorMessage(error)}</p>
        <Button variant="secondary" onClick={() => refetch()}>
          Qayta urinish
        </Button>
      </Card>
    );
  }

  const candidate = data.candidate;
  const manual = typeof action === "object" ? action : null;
  const candidateName = candidate
    ? `${candidate.participant.firstName} ${candidate.participant.lastName}`
    : "";

  return (
    <div className="space-y-4">
      <ContestStatus overview={data} />

      <div role="status" aria-live="polite">
        {notice && (
          <div className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
            <CheckCircle2 className="size-4 shrink-0" aria-hidden />
            {notice}
          </div>
        )}
      </div>

      <StageSteps stage={data.stage} />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <WinnerCandidateCard overview={data} onAction={setAction} />
        <div className="space-y-4">
          <RunnersUpCard runnersUp={data.runnersUp} />
          <SkippedCard skipped={data.skipped} />
        </div>
      </div>

      {candidate && manual && (
        <ManualCheckDialog
          action={manual}
          candidateName={candidateName}
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
              <strong className="font-medium text-slate-900">{candidateName}</strong> g&apos;olib
              bo&apos;la olmaydi, random tanlovdagi navbatdagi zaxira g&apos;olib nomzod bo&apos;ladi (oferta 10.3).
              Ishtirokchining tanlovdagi holati o&apos;zgarmaydi.
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
            done(overview, `${candidateName} rad etildi. Keyingi nomzod tekshiruvga chiqdi.`);
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
              <strong className="font-medium text-slate-900">{candidateName}</strong> tanlov
              g&apos;olibi sifatida tasdiqlanadi. E&apos;lon qilinmaguncha tasdiqni bekor qilish mumkin.
            </>
          }
          confirmLabel="Tasdiqlash"
          onConfirm={async () => {
            done(await confirmWinner(candidate.participant.id), `${candidateName} g'olib sifatida tasdiqlandi.`);
          }}
          onClose={() => setAction(null)}
          onDone={() => undefined}
        />
      )}

      {action === "unconfirm" && (
        <ConfirmDialog
          title="Tasdiqni bekor qilish"
          description="G'olib nomzod yana tekshiruv bosqichiga qaytadi."
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
              <strong className="font-medium text-slate-900">{candidateName}</strong> g&apos;olib
              bo&apos;lganini ko&apos;radi.{" "}
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
  candidateName,
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
          <strong className="font-medium text-slate-900">{candidateName}</strong> {texts.question}
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

function ContestStatus({ overview }: { overview: WinnerOverview }) {
  const { contest } = overview;
  return (
    <Card>
      <CardContent className="flex flex-wrap items-center gap-3">
        <IosIcon
          icon={contest.ended ? Flag : CalendarClock}
          tint={contest.ended ? "green" : "blue"}
          size={40}
        />
        <div className="min-w-0 flex-1">
          <p className="font-medium text-slate-900">
            {contest.ended ? "Tanlov tugadi" : `Tanlov davom etmoqda — tugashiga ${contest.daysLeft} kun`}
          </p>
          <p className="text-sm text-slate-500">
            {formatDate(contest.startsOn)} – {formatDate(contest.endsOn)}
            <span aria-hidden> · </span>
            {contest.ended
              ? `G'olib ${formatDate(contest.ratingDate)} holatidagi ko'rishlar bo'yicha random tanlovda aniqlanadi`
              : "G'olib aksiya yakunida 4 000 001+ ko'rish to'plaganlar orasidan random tanlovda aniqlanadi"}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

const STEPS = ["Nomzodni tekshirish", "Tasdiqlash", "E'lon qilish"] as const;

function StageSteps({ stage }: { stage: WinnerOverview["stage"] }) {
  // Nechta qadam tugagan.
  const completed = { NOT_STARTED: 0, CANDIDATE: 0, CONFIRMED: 2, ANNOUNCED: 3 }[stage];
  const current = stage === "CANDIDATE" ? 0 : stage === "CONFIRMED" ? 2 : -1;

  return (
    <ol className="grid grid-cols-3 gap-2" aria-label="G'olibni aniqlash bosqichlari">
      {STEPS.map((step, index) => {
        const done = index < completed;
        const active = index === current;
        return (
          <li
            key={step}
            aria-current={active ? "step" : undefined}
            className={cn(
              "rounded-md border px-3 py-2 text-sm",
              done && "border-green-200 bg-green-50 text-green-800",
              active && "border-brand-200 bg-brand-50 font-medium text-brand-700",
              !done && !active && "border-slate-200 bg-white text-slate-400",
            )}
          >
            <span className="tabular-nums">{index + 1}.</span> {step}
            {done && <span className="sr-only"> (bajarildi)</span>}
          </li>
        );
      })}
    </ol>
  );
}
