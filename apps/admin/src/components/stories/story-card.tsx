"use client";

import { useState } from "react";
import { Clock, HardDrive, Hourglass, Trash2, VideoOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { storyVideoUrl } from "@/lib/api";
import { formatDateTime, formatFileSize, formatTimeAgo, formatTimeLeft } from "@/lib/format";
import { STORY_MIME_LABELS } from "@/lib/labels";
import type { AdminStoryItem } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Qolgan vaqt shundan kam bo'lsa — "tez orada yo'qoladi" rangi. */
const SOON_MS = 60 * 60 * 1000;

interface StoryCardProps {
  story: AdminStoryItem;
  /** Joriy vaqt (ms) — "N soat oldin" va qolgan vaqt shu bo'yicha. */
  now: number;
  onRemove: (story: AdminStoryItem) => void;
}

/**
 * Bitta istoriya: video (ovozsiz, boshqaruvlar bilan, faqat metadata oldindan yuklanadi),
 * ishtirokchi, yuklangan vaqt, yo'qolishiga qolgan vaqt, hajmi va "O'chirish" tugmasi.
 */
export function StoryCard({ story, now, onRemove }: StoryCardProps) {
  const [failed, setFailed] = useState(false);

  const name = story.participant.fullName;
  const createdMs = Date.parse(story.createdAt);
  const expiresMs = Date.parse(story.expiresAt);
  const lifetime = expiresMs - createdMs;
  const leftMs = expiresMs - now;
  const leftRatio = lifetime > 0 ? Math.min(1, Math.max(0, leftMs / lifetime)) : 0;
  const timeLeft = formatTimeLeft(story.expiresAt, now);
  const format = STORY_MIME_LABELS[story.mime] ?? story.mime;

  return (
    <Card className="flex h-full flex-col overflow-hidden">
      {/* Telefonda karta ekran kengligida — video ekrandan baland bo'lib ketmasin. */}
      <div className="relative aspect-[9/16] max-h-[70vh] bg-slate-900">
        {failed ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center text-sm text-white/70">
            <VideoOff className="size-6" aria-hidden />
            Videoni yuklab bo&apos;lmadi: muddati tugagan yoki o&apos;chirilgan bo&apos;lishi mumkin.
          </div>
        ) : (
          <video
            src={storyVideoUrl(story.id)}
            controls
            muted
            playsInline
            preload="metadata"
            onError={() => setFailed(true)}
            aria-label={`${name} istoriyasi`}
            className="absolute inset-0 size-full object-contain"
          />
        )}
        {/* Istoriya umrining qolgan qismi — Instagram istoriyalaridagi kabi ingichka chiziq. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-3 top-3 h-1 overflow-hidden rounded-full bg-white/30"
        >
          <div className="h-full rounded-full bg-white" style={{ width: `${leftRatio * 100}%` }} />
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="min-w-0">
          <p className="truncate font-medium text-ink" title={name}>
            {name}
          </p>
          <p className="text-sm text-slate-500 tabular-nums">{story.participant.phone}</p>
        </div>

        <dl className="space-y-1 text-sm text-slate-600">
          <div className="flex items-center gap-2">
            <dt>
              <Clock className="size-4 text-slate-400" aria-hidden />
              <span className="sr-only">Yuklangan</span>
            </dt>
            <dd>
              <time dateTime={story.createdAt} title={formatDateTime(story.createdAt)}>
                {formatTimeAgo(story.createdAt, now)}
              </time>
            </dd>
          </div>
          <div className="flex items-center gap-2">
            <dt>
              <Hourglass className="size-4 text-slate-400" aria-hidden />
              <span className="sr-only">Yo&apos;qolishiga</span>
            </dt>
            <dd className={cn("tabular-nums", leftMs < SOON_MS && "text-[#a7650f]")}>
              <time dateTime={story.expiresAt} title={`${formatDateTime(story.expiresAt)} da yo'qoladi`}>
                {timeLeft ? `${timeLeft} qoldi` : "Muddati tugadi"}
              </time>
            </dd>
          </div>
          <div className="flex items-center gap-2">
            <dt>
              <HardDrive className="size-4 text-slate-400" aria-hidden />
              <span className="sr-only">Hajmi</span>
            </dt>
            <dd className="tabular-nums">
              {formatFileSize(story.sizeBytes)} · {format}
            </dd>
          </div>
        </dl>

        <Button
          variant="secondary"
          size="sm"
          onClick={() => onRemove(story)}
          aria-label={`${name} istoriyasini o'chirish`}
          className="mt-auto w-full text-red-600 hover:border-red-200 hover:bg-red-50"
        >
          <Trash2 className="size-4" aria-hidden />
          O&apos;chirish
        </Button>
      </div>
    </Card>
  );
}

/** Ro'yxat birinchi marta yuklanayotganda ko'rinadigan "skelet". */
export function StoriesSkeleton({ count = 10 }: { count?: number }) {
  return (
    <div aria-hidden className="grid grid-cols-1 gap-4 min-[480px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {Array.from({ length: count }, (_, index) => (
        <Card key={index} className="overflow-hidden">
          <div className="aspect-[9/16] max-h-[70vh] animate-pulse bg-slate-200" />
          <div className="space-y-2 p-4">
            <div className="h-4 w-32 animate-pulse rounded bg-slate-200" />
            <div className="h-3 w-24 animate-pulse rounded bg-slate-200" />
            <div className="h-3 w-28 animate-pulse rounded bg-slate-200" />
            <div className="mt-3 h-8 animate-pulse rounded-[10px] bg-slate-200" />
          </div>
        </Card>
      ))}
    </div>
  );
}
