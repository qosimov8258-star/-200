"use client";

import { useState } from "react";
import { Check, ChevronDown, Clock, ExternalLink, ImageOff, Loader2, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { aiFrameUrl } from "@/lib/api";
import { formatDayTime, formatNumber, formatPercent, formatUsd, formatVideoSecond } from "@/lib/format";
import { AI_MANUAL_DECISION_LABELS, AI_REVIEW_STATE_LABELS, AI_VERDICT_FILTER_LABELS, AI_VERDICT_LABELS, AI_VERDICT_TONES } from "@/lib/labels";
import type { AiEvidence, AiManualDecision, AiReviewItem } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Shundan yuqori ishonch — "AI aniq". */
const SURE_CONFIDENCE = 0.85;

interface ReviewCardProps {
  item: AiReviewItem;
  /** Bundan past ishonch — "Shubhali" (backend sozlamasi). */
  confidenceMin: number;
  onDecide: (item: AiReviewItem, decision: AiManualDecision) => void;
}

/** AI ishonchi foiz o'rniga so'z bilan (aniq foiz — "Batafsil" ichida). */
function confidenceText(confidence: number, confidenceMin: number): string {
  if (confidence >= SURE_CONFIDENCE) return "AI aniq";
  if (confidence >= confidenceMin) return "AI deyarli aniq";
  return "AI ishonchsiz";
}

/**
 * Natijalar ro'yxatidagi bitta video: ishtirokchi, xulosa, sabab, dalil kadrlari va "Mos / Mos emas" belgisi.
 * Texnik ma'lumotlar (shortcode, aniq ishonch, narx, token) — kartaning pastidagi "Batafsil" ichida.
 */
export function ReviewCard({ item, confidenceMin, onDecide }: ReviewCardProps) {
  const [frame, setFrame] = useState<AiEvidence | null>(null);
  const { manual } = item;
  const tokens = item.tokens ? item.tokens.input + item.tokens.output + item.tokens.cacheRead + item.tokens.cacheWrite : null;
  const name = item.participant.fullName;
  // "SHUBHALI" belgisining o'zi yetarli — yoniga "AI aniq" yozilsa, bir-biriga zid bo'lardi.
  const aiNote = !item.verdict
    ? null
    : manual
      ? `AI: ${AI_VERDICT_FILTER_LABELS[item.verdict]}`
      : item.verdict !== "UNCERTAIN" && item.confidence !== null
        ? confidenceText(item.confidence, confidenceMin)
        : null;

  return (
    <li className="rounded-2xl border border-line bg-white p-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:gap-6">
        {/* Ishtirokchi va video */}
        <div className="min-w-0 lg:w-56 lg:shrink-0">
          <p className="truncate font-medium text-ink">{name}</p>
          <p className="text-xs text-slate-500 tabular-nums">{item.participant.phone}</p>
          <a
            href={item.reel.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1.5 inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:underline"
          >
            Reelni ochish
            <ExternalLink className="size-3.5" aria-hidden />
            <span className="sr-only">({name}, yangi oynada)</span>
          </a>
          <p className="text-xs text-slate-500 tabular-nums">{formatNumber(item.reel.views)} ko&apos;rish</p>
        </div>

        {/* Xulosa */}
        <div className="min-w-0 flex-1 space-y-2.5">
          <div className="flex flex-wrap items-center gap-2">
            {manual ? (
              <Badge tone={AI_VERDICT_TONES[manual.decision]}>Siz: {AI_MANUAL_DECISION_LABELS[manual.decision]}</Badge>
            ) : item.verdict ? (
              <Badge tone={AI_VERDICT_TONES[item.verdict]}>{AI_VERDICT_LABELS[item.verdict]}</Badge>
            ) : null}
            {item.state === "FAILED" && <Badge tone="danger">{AI_REVIEW_STATE_LABELS.FAILED}</Badge>}
            {aiNote && <span className="text-xs text-slate-500">{aiNote}</span>}
          </div>

          {item.reason && <p className="text-sm break-words text-slate-700">{item.reason}</p>}
          {item.state === "QUEUED" && (
            <p className="flex items-center gap-1.5 text-sm text-slate-500">
              <Clock className="size-4 shrink-0" aria-hidden />
              Navbatda — tez orada tekshiriladi
            </p>
          )}
          {item.state === "PROCESSING" && (
            <p className="flex items-center gap-1.5 text-sm text-brand-700">
              <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
              Hozir tekshirilmoqda…
            </p>
          )}
          {item.state === "FAILED" && (
            <p className="text-sm break-words text-red-700">
              {item.error ?? "Tekshirib bo'lmadi."}{" "}
              {item.attempts > 0 && (
                <span className="text-xs text-slate-500 tabular-nums">· {item.attempts} marta urinildi</span>
              )}
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
              <span className="font-medium text-ink">Belgi: {AI_MANUAL_DECISION_LABELS[manual.decision]}</span> — «{manual.note}» ·{" "}
              {manual.by}, <span className="tabular-nums">{formatDayTime(manual.at)}</span>
            </p>
          )}
        </div>

        {/* Belgi: faqat AI natijasini to'g'rilaydi */}
        <div className="flex flex-wrap items-center gap-2 lg:w-36 lg:shrink-0 lg:flex-col lg:flex-nowrap lg:items-stretch">
          {manual?.decision !== "APPROVED" && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => onDecide(item, "APPROVED")}
              className="flex-1 text-up hover:border-green-200 hover:bg-green-50 sm:flex-none lg:flex-none"
              aria-label={`${name}: AI natijasini «mos» deb belgilash`}
            >
              <Check className="size-4" aria-hidden />
              Mos
            </Button>
          )}
          {manual?.decision !== "REJECTED" && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => onDecide(item, "REJECTED")}
              className="flex-1 text-red-600 hover:border-red-200 hover:bg-red-50 sm:flex-none lg:flex-none"
              aria-label={`${name}: AI natijasini «mos emas» deb belgilash`}
            >
              <X className="size-4" aria-hidden />
              Mos emas
            </Button>
          )}
        </div>
      </div>

      <details className="group mt-3 border-t border-line pt-2 text-xs text-slate-500">
        <summary className="inline-flex cursor-pointer list-none items-center gap-1 rounded hover:text-ink focus-visible:outline-2 focus-visible:outline-brand-500 [&::-webkit-details-marker]:hidden">
          Batafsil
          <span className="sr-only">: {name} videosi bo&apos;yicha texnik ma&apos;lumot</span>
          <ChevronDown className="size-3.5 transition-transform group-open:rotate-180" aria-hidden />
        </summary>
        <dl className="mt-2 grid gap-x-6 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
          <DetailRow label="Video kodi">
            <span className="font-mono">{item.reel.shortcode}</span>
          </DetailRow>
          {item.confidence !== null && <DetailRow label="AI ishonchi">{formatPercent(item.confidence)}</DetailRow>}
          {item.costUsd !== null && <DetailRow label="Narxi">{formatUsd(item.costUsd)}</DetailRow>}
          {tokens !== null && <DetailRow label="Token">{formatNumber(tokens)}</DetailRow>}
          {item.attempts > 0 && <DetailRow label="Urinishlar">{formatNumber(item.attempts)}</DetailRow>}
          <DetailRow label="Yangilangan">{formatDayTime(item.updatedAt)}</DetailRow>
        </dl>
      </details>

      {frame && (
        <Dialog
          open
          onClose={() => setFrame(null)}
          title={`${name} — ${formatVideoSecond(frame.second)}`}
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

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 justify-between gap-2">
      <dt>{label}</dt>
      <dd className="min-w-0 truncate text-slate-700 tabular-nums">{children}</dd>
    </div>
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
