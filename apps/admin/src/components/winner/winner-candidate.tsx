"use client";

import { CheckCircle2, Clock, Crown, ExternalLink, XCircle } from "lucide-react";

import { IosIcon } from "@/components/ui/ios-icon";
import { Button } from "@/components/ui/button";
import { formatNumber } from "@/lib/format";
import { WINNER_CHECK_LABELS } from "@/lib/labels";
import type { WinnerCandidate, WinnerCheck, WinnerManualCheckKey, WinnerOverview } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Qo'lda tekshiriladigan bandni belgilash: o'tdi / o'tmadi. */
export interface ManualCheckAction {
  check: WinnerManualCheckKey;
  passed: boolean;
}

export type WinnerAction = "skip" | "confirm" | "unconfirm" | "announce" | ManualCheckAction;

/** Qo'lda bandlar tugmalari: [o'tdi, o'tmadi]. */
const MANUAL_BUTTONS: Record<WinnerManualCheckKey, [string, string]> = {
  AD_TOOLS_REVIEWED: ["Reklama yo'q", "Reklama bor"],
};

const isManualKey = (key: WinnerCheck["key"]): key is WinnerManualCheckKey => key in MANUAL_BUTTONS;

/** Nomzod ismi ustidagi kichik izoh — hozir u kim. */
const STAGE_CAPTIONS: Record<WinnerOverview["stage"], string> = {
  NOT_STARTED: "G'olib nomzodi — aksiya tugagach tasdiqlanadi",
  CANDIDATE: "G'olib nomzodi",
  CONFIRMED: "G'olib (tasdiqlangan)",
  ANNOUNCED: "G'olib",
};

export const candidateName = (candidate: WinnerCandidate): string =>
  `${candidate.participant.firstName} ${candidate.participant.lastName}`;

/** Tekshiruv bandlari bo'yicha hisob: nechtasi o'tdi, o'tmadi, kutmoqda. */
export function checkCounts(candidate: WinnerCandidate) {
  const passed = candidate.checks.filter((check) => check.status === "PASSED").length;
  const failed = candidate.checks.filter((check) => check.status === "FAILED").length;
  return { passed, failed, total: candidate.checks.length, allPassed: passed === candidate.checks.length };
}

/**
 * Nomzod: ismi, barabandagi o'rni, ko'rishlari, telefon, Instagram va videosi. `reservePlace` —
 * nomzod tanlovning zaxirasidan o'tgan bo'lsa, uning zaxira raqami (oldingi nomzod rad etilgan yoki
 * chiqib ketgan); `candidate.rank` bunga yaramaydi — rad etilganlar navbatdan chiqqach u yana 1 bo'ladi.
 */
export function CandidateSummary({
  candidate,
  stage,
  reservePlace,
}: {
  candidate: WinnerCandidate;
  stage: WinnerOverview["stage"];
  reservePlace: number | null;
}) {
  return (
    <div className="flex flex-wrap items-start gap-3">
      <IosIcon icon={Crown} tint="yellow" size={40} />
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted">{STAGE_CAPTIONS[stage]}</p>
        <p className="text-lg font-semibold text-ink">{candidateName(candidate)}</p>
        <p className="text-sm text-slate-500 tabular-nums">
          {reservePlace === null
            ? "Barabanda chiqqan g'olib"
            : `${reservePlace}-zaxira g'olib (oldingi nomzod o'rniga)`}
          <span aria-hidden> · </span>
          {formatNumber(candidate.views)} ko&apos;rish (jami)
          {candidate.participant.age > 0 && ` · ${candidate.participant.age} yosh`}
        </p>
        <p className="mt-1 flex flex-wrap gap-x-3 text-sm text-slate-600">
          <span className="tabular-nums">{candidate.participant.phone}</span>
          {candidate.participant.instagramUsername && <span>@{candidate.participant.instagramUsername}</span>}
          <a
            href={candidate.reelUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-brand-700 hover:underline"
          >
            Videoni ochish
            <ExternalLink className="size-3.5" aria-hidden />
          </a>
        </p>
      </div>
    </div>
  );
}

/** Tekshiruv bandlari; qo'lda belgilanadigan bandda (reklama tarixi) — "Reklama yo'q / bor" tugmalari. */
export function CheckList({
  candidate,
  editable,
  onAction,
}: {
  candidate: WinnerCandidate;
  editable: boolean;
  onAction: (action: WinnerAction) => void;
}) {
  return (
    <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white" aria-label="Tekshiruv bandlari">
      {candidate.checks.map((check) => (
        <CheckRow key={check.key} check={check} editable={check.manual && editable} onAction={onAction} />
      ))}
    </ul>
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
      {editable && isManualKey(check.key) && <ManualButtons check={check.key} onAction={onAction} />}
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
