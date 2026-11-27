"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarDays, Check, ChevronDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addDays } from "@/lib/dates";
import { formatDayMonth } from "@/lib/format";
import { PERIOD_PRESETS, type Period } from "@/lib/period";
import type { IsoDate } from "@/lib/types";
import { cn } from "@/lib/utils";

interface PeriodSelectProps {
  value: Period;
  onChange: (period: Period) => void;
  today: IsoDate;
  /** Eng erta tanlanadigan sana (tanlov boshlanishi). */
  minDate?: IsoDate;
}

/** Tugmadagi yozuv: "Davr: 7 kun" — bu tugma raqamlarni o'zgartirishi darrov ko'rinsin. */
function label(period: Period): string {
  if (period.kind === "custom") return `Davr: ${formatDayMonth(period.from)} – ${formatDayMonth(period.to)}`;
  return `Davr: ${PERIOD_PRESETS.find((preset) => preset.value === period.preset)?.label ?? ""}`;
}

/** Davr tanlash — bitta kapsula, ochilganda ro'yxat va sanalar. */
export function PeriodSelect({ value, onChange, today, minDate }: PeriodSelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const [from, setFrom] = useState<IsoDate>(value.kind === "custom" ? value.from : addDays(today, -6));
  const [to, setTo] = useState<IsoDate>(value.kind === "custom" ? value.to : today);
  const invalid = !from || !to || from > to;

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex h-10 items-center gap-2 rounded-xl border border-line bg-white px-3.5 text-sm font-medium text-ink shadow-[0_1px_2px_rgba(39,38,39,0.04)] hover:border-brand-200"
      >
        <CalendarDays className="size-4 text-muted" aria-hidden />
        {label(value)}
        <ChevronDown className={cn("size-4 text-muted transition-transform", open && "rotate-180")} aria-hidden />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute top-full right-0 z-30 mt-2 w-72 rounded-2xl border border-line bg-white p-1.5 shadow-[0_18px_40px_-12px_rgba(39,38,39,0.25)]"
        >
          {PERIOD_PRESETS.map((preset) => {
            const active = value.kind === "preset" && value.preset === preset.value;
            return (
              <button
                key={preset.value}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                onClick={() => {
                  onChange({ kind: "preset", preset: preset.value });
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm font-medium",
                  active ? "bg-brand-50 text-brand-600" : "text-ink hover:bg-[#f5f4f8]",
                )}
              >
                {preset.label}
                {active && <Check className="size-4" aria-hidden />}
              </button>
            );
          })}
          <form
            className="mt-1 space-y-2 border-t border-line px-1.5 pt-3 pb-1.5"
            onSubmit={(event) => {
              event.preventDefault();
              if (invalid) return;
              onChange({ kind: "custom", from, to });
              setOpen(false);
            }}
            aria-label="Boshqa davr"
          >
            <p className="text-xs font-medium text-muted">Boshqa davr</p>
            <div className="flex items-center gap-2">
              <Input
                type="date"
                aria-label="Davr boshi"
                value={from}
                min={minDate}
                max={to || today}
                onChange={(event) => setFrom(event.target.value)}
                className="h-9 px-2 text-xs"
              />
              <span className="text-muted" aria-hidden>
                —
              </span>
              <Input
                type="date"
                aria-label="Davr oxiri"
                value={to}
                min={from || minDate}
                max={today}
                onChange={(event) => setTo(event.target.value)}
                className="h-9 px-2 text-xs"
              />
            </div>
            <Button type="submit" size="sm" disabled={invalid} className="w-full">
              Qo&apos;llash
            </Button>
          </form>
        </div>
      )}
    </div>
  );
}
