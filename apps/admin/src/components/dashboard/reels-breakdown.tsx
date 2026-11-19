import Link from "next/link";
import { Maximize2 } from "lucide-react";

import { formatNumber, formatPercent } from "@/lib/format";
import type { DashboardStats } from "@/lib/types";

import { DashboardSection } from "./section";

/** CareOps "Revenue source distribution": rangli chiziq, nom, ulush va son — ikki ustunda. */
export function ReelsBreakdown({ stats, phrase }: { stats: DashboardStats; phrase: string }) {
  const total = Math.max(1, stats.reels.total);
  const rows = [
    { label: "Qabul qilingan", value: stats.reels.accepted, color: "#5cc085", share: true },
    { label: "Tekshirilmoqda", value: stats.reels.pending, color: "#e8b84a", share: true },
    { label: "Rad etilgan", value: stats.reels.rejected, color: "#e0583f", share: true },
    { label: "O'chirilgan", value: stats.reels.removed, color: "#a1a9a5", share: true },
    { label: `Yangi (${phrase})`, value: stats.reels.newInRange, color: "#7c62db", share: false },
    { label: "Target aniqlangan", value: stats.targets.total, color: "#f08a5d", share: false },
  ];

  return (
    <DashboardSection
      title="Reellar holati"
      subtitle={`Jami ${formatNumber(stats.reels.total)} ta yuborilgan video`}
      actions={
        <Link
          href="/users"
          aria-label="Ishtirokchilar ro'yxati"
          title="Ishtirokchilar ro'yxati"
          className="grid size-8 place-items-center rounded-[10px] border border-line bg-white text-muted hover:border-brand-200 hover:text-ink"
        >
          <Maximize2 className="size-4" aria-hidden />
        </Link>
      }
    >
      <ul className="grid gap-2 sm:grid-cols-2">
        {rows.map((row) => (
          <li key={row.label} className="flex items-center gap-3 rounded-xl bg-[#fbfbfd] px-3.5 py-3">
            <span className="h-5 w-1 shrink-0 rounded-full" style={{ background: row.color }} aria-hidden />
            <span className="min-w-0 flex-1 truncate text-sm text-ink">
              {row.label}
              {row.share && (
                <span className="ml-1.5 text-xs text-muted tabular-nums">({formatPercent(row.value / total)})</span>
              )}
            </span>
            <span className="text-sm font-semibold text-ink tabular-nums">{formatNumber(row.value)}</span>
          </li>
        ))}
      </ul>
    </DashboardSection>
  );
}
