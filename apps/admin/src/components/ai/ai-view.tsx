"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Info } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { IosIcon } from "@/components/ui/ios-icon";
import { Spinner } from "@/components/ui/spinner";
import { getAiState } from "@/lib/api";
import { errorMessage } from "@/lib/api-error";
import { formatDayTime, formatPercent } from "@/lib/format";
import type { AiState, AiWorkerStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

import { AI_POLL_MS, AI_STATE_KEY, SuccessNotice, aiRunInProgress } from "./ai-common";
import { ConfigCard } from "./ai-config-card";
import { ProgressCard } from "./ai-progress-card";
import { Results } from "./ai-results";

/** Worker ishlamayotganda ham uning holati shu oraliqda tekshiriladi. */
const IDLE_POLL_MS = 30_000;
const NOTICE_TIMEOUT_MS = 6000;

/**
 * AI bo'limi (`/ai`, faqat ADMIN): namuna rasmlar va mezonlar (versiyalar bilan), tasdiqlash
 * (sinov yoki hammasi), jarayon va natijalar. Standart — AI hech narsaga ulanmagan, xulosasi faqat
 * yordam; `AI_ACCEPTANCE_GATE=true` bo'lsa, yangi videolar ham shu AI'dan o'tadi.
 */
export function AiView() {
  const { data, error, isPending, isError, refetch } = useQuery({
    queryKey: AI_STATE_KEY,
    queryFn: getAiState,
    refetchInterval: (query) => (aiRunInProgress(query.state.data) ? AI_POLL_MS : IDLE_POLL_MS),
  });
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), NOTICE_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [notice]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-ink">AI tekshiruvi</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            AI har bir tanlov videosini ko&apos;rib chiqadi: siz bergan namuna rasmlar va mezonlar bo&apos;yicha videoda
            kerakli narsa bor-yo&apos;qligini aytadi.
          </p>
        </div>
        {data && <WorkerChip worker={data.worker} />}
      </header>

      {isPending ? (
        <Card>
          <CardContent className="flex justify-center py-12">
            <Spinner />
          </CardContent>
        </Card>
      ) : isError && !data ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <IosIcon icon={AlertTriangle} tint="orange" size={48} />
            <p className="text-sm text-slate-600">{errorMessage(error)}</p>
            <Button variant="secondary" onClick={() => refetch()}>
              Qayta urinish
            </Button>
          </CardContent>
        </Card>
      ) : data ? (
        <AiSections state={data} notice={notice} onNotice={setNotice} />
      ) : null}
    </div>
  );
}

function AiSections({
  state,
  notice,
  onNotice,
}: {
  state: AiState;
  notice: string | null;
  onNotice: (message: string) => void;
}) {
  const { run, settings } = state;
  return (
    <>
      <p className="flex items-start gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
        <IosIcon icon={Info} tint="blue" size={22} />
        <span>
          {state.acceptanceGate ? (
            <>
              Mezonlar tasdiqlangach, <strong className="font-medium text-ink">har bir yangi video</strong>{" "}
              Apify&apos;dan keyin AI tekshiruvidan o&apos;tadi: AI «Tasdiqlandi» desa — video qabul qilinadi;
              «Rad etildi», «Shubhali» yoki ko&apos;ra olmasa — «Qo&apos;lda tekshiruv»ga tushadi. Allaqachon qabul
              qilingan videolar bo&apos;yicha AI xulosasi esa faqat yordam.
            </>
          ) : (
            <>
              AI hozircha <strong className="font-medium text-ink">hech narsaga ulanmagan</strong>: yangi videolar
              faqat Apify bo&apos;yicha qabul qilinadi. Bu yerdagi sinov va natijalar — faqat yordam, videolar
              holatini o&apos;zi o&apos;zgartirmaydi. «Shubhali» va «Rad etildi» videolarni o&apos;zingiz ko&apos;rib
              qaror qiling.
            </>
          )}
          <span className="mt-1 block text-xs text-slate-500">
            Model: {settings.model} · kadr har {settings.frameIntervalSec} soniyada ({settings.frameHeight}p) · ishonch{" "}
            {formatPercent(settings.confidenceMin)} dan past bo&apos;lsa — «Shubhali».
          </span>
        </span>
      </p>

      <div role="status" aria-live="polite">
        {notice && <SuccessNotice>{notice}</SuccessNotice>}
      </div>

      <ConfigCard
        state={state}
        onNotice={(message) => {
          onNotice(message);
          // Tasdiqlangach "Jarayon" ga o'tamiz — videolar navbatga tushgani ko'rinsin.
          setTimeout(() => document.getElementById("ai-progress")?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
        }}
      />

      {run ? (
        <>
          <ProgressCard state={state} run={run} onNotice={onNotice} />
          <Results run={run} progress={state.progress} polling={aiRunInProgress(state)} onNotice={onNotice} />
        </>
      ) : (
        <p className="rounded-2xl border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-500">
          Hali ishga tushirilmagan. Sozlamalarni tasdiqlang — «Jarayon» va «Natijalar» shundan keyin shu yerda ko&apos;rinadi.
        </p>
      )}
    </>
  );
}

function WorkerChip({ worker }: { worker: AiWorkerStatus }) {
  const lastSeen = worker.lastSeenAt ? `Oxirgi signal: ${formatDayTime(worker.lastSeenAt)}` : "Worker hali signal bermagan";
  return (
    <div className="flex flex-col items-start gap-1 sm:items-end">
      <span
        title={lastSeen}
        className={cn(
          "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium",
          worker.online ? "bg-[#e9f6ee] text-up" : "bg-[#fdf3e2] text-[#a7650f]",
        )}
      >
        <span className="relative flex size-2.5" aria-hidden>
          {worker.online && <span className="absolute inline-flex size-full animate-ping rounded-full bg-up/50" />}
          <span className={cn("relative inline-flex size-2.5 rounded-full", worker.online ? "bg-up" : "bg-[#e0a03a]")} />
        </span>
        {worker.online ? "Worker ishlayapti" : "Worker o'chiq — videolar navbatda kutadi"}
      </span>
      {!worker.online && <span className="text-xs text-slate-500 tabular-nums">{lastSeen}</span>}
    </div>
  );
}
