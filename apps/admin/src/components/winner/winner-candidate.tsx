"use client";

import { CheckCircle2, Clock, Crown, ExternalLink, XCircle } from "lucide-react";

import { IosIcon } from "@/components/ui/ios-icon";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime, formatNumber } from "@/lib/format";
import { WINNER_CHECK_LABELS } from "@/lib/labels";
import type { WinnerCheck, WinnerManualCheckKey, WinnerOverview } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Qo'lda tekshiriladigan bandni belgilash: o'tdi / o'tmadi. */
export interface ManualCheckAction {
  check: WinnerManualCheckKey;
  passed: boolean;
}

export type WinnerAction = "skip" | "confirm" | "unconfirm" | "announce" | ManualCheckAction;

/** Qo'lda bandlar tugmalari: [o'tdi, o'tmadi]. */
const MANUAL_BUTTONS: Record<WinnerManualCheckKey, [string, string]> = {
  PURCHASE_CONFIRMED: ["Tasdiqlandi", "Tasdiqlanmadi"],
  AD_TOOLS_REVIEWED: ["Reklama yo'q", "Reklama bor"],
};

const isManualKey = (key: WinnerCheck["key"]): key is WinnerManualCheckKey => key in MANUAL_BUTTONS;

interface WinnerCandidateCardProps {
  overview: WinnerOverview;
  onAction: (action: WinnerAction) => void;
}

const STAGE_TITLES: Record<WinnerOverview["stage"], string> = {
  NOT_STARTED: "Joriy yetakchi",
  CANDIDATE: "G'olib nomzodi",
  CONFIRMED: "G'olib (tasdiqlangan)",
  ANNOUNCED: "G'olib",
};

export function WinnerCandidateCard({ overview, onAction }: WinnerCandidateCardProps) {
  const { candidate, stage } = overview;

  if (!candidate) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-slate-500">
          Reytingda nomzod yo&apos;q.
        </CardContent>
      </Card>
    );
  }

  const name = `${candidate.participant.firstName} ${candidate.participant.lastName}`;
  const passed = candidate.checks.filter((check) => check.status === "PASSED").length;
  const allPassed = passed === candidate.checks.length;
  const manualEditable = stage === "NOT_STARTED" || stage === "CANDIDATE";

  return (
    <Card>
      <CardHeader>
        <CardTitle>{STAGE_TITLES[stage]}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex flex-wrap items-start gap-4">
          <IosIcon icon={Crown} tint="yellow" size={48} />
          <div className="min-w-0 flex-1">
            <p className="text-xl font-semibold text-slate-900">{name}</p>
            <p className="text-sm text-slate-500">
              {candidate.rank}-o&apos;rin · {formatNumber(candidate.views)} ko&apos;rish ·{" "}
              {candidate.participant.age} yosh
            </p>
            <p className="mt-1 flex flex-wrap gap-x-3 text-sm text-slate-600">
              <span className="tabular-nums">{candidate.participant.phone}</span>
              {candidate.participant.instagramUsername && (
                <span>@{candidate.participant.instagramUsername}</span>
              )}
              <a
                href={candidate.reelUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-brand-700 hover:underline"
              >
                Reelni ochish
                <ExternalLink className="size-3.5" aria-hidden />
              </a>
            </p>
          </div>
        </div>

        <section aria-labelledby="winner-checks-title">
          <div className="mb-2 flex items-baseline justify-between gap-2">
            <h3 id="winner-checks-title" className="text-sm font-semibold text-slate-900">
              Tekshiruv ro&apos;yxati
            </h3>
            <span className="text-xs text-slate-500 tabular-nums">
              {candidate.checks.length} tadan {passed} tasi o&apos;tdi
            </span>
          </div>
          <ul className="divide-y divide-slate-100 rounded-md border border-slate-200">
            {candidate.checks.map((check) => (
              <CheckRow
                key={check.key}
                check={check}
                editable={check.manual && manualEditable}
                onAction={onAction}
              />
            ))}
          </ul>
        </section>

        <StageActions overview={overview} allPassed={allPassed} onAction={onAction} />
      </CardContent>
    </Card>
  );
}

function CheckRow({
  check,
  editable,
  onAction,
}: {
  check: WinnerCheck;
  editable: boolean;
  onAction: (action: WinnerAction) => void;
}) {
  const Icon = check.status === "PASSED" ? CheckCircle2 : check.status === "FAILED" ? XCircle : Clock;
  const statusText =
    check.status === "PASSED" ? "o'tdi" : check.status === "FAILED" ? "o'tmadi" : "tekshirilmagan";

  return (
    <li className="flex flex-wrap items-start gap-3 px-3 py-3">
      <Icon
        className={cn(
          "mt-0.5 size-5 shrink-0",
          check.status === "PASSED" && "text-green-600",
          check.status === "FAILED" && "text-red-600",
          check.status === "PENDING" && "text-amber-500",
        )}
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-slate-900">
          {WINNER_CHECK_LABELS[check.key]}
          <span className="sr-only"> — {statusText}</span>
        </p>
        <p className="text-sm text-slate-600">{check.detail}</p>
      </div>
      {editable && isManualKey(check.key) && (
        <ManualButtons check={check.key} onAction={onAction} />
      )}
    </li>
  );
}

function ManualButtons({
  check,
  onAction,
}: {
  check: WinnerManualCheckKey;
  onAction: (action: WinnerAction) => void;
}) {
  const [passLabel, failLabel] = MANUAL_BUTTONS[check];
  return (
    <div className="flex gap-2">
      <Button variant="secondary" size="sm" onClick={() => onAction({ check, passed: true })}>
        {passLabel}
      </Button>
      <Button variant="ghost" size="sm" onClick={() => onAction({ check, passed: false })}>
        {failLabel}
      </Button>
    </div>
  );
}

function StageActions({
  overview,
  allPassed,
  onAction,
}: {
  overview: WinnerOverview;
  allPassed: boolean;
  onAction: (action: WinnerAction) => void;
}) {
  switch (overview.stage) {
    case "NOT_STARTED":
      return (
        <p className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-600">
          Tasdiqlash tanlov tugagach ochiladi. Hozir yetakchini oldindan tekshirib, xarid
          hujjatini tasdiqlab qo&apos;yishingiz mumkin. Reklama tarixi esa g&apos;olib bilan
          yuzma-yuz uchrashuvda ko&apos;riladi.
        </p>
      );
    case "CANDIDATE":
      return (
        <div className="flex flex-col gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:items-center">
          <Button onClick={() => onAction("confirm")} disabled={!allPassed}>
            G&apos;olibni tasdiqlash
          </Button>
          <Button variant="secondary" onClick={() => onAction("skip")}>
            Nomzodni rad etish
          </Button>
          {!allPassed && (
            <p className="text-xs text-slate-500 sm:ml-2">
              Tasdiqlash uchun barcha bandlar o&apos;tishi kerak.
            </p>
          )}
        </div>
      );
    case "CONFIRMED":
      return (
        <div className="space-y-3 border-t border-slate-100 pt-4">
          {overview.confirmed && (
            <p className="text-sm text-slate-600">
              Tasdiqlangan: {formatDateTime(overview.confirmed.at)} · {overview.confirmed.by}
            </p>
          )}
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button onClick={() => onAction("announce")}>G&apos;olibni e&apos;lon qilish</Button>
            <Button variant="ghost" onClick={() => onAction("unconfirm")}>
              Tasdiqni bekor qilish
            </Button>
          </div>
        </div>
      );
    case "ANNOUNCED":
      return (
        <div className="flex items-start gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            G&apos;olib e&apos;lon qilindi
            {overview.announced &&
              `: ${formatDateTime(overview.announced.at)} · ${overview.announced.by}`}
            . Ilovada &quot;G&apos;olib e&apos;loni&quot; ekrani ko&apos;rinmoqda.
          </span>
        </div>
      );
  }
}
