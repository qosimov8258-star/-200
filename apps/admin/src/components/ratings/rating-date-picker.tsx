"use client";

import { CalendarClock, ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addDays, isIsoDate } from "@/lib/dates";
import { formatDate } from "@/lib/format";
import type { IsoDate } from "@/lib/types";

interface RatingDatePickerProps {
  date: IsoDate;
  today: IsoDate;
  /** Tanlash mumkin bo'lgan oraliq; hali ma'lum bo'lmasa — tugmalar o'chiq. */
  min?: IsoDate;
  max?: IsoDate;
  onChange: (date: IsoDate) => void;
}

/**
 * Reyting kuni: oldingi / keyingi kun yoki sana tanlash. Bugungi kun ko'rsatilmayotgan bo'lsa —
 * buni aniq aytadi va bugunga qaytish tugmasi chiqadi.
 */
export function RatingDatePicker({ date, today, min, max, onChange }: RatingDatePickerProps) {
  const canGoBack = min !== undefined && date > min;
  const canGoForward = max !== undefined && date < max;
  const pastDay = date !== today;
  // Tanlov hali boshlanmagan yoki tugagan bo'lsa bugungi kun reytingda yo'q — qaytish tugmasi kerak emas.
  const todayAvailable = (min === undefined || today >= min) && (max === undefined || today <= max);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label htmlFor="rating-date" className="text-sm font-medium text-ink">
        Kun:
      </label>

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

      {pastDay && (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800 ring-1 ring-amber-200">
          <CalendarClock className="size-3.5" aria-hidden />
          {formatDate(date)} kungi holat ko&apos;rsatilmoqda
        </span>
      )}

      {pastDay && todayAvailable && (
        <Button variant="secondary" size="sm" className="h-9" onClick={() => onChange(today)}>
          Bugunga qaytish
        </Button>
      )}
    </div>
  );
}
