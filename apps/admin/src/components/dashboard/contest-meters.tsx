"use client";

import { useState } from "react";
import { CalendarClock, Clapperboard, ShieldCheck, Timer, Users, type LucideIcon } from "lucide-react";

import { diffDays } from "@/lib/dates";
import { formatNumber } from "@/lib/format";
import type { DashboardStats, IsoDate } from "@/lib/types";
import { cn } from "@/lib/utils";

import { CarouselControls, DashboardSection } from "./section";

const TICKS = 48;

interface Meter {
  key: string;
  title: string;
  icon: LucideIcon;
  iconTone: string;
  /** 0..1 */
  value: number;
  chips: Array<{ icon: LucideIcon; label: string; value: string; tone: string }>;
}

/** CareOps "Departments performance": ko'p mayda tayoqchadan yig'ilgan shkala, tepasida chiplar. */
export function ContestMeters({ stats, today }: { stats: DashboardStats; today: IsoDate }) {
  const [index, setIndex] = useState(0);
  const { startsOn, endsOn } = stats.contest;
  const totalDays = Math.max(1, diffDays(startsOn, endsOn) + 1);
  const until = today < endsOn ? today : endsOn;
  const elapsed = Math.min(totalDays, Math.max(0, diffDays(startsOn, until) + 1));
  const accepted = stats.reels.total > 0 ? stats.reels.accepted / stats.reels.total : 0;
  const clean = stats.reels.accepted > 0 ? 1 - stats.targets.total / stats.reels.accepted : 1;

  const meters: Meter[] = [
    {
      key: "time",
      title: "Tanlov muddati",
      icon: CalendarClock,
      iconTone: "bg-brand-50 text-brand-500",
      value: elapsed / totalDays,
      chips: [
        { icon: Timer, label: "O'tdi", value: `${elapsed} kun`, tone: "text-ink" },
        { icon: CalendarClock, label: "Qoldi", value: `${totalDays - elapsed} kun`, tone: "text-brand-500" },
      ],
    },
    {
      key: "reels",
      title: "Reellar tasdiqlanishi",
      icon: Clapperboard,
      iconTone: "bg-[#e9f6ee] text-up",
      value: accepted,
      chips: [
        { icon: Clapperboard, label: "Qabul", value: formatNumber(stats.reels.accepted), tone: "text-up" },
        { icon: Users, label: "Kutilmoqda", value: formatNumber(stats.reels.pending), tone: "text-brand-500" },
      ],
    },
    {
      key: "clean",
      title: "Toza videolar",
      icon: ShieldCheck,
      iconTone: "bg-[#fdecea] text-down",
      value: Math.max(0, clean),
      chips: [
        { icon: ShieldCheck, label: "Target", value: formatNumber(stats.targets.total), tone: "text-down" },
        { icon: Users, label: "Davr ichida", value: formatNumber(stats.targets.detectedInRange), tone: "text-brand-500" },
      ],
    },
  ];
  const meter = meters[index];
  const Icon = meter.icon;
  const filled = Math.round(meter.value * TICKS);
  const pct = Math.round(meter.value * 100);

  return (
    <DashboardSection
      title="Tanlov ko'rsatkichlari"
      subtitle={`${index + 1} / ${meters.length}`}
      actions={<CarouselControls page={index} pages={meters.length} onPage={setIndex} />}
    >
      <div className="rounded-2xl border border-line p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className={cn("grid size-10 place-items-center rounded-xl", meter.iconTone)}>
              <Icon className="size-5" aria-hidden />
            </span>
            <span className="text-[15px] font-semibold text-ink">{meter.title}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {meter.chips.map((chip) => {
              const ChipIcon = chip.icon;
              return (
                <span
                  key={chip.label}
                  className="inline-flex items-center gap-1.5 rounded-full bg-[#f5f4f8] px-3 py-1.5 text-xs text-ink"
                >
                  <ChipIcon className="size-3.5 text-muted" aria-hidden />
                  {chip.label}
                  <span className={cn("font-semibold tabular-nums", chip.tone)}>{chip.value}</span>
                </span>
              );
            })}
          </div>
        </div>

        <div className="mt-5 flex h-8 items-end justify-between gap-[3px]" role="meter" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={meter.title}>
          {Array.from({ length: TICKS }, (_, i) => (
            <span
              key={i}
              className={cn(
                "h-full w-full max-w-[6px] rounded-full transition-colors duration-500",
                i < filled ? "bg-up-bar" : "bg-[#ecebf1]",
              )}
              style={{ transitionDelay: `${i * 8}ms` }}
            />
          ))}
        </div>
        <div className="relative mt-2 h-5 text-xs text-muted tabular-nums">
          <span className="absolute left-0">0</span>
          {Math.abs(pct - 50) > 9 && <span className="absolute left-1/2 -translate-x-1/2 border-l border-line pl-1.5">50</span>}
          <span
            className="absolute -translate-x-1/2 border-l border-line pl-1.5 font-semibold text-ink"
            style={{ left: `${Math.min(92, Math.max(8, pct))}%` }}
          >
            {pct}%
          </span>
          {pct < 88 && <span className="absolute right-0">100</span>}
        </div>
      </div>
    </DashboardSection>
  );
}
