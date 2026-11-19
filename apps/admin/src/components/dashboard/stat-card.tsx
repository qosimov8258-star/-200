import { ArrowDownRight, ArrowUpRight, type LucideIcon } from "lucide-react";

import { Card } from "@/components/ui/card";
import { formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string;
  icon: LucideIcon;
  /** `attention` — e'tibor talab qiladigan ko'rsatkich (masalan, target). */
  tone?: "neutral" | "attention";
  /** Qiymat ostidagi izoh (davr ichidagi o'zgarish, tarkib). */
  children?: React.ReactNode;
}

export function StatCard({ label, value, icon: Icon, tone = "neutral", children }: StatCardProps) {
  return (
    <Card className="flex flex-col p-5">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-medium text-slate-500">{label}</h3>
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-lg",
            tone === "attention" ? "bg-amber-50 text-amber-600" : "bg-slate-100 text-slate-500",
          )}
          aria-hidden
        >
          <Icon className="size-4.5" />
        </span>
      </div>
      <p className="mt-1 text-3xl font-semibold tracking-tight text-slate-900">{value}</p>
      {children && <div className="mt-2 text-sm text-slate-500">{children}</div>}
    </Card>
  );
}

interface GrowthDeltaProps {
  current: number;
  previous: number | null;
}

/** Oldingi kunga nisbatan o'zgarish: yo'nalish strelka + matn bilan, faqat rang bilan emas. */
export function GrowthDelta({ current, previous }: GrowthDeltaProps) {
  if (previous === null) {
    return <span>Tanlovning birinchi kuni</span>;
  }
  if (previous === 0) {
    return <span>Oldingi kunda o&apos;sish bo&apos;lmagan</span>;
  }

  const change = (current - previous) / previous;
  const up = change >= 0;
  const Arrow = up ? ArrowUpRight : ArrowDownRight;

  return (
    <span className="inline-flex flex-wrap items-center gap-x-1">
      <span
        className={cn(
          "inline-flex items-center gap-0.5 font-medium",
          up ? "text-green-700" : "text-red-700",
        )}
      >
        <Arrow className="size-4" aria-hidden />
        <span className="sr-only">{up ? "o'sdi:" : "kamaydi:"}</span>
        {formatPercent(Math.abs(change))}
      </span>
      <span>oldingi kunga nisbatan</span>
    </span>
  );
}
