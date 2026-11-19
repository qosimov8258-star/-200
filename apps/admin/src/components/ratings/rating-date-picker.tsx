"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addDays, isIsoDate } from "@/lib/dates";
import type { IsoDate } from "@/lib/types";

interface RatingDatePickerProps {
  date: IsoDate;
  today: IsoDate;
  /** Tanlash mumkin bo'lgan oraliq; hali ma'lum bo'lmasa — tugmalar o'chiq. */
  min?: IsoDate;
  max?: IsoDate;
  onChange: (date: IsoDate) => void;
}

export function RatingDatePicker({ date, today, min, max, onChange }: RatingDatePickerProps) {
  const canGoBack = min !== undefined && date > min;
  const canGoForward = max !== undefined && date < max;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        variant="secondary"
        size="sm"
        className="h-9"
        onClick={() => onChange(addDays(date, -1))}
        disabled={!canGoBack}
        aria-label="Oldingi kun"
      >
        <ChevronLeft className="size-4" aria-hidden />
      </Button>

      <label htmlFor="rating-date" className="sr-only">
        Reyting kuni
      </label>
      <Input
        id="rating-date"
        type="date"
        value={date}
        min={min}
        max={max}
        onChange={(event) => {
          if (isIsoDate(event.target.value)) onChange(event.target.value);
        }}
        className="h-9 w-auto"
      />

      <Button
        variant="secondary"
        size="sm"
        className="h-9"
        onClick={() => onChange(addDays(date, 1))}
        disabled={!canGoForward}
        aria-label="Keyingi kun"
      >
        <ChevronRight className="size-4" aria-hidden />
      </Button>

      {date !== today && (
        <Button variant="ghost" size="sm" className="h-9" onClick={() => onChange(today)}>
          Bugungi reyting
        </Button>
      )}
    </div>
  );
}
