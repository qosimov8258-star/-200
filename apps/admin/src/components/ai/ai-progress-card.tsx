"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AlertTriangle, PlayCircle, Rocket } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { runAiForAll } from "@/lib/api";
import { formatDateTime, formatNumber, formatPercent, formatUsd } from "@/lib/format";
import { AI_RUN_MODE_LABELS, AI_VERDICT_FILTER_LABELS } from "@/lib/labels";
import type { AiRun, AiState } from "@/lib/types";
import { cn } from "@/lib/utils";

import { AI_REVIEWS_KEY, useSetAiState } from "./ai-common";

interface ProgressCardProps {
  state: AiState;
  run: AiRun;
  onNotice: (message: string) => void;
}

/** "Jarayon": nechtasi tayyor / navbatda / ishlanmoqda / xato, xulosalar, tokenlar va sarf. */
export function ProgressCard({ state, run, onNotice }: ProgressCardProps) {
  const setState = useSetAiState();
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState(false);
  const { progress, worker } = state;

  const finished = progress.done + progress.failed;
  const inFlight = progress.queued + progress.processing;
  const ratio = progress.total > 0 ? finished / progress.total : 0;
  const trialFinished = run.mode === "TRIAL" && progress.total > 0 && inFlight === 0;
  const priced = progress.done > 0 ? progress.costUsd / progress.done : null;
  const width = (value: number) => `${progress.total > 0 ? (value / progress.total) * 100 : 0}%`;

  return (
    <Card id="ai-progress" className="scroll-mt-28">
      <CardHeader className="space-y-1">
        <CardTitle>Jarayon</CardTitle>
        <p className="text-sm text-slate-500">
          Versiya {run.version} · {AI_RUN_MODE_LABELS[run.mode]} · boshlangan{" "}
          <span className="tabular-nums">{formatDateTime(run.startedAt)}</span> · {run.startedBy}
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
          <Stat label="Tayyor" value={progress.done} dot="bg-up-bar" />
          <Stat label="Navbatda" value={progress.queued} dot="bg-slate-300" />
          <Stat label="Ishlanmoqda" value={progress.processing} dot="bg-brand-400" />
          <Stat label="Xato" value={progress.failed} dot="bg-down" attention={progress.failed > 0} />
        </dl>

        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="rounded-xl border border-line p-3">
            <p className="text-xs font-medium text-slate-500">Xulosalar</p>
            <dl className="mt-2 grid grid-cols-3 gap-2 text-center">
              <Verdict label={AI_VERDICT_FILTER_LABELS.APPROVED} value={progress.approved} className="bg-[#e9f6ee] text-up" />
              <Verdict label={AI_VERDICT_FILTER_LABELS.REJECTED} value={progress.rejected} className="bg-[#fdecea] text-[#c2412b]" />
              <Verdict
                label={AI_VERDICT_FILTER_LABELS.UNCERTAIN}
                value={progress.uncertain}
                className="bg-[#fdf3e2] text-[#a7650f]"
              />
            </dl>
            <p className="mt-2 text-xs text-slate-500 tabular-nums">
              Qo&apos;lda qaror qilingan: {formatNumber(progress.manual)}
            </p>
          </div>

          <div className="rounded-xl border border-line p-3">
            <p className="text-xs font-medium text-slate-500">$ sarflandi</p>
            <p className="mt-1 text-2xl font-semibold tracking-tight text-ink tabular-nums">{formatUsd(progress.costUsd)}</p>
            {priced !== null && (
              <p className="text-xs text-slate-500 tabular-nums">1 video o&apos;rtacha: {formatUsd(priced)}</p>
            )}
            <dl className="mt-2 grid gap-x-4 gap-y-0.5 text-xs text-slate-600 sm:grid-cols-2">
              <TokenRow label="Kiruvchi token" value={progress.inputTokens} />
              <TokenRow label="Chiquvchi token" value={progress.outputTokens} />
              <TokenRow label="Keshdan o'qildi" value={progress.cacheReadTokens} />
              <TokenRow label="Keshga yozildi" value={progress.cacheWriteTokens} />
            </dl>
          </div>
        </div>

        {inFlight > 0 && !worker.online && (
          <p className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
            Worker o&apos;chiq — {formatNumber(inFlight)} ta video navbatda kutadi. Worker yoqilgach tekshiruv o&apos;zi davom etadi.
          </p>
        )}

        {run.mode === "FULL" && (
          <p className="text-xs text-slate-500">
            Keyin qabul qilinadigan videolar ham versiya {run.version} bo&apos;yicha avtomatik navbatga qo&apos;yiladi.
          </p>
        )}

        {run.mode === "TRIAL" && !trialFinished && (
          <p className="text-xs text-slate-500">
            Sinov tugagach shu yerda «Hammasini ishga tushirish» tugmasi chiqadi. Shu orada natijalarni ko&apos;rib chiqing.
          </p>
        )}

        {trialFinished && (
          <div className="flex flex-col gap-3 rounded-2xl border border-brand-200 bg-brand-50 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <Rocket className="mt-0.5 size-6 shrink-0 text-brand-600" aria-hidden />
              <div>
                <p className="font-semibold text-ink">Sinov tugadi</p>
                <p className="text-sm text-slate-600">
                  Pastdagi natijalarni ko&apos;rib chiqing. AI to&apos;g&apos;ri ishlayotgan bo&apos;lsa — barcha videolarni
                  ishga tushiring. Bo&apos;lmasa — «Yangi versiya» bilan rasm va mezonlarni aniqlashtiring.
                </p>
              </div>
            </div>
            <Button onClick={() => setConfirming(true)} className="w-full sm:w-auto">
              <PlayCircle className="size-4" aria-hidden />
              Hammasini ishga tushirish
            </Button>
          </div>
        )}
      </CardContent>

      {confirming && (
        <ConfirmDialog
          title="Barcha videolar tekshirilsinmi?"
          description={
            <div className="space-y-2">
              <p>
                Barcha qabul qilingan videolar versiya {run.version} bo&apos;yicha navbatga qo&apos;yiladi. Sinovdagi{" "}
                {formatNumber(progress.total)} ta video qayta tekshirilmaydi. Keyin qabul qilinadigan videolar ham avtomatik
                tekshiriladi.
              </p>
              {priced !== null && (
                <p>Sinovda 1 video o&apos;rtacha {formatUsd(priced)} turdi.</p>
              )}
            </div>
          }
          confirmLabel="Ishga tushirish"
          onConfirm={async () => setState(await runAiForAll())}
          onClose={() => setConfirming(false)}
          onDone={async () => {
            setConfirming(false);
            onNotice("Barcha qabul qilingan videolar navbatga qo'yildi.");
            await Promise.all([
              queryClient.invalidateQueries({ queryKey: AI_REVIEWS_KEY }),
              queryClient.invalidateQueries({ queryKey: ["audit-log"] }),
            ]);
          }}
        />
      )}
    </Card>
  );
}

function Stat({ label, value, dot, attention = false }: { label: string; value: number; dot: string; attention?: boolean }) {
  return (
    <div className="rounded-xl bg-canvas px-3 py-2.5">
      <dt className="flex items-center gap-1.5 text-xs text-slate-500">
        <span className={cn("size-2 rounded-full", dot)} aria-hidden />
        {label}
      </dt>
      <dd className={cn("mt-0.5 text-xl font-semibold tabular-nums", attention ? "text-down" : "text-ink")}>
        {formatNumber(value)}
      </dd>
    </div>
  );
}

function Verdict({ label, value, className }: { label: string; value: number; className: string }) {
  return (
    <div className={cn("rounded-lg px-2 py-2", className)}>
      <dt className="truncate text-xs font-medium">{label}</dt>
      <dd className="text-lg font-semibold tabular-nums">{formatNumber(value)}</dd>
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
