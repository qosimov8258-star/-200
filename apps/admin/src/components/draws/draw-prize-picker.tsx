"use client";

import { Ticket, type LucideIcon } from "lucide-react";

import { prizeQuantityLabel, RATING_PRIZE_ICONS } from "@/components/prizes/rating-prize-table";
import { Badge } from "@/components/ui/badge";
import { formatNumber, formatViewsRange } from "@/lib/format";
import { RATING_PRIZE_LABELS, VOUCHER_PRIZE_LABEL } from "@/lib/labels";
import type { DrawSetup, RatingPrizeKind, RatingPrizeTier } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Tanlangan sovg'a: `voucher` — random tanlov, qolganlari — reyting bo'yicha. */
export type DrawPrizeChoice = "voucher" | RatingPrizeKind;

interface DrawPrizePickerProps {
  /** Oylik voucher (random) — `GET /admin/draws/setup` dan. */
  voucher: DrawSetup["prizes"][number] | undefined;
  /** Asosiy sovrinlar (reyting bo'yicha); yuklanmagan bo'lsa — undefined. */
  tiers: RatingPrizeTier[] | undefined;
  tiersError: string | null;
  value: DrawPrizeChoice;
  onChange: (next: DrawPrizeChoice) => void;
}

/** Sahifa tepasidagi sovg'a tanlash kartalari ("Random" / "Reyting bo'yicha" belgilari bilan). */
export function DrawPrizePicker({ voucher, tiers, tiersError, value, onChange }: DrawPrizePickerProps) {
  return (
    <div className="space-y-3">
      <div role="tablist" aria-label="Sovg'a" className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <PrizeCard
          className="col-span-2 lg:col-span-1"
          active={value === "voucher"}
          onSelect={() => onChange("voucher")}
          icon={Ticket}
          badge={<Badge tone="brand">Random</Badge>}
          title={VOUCHER_PRIZE_LABEL}
          quantity={voucher ? `oyiga ${formatNumber(voucher.quantity)} ta` : "…"}
          range={voucher ? formatViewsRange(voucher.minViews ?? 0, voucher.maxViews) : "…"}
        />
        {tiers
          ? tiers.map((tier) => (
              <PrizeCard
                key={tier.kind}
                active={value === tier.kind}
                onSelect={() => onChange(tier.kind)}
                icon={RATING_PRIZE_ICONS[tier.kind]}
                badge={<Badge>Reyting bo&apos;yicha</Badge>}
                title={RATING_PRIZE_LABELS[tier.kind]}
                quantity={prizeQuantityLabel(tier)}
                range={formatViewsRange(tier.minViews, tier.maxViews)}
              />
            ))
          : !tiersError &&
            Array.from({ length: 4 }, (_, i) => (
              <div key={i} aria-hidden className="h-[124px] animate-pulse rounded-2xl border border-line bg-white" />
            ))}
      </div>
      {tiersError && (
        <p role="alert" className="text-sm text-red-700">
          Asosiy sovrinlarni yuklab bo&apos;lmadi: {tiersError}
        </p>
      )}
    </div>
  );
}

function PrizeCard({
  active,
  onSelect,
  icon: Icon,
  badge,
  title,
  quantity,
  range,
  className,
}: {
  active: boolean;
  onSelect: () => void;
  icon: LucideIcon;
  badge: React.ReactNode;
  title: string;
  quantity: string;
  range: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onSelect}
      className={cn(
        "flex min-w-0 flex-col items-start gap-2 rounded-2xl border bg-white p-3.5 text-left transition",
        active
          ? "border-brand-500 ring-2 ring-brand-500/20"
          : "border-line hover:border-brand-200 hover:bg-brand-50/30",
        className,
      )}
    >
      <span className="flex w-full flex-wrap items-center justify-between gap-2">
        <span
          className={cn(
            "grid size-8 shrink-0 place-items-center rounded-xl",
            active ? "bg-brand-500 text-white" : "bg-brand-50 text-brand-600",
          )}
        >
          <Icon className="size-4" aria-hidden />
        </span>
        {badge}
      </span>
      <span className="text-sm leading-snug font-semibold text-ink">{title}</span>
      <span className="text-xs leading-relaxed text-muted tabular-nums">
        <span className="block">{quantity}</span>
        <span className="block">{range} ko&apos;rish</span>
      </span>
    </button>
  );
}
