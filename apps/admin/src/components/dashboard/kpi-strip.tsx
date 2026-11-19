import { TrendingDown, TrendingUp } from "lucide-react";

import { formatDate, formatNumber, formatSigned } from "@/lib/format";
import { periodPhrase, type Period } from "@/lib/period";
import type { DashboardStats, IsoDate } from "@/lib/types";
import { cn } from "@/lib/utils";

interface KpiStripProps {
  stats: DashboardStats;
  period: Period;
  today: IsoDate;
}

/** O'sish foizi; taqqoslash uchun asos bo'lmasa — null. */
function ratio(part: number, base: number): number | null {
  return base > 0 ? part / base : null;
}

/** CareOps "Revenue / Expenses / …" qatori: bitta kartada 5 ta ko'rsatkich, orasida nozik chiziq. */
export function KpiStrip({ stats, period, today }: KpiStripProps) {
  const phrase = periodPhrase(period);
  const growth = stats.views.growthInRange;
  const prevTotal = stats.views.total - growth;
  const fromStart = stats.range.from === stats.contest.startsOn;
  const lastDayLabel =
    stats.lastDay.date === today ? "Bugungi o'sish" : `${formatDate(stats.lastDay.date)} o'sishi`;
  const accepted = ratio(stats.reels.accepted, stats.reels.total);

  return (
    <dl className="grid grid-cols-1 gap-px bg-line sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      <Kpi
        label="Jami ko'rishlar"
        value={formatNumber(stats.views.total)}
        unit="ko'rish"
        note={`${formatSigned(growth)} ${phrase}`}
        trend={fromStart ? null : ratio(growth, prevTotal)}
      />
      <Kpi
        label={lastDayLabel}
        value={formatSigned(stats.lastDay.growth)}
        unit="ko'rish"
        note={
          stats.lastDay.previousGrowth === null
            ? "Tanlovning birinchi kuni"
            : `${formatNumber(stats.lastDay.previousGrowth)} oldingi kun`
        }
        trend={
          stats.lastDay.previousGrowth === null
            ? null
            : ratio(stats.lastDay.growth - stats.lastDay.previousGrowth, stats.lastDay.previousGrowth)
        }
      />
      <Kpi
        label="Ishtirokchilar"
        value={formatNumber(stats.participants.total)}
        unit="kishi"
        note={`${formatSigned(stats.participants.newInRange)} ${phrase}`}
        trend={
          fromStart ? null : ratio(stats.participants.newInRange, stats.participants.total - stats.participants.newInRange)
        }
      />
      <Kpi
        label="Qabul qilingan Reellar"
        value={formatNumber(stats.reels.accepted)}
        unit={`/ ${formatNumber(stats.reels.total)}`}
        note={`${formatNumber(stats.reels.pending)} kutilmoqda · ${formatNumber(stats.reels.rejected)} rad etilgan`}
        badge={accepted === null ? null : `${Math.round(accepted * 100)}%`}
      />
      <Kpi
        label="Ochiq murojaatlar"
        value={formatNumber(stats.support.open)}
        unit="ta"
        note={`${formatNumber(stats.support.new)} yangi · ${formatNumber(stats.support.inProgress)} ko'rilmoqda`}
        attention={stats.support.new > 0}
      />
    </dl>
  );
}

function Kpi({
  label,
  value,
  unit,
  note,
  trend = null,
  badge = null,
  attention = false,
}: {
  label: string;
  value: string;
  unit: string;
  note: string;
  /** Nisbiy o'zgarish (0.032 = +3,2%). */
  trend?: number | null;
  badge?: string | null;
  attention?: boolean;
}) {
  const up = trend !== null && trend >= 0;
  const TrendIcon = up ? TrendingUp : TrendingDown;
  return (
    <div className="bg-[#fbfbfd] px-5 py-4">
      <dt className="flex items-center gap-2 text-[13px] text-muted">
        {label}
        {attention && <span className="size-1.5 rounded-full bg-down" aria-label="yangi murojaatlar bor" />}
      </dt>
      <dd className="mt-1.5">
        <p className="flex items-baseline gap-1.5">
          <span className="text-[26px] leading-none font-semibold tracking-tight text-ink tabular-nums">{value}</span>
          <span className="text-sm font-medium text-[#b3b1bb]">{unit}</span>
        </p>
        <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
          <span className="tabular-nums">{note}</span>
          {trend !== null && (
            <span className={cn("inline-flex items-center gap-0.5 font-medium tabular-nums", up ? "text-up" : "text-down")}>
              <TrendIcon className="size-3.5" aria-hidden />
              {up ? "+" : "−"}
              {(Math.abs(trend) * 100).toFixed(1).replace(".", ",")}%
            </span>
          )}
          {badge && (
            <span className="rounded-full bg-brand-100 px-1.5 py-px font-medium text-brand-600 tabular-nums">{badge}</span>
          )}
        </p>
      </dd>
    </div>
  );
}
