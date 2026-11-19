"use client";

import { useState } from "react";
import { ChartColumn, Table } from "lucide-react";

import { formatCompact, formatDate, formatDayMonth, formatNumber, formatSigned } from "@/lib/format";
import type { DailyStat, IsoDate } from "@/lib/types";
import { cn } from "@/lib/utils";

import { DashboardSection, IconButton } from "./section";

const PLOT_HEIGHT = 220;
const WEEKDAYS = ["Ya", "Du", "Se", "Ch", "Pa", "Ju", "Sh"];
/** Eng yuqori kunga shu ulushdan yaqin kunlar to'qroq rangda ajratiladi. */
const PEAK_SHARE = 0.85;

const weekday = (day: IsoDate) => WEEKDAYS[new Date(`${day}T00:00:00Z`).getUTCDay()];

/** Shkala uchun "chiroyli" yuqori chegara: 1, 2, 2.5, 5 × 10ⁿ. */
function niceMax(value: number): number {
  if (value <= 0) return 1;
  const power = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 2.5, 5, 10].find((s) => s * power >= value) ?? 10;
  return step * power;
}

/** CareOps "Appointments load": kapsula ustunlar, bo'sh qismi chiziqlangan, cho'qqi kunlar to'qroq. */
export function ViewsChart({ daily }: { daily: DailyStat[] }) {
  const [view, setView] = useState<"chart" | "table">("chart");
  return (
    <DashboardSection
      title="Kunlik ko'rishlar o'sishi"
      subtitle="Har kuni yig'ilgan yangi ko'rishlar"
      actions={
        <>
          <IconButton label="Grafik" active={view === "chart"} onClick={() => setView("chart")}>
            <ChartColumn className="size-4" aria-hidden />
          </IconButton>
          <IconButton label="Jadval" active={view === "table"} onClick={() => setView("table")}>
            <Table className="size-4" aria-hidden />
          </IconButton>
        </>
      }
    >
      {view === "table" ? <DailyTable daily={daily} /> : <Columns daily={daily} />}
    </DashboardSection>
  );
}

function Columns({ daily }: { daily: DailyStat[] }) {
  if (daily.length === 0) {
    return <p className="py-16 text-center text-sm text-muted">Bu davrda ma&apos;lumot yo&apos;q</p>;
  }
  const max = Math.max(...daily.map((d) => d.viewsGrowth));
  const top = niceMax(max);
  const ticks = [1, 0.75, 0.5, 0.25, 0];
  const labelEvery = daily.length <= 14 ? 1 : Math.ceil(daily.length / 8);
  const useWeekdays = daily.length <= 7;

  return (
    <div className="flex gap-3">
      {/* Y o'qi */}
      <div className="relative w-14 shrink-0 text-right text-[11px] text-muted tabular-nums" style={{ height: PLOT_HEIGHT }}>
        {ticks.map((t) => (
          <span key={t} className="absolute right-0 -translate-y-1/2 whitespace-nowrap" style={{ top: `${(1 - t) * 100}%` }}>
            {formatCompact(Math.round(top * t))}
          </span>
        ))}
      </div>

      <div className="min-w-0 flex-1">
        <div
          className={cn("flex items-end", daily.length > 20 ? "gap-1" : daily.length > 10 ? "gap-2" : "gap-3")}
          style={{ height: PLOT_HEIGHT }}
          role="img"
          aria-label={`Kunlik o'sish: eng ko'pi ${formatNumber(max)} ko'rish`}
        >
          {daily.map((d) => {
            const share = d.viewsGrowth / top;
            const peak = max > 0 && d.viewsGrowth >= max * PEAK_SHARE;
            return (
              <div key={d.date} className="group relative h-full flex-1">
                <div className="absolute inset-0 overflow-hidden rounded-[14px] bg-[#f7f6fb] bg-hatch">
                  <div
                    className={cn(
                      "absolute inset-x-0 bottom-0 rounded-[14px] transition-[height,background-color] duration-500",
                      peak ? "bg-brand-300 group-hover:bg-brand-400" : "bg-brand-100 group-hover:bg-brand-200",
                    )}
                    style={{ height: `${Math.max(share * 100, d.viewsGrowth > 0 ? 3 : 0)}%` }}
                  />
                </div>
                {/* Ko'rsatkich (sichqoncha ustiga kelganda) */}
                <div className="pointer-events-none absolute -top-2 left-1/2 z-10 hidden -translate-x-1/2 -translate-y-full rounded-xl bg-ink px-2.5 py-1.5 text-center whitespace-nowrap text-white shadow-lg group-hover:block">
                  <p className="text-[11px] text-white/60">{formatDate(d.date)}</p>
                  <p className="text-sm font-semibold tabular-nums">{formatSigned(d.viewsGrowth)}</p>
                </div>
              </div>
            );
          })}
        </div>
        <div className={cn("mt-2 flex", daily.length > 20 ? "gap-1" : daily.length > 10 ? "gap-2" : "gap-3")}>
          {daily.map((d, i) => (
            <span key={d.date} className="flex-1 text-center text-[11px] text-muted">
              {i % labelEvery === 0 || i === daily.length - 1 ? (useWeekdays ? weekday(d.date) : formatDayMonth(d.date)) : ""}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function DailyTable({ daily }: { daily: DailyStat[] }) {
  return (
    <div className="max-h-[260px] overflow-y-auto rounded-xl border border-line">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-[#fbfbfd] text-xs text-muted">
          <tr>
            <th className="px-3 py-2 text-left font-medium">Sana</th>
            <th className="px-3 py-2 text-right font-medium">Yangi ko&apos;rishlar</th>
            <th className="px-3 py-2 text-right font-medium">Yangi ishtirokchilar</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {[...daily].reverse().map((d) => (
            <tr key={d.date}>
              <td className="px-3 py-2 tabular-nums">{formatDate(d.date)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{formatSigned(d.viewsGrowth)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{formatSigned(d.newParticipants)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
