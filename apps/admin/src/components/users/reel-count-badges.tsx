import { CheckCircle2, Clock, XCircle, type LucideIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { formatNumber } from "@/lib/format";
import type { ParticipantReelCounts } from "@/lib/types";
import { cn } from "@/lib/utils";

type CountKey = Exclude<keyof ParticipantReelCounts, "total">;

const COUNTS: Array<{
  key: CountKey;
  tone: "success" | "warning" | "danger";
  icon: LucideIcon;
  /** "3 ta qabul qilingan" — ekran o'quvchi va `title` uchun. */
  label: string;
}> = [
  { key: "accepted", tone: "success", icon: CheckCircle2, label: "qabul qilingan" },
  { key: "pending", tone: "warning", icon: Clock, label: "kutilmoqda" },
  { key: "rejected", tone: "danger", icon: XCircle, label: "rad etilgan" },
];

/** Videolar holati bo'yicha ixcham belgilar (faqat noldan kattalari). */
export function ReelCountBadges({
  counts,
  className,
}: {
  counts: ParticipantReelCounts;
  className?: string;
}) {
  const visible = COUNTS.filter((item) => counts[item.key] > 0);
  if (visible.length === 0) return null;

  return (
    <span className={cn("inline-flex flex-wrap items-center gap-1", className)}>
      {visible.map(({ key, tone, icon: Icon, label }) => {
        const text = `${formatNumber(counts[key])} ta ${label}`;
        return (
          <Badge key={key} tone={tone} className="gap-1 px-2 tabular-nums" title={text}>
            <Icon className="size-3" aria-hidden />
            <span aria-hidden>{formatNumber(counts[key])}</span>
            <span className="sr-only">{text}</span>
          </Badge>
        );
      })}
    </span>
  );
}
