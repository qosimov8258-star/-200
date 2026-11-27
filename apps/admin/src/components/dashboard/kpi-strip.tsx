import { formatDate, formatNumber, formatPercent, formatSigned } from "@/lib/format";
import { periodPhrase, type Period } from "@/lib/period";
import type { DashboardStats, IsoDate } from "@/lib/types";

interface KpiStripProps {
  stats: DashboardStats;
  period: Period;
  today: IsoDate;
}

/** Nisbiy o'zgarish matni ("+3,2%"); taqqoslash uchun asos bo'lmasa — null. */
function change(part: number, base: number): string | null {
  if (base <= 0) return null;
  const value = part / base;
  return `${value >= 0 ? "+" : "−"}${(Math.abs(value) * 100).toFixed(1).replace(".", ",")}%`;
}

/**
 * Asosiy 4 ta ko'rsatkich bitta kartada, orasida nozik chiziq. Foizli o'zgarish ko'rinmaydi —
 * qiymat ustiga olib borilganda (va ekran o'quvchida) chiqadi.
 */
export function KpiStrip({ stats, period, today }: KpiStripProps) {
  // Izoh qatori shu so'z bilan boshlanadi: "So'nggi 7 kunda +1 234".
  const periodText = periodPhrase(period);
  const phrase = periodText.charAt(0).toUpperCase() + periodText.slice(1);
  const growth = stats.views.growthInRange;
  const fromStart = stats.range.from === stats.contest.startsOn;
  const viewsChange = fromStart ? null : change(growth, stats.views.total - growth);
  const { lastDay } = stats;
  const dayChange =
    lastDay.previousGrowth === null ? null : change(lastDay.growth - lastDay.previousGrowth, lastDay.previousGrowth);
  const participantsChange = fromStart
    ? null
    : change(stats.participants.newInRange, stats.participants.total - stats.participants.newInRange);

  return (
    <dl className="grid grid-cols-1 gap-px bg-line sm:grid-cols-2 xl:grid-cols-4">
      <Kpi
        label="Jami ko'rishlar"
        value={formatNumber(stats.views.total)}
        unit="ko'rish"
        note={`${phrase} ${formatSigned(growth)}`}
        hint={viewsChange && `davr boshiga nisbatan ${viewsChange}`}
      />
      <Kpi
        label={
          lastDay.date === today ? "Bugun qo'shilgan ko'rishlar" : `${formatDate(lastDay.date)} kuni qo'shilgan ko'rishlar`
        }
        value={formatSigned(lastDay.growth)}
        unit="ko'rish"
        note={
          lastDay.previousGrowth === null
            ? "Tanlovning birinchi kuni"
            : `Oldingi kuni: ${formatNumber(lastDay.previousGrowth)}`
        }
        hint={dayChange && `oldingi kunga nisbatan ${dayChange}`}
      />
      <Kpi
        label="Ishtirokchilar"
        value={formatNumber(stats.participants.total)}
        unit="kishi"
        note={`${phrase} ${formatSigned(stats.participants.newInRange)} yangi`}
        hint={participantsChange && `davr boshiga nisbatan ${participantsChange}`}
      />
      <Kpi
        label="Qabul qilingan videolar"
        value={formatNumber(stats.reels.accepted)}
        unit={`/ jami ${formatNumber(stats.reels.total)}`}
        note={`${formatNumber(stats.reels.pending)} ta tekshiruvda · ${formatNumber(stats.reels.rejected)} ta rad etilgan`}
        hint={
          stats.reels.total > 0 ? `yuborilganlarning ${formatPercent(stats.reels.accepted / stats.reels.total)} qismi` : null
        }
      />
    </dl>
  );
}

function Kpi({
  label,
  value,
  unit,
  note,
  hint,
}: {
  label: string;
  value: string;
  unit: string;
  note: string;
  /** Qo'shimcha izoh (foizli o'zgarish) — sichqoncha ustiga kelganda va ekran o'quvchida. */
  hint: string | null;
}) {
  return (
    <div className="bg-[#fbfbfd] px-5 py-4">
      <dt className="text-[13px] text-muted">{label}</dt>
      <dd className="mt-1.5">
        <p className="flex items-baseline gap-1.5" title={hint ?? undefined}>
          <span className="text-[26px] leading-none font-semibold tracking-tight text-ink tabular-nums">{value}</span>
          <span className="text-sm font-medium text-[#b3b1bb]">{unit}</span>
          {hint && <span className="sr-only">({hint})</span>}
        </p>
        <p className="mt-2 text-xs text-muted tabular-nums">{note}</p>
      </dd>
    </div>
  );
}
