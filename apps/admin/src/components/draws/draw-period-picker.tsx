"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarPlus, CalendarRange, Pencil, RotateCcw, Trash2 } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { deleteDrawPeriod, deleteDrawStage, restoreDrawStage } from "@/lib/api";
import { errorMessage } from "@/lib/api-error";
import { diffDays, isIsoDate } from "@/lib/dates";
import { periodLabel, type DrawPeriodChoice } from "@/lib/draw-rules";
import { formatDayMonth, formatNumber } from "@/lib/format";
import type { DrawPeriod, DrawSetup, DrawStage, IsoDate } from "@/lib/types";
import { cn } from "@/lib/utils";

import { DrawPeriodDialog } from "./draw-period-dialog";

interface DrawPeriodPickerProps {
  setup: DrawSetup;
  value: DrawPeriodChoice;
  onChange: (next: DrawPeriodChoice) => void;
  disabled?: boolean;
}

/**
 * Qaysi davr uchun tanlanadi: aksiya bosqichlari (1-, 2-, 3-bosqich) va admin kalendardan yaratgan
 * davrlar. Bosqichni o'chirish / tiklash, davr yaratish, tahrirlash va o'chirish ham shu yerda.
 */
export function DrawPeriodPicker({ setup, value, onChange, disabled = false }: DrawPeriodPickerProps) {
  const queryClient = useQueryClient();
  /** Davr oynasi: `period: null` — yangi davr. */
  const [periodDialog, setPeriodDialog] = useState<{ period: DrawPeriod | null } | null>(null);
  const [deleting, setDeleting] = useState<DrawPeriod | null>(null);
  const [deletingStage, setDeletingStage] = useState<DrawStage | null>(null);

  const refreshSetup = () => {
    void queryClient.invalidateQueries({ queryKey: ["draw-setup"] });
    void queryClient.invalidateQueries({ queryKey: ["draws", "stock"] });
    void queryClient.invalidateQueries({ queryKey: ["audit-log"] });
  };

  const restoreStage = useMutation({
    mutationFn: (index: number) => restoreDrawStage(index),
    onSuccess: refreshSetup,
  });

  const isPeriodActive = (period: DrawPeriod) =>
    value.stage === null && value.periodFrom === period.startsOn && value.periodTo === period.endsOn;

  const selectPeriod = (period: DrawPeriod) =>
    onChange({ stage: null, periodFrom: period.startsOn, periodTo: period.endsOn });

  const selectStage = (stage: DrawStage) =>
    onChange({ stage: stage.index, periodFrom: stage.startsOn, periodTo: stage.endsOn });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarRange className="size-4 text-brand-600" aria-hidden />
          Bosqich
        </CardTitle>
        <p className="mt-0.5 text-xs text-muted">Qaysi oy uchun tanlaymiz? Har bosqichda bitta tanlov o&apos;tkaziladi.</p>
      </CardHeader>
      <CardContent className="space-y-3">
        <fieldset disabled={disabled} className="flex min-w-0 flex-wrap gap-2" role="radiogroup" aria-label="Bosqich yoki davr">
          {setup.stages.map((stage) => (
            <StageChip
              key={stage.index}
              stage={stage}
              today={setup.today}
              active={value.stage === stage.index}
              onSelect={() => selectStage(stage)}
              onDelete={() => setDeletingStage(stage)}
            />
          ))}
          {setup.periods.map((period) => (
            <PeriodChip
              key={period.id}
              period={period}
              today={setup.today}
              active={isPeriodActive(period)}
              onSelect={() => selectPeriod(period)}
              onEdit={() => setPeriodDialog({ period })}
              onDelete={() => setDeleting(period)}
            />
          ))}
          <button
            type="button"
            onClick={() => setPeriodDialog({ period: null })}
            className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-brand-300 bg-white px-3.5 py-1.5 text-sm font-medium text-brand-600 transition hover:border-brand-500 hover:bg-brand-50"
          >
            <CalendarPlus className="size-4" aria-hidden />
            Davr yaratish
          </button>
        </fieldset>

        {setup.removedStages.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-xs text-muted">
            <span>O&apos;chirilgan:</span>
            {setup.removedStages.map((stage) => (
              <span
                key={stage.index}
                className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-slate-300 py-0.5 pr-1 pl-2.5"
              >
                <span className="line-through decoration-slate-400">
                  {stage.index}-bosqich · {formatDayMonth(stage.startsOn)} – {formatDayMonth(stage.endsOn)}
                </span>
                <button
                  type="button"
                  onClick={() => restoreStage.mutate(stage.index)}
                  disabled={restoreStage.isPending}
                  className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium text-brand-600 transition hover:bg-brand-50 disabled:opacity-50"
                >
                  <RotateCcw className="size-3" aria-hidden />
                  Tiklash
                </button>
              </span>
            ))}
            {restoreStage.isError && <span className="text-red-600">{errorMessage(restoreStage.error)}</span>}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl bg-[#f7f6fb] px-3.5 py-2.5 text-sm">
          <CalendarRange className="size-4 shrink-0 text-muted" aria-hidden />
          <span className="text-muted">Tanlangan davr:</span>
          <span className="font-semibold text-ink tabular-nums">{periodLabel(value.periodFrom, value.periodTo)}</span>
          {isIsoDate(value.periodFrom) && isIsoDate(value.periodTo) && value.periodTo >= value.periodFrom && (
            <span className="text-muted">· {formatNumber(diffDays(value.periodFrom, value.periodTo) + 1)} kun</span>
          )}
        </div>
      </CardContent>

      {periodDialog && (
        <DrawPeriodDialog
          setup={setup}
          period={periodDialog.period}
          onClose={() => setPeriodDialog(null)}
          onSaved={(saved) => {
            // Yangi davr — darhol tanlanadi; tahrirlangan davr tanlangan bo'lsa — sanalari yangilanadi.
            const wasActive = periodDialog.period ? isPeriodActive(periodDialog.period) : true;
            if (wasActive) selectPeriod(saved);
            setPeriodDialog(null);
          }}
        />
      )}

      {deleting && (
        <ConfirmDialog
          title="Davrni o'chirish"
          description={
            <>
              «{deleting.title}» ({periodLabel(deleting.startsOn, deleting.endsOn)}) davri ro&apos;yxatdan
              o&apos;chiriladi. Unda o&apos;tkazilgan tanlovlar o&apos;zgarmaydi.
            </>
          }
          confirmLabel="O'chirish"
          variant="danger"
          onConfirm={() => deleteDrawPeriod(deleting.id)}
          onClose={() => setDeleting(null)}
          onDone={() => {
            setDeleting(null);
            void queryClient.invalidateQueries({ queryKey: ["draw-setup"] });
            void queryClient.invalidateQueries({ queryKey: ["audit-log"] });
          }}
        />
      )}

      {deletingStage && (
        <ConfirmDialog
          title="Bosqichni o'chirish"
          description={
            <>
              {deletingStage.index}-bosqich ({periodLabel(deletingStage.startsOn, deletingStage.endsOn)}) random
              tanlovda tanlanmaydi, Mini App&apos;dagi sovg&apos;alar sahifasidan ham olib tashlanadi va voucherlar
              jami shu bosqich kvotasiga kamayadi. Keyin «Tiklash» bilan qaytarish mumkin.
            </>
          }
          confirmLabel="O'chirish"
          variant="danger"
          onConfirm={() => deleteDrawStage(deletingStage.index)}
          onClose={() => setDeletingStage(null)}
          onDone={() => {
            // Tanlangan bosqich o'chirilgan bo'lsa — qolganlaridan birinchisiga o'tamiz.
            if (value.stage === deletingStage.index) {
              const next = setup.stages.find((item) => item.index !== deletingStage.index);
              if (next) selectStage(next);
            }
            setDeletingStage(null);
            refreshSetup();
          }}
        />
      )}
    </Card>
  );
}

type PeriodState = "finished" | "current" | "upcoming";

function periodState(startsOn: IsoDate, endsOn: IsoDate, today: IsoDate): PeriodState {
  if (endsOn < today) return "finished";
  return startsOn > today ? "upcoming" : "current";
}

const STATE_LABELS: Record<PeriodState, string> = {
  finished: "tugagan",
  current: "davom etmoqda",
  upcoming: "boshlanmagan",
};

function StateBadge({ state }: { state: PeriodState }) {
  return (
    <span
      className={cn(
        "rounded-full px-1.5 text-[10px] font-semibold",
        state === "finished" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700",
      )}
    >
      {STATE_LABELS[state]}
    </span>
  );
}

/** Aksiya bosqichi: tanlash tugmasi va yonida o'chirish (sanalari qoidalarda belgilangan — tahrirlanmaydi). */
function StageChip({
  stage,
  today,
  active,
  onSelect,
  onDelete,
}: {
  stage: DrawStage;
  today: IsoDate;
  active: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border py-0.5 pr-1 pl-0.5 text-sm transition",
        active ? "border-brand-600 bg-brand-600 text-white" : "border-slate-200 bg-white text-slate-700 hover:border-slate-300",
      )}
    >
      <button
        type="button"
        role="radio"
        aria-checked={active}
        onClick={onSelect}
        className="inline-flex items-center gap-2 rounded-full py-1 pr-1.5 pl-2.5"
      >
        <span className="font-semibold">{stage.index}-bosqich</span>
        <span className="text-xs opacity-75">
          {formatDayMonth(stage.startsOn)} – {formatDayMonth(stage.endsOn)}
        </span>
        <StateBadge state={periodState(stage.startsOn, stage.endsOn, today)} />
      </button>
      <button
        type="button"
        onClick={onDelete}
        aria-label={`${stage.index}-bosqichni o'chirish`}
        title="O'chirish"
        className={cn(
          "grid size-7 place-items-center rounded-full transition",
          active ? "text-white/80 hover:bg-white/15 hover:text-white" : "text-muted hover:bg-red-50 hover:text-red-600",
        )}
      >
        <Trash2 className="size-3.5" aria-hidden />
      </button>
    </span>
  );
}

/** Admin yaratgan davr: tanlash tugmasi va yonida tahrirlash / o'chirish. */
function PeriodChip({
  period,
  today,
  active,
  onSelect,
  onEdit,
  onDelete,
}: {
  period: DrawPeriod;
  today: IsoDate;
  active: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const iconButton = cn(
    "grid size-7 place-items-center rounded-full transition",
    active ? "text-white/80 hover:bg-white/15 hover:text-white" : "text-muted hover:bg-brand-50 hover:text-ink",
  );
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border py-0.5 pr-1 pl-0.5 text-sm transition",
        active ? "border-brand-600 bg-brand-600 text-white" : "border-slate-200 bg-white text-slate-700 hover:border-slate-300",
      )}
    >
      <button
        type="button"
        role="radio"
        aria-checked={active}
        onClick={onSelect}
        className="inline-flex items-center gap-2 rounded-full py-1 pr-1.5 pl-2.5"
      >
        <span className="max-w-[12rem] truncate font-semibold">{period.title}</span>
        <span className="text-xs opacity-75">
          {formatDayMonth(period.startsOn)} – {formatDayMonth(period.endsOn)}
        </span>
        <StateBadge state={periodState(period.startsOn, period.endsOn, today)} />
      </button>
      <button type="button" onClick={onEdit} aria-label={`«${period.title}» davrini tahrirlash`} title="Tahrirlash" className={iconButton}>
        <Pencil className="size-3.5" aria-hidden />
      </button>
      <button type="button" onClick={onDelete} aria-label={`«${period.title}» davrini o'chirish`} title="O'chirish" className={iconButton}>
        <Trash2 className="size-3.5" aria-hidden />
      </button>
    </span>
  );
}
