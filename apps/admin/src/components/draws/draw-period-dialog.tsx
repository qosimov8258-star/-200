"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, CalendarRange } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RangeCalendar, type DateRange } from "@/components/ui/range-calendar";
import { createDrawPeriod, updateDrawPeriod } from "@/lib/api";
import { errorMessage } from "@/lib/api-error";
import { diffDays } from "@/lib/dates";
import { DRAW_PERIOD_LIMITS, periodLabel, validateDrawPeriod } from "@/lib/draw-rules";
import { formatNumber } from "@/lib/format";
import type { DrawPeriod, DrawSetup } from "@/lib/types";

interface DrawPeriodDialogProps {
  setup: DrawSetup;
  /** Tahrirlanadigan davr; null — yangi davr. */
  period: DrawPeriod | null;
  onClose: () => void;
  onSaved: (period: DrawPeriod) => void;
}

/** Kalendardan davr yaratish yoki tahrirlash: nom + boshlanish va tugash kuni (tanlov muddati ichida). */
export function DrawPeriodDialog({ setup, period, onClose, onSaved }: DrawPeriodDialogProps) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState(period?.title ?? "");
  const [range, setRange] = useState<DateRange>({ from: period?.startsOn ?? null, to: period?.endsOn ?? null });
  const [submitted, setSubmitted] = useState(false);

  const bounds = {
    min: setup.stages[0]?.startsOn ?? setup.today,
    max: setup.stages.at(-1)?.endsOn ?? setup.today,
  };
  const input = { title, startsOn: range.from ?? "", endsOn: range.to ?? "" };
  const errors = validateDrawPeriod(input, bounds);
  const valid = Object.keys(errors).length === 0;

  const save = useMutation({
    mutationFn: () => (period ? updateDrawPeriod(period.id, input) : createDrawPeriod(input)),
    onSuccess: async (saved) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["draw-setup"] }),
        queryClient.invalidateQueries({ queryKey: ["audit-log"] }),
      ]);
      onSaved(saved);
    },
  });

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitted(true);
    if (valid) save.mutate();
  };

  const dateError = errors.startsOn ?? errors.endsOn;

  return (
    <Dialog
      open
      onClose={onClose}
      busy={save.isPending}
      title={period ? "Davrni tahrirlash" : "Yangi davr"}
      description={`Kalendardan boshlanish va tugash kunini tanlang. Davr tanlov muddati ichida bo'ladi: ${periodLabel(bounds.min, bounds.max)}.`}
      className="max-w-[680px] rounded-panel"
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        {save.isError && (
          <p role="alert" className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
            {errorMessage(save.error)}
          </p>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="draw-period-title">Nomi</Label>
          <Input
            id="draw-period-title"
            data-autofocus
            value={title}
            maxLength={DRAW_PERIOD_LIMITS.titleMax}
            placeholder="Masalan: Yangi yil bonusi"
            onChange={(e) => setTitle(e.target.value)}
            aria-invalid={submitted && errors.title ? true : undefined}
          />
          {submitted && errors.title && <p className="text-xs text-red-600">{errors.title}</p>}
        </div>

        <div className="rounded-2xl border border-line p-3 sm:p-4">
          <RangeCalendar value={range} onChange={setRange} min={bounds.min} max={bounds.max} today={setup.today} />
        </div>

        <div
          className="flex items-center gap-2.5 rounded-xl bg-brand-50/70 px-3.5 py-2.5 text-sm"
          aria-live="polite"
        >
          <CalendarRange className="size-4 shrink-0 text-brand-600" aria-hidden />
          {range.from && range.to ? (
            <span className="text-ink">
              <span className="font-semibold tabular-nums">{periodLabel(range.from, range.to)}</span>
              <span className="text-muted"> · {formatNumber(diffDays(range.from, range.to) + 1)} kun</span>
            </span>
          ) : (
            <span className="text-muted">{range.from ? "Endi tugash kunini tanlang." : "Boshlanish kunini tanlang."}</span>
          )}
        </div>
        {submitted && dateError && <p className="-mt-2 text-xs text-red-600">{dateError}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={onClose} disabled={save.isPending}>
            Bekor qilish
          </Button>
          <Button type="submit" loading={save.isPending}>
            {period ? "Saqlash" : "Davr yaratish"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
