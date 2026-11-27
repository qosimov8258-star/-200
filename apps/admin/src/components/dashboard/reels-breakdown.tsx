import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { formatNumber, formatPercent } from "@/lib/format";
import type { DashboardStats } from "@/lib/types";

import { DashboardSection } from "./section";

/** Videolar holati: rangli chiziq, holat nomi, ulush va son — ikki ustunda. */
export function ReelsBreakdown({ stats, phrase }: { stats: DashboardStats; phrase: string }) {
  const total = Math.max(1, stats.reels.total);
  const rows = [
    { label: "Qabul qilingan", value: stats.reels.accepted, color: "#5cc085" },
    { label: "Tekshiruvda", value: stats.reels.pending, color: "#e8b84a" },
    { label: "Rad etilgan", value: stats.reels.rejected, color: "#e0583f" },
    { label: "O'chirilgan", value: stats.reels.removed, color: "#a1a9a5" },
  ];

  return (
    <DashboardSection
      title="Videolar holati"
      subtitle={`Jami ${formatNumber(stats.reels.total)} ta yuborilgan video · ${phrase} ${formatNumber(stats.reels.newInRange)} ta yangi`}
      actions={
        <Link href="/users" className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:underline">
          Ishtirokchilar ro&apos;yxati
          <ArrowRight className="size-4" aria-hidden />
        </Link>
      }
    >
      <ul className="grid gap-2 sm:grid-cols-2">
        {rows.map((row) => (
          <li key={row.label} className="flex items-center gap-3 rounded-xl bg-[#fbfbfd] px-3.5 py-3">
            <span className="h-5 w-1 shrink-0 rounded-full" style={{ background: row.color }} aria-hidden />
            <span className="min-w-0 flex-1 truncate text-sm text-ink">
              {row.label}
              <span className="ml-1.5 text-xs text-muted tabular-nums">({formatPercent(row.value / total)})</span>
            </span>
            <span className="text-sm font-semibold text-ink tabular-nums">{formatNumber(row.value)}</span>
          </li>
        ))}
      </ul>
    </DashboardSection>
  );
}
