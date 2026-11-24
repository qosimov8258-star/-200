"use client";

import { useState } from "react";
import { Check, ExternalLink, ImageOff, Loader2, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { aiFrameUrl } from "@/lib/api";
import { formatDayTime, formatNumber, formatPercent, formatUsd, formatVideoSecond } from "@/lib/format";
import {
  AI_MANUAL_DECISION_LABELS,
  AI_REVIEW_STATE_LABELS,
  AI_REVIEW_STATE_TONES,
  AI_VERDICT_LABELS,
  AI_VERDICT_TONES,
} from "@/lib/labels";
import type { AiEvidence, AiManualDecision, AiReviewItem } from "@/lib/types";
import { cn } from "@/lib/utils";

interface ReviewCardProps {
  item: AiReviewItem;
  onDecide: (item: AiReviewItem, decision: AiManualDecision) => void;
}

/** Natijalar ro'yxatidagi bitta video: ishtirokchi, xulosa, sabab, dalil kadrlari, qo'lda qaror. */
export function ReviewCard({ item, onDecide }: ReviewCardProps) {
  const [frame, setFrame] = useState<AiEvidence | null>(null);
  const { manual } = item;
  const tokens = item.tokens ? item.tokens.input + item.tokens.output + item.tokens.cacheRead + item.tokens.cacheWrite : null;

  return (
    <li className="rounded-2xl border border-line bg-white p-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:gap-6">
        {/* Ishtirokchi va video */}
        <div className="min-w-0 lg:w-56 lg:shrink-0">
          <p className="truncate font-medium text-ink">{item.participant.fullName}</p>
          <p className="text-xs text-slate-500 tabular-nums">{item.participant.phone}</p>
          <a
            href={item.reel.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1.5 inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:underline"
          >
            Reelni ochish
            <ExternalLink className="size-3.5" aria-hidden />
            <span className="sr-only">({item.participant.fullName}, yangi oynada)</span>
          </a>
          <p className="text-xs text-slate-500">
            <span className="font-mono">{item.reel.shortcode}</span> ·{" "}
            <span className="tabular-nums">{formatNumber(item.reel.views)} ko&apos;rish</span>
          </p>
        </div>

        {/* Xulosa */}
        <div className="min-w-0 flex-1 space-y-2.5">
          <div className="flex flex-wrap items-center gap-2">
            {manual ? (
              <Badge tone={AI_VERDICT_TONES[manual.decision]}>Qo&apos;lda: {AI_VERDICT_LABELS[manual.decision]}</Badge>
            ) : item.verdict ? (
              <Badge tone={AI_VERDICT_TONES[item.verdict]}>{AI_VERDICT_LABELS[item.verdict]}</Badge>
            ) : null}
            {item.state !== "DONE" && (
              <Badge tone={AI_REVIEW_STATE_TONES[item.state]}>
                {item.state === "PROCESSING" && <Loader2 className="mr-1 size-3 animate-spin" aria-hidden />}
                {AI_REVIEW_STATE_LABELS[item.state]}
              </Badge>
            )}
            {item.verdict && (
              <span className="text-xs text-slate-500">
                {manual ? `AI: ${AI_VERDICT_LABELS[item.verdict]}` : "AI"}
                {item.confidence !== null && (
                  <>
                    {" · ishonch "}
                    <span className="font-medium text-ink tabular-nums">{formatPercent(item.confidence)}</span>
                  </>
                )}
              </span>
            )}
          </div>

          {item.reason && <p className="text-sm break-words text-slate-700">{item.reason}</p>}
          {item.state === "QUEUED" && <p className="text-sm text-slate-500">Worker navbati kelganda tekshiriladi.</p>}
          {item.state === "PROCESSING" && (
            <p className="text-sm text-slate-500">Video yuklab olinmoqda va kadrlar AI ga yuborilmoqda…</p>
          )}
          {item.state === "FAILED" && (
            <p className="text-sm break-words text-red-700">
              {item.error ?? "Tekshirib bo'lmadi."}{" "}
              <span className="text-xs text-slate-500 tabular-nums">(urinishlar: {item.attempts})</span>
            </p>
          )}

          {item.evidence.length > 0 && (
            <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3" aria-label="Dalil kadrlari">
              {item.evidence.map((evidence) => (
                <li key={evidence.second} className="flex min-w-0 gap-2.5 rounded-xl bg-canvas p-2">
                  <FrameThumb reviewId={item.id} evidence={evidence} onOpen={() => setFrame(evidence)} />
                  <div className="min-w-0 py-0.5">
                    <p className="text-xs font-semibold text-ink tabular-nums">{formatVideoSecond(evidence.second)}</p>
                    <p className="text-xs break-words text-slate-600">{evidence.description}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {manual && (
            <p className="rounded-lg border border-line px-3 py-2 text-xs break-words text-slate-600">
              <span className="font-medium text-ink">Qo&apos;lda: {AI_MANUAL_DECISION_LABELS[manual.decision]}</span> — «
              {manual.note}» · {manual.by}, <span className="tabular-nums">{formatDayTime(manual.at)}</span>
            </p>
          )}
        </div>

        {/* Qaror */}
        <div className="flex flex-wrap items-center gap-2 lg:w-40 lg:shrink-0 lg:flex-col lg:flex-nowrap lg:items-stretch">
          {manual?.decision !== "APPROVED" && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => onDecide(item, "APPROVED")}
              className="flex-1 text-up hover:border-green-200 hover:bg-green-50 sm:flex-none lg:flex-none"
              aria-label={`${item.participant.fullName} videosini qo'lda tasdiqlash`}
            >
              <Check className="size-4" aria-hidden />
              Tasdiqlash
            </Button>
          )}
          {manual?.decision !== "REJECTED" && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => onDecide(item, "REJECTED")}
              className="flex-1 text-red-600 hover:border-red-200 hover:bg-red-50 sm:flex-none lg:flex-none"
              aria-label={`${item.participant.fullName} videosini qo'lda rad etish`}
            >
              <X className="size-4" aria-hidden />
              Rad etish
            </Button>
          )}
          <p className="w-full text-xs text-slate-400 tabular-nums sm:w-auto lg:w-full lg:text-right">
            {formatDayTime(item.updatedAt)}
            {item.costUsd !== null && ` · ${formatUsd(item.costUsd)}`}
            {tokens !== null && (
              <span className="block">{formatNumber(tokens)} token</span>
            )}
          </p>
        </div>
      </div>

      {frame && (
        <Dialog
          open
          onClose={() => setFrame(null)}
          title={`${item.participant.fullName} — ${formatVideoSecond(frame.second)}`}
          description={frame.description}
          className="max-w-sm"
        >
          {/* Kadr API dan (cookie bilan) yoki mock'da `data:` URL. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={aiFrameUrl(item.id, frame.second)}
            alt={`${formatVideoSecond(frame.second)}: ${frame.description}`}
            className="mx-auto max-h-[65vh] w-auto rounded-lg bg-slate-100"
          />
        </Dialog>
      )}
    </li>
  );
}

/** Dalil kadri (9:16): bosilsa — kattaroq ko'rinadi; kadr saqlanmagan yoki ochilmasa — belgi. */
function FrameThumb({ reviewId, evidence, onOpen }: { reviewId: string; evidence: AiEvidence; onOpen: () => void }) {
  const [failed, setFailed] = useState(false);
  const box = "flex aspect-[9/16] w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-200";

  if (!evidence.hasFrame || failed) {
    return (
      <span className={cn(box, "text-slate-400")} title="Kadr saqlanmagan">
        <ImageOff className="size-4" aria-hidden />
        <span className="sr-only">Kadr saqlanmagan</span>
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(box, "ring-brand-300 transition hover:ring-2")}
      aria-label={`${formatVideoSecond(evidence.second)} kadrini kattalashtirish`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={aiFrameUrl(reviewId, evidence.second)}
        alt=""
        loading="lazy"
        onError={() => setFailed(true)}
        className="size-full object-cover"
      />
    </button>
  );
}
