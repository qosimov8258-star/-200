"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import type { IsoDate } from "@/lib/types";
import { cn } from "@/lib/utils";

export interface DateRange {
  from: IsoDate | null;
  /** Shu kun ham kiradi; null — hali tanlanmagan. */
  to: IsoDate | null;
}

interface RangeCalendarProps {
  value: DateRange;
  onChange: (next: DateRange) => void;
  /** Shundan oldingi kunlarni tanlab bo'lmaydi. */
  min?: IsoDate;
  /** Shundan keyingi kunlarni tanlab bo'lmaydi. */
  max?: IsoDate;
  /** Bugun — ingichka halqa bilan belgilanadi. */
  today?: IsoDate;
  className?: string;
}

const MONTHS = [
  "Yanvar",
  "Fevral",
  "Mart",
  "Aprel",
  "May",
  "Iyun",
  "Iyul",
  "Avgust",
  "Sentabr",
  "Oktabr",
  "Noyabr",
  "Dekabr",
];
const WEEKDAYS = ["Du", "Se", "Ch", "Pa", "Ju", "Sh", "Ya"];

const iso = (year: number, monthIndex: number, day: number): IsoDate =>
  new Date(Date.UTC(year, monthIndex, day)).toISOString().slice(0, 10);

function parts(value: IsoDate): [number, number, number] {
  const [year, month, day] = value.split("-").map(Number);
  return [year, month - 1, day];
}

/** Oyning birinchi kuni, `shift` oy oldinga/orqaga surilgan. */
function monthStart(value: IsoDate, shift = 0): IsoDate {
  const [year, month] = parts(value);
  return iso(year, month + shift, 1);
}

/** Dushanbadan boshlanadigan to'r: oy boshigacha bo'sh kataklar (null), keyin kunlar. */
function monthGrid(first: IsoDate): (IsoDate | null)[] {
  const [year, month] = parts(first);
  const lead = (new Date(Date.UTC(year, month, 1)).getUTCDay() + 6) % 7;
  const days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return [...Array.from({ length: lead }, () => null), ...Array.from({ length: days }, (_, i) => iso(year, month, i + 1))];
}

const dayLabel = (value: IsoDate) => {
  const [year, month, day] = parts(value);
  return `${day}-${MONTHS[month].toLowerCase()} ${year}`;
};

/**
 * Oraliq tanlash kalendari: birinchi bosish — boshlanish, ikkinchisi — tugash (oldinroq kun bosilsa,
 * joylari almashadi). Tugash tanlanguncha kursor ostidagi kungacha oraliq ko'rsatib turiladi.
 * Kompyuterda ikki oy yonma-yon, telefonda bitta.
 */
export function RangeCalendar({ value, onChange, min, max, today, className }: RangeCalendarProps) {
  const [view, setView] = useState<IsoDate>(() => monthStart(value.from ?? today ?? min ?? iso(2026, 0, 1)));
  const [hover, setHover] = useState<IsoDate | null>(null);

  const anchorEnd = value.to ?? (value.from && hover ? hover : null);
  const lo = value.from && anchorEnd ? (anchorEnd < value.from ? anchorEnd : value.from) : value.from;
  const hi = value.from && anchorEnd ? (anchorEnd < value.from ? value.from : anchorEnd) : value.from;
  const previewing = value.to === null && value.from !== null && hover !== null;

  // Oldingi oyda tanlasa bo'ladigan kun bormi / keyingi oy chegaradan oshmaydimi.
  const canPrev = !min || view > monthStart(min);
  const canNext = !max || monthStart(view, 1) <= max;

  const pick = (day: IsoDate) => {
    if (!value.from || value.to) {
      onChange({ from: day, to: null });
    } else if (day < value.from) {
      onChange({ from: day, to: value.from });
    } else {
      onChange({ from: value.from, to: day });
    }
    setHover(null);
  };

  const months = [view, monthStart(view, 1)];

  return (
    <div className={cn("select-none", className)}>
      <div className="grid gap-6 sm:grid-cols-2">
        {months.map((first, index) => {
          const [year, month] = parts(first);
          return (
            <div key={first} className={cn(index === 1 && "hidden sm:block")}>
              <div className="mb-2 flex h-9 items-center justify-between">
                <NavButton
                  label="Oldingi oy"
                  onClick={() => setView(monthStart(view, -1))}
                  disabled={!canPrev}
                  className={cn(index === 1 && "invisible")}
                >
                  <ChevronLeft className="size-4" aria-hidden />
                </NavButton>
                <span className="text-sm font-semibold text-ink">
                  {MONTHS[month]} {year}
                </span>
                <NavButton
                  label="Keyingi oy"
                  onClick={() => setView(monthStart(view, 1))}
                  disabled={!canNext}
                  className={cn(index === 0 && "sm:invisible")}
                >
                  <ChevronRight className="size-4" aria-hidden />
                </NavButton>
              </div>

              <div className="grid grid-cols-7 text-center text-[11px] font-medium text-muted">
                {WEEKDAYS.map((weekday) => (
                  <span key={weekday} className="py-1">
                    {weekday}
                  </span>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-y-1" onMouseLeave={() => setHover(null)}>
                {monthGrid(first).map((day, cell) => {
                  if (!day) return <span key={`blank-${cell}`} />;
                  const disabled = Boolean((min && day < min) || (max && day > max));
                  const inRange = Boolean(lo && hi && day >= lo && day <= hi);
                  const isStart = day === lo;
                  const isEnd = day === hi;
                  const single = lo === hi;
                  const endpoint = isStart || isEnd;
                  return (
                    <div
                      key={day}
                      className={cn(
                        "flex h-9 items-center justify-center",
                        inRange && !single && !endpoint && (previewing ? "bg-brand-50/70" : "bg-brand-50"),
                        inRange && !single && isStart && "bg-[linear-gradient(to_right,transparent_50%,var(--color-brand-50)_50%)]",
                        inRange && !single && isEnd && "bg-[linear-gradient(to_left,transparent_50%,var(--color-brand-50)_50%)]",
                      )}
                    >
                      <button
                        type="button"
                        disabled={disabled}
                        aria-label={dayLabel(day)}
                        aria-pressed={endpoint && inRange}
                        onClick={() => pick(day)}
                        onMouseEnter={() => setHover(day)}
                        onFocus={() => setHover(day)}
                        className={cn(
                          "grid size-9 place-items-center rounded-full text-sm tabular-nums transition-colors",
                          endpoint && inRange
                            ? "bg-brand-600 font-semibold text-white shadow-[0_4px_10px_-4px_rgba(107,80,207,0.7)]"
                            : disabled
                              ? "cursor-not-allowed text-slate-300"
                              : "text-ink hover:bg-brand-100",
                          day === today && !(endpoint && inRange) && "font-semibold ring-1 ring-brand-300",
                        )}
                      >
                        {parts(day)[2]}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function NavButton({
  label,
  onClick,
  disabled,
  className,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={cn(
        "grid size-8 place-items-center rounded-full text-muted transition-colors hover:bg-brand-50 hover:text-ink disabled:cursor-not-allowed disabled:opacity-30",
        className,
      )}
    >
      {children}
    </button>
  );
}
