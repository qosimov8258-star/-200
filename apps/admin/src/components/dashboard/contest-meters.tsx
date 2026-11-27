import Link from "next/link";
import { ArrowRight, CalendarClock, Clapperboard, Crosshair, Hourglass } from "lucide-react";

import { diffDays } from "@/lib/dates";
import { formatDate, formatNumber } from "@/lib/format";
import type { DashboardStats, IsoDate } from "@/lib/types";
import { cn } from "@/lib/utils";

import { DashboardSection } from "./section";

const TICKS = 48;

/** Aksiya muddati — bitta qator: nechanchi kun, necha kun qoldi va sanalar (ingichka chiziq bilan). */
export function ContestTimeline({ contest, today }: { contest: DashboardStats["contest"]; today: IsoDate }) {
  const { startsOn, endsOn } = contest;
  const totalDays = Math.max(1, diffDays(startsOn, endsOn) + 1);
  const until = today < endsOn ? today : endsOn;
  const elapsed = Math.min(totalDays, Math.max(0, diffDays(startsOn, until) + 1));
  const left = totalDays - elapsed;
  const status =
    today < startsOn
      ? "hali boshlanmagan"
      : today > endsOn
        ? "tugadi"
        : left === 0
          ? `${elapsed}-kun · bugun oxirgi kun`
          : `${elapsed}-kun · ${left} kun qoldi`;

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-line px-5 py-3.5 sm:px-6">
      <p className="flex items-center gap-2 text-sm text-ink">
        <CalendarClock className="size-4 shrink-0 text-brand-500" aria-hidden />
        <span>
          <span className="font-semibold">Aksiya:</span> <span className="tabular-nums">{status}</span>
          <span aria-hidden> · </span>
          <span className="text-muted tabular-nums">
            {formatDate(startsOn)} – {formatDate(endsOn)}
          </span>
        </span>
      </p>
      <div
        role="progressbar"
        aria-label="Aksiya muddati"
        aria-valuemin={0}
        aria-valuemax={totalDays}
        aria-valuenow={elapsed}
        aria-valuetext={`${totalDays} kundan ${elapsed} kun o'tdi`}
        className="h-1.5 min-w-24 flex-1 overflow-hidden rounded-full bg-[#ecebf1]"
      >
        <div className="h-full rounded-full bg-up-bar" style={{ width: `${(elapsed / totalDays) * 100}%` }} />
      </div>
    </div>
  );
}

/**
 * Batafsil: videolar tasdiqlanishi (mayda tayoqchalardan yig'ilgan shkala) va target (pullik
 * reklama) aniqlangan ishtirokchilar soni.
 */
export function ContestMeters({ stats, phrase }: { stats: DashboardStats; phrase: string }) {
  const share = stats.reels.total > 0 ? stats.reels.accepted / stats.reels.total : 0;
  const filled = Math.round(share * TICKS);
  const pct = Math.round(share * 100);
  const chips = [
    { icon: Clapperboard, label: "Qabul qilingan", value: formatNumber(stats.reels.accepted), tone: "text-up" },
    { icon: Hourglass, label: "Tekshiruvda", value: formatNumber(stats.reels.pending), tone: "text-brand-500" },
  ];

  return (
    <DashboardSection title="Tanlov ko'rsatkichlari">
      <div className="space-y-3">
        <div className="rounded-2xl border border-line p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-xl bg-[#e9f6ee] text-up">
                <Clapperboard className="size-5" aria-hidden />
              </span>
              <span className="text-[15px] font-semibold text-ink">Videolar tasdiqlanishi</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {chips.map((chip) => {
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

          <div
            className="mt-5 flex h-8 items-end justify-between gap-[3px]"
            role="meter"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuetext={`Yuborilgan videolarning ${pct}% qismi qabul qilingan`}
            aria-label="Videolar tasdiqlanishi"
          >
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
          <div className="relative mt-2 h-5 text-xs text-muted tabular-nums" aria-hidden>
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

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line p-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#fdecea] text-down">
              <Crosshair className="size-5" aria-hidden />
            </span>
            <p className="min-w-0 text-sm text-ink">
              Target (pullik reklama) aniqlangan:{" "}
              <strong className="font-semibold tabular-nums">{formatNumber(stats.targets.total)} ta</strong> ishtirokchi
              <span className="block text-xs text-muted tabular-nums">
                {phrase.charAt(0).toUpperCase() + phrase.slice(1)}: {formatNumber(stats.targets.detectedInRange)} ta
                yangi
              </span>
            </p>
          </div>
          <Link
            href="/targets"
            className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:underline"
          >
            Ro&apos;yxatni ochish
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
      </div>
    </DashboardSection>
  );
}
