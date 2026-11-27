"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AlertCircle, CheckCircle2, ImageOff } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { aiReferenceImageUrl } from "@/lib/api";
import { AI_REF_KIND_LABELS, AI_REF_KIND_TONES } from "@/lib/labels";
import type { AiProgress, AiRefKind, AiState } from "@/lib/types";
import { cn } from "@/lib/utils";

/** `GET /admin/ai/state` — barcha amallar javobi ham shu kalitga yoziladi. */
export const AI_STATE_KEY = ["ai-state"] as const;
/** `GET /admin/ai/reviews` (filtrlar bilan). */
export const AI_REVIEWS_KEY = ["ai-reviews"] as const;
/** `GET /admin/ai/candidates`. */
export const AI_CANDIDATES_KEY = ["ai-candidates"] as const;

/** Worker ishlayotganda holat va natijalar shuncha vaqtda yangilanadi. */
export const AI_POLL_MS = 3000;

/** Sahifa bo'limlari — qadamlardagi tugmalar shu yerlarga olib boradi. */
export const AI_SECTION_IDS = {
  config: "ai-config",
  configTitle: "ai-config-title",
  approve: "ai-approve",
  approveStart: "ai-approve-start",
  progress: "ai-progress",
  progressTitle: "ai-progress-title",
  results: "ai-results",
} as const;

/** Navbatda yoki ishlanayotgan video bor. */
export function aiRunInProgress(state: AiState | undefined): boolean {
  return Boolean(state?.run && state.progress.queued + state.progress.processing > 0);
}

/** Sinov ishga tushirilgan va undagi hamma videolar tekshirib bo'lingan. */
export function aiTrialFinished(state: AiState): boolean {
  const { run, progress } = state;
  return run?.mode === "TRIAL" && progress.total > 0 && progress.queued + progress.processing === 0;
}

/** Bitta video o'rtacha narxi; hali birortasi tayyor bo'lmasa — null. */
export function averageCost(progress: AiProgress): number | null {
  return progress.done > 0 ? progress.costUsd / progress.done : null;
}

/**
 * Sahifadagi bo'limga silliq o'tish. `focusId` berilsa — o'sha element fokus oladi (klaviatura va ekran
 * o'quvchisi ham shu joyga o'tsin). Holat yangilangach bo'lim endi chizilayotgan bo'lishi mumkin — bir oz kutiladi.
 */
export function scrollToAiSection(id: string, focusId?: string): void {
  window.setTimeout(() => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    if (focusId) document.getElementById(focusId)?.focus({ preventScroll: true });
  }, 100);
}

/** Amal javobidagi yangi holatni keshga yozish. */
export function useSetAiState(): (state: AiState) => void {
  const queryClient = useQueryClient();
  return (state) => queryClient.setQueryData(AI_STATE_KEY, state);
}

export function ErrorAlert({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      role="alert"
      className={cn(
        "flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700",
        className,
      )}
    >
      <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="min-w-0 space-y-1">{children}</div>
    </div>
  );
}

/** Muvaffaqiyat xabari — `role="status"` konteyner ichida ishlatiladi. */
export function SuccessNotice({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
      <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>{children}</span>
    </div>
  );
}

export function KindBadge({ kind, className }: { kind: AiRefKind; className?: string }) {
  return (
    <Badge tone={AI_REF_KIND_TONES[kind]} className={className}>
      {AI_REF_KIND_LABELS[kind]}
    </Badge>
  );
}

/** Namuna rasm: butun rasm ko'rinadi (kesilmaydi); ochilmasa — belgi. */
export function ReferenceImage({ id, alt, className }: { id: string; alt: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className={cn("flex items-center justify-center overflow-hidden bg-slate-100", className)}>
      {failed ? (
        <span className="flex flex-col items-center gap-1 px-3 text-center text-xs text-slate-500">
          <ImageOff className="size-5" aria-hidden />
          Rasmni ochib bo&apos;lmadi
        </span>
      ) : (
        // Rasm API dan (cookie bilan) yoki mock'da `data:` URL — `next/image` optimizatsiyasi kerak emas.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={aiReferenceImageUrl(id)}
          alt={alt}
          loading="lazy"
          onError={() => setFailed(true)}
          className="size-full object-contain"
        />
      )}
    </div>
  );
}
