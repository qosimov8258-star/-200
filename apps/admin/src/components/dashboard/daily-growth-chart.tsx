"use client";

import { useRef, useState } from "react";
import { ChartColumn, Table } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  formatCompact,
  formatDate,
  formatDayMonth,
  formatNumber,
  formatSigned,
} from "@/lib/format";
import type { DailyStat } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Grafik maydonining balandligi (x o'qi yorliqlari bundan tashqarida). */
const PLOT_HEIGHT = 208;
/** X o'qida ko'pi bilan nechta sana yozuvi. */
const MAX_X_LABELS = 8;

type ChartView = "chart" | "table";

export function DailyGrowthChart({ daily }: { daily: DailyStat[] }) {
  const [view, setView] = useState<ChartView>("chart");

  return (
    <Card>
      <CardHeader className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle>Kunlik ko&apos;rishlar o&apos;sishi</CardTitle>
          <p className="mt-0.5 text-sm text-slate-500">Har kuni yig&apos;ilgan yangi ko&apos;rishlar soni</p>
        </div>
        <ViewToggle value={view} onChange={setView} />
      </CardHeader>

      <CardContent>
        {view === "table" ? (
          <DailyTable daily={daily} />
        ) : daily.length < 2 ? (
          <p className="py-10 text-center text-sm text-slate-500">
            Grafik kamida ikki kunlik davr uchun chiziladi. Bir kunlik o&apos;sish yuqoridagi kartada
            ko&apos;rsatilgan.
          </p>
        ) : (
          <ColumnPlot daily={daily} />
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Ko'rinishni almashtirish (grafik / jadval)
// ---------------------------------------------------------------------------

function ViewToggle({ value, onChange }: { value: ChartView; onChange: (view: ChartView) => void }) {
  const options: Array<{ value: ChartView; label: string; icon: typeof ChartColumn }> = [
    { value: "chart", label: "Grafik", icon: ChartColumn },
    { value: "table", label: "Jadval", icon: Table },
  ];

  return (
    <div role="group" aria-label="Ko'rinish" className="flex rounded-md border border-slate-300 p-0.5">
      {options.map((option) => {
        const active = option.value === value;
        const Icon = option.icon;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors",
              active ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100",
            )}
          >
            <Icon className="size-3.5" aria-hidden />
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Ustunli grafik
// ---------------------------------------------------------------------------

/** 1, 2, 2.5, 5, 10 × 10^n ko'rinishidagi "yumaloq" qadam. */
function niceStep(raw: number): number {
  const base = 10 ** Math.floor(Math.log10(raw));
  const fraction = raw / base;
  const nice = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 2.5 ? 2.5 : fraction <= 5 ? 5 : 10;
  return nice * base;
}

/** Y o'qi shkalasi: 0 dan boshlanadi, tepada eng katta qiymat yorlig'i uchun joy qoladi. */
function buildScale(max: number): { top: number; ticks: number[] } {
  if (max <= 0) {
    return { top: 1, ticks: [0] };
  }
  const padded = max * 1.15;
  const step = Math.max(1, niceStep(padded / 4));
  const top = Math.ceil(padded / step) * step;
  const ticks: number[] = [];
  for (let value = 0; value <= top + step / 2; value += step) {
    ticks.push(value);
  }
  return { top, ticks };
}

function ColumnPlot({ daily }: { daily: DailyStat[] }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [focusIndex, setFocusIndex] = useState(daily.length - 1);
  const buttonsRef = useRef<Array<HTMLButtonElement | null>>([]);

  const max = Math.max(...daily.map((day) => day.viewsGrowth));
  const { top, ticks } = buildScale(max);
  const peakIndex = max > 0 ? daily.findIndex((day) => day.viewsGrowth === max) : -1;
  const labelEvery = Math.ceil(daily.length / MAX_X_LABELS);
  const formatTick = top >= 10_000 ? formatCompact : formatNumber;
  const rovingIndex = Math.min(focusIndex, daily.length - 1);
  const toPercent = (value: number) => `${(value / top) * 100}%`;

  function moveFocus(index: number) {
    const next = Math.max(0, Math.min(daily.length - 1, index));
    setFocusIndex(next);
    buttonsRef.current[next]?.focus();
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    const targets: Record<string, number> = {
      ArrowRight: index + 1,
      ArrowLeft: index - 1,
      Home: 0,
      End: daily.length - 1,
    };
    const target = targets[event.key];
    if (target !== undefined) {
      event.preventDefault();
      moveFocus(target);
    }
  }

  return (
    <div className="flex gap-2">
      {/* Y o'qi yorliqlari */}
      <div className="relative w-14 shrink-0" style={{ height: PLOT_HEIGHT }} aria-hidden>
        {ticks.map((tick) => (
          <span
            key={tick}
            className="absolute right-0 translate-y-1/2 text-xs text-slate-400 tabular-nums"
            style={{ bottom: toPercent(tick) }}
          >
            {formatTick(tick)}
          </span>
        ))}
      </div>

      <div className="min-w-0 flex-1">
        <div className="relative" style={{ height: PLOT_HEIGHT }}>
          {/* To'r chiziqlari: ingichka, yaxlit, fon rangidan bir pog'ona to'q */}
          {ticks.map((tick) => (
            <div
              key={tick}
              aria-hidden
              className={cn(
                "absolute inset-x-0 border-t",
                tick === 0 ? "border-slate-300" : "border-slate-100",
              )}
              style={{ bottom: toPercent(tick) }}
            />
          ))}

          <ul
            className="absolute inset-0 flex items-end"
            aria-label="Kunlik ko'rishlar o'sishi, kunlar bo'yicha. Strelka tugmalari bilan kunlar orasida yuring."
          >
            {daily.map((day, index) => {
              const active = activeIndex === index;
              const barHeight = toPercent(day.viewsGrowth);

              return (
                <li
                  key={day.date}
                  className="relative flex h-full min-w-0 flex-1 items-end justify-center px-px"
                >
                  <div
                    aria-hidden
                    className={cn(
                      "w-full max-w-6 rounded-t-[4px] transition-colors",
                      active ? "bg-brand-500" : "bg-brand-600",
                    )}
                    style={{ height: barHeight }}
                  />

                  {/* Faqat eng yuqori kun yoziladi — qolganlari o'q, tooltip va jadvalda. */}
                  {index === peakIndex && !active && (
                    <span
                      aria-hidden
                      className="pointer-events-none absolute left-1/2 mb-1 -translate-x-1/2 text-xs font-medium whitespace-nowrap text-slate-600 tabular-nums"
                      style={{ bottom: barHeight }}
                    >
                      {formatCompact(day.viewsGrowth)}
                    </span>
                  )}

                  {/* Bosish maydoni — ustundan katta: butun kun kengligi va balandligi */}
                  <button
                    ref={(element) => {
                      buttonsRef.current[index] = element;
                    }}
                    type="button"
                    tabIndex={index === rovingIndex ? 0 : -1}
                    aria-label={`${formatDate(day.date)}: ${formatSigned(day.viewsGrowth)} ko'rish, ${formatNumber(day.newParticipants)} yangi ishtirokchi`}
                    className="absolute inset-0 cursor-default rounded-sm focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-brand-500"
                    onMouseEnter={() => setActiveIndex(index)}
                    onMouseLeave={() => setActiveIndex(null)}
                    onFocus={() => {
                      setActiveIndex(index);
                      setFocusIndex(index);
                    }}
                    onBlur={() => setActiveIndex(null)}
                    onKeyDown={(event) => handleKeyDown(event, index)}
                  />

                  {active && (
                    <ChartTooltip day={day} index={index} count={daily.length} bottom={barHeight} />
                  )}
                </li>
              );
            })}
          </ul>
        </div>

        {/* X o'qi: oxirgi kundan boshlab teng oraliqda */}
        <div className="mt-2 flex h-4" aria-hidden>
          {daily.map((day, index) => {
            const show = (daily.length - 1 - index) % labelEvery === 0;
            return (
              <span key={day.date} className="relative min-w-0 flex-1">
                {show && (
                  <span className="absolute left-1/2 -translate-x-1/2 text-xs whitespace-nowrap text-slate-400 tabular-nums">
                    {formatDayMonth(day.date)}
                  </span>
                )}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}

interface ChartTooltipProps {
  day: DailyStat;
  index: number;
  count: number;
  /** Ustun balandligi (CSS foiz) — tooltip uning ustida turadi. */
  bottom: string;
}

function ChartTooltip({ day, index, count, bottom }: ChartTooltipProps) {
  // Chetdagi ustunlarda tooltip karta tashqarisiga chiqib ketmasligi uchun.
  const alignment =
    index < count * 0.2 ? "left-0" : index > count * 0.8 ? "right-0" : "left-1/2 -translate-x-1/2";

  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute z-10 mb-2 rounded-md bg-slate-900 px-2.5 py-1.5 text-xs whitespace-nowrap text-white shadow-lg",
        alignment,
      )}
      style={{ bottom }}
    >
      <p>
        <span className="text-sm font-semibold">{formatSigned(day.viewsGrowth)}</span>{" "}
        <span className="text-slate-300">ko&apos;rish</span>
      </p>
      <p className="text-slate-300">
        {formatDate(day.date)} · {formatNumber(day.newParticipants)} yangi ishtirokchi
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Jadval ko'rinishi (grafikning to'liq matnli muqobili)
// ---------------------------------------------------------------------------

function DailyTable({ daily }: { daily: DailyStat[] }) {
  const rows = [...daily].reverse();
  const totalViews = daily.reduce((sum, day) => sum + day.viewsGrowth, 0);
  const totalParticipants = daily.reduce((sum, day) => sum + day.newParticipants, 0);

  return (
    <div className="relative max-h-80 overflow-y-auto rounded-md border border-slate-200">
      <table className="w-full text-sm">
        <caption className="sr-only">Kunlik ko&apos;rishlar o&apos;sishi va yangi ishtirokchilar</caption>
        <thead className="sticky top-0 bg-slate-50 text-xs text-slate-500">
          <tr>
            <th scope="col" className="px-3 py-2 text-left font-medium">
              Sana
            </th>
            <th scope="col" className="px-3 py-2 text-right font-medium">
              Yangi ko&apos;rishlar
            </th>
            <th scope="col" className="px-3 py-2 text-right font-medium">
              Yangi ishtirokchilar
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((day) => (
            <tr key={day.date}>
              <td className="px-3 py-2 text-slate-700 tabular-nums">{formatDate(day.date)}</td>
              <td className="px-3 py-2 text-right text-slate-900 tabular-nums">
                {formatSigned(day.viewsGrowth)}
              </td>
              <td className="px-3 py-2 text-right text-slate-900 tabular-nums">
                {formatNumber(day.newParticipants)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot className="sticky bottom-0 border-t border-slate-200 bg-white font-medium">
          <tr>
            <th scope="row" className="px-3 py-2 text-left">
              Jami
            </th>
            <td className="px-3 py-2 text-right tabular-nums">{formatSigned(totalViews)}</td>
            <td className="px-3 py-2 text-right tabular-nums">{formatNumber(totalParticipants)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
