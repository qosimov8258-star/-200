"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CalendarClock, CheckCircle2, FlaskConical, Flag } from "lucide-react";

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
  mockControls,
  setWinnerPurchaseCheck,
  skipWinnerCandidate,
} from "@/lib/api";
import { errorMessage } from "@/lib/api-error";
import { formatDate } from "@/lib/format";
import type { WinnerOverview } from "@/lib/types";
import { cn } from "@/lib/utils";

import { WinnerCandidateCard, type WinnerAction } from "./winner-candidate";
import { RunnersUpCard, SkippedCard } from "./winner-side";

const QUERY_KEY = ["winner"];
const NOTICE_TIMEOUT_MS = 5000;

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

  const toggleContest = useMutation({
    mutationFn: async (ended: boolean) => {
      await mockControls?.setContestEnded(ended);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });

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
        <AlertTriangle className="size-8 text-amber-500" aria-hidden />
        <p className="text-sm text-slate-600">{errorMessage(error)}</p>
        <Button variant="secondary" onClick={() => refetch()}>
          Qayta urinish
        </Button>
      </Card>
    );
  }

  const candidate = data.candidate;
  const candidateName = candidate
    ? `${candidate.participant.firstName} ${candidate.participant.lastName}`
    : "";

  return (
    <div className="space-y-4">
      <ContestStatus overview={data} />

      {mockControls && (
        <div className="flex flex-wrap items-center gap-3 rounded-md border border-dashed border-amber-300 bg-amber-50/60 px-3 py-2 text-sm text-amber-900">
          <FlaskConical className="size-4 shrink-0" aria-hidden />
          <span className="flex-1">
            Mock rejim: g&apos;olib oqimini sinash uchun tanlovni tugagan deb belgilash mumkin.
          </span>
          <Button
            variant="secondary"
            size="sm"
            loading={toggleContest.isPending}
            onClick={() => toggleContest.mutate(!data.contest.ended)}
          >
            {data.contest.ended ? "Tanlovni davom ettirish (qayta boshlash)" : "Tanlovni tugagan deb ko'rish"}
          </Button>
        </div>
      )}

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

      {candidate && (action === "purchase-pass" || action === "purchase-fail") && (
        <ReasonDialog
          title={action === "purchase-pass" ? "Xaridni tasdiqlash" : "Xarid tasdiqlanmadi"}
          description={
            <>
              <strong className="font-medium text-slate-900">{candidateName}</strong> zavod
              mahsulotini sotib olganini qanday tekshirdingiz? (chek, QR kod, buyurtma raqami)
            </>
          }
          fieldLabel="Izoh"
          placeholder={
            action === "purchase-pass"
              ? "Masalan: Chek №4512, 02.11.2026, do'kon bilan tasdiqlandi"
              : "Masalan: Chek taqdim etilmadi, buyurtma raqami topilmadi"
          }
          confirmLabel={action === "purchase-pass" ? "Tasdiqlandi" : "Tasdiqlanmadi"}
          variant={action === "purchase-pass" ? "primary" : "danger"}
          onConfirm={async (note) => {
            const overview = await setWinnerPurchaseCheck({
              participantId: candidate.participant.id,
              passed: action === "purchase-pass",
              note,
            });
            done(overview, "Xarid tekshiruvi saqlandi.");
          }}
          onClose={() => setAction(null)}
          onDone={() => undefined}
        />
      )}

      {candidate && action === "skip" && (
        <ReasonDialog
          title="Nomzodni rad etish"
          description={
            <>
              <strong className="font-medium text-slate-900">{candidateName}</strong> g&apos;olib
              bo&apos;la olmaydi, keyingi o&apos;rindagi ishtirokchi nomzod bo&apos;ladi.
              Ishtirokchining tanlovdagi holati o&apos;zgarmaydi.
            </>
          }
          placeholder="Masalan: Xarid hujjati taqdim etilmadi"
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

function ContestStatus({ overview }: { overview: WinnerOverview }) {
  const { contest } = overview;
  return (
    <Card>
      <CardContent className="flex flex-wrap items-center gap-3">
        <span
          className={cn(
            "flex size-10 items-center justify-center rounded-full",
            contest.ended ? "bg-green-50 text-green-600" : "bg-brand-50 text-brand-600",
          )}
          aria-hidden
        >
          {contest.ended ? <Flag className="size-5" /> : <CalendarClock className="size-5" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-medium text-slate-900">
            {contest.ended ? "Tanlov tugadi" : `Tanlov davom etmoqda — tugashiga ${contest.daysLeft} kun`}
          </p>
          <p className="text-sm text-slate-500">
            {formatDate(contest.startsOn)} – {formatDate(contest.endsOn)}
            <span aria-hidden> · </span>
            {contest.ended
              ? `G'olib ${formatDate(contest.ratingDate)} reytingi bo'yicha aniqlanadi`
              : "G'olib tanlov oxiridagi reyting bo'yicha aniqlanadi"}
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
