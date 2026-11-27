"use client";

import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, PlayCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { MoreDetails } from "@/components/ui/more-details";
import { runAiForAll } from "@/lib/api";
import { formatDayTime, formatNumber, formatPercent, formatUsd } from "@/lib/format";
import { AI_REVIEW_STATE_LABELS, AI_RUN_MODE_LABELS } from "@/lib/labels";
import type { AiProgress, AiRun, AiState } from "@/lib/types";
import { cn } from "@/lib/utils";

import { AI_REVIEWS_KEY, AI_SECTION_IDS, aiTrialFinished, averageCost, useSetAiState } from "./ai-common";

interface ProgressCardProps {
  state: AiState;
  run: AiRun;
  /** "Hammasini ishga tushirish" oynasini ochish (asosiy tugma — qadamlarda). */
  onRunAll: () => void;
}

/** "Jarayon": nechtasi tekshirildi, holatlar bo'yicha sonlar, sarf; tokenlar — "Batafsil" ichida. */
export function ProgressCard({ state, run, onRunAll }: ProgressCardProps) {
  const { progress, worker } = state;

  const finished = progress.done + progress.failed;
  const inFlight = progress.queued + progress.processing;
  const ratio = progress.total > 0 ? finished / progress.total : 0;
  const trialFinished = aiTrialFinished(state);
  const priced = averageCost(progress);
  const width = (value: number) => `${progress.total > 0 ? (value / progress.total) * 100 : 0}%`;

  return (
    <Card id={AI_SECTION_IDS.progress} className="scroll-mt-28">
      <CardHeader className="space-y-1">
        <CardTitle id={AI_SECTION_IDS.progressTitle} tabIndex={-1} className="outline-none">
          Jarayon
        </CardTitle>
        <p className="text-sm text-slate-500">
          {AI_RUN_MODE_LABELS[run.mode]} · <span className="tabular-nums">{formatDayTime(run.startedAt)}</span> da{" "}
          {run.startedBy} boshlagan
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
            <span className="text-ink">
              Tekshirildi:{" "}
              <span className="font-semibold tabular-nums">
                {formatNumber(finished)} / {formatNumber(progress.total)}
              </span>
            </span>
            <span className="font-medium text-brand-700 tabular-nums">{formatPercent(ratio)}</span>
          </div>
          <div
            role="progressbar"
            aria-label="Tekshirilgan videolar"
            aria-valuemin={0}
            aria-valuemax={progress.total}
            aria-valuenow={finished}
            aria-valuetext={`${formatNumber(finished)} / ${formatNumber(progress.total)}`}
            className="flex h-3 overflow-hidden rounded-full bg-slate-200/70"
          >
            <div className="h-full bg-up-bar transition-[width] duration-500" style={{ width: width(progress.done) }} />
            <div className="h-full bg-down transition-[width] duration-500" style={{ width: width(progress.failed) }} />
            <div
              className="h-full animate-pulse bg-brand-400 transition-[width] duration-500"
              style={{ width: width(progress.processing) }}
            />
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label={AI_REVIEW_STATE_LABELS.DONE} value={progress.done} dot="bg-up-bar" />
          <Stat label={AI_REVIEW_STATE_LABELS.QUEUED} value={progress.queued} dot="bg-slate-300" />
          <Stat label={AI_REVIEW_STATE_LABELS.PROCESSING} value={progress.processing} dot="bg-brand-400" />
          <Stat label={AI_REVIEW_STATE_LABELS.FAILED} value={progress.failed} dot="bg-down" attention={progress.failed > 0} />
        </dl>

        <p className="text-sm text-slate-600">
          Sarflandi: <span className="font-semibold text-ink tabular-nums">{formatUsd(progress.costUsd)}</span>
          {priced !== null && <span className="text-slate-500 tabular-nums"> (1 video ≈ {formatUsd(priced)})</span>}
        </p>

        {inFlight > 0 && !worker.online && (
          <p className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
            AI dasturi to&apos;xtab turibdi — {formatNumber(inFlight)} ta video navbatda. Dasturchiga xabar bering;
            yoqilgach o&apos;zi davom etadi.
          </p>
        )}

        {run.mode === "FULL" && (
          <p className="text-xs text-slate-500">Yangi qabul qilingan videolar ham o&apos;zi tekshiriladi.</p>
        )}

        {run.mode === "TRIAL" && !trialFinished && progress.total > 0 && (
          <p className="text-xs text-slate-500">
            Sinov tugagach, keyingi qadam sahifa tepasida chiqadi. Shu orada natijalarni ko&apos;rib chiqing.
          </p>
        )}

        {trialFinished &&
          (state.draft ? (
            // Qadamlar yangi sozlamalarga qaragan — hozirgilari bilan hammasini tekshirish shu yerda qoladi.
            <div className="flex flex-col gap-2 rounded-xl border border-line p-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-slate-600">
                Sinov tugagan. Yangi sozlamalarni kutmasdan, hozirgilari bilan hamma videolarni tekshirish ham mumkin.
              </p>
              <Button size="sm" variant="secondary" onClick={onRunAll} className="w-full sm:w-auto">
                <PlayCircle className="size-4" aria-hidden />
                Hozirgilari bilan hammasini tekshirish
              </Button>
            </div>
          ) : (
            <p className="text-xs text-slate-500">
              Sinov tugadi — pastdagi natijalarni ko&apos;rib chiqing. Keyingi qadam sahifa tepasida.
            </p>
          ))}

        <MoreDetails title="Batafsil: tokenlar" meta={`sozlamalar versiyasi ${run.version}`}>
          <dl className="grid gap-x-6 gap-y-1 text-sm text-slate-600 sm:grid-cols-2">
            <TokenRow label="Kiruvchi token" value={progress.inputTokens} />
            <TokenRow label="Chiquvchi token" value={progress.outputTokens} />
            <TokenRow label="Keshdan o'qildi" value={progress.cacheReadTokens} />
            <TokenRow label="Keshga yozildi" value={progress.cacheWriteTokens} />
          </dl>
        </MoreDetails>
      </CardContent>
    </Card>
  );
}

interface RunAllDialogProps {
  progress: AiProgress;
  onClose: () => void;
  /** Navbatga qo'yilgach (xabar va "Jarayon"ga o'tish — chaqiruvchida). */
  onStarted: () => void;
}

/** Sinovdan keyin: barcha qabul qilingan videolarni shu sozlamalar bo'yicha tekshirishga berish. */
export function RunAllDialog({ progress, onClose, onStarted }: RunAllDialogProps) {
  const setState = useSetAiState();
  const queryClient = useQueryClient();
  const priced = averageCost(progress);

  return (
    <ConfirmDialog
      title="Hamma videolar tekshirilsinmi?"
      description={
        <div className="space-y-2">
          <p>
            Barcha qabul qilingan videolar shu rasm va mezonlar bo&apos;yicha tekshiriladi. Sinovdagi{" "}
            {formatNumber(progress.total)} ta video qayta tekshirilmaydi. Keyin qabul qilinadigan videolar ham o&apos;zi
            tekshiriladi.
          </p>
          <p className="text-xs text-slate-500">
            Tekshiruv pullik — sarf «Jarayon»da ko&apos;rinadi.
            {priced !== null && <> Sinovda 1 video o&apos;rtacha {formatUsd(priced)} turdi.</>}
          </p>
        </div>
      }
      confirmLabel="Tekshirishni boshlash"
      onConfirm={async () => setState(await runAiForAll())}
      onClose={onClose}
      onDone={async () => {
        onStarted();
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: AI_REVIEWS_KEY }),
          queryClient.invalidateQueries({ queryKey: ["audit-log"] }),
        ]);
      }}
    />
  );
}

function Stat({ label, value, dot, attention = false }: { label: string; value: number; dot: string; attention?: boolean }) {
  return (
    <div className="rounded-xl bg-canvas px-3 py-2.5">
      <dt className="flex items-center gap-1.5 text-xs text-slate-500">
        <span className={cn("size-2 shrink-0 rounded-full", dot)} aria-hidden />
        {label}
      </dt>
      <dd className={cn("mt-0.5 text-xl font-semibold tabular-nums", attention ? "text-down" : "text-ink")}>
        {formatNumber(value)}
      </dd>
    </div>
  );
}

function TokenRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex min-w-0 justify-between gap-2">
      <dt className="truncate">{label}</dt>
      <dd className="tabular-nums text-ink">{formatNumber(value)}</dd>
    </div>
  );
}
