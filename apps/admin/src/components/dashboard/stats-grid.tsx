import { Clapperboard, Crosshair, Eye, LifeBuoy, TrendingUp, Users } from "lucide-react";

import { formatDate, formatNumber, formatSigned } from "@/lib/format";
import { periodPhrase, type Period } from "@/lib/period";
import type { DashboardStats, IsoDate } from "@/lib/types";

import { GrowthDelta, StatCard } from "./stat-card";

interface StatsGridProps {
  stats: DashboardStats;
  period: Period;
  today: IsoDate;
}

/** TZ 6-bo'lim: Dashboard ko'rsatkichlari. */
export function StatsGrid({ stats, period, today }: StatsGridProps) {
  const phrase = periodPhrase(period);
  const lastDayLabel =
    stats.lastDay.date === today
      ? "Bugungi o'sish"
      : `Kunlik o'sish (${formatDate(stats.lastDay.date)})`;

  // Davr tanlov boshidan boshlansa, "davr ichidagi o'zgarish" jami bilan teng —
  // takrorlash o'rniga kunlik o'rtacha ko'rsatiladi.
  const fromContestStart = stats.range.from === stats.contest.startsOn;
  const dayCount = Math.max(1, stats.daily.length);
  const perDay = (value: number) => `Kuniga o'rtacha ${formatSigned(Math.round(value / dayCount))}`;

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <StatCard label="Jami ko'rishlar" value={formatNumber(stats.views.total)} icon={Eye}>
        {fromContestStart
          ? perDay(stats.views.growthInRange)
          : `${formatSigned(stats.views.growthInRange)} ${phrase}`}
      </StatCard>

      <StatCard label={lastDayLabel} value={formatSigned(stats.lastDay.growth)} icon={TrendingUp}>
        <GrowthDelta current={stats.lastDay.growth} previous={stats.lastDay.previousGrowth} />
      </StatCard>

      <StatCard label="Ishtirokchilar" value={formatNumber(stats.participants.total)} icon={Users}>
        {fromContestStart
          ? perDay(stats.participants.newInRange)
          : `${formatSigned(stats.participants.newInRange)} ${phrase}`}
      </StatCard>

      <StatCard label="Yuborilgan Reellar" value={formatNumber(stats.reels.total)} icon={Clapperboard}>
        <span>Qabul qilingan {formatNumber(stats.reels.accepted)}</span>
        <span aria-hidden> · </span>
        <span>kutilmoqda {formatNumber(stats.reels.pending)}</span>
        <span aria-hidden> · </span>
        <span>rad etilgan {formatNumber(stats.reels.rejected)}</span>
        {stats.reels.removed > 0 && (
          <>
            <span aria-hidden> · </span>
            <span>o&apos;chirilgan {formatNumber(stats.reels.removed)}</span>
          </>
        )}
      </StatCard>

      <StatCard
        label="Ochiq support murojaatlari"
        value={formatNumber(stats.support.open)}
        icon={LifeBuoy}
      >
        <span>Yangi {formatNumber(stats.support.new)}</span>
        <span aria-hidden> · </span>
        <span>ko&apos;rilmoqda {formatNumber(stats.support.inProgress)}</span>
      </StatCard>

      <StatCard
        label="Target yoqqanlar"
        value={formatNumber(stats.targets.total)}
        icon={Crosshair}
        tone={stats.targets.total > 0 ? "attention" : "neutral"}
      >
        {fromContestStart
          ? "Tanlov boshidan beri aniqlanganlar"
          : `${formatSigned(stats.targets.detectedInRange)} ${phrase} aniqlangan`}
      </StatCard>
    </div>
  );
}
