import { ArrowDownRight, ArrowUpRight, type LucideIcon } from "lucide-react";

import { Card } from "@/components/ui/card";
import { IosIcon, type IosTint } from "@/components/ui/ios-icon";
import { formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string;
  icon: LucideIcon;
  /** iOS uslubidagi ikonka rangi. */
  tint?: IosTint;
  /** Qiymat ostidagi izoh (davr ichidagi o'zgarish, tarkib). */
  children?: React.ReactNode;
}

export function StatCard({ label, value, icon, tint = "blue", children }: StatCardProps) {
  return (
    <Card className="flex flex-col p-5">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-[13px] font-medium text-muted">{label}</h3>
        <IosIcon icon={icon} tint={tint} size={36} />
      </div>
      <p className="mt-1 text-[28px] font-semibold tracking-tight text-ink tabular-nums">{value}</p>
      {children && <div className="mt-2 text-xs text-muted">{children}</div>}
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
