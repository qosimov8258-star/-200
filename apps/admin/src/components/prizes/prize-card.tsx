"use client";

import Image from "next/image";
import { ArrowDown, ArrowUp, ImagePlus, Pencil, Trash2 } from "lucide-react";

import { ActionMenu } from "@/components/ui/action-menu";
import { Badge } from "@/components/ui/badge";
import { PRIZE_KIND_LABELS, PRIZE_KIND_TONES } from "@/lib/labels";
import { formatPrizeQuantity, formatViewsRangeShort } from "@/lib/prize-rules";
import type { Prize, PrizeMoveDirection } from "@/lib/types";

interface PrizeCardProps {
  prize: Prize;
  /** O'z turidagi birinchi/oxirgi sovg'a — yuqoriga/pastga surib bo'lmaydi. */
  isFirst: boolean;
  isLast: boolean;
  /** Tartib o'zgartirilayotganda surish amallari vaqtincha o'chadi. */
  busy: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onMove: (direction: PrizeMoveDirection) => void;
}

/** Ro'yxatdagi ixcham sovg'a kartasi: rasm, nom, soni va ko'rishlar sharti. */
export function PrizeCard({ prize, isFirst, isLast, busy, onEdit, onDelete, onMove }: PrizeCardProps) {
  const views = formatViewsRangeShort(prize.minViews, prize.maxViews);

  return (
    <article className="flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-white transition-shadow hover:shadow-sm">
      <div className="relative aspect-[4/3] bg-gradient-to-b from-slate-50 to-slate-100">
        {prize.imageUrl ? (
          // Rasm yuklashdan oldin kichraytiriladi (lib/image.ts), Next optimizatsiyasi shart emas.
          <Image
            src={prize.imageUrl}
            alt={prize.title}
            fill
            unoptimized
            sizes="16rem"
            className="object-contain p-2"
          />
        ) : (
          <button
            type="button"
            onClick={onEdit}
            className="flex size-full flex-col items-center justify-center gap-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <ImagePlus className="size-6" aria-hidden />
            <span className="text-xs font-medium">Rasm qo&apos;shish</span>
          </button>
        )}
        <Badge tone={PRIZE_KIND_TONES[prize.kind]} className="absolute top-2 left-2 shadow-sm">
          {PRIZE_KIND_LABELS[prize.kind]}
        </Badge>
      </div>

      <div className="flex flex-1 flex-col gap-2 border-t border-slate-100 p-3">
        <div className="flex items-start justify-between gap-1">
          <h4 className="min-w-0 pt-1 text-sm leading-snug font-semibold break-words text-slate-900">
            {prize.title}
          </h4>
          <div className="-mt-0.5 -mr-1.5 shrink-0">
            <ActionMenu
              label={`${prize.title} uchun amallar`}
              items={[
                { label: "Tahrirlash", icon: Pencil, onSelect: onEdit },
                {
                  label: "Yuqoriga surish",
                  icon: ArrowUp,
                  onSelect: () => onMove("up"),
                  disabled: isFirst || busy,
                },
                {
                  label: "Pastga surish",
                  icon: ArrowDown,
                  onSelect: () => onMove("down"),
                  disabled: isLast || busy,
                },
                { label: "O'chirish", icon: Trash2, onSelect: onDelete, danger: true },
              ]}
            />
          </div>
        </div>

        <dl className="mt-auto space-y-1 text-xs">
          <div className="flex justify-between gap-2">
            <dt className="text-slate-500">Soni</dt>
            <dd className="font-medium text-slate-900">{formatPrizeQuantity(prize)}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-slate-500">Ko&apos;rishlar</dt>
            <dd className="text-right font-medium text-slate-900">{views ?? "—"}</dd>
          </div>
        </dl>

        {prize.description && (
          <p className="line-clamp-2 text-xs text-slate-500" title={prize.description}>
            {prize.description}
          </p>
        )}
      </div>
    </article>
  );
}
