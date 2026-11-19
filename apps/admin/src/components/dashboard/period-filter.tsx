"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addDays } from "@/lib/dates";
import { PERIOD_PRESETS, type Period } from "@/lib/period";
import type { IsoDate } from "@/lib/types";
import { cn } from "@/lib/utils";

interface PeriodFilterProps {
  value: Period;
  onChange: (period: Period) => void;
  today: IsoDate;
  /** Eng erta tanlanadigan sana (tanlov boshlanishi); noma'lum bo'lsa — cheklovsiz. */
  minDate?: IsoDate;
}

const SEGMENT_CLASSES =
  "rounded px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors";

export function PeriodFilter({ value, onChange, today, minDate }: PeriodFilterProps) {
  const [customRequested, setCustomRequested] = useState(false);
  const [from, setFrom] = useState<IsoDate>(
    value.kind === "custom" ? value.from : addDays(today, -6),
  );
  const [to, setTo] = useState<IsoDate>(value.kind === "custom" ? value.to : today);

  const showCustom = customRequested || value.kind === "custom";
  const invalid = !from || !to || from > to;

  function selectPreset(preset: (typeof PERIOD_PRESETS)[number]["value"]) {
    setCustomRequested(false);
    onChange({ kind: "preset", preset });
  }

  function applyCustom(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!invalid) {
      onChange({ kind: "custom", from, to });
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div
        role="group"
        aria-label="Davr"
        className="flex max-w-full flex-wrap gap-0.5 rounded-md border border-slate-300 bg-white p-0.5"
      >
        {PERIOD_PRESETS.map((preset) => {
          const active = !showCustom && value.kind === "preset" && value.preset === preset.value;
          return (
            <button
              key={preset.value}
              type="button"
              aria-pressed={active}
              onClick={() => selectPreset(preset.value)}
              className={cn(
                SEGMENT_CLASSES,
                active ? "bg-brand-600 text-white" : "text-slate-600 hover:bg-slate-100",
              )}
            >
              {preset.label}
            </button>
          );
        })}
        <button
          type="button"
          aria-pressed={showCustom}
          aria-expanded={showCustom}
          aria-controls="custom-period"
          onClick={() => setCustomRequested(true)}
          className={cn(
            SEGMENT_CLASSES,
            showCustom ? "bg-brand-600 text-white" : "text-slate-600 hover:bg-slate-100",
          )}
        >
          Boshqa davr
        </button>
      </div>

      {showCustom && (
        <form
          id="custom-period"
          onSubmit={applyCustom}
          className="flex flex-wrap items-center gap-2"
          aria-label="Boshqa davr"
        >
          <label htmlFor="period-from" className="sr-only">
            Davr boshi
          </label>
          <Input
            id="period-from"
            type="date"
            value={from}
            min={minDate}
            max={to || today}
            onChange={(event) => setFrom(event.target.value)}
            className="h-9 w-auto"
          />
          <span className="text-slate-400" aria-hidden>
            —
          </span>
          <label htmlFor="period-to" className="sr-only">
            Davr oxiri
          </label>
          <Input
            id="period-to"
            type="date"
            value={to}
            min={from || minDate}
            max={today}
            onChange={(event) => setTo(event.target.value)}
            className="h-9 w-auto"
          />
          <Button type="submit" size="sm" disabled={invalid} className="h-9">
            Qo&apos;llash
          </Button>
        </form>
      )}
    </div>
  );
}
