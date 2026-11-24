import { Car, ExternalLink, Plane, Smartphone, Tablet, type LucideIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { formatNumber, formatViewsRange } from "@/lib/format";
import { RATING_PRIZE_LABELS } from "@/lib/labels";
import type { RatingPrizeEntry, RatingPrizeKind, RatingPrizeTier } from "@/lib/types";
import { cn } from "@/lib/utils";

export const RATING_PRIZE_ICONS: Record<RatingPrizeKind, LucideIcon> = {
  car: Car,
  travel: Plane,
  phone: Smartphone,
  tablet: Tablet,
};

/** "1 ta", "3 ta yo'llanma". */
export function prizeQuantityLabel(tier: Pick<RatingPrizeTier, "quantity" | "unit">): string {
  return `${formatNumber(tier.quantity)} ta${tier.unit ? ` ${tier.unit}` : ""}`;
}

/** Sovrin qoidasi bir gapda: random emas, ko'rishlar oralig'i va nechtasi oladi. */
export function RatingPrizeRule({ tier, className }: { tier: RatingPrizeTier; className?: string }) {
  return (
    <p className={cn("text-sm text-slate-600", className)}>
      <b className="font-semibold text-ink">Random emas.</b> Eng ko&apos;p ko&apos;rilgan videosi{" "}
      <span className="font-medium whitespace-nowrap text-ink tabular-nums">
        {formatViewsRange(tier.minViews, tier.maxViews)}
      </span>{" "}
      ko&apos;rish oralig&apos;ida bo&apos;lganlar reyting tartibida saralanadi — birinchi{" "}
      <span className="font-medium text-ink tabular-nums">{formatNumber(tier.quantity)}</span> tasi oladi. Bir
      kishiga bitta asosiy sovrin.
    </p>
  );
}

/** Sovrin nomi, soni va ko'rishlar oralig'i (kartaning sarlavhasi). */
export function RatingPrizeHeading({ tier }: { tier: RatingPrizeTier }) {
  const Icon = RATING_PRIZE_ICONS[tier.kind];
  return (
    <div className="flex min-w-0 items-start gap-3">
      <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand-600">
        <Icon className="size-5" aria-hidden />
      </span>
      <div className="min-w-0">
        <h2 className="flex flex-wrap items-center gap-2 text-base font-semibold tracking-tight text-ink">
          {RATING_PRIZE_LABELS[tier.kind]}
          <Badge>Reyting bo&apos;yicha</Badge>
        </h2>
        <p className="mt-0.5 text-sm text-muted tabular-nums">
          {prizeQuantityLabel(tier)} · {formatViewsRange(tier.minViews, tier.maxViews)} ko&apos;rish · oraliqda{" "}
          {formatNumber(tier.eligibleCount)} ishtirokchi
        </p>
      </div>
    </div>
  );
}

/** G'oliblar (birinchi `quantity` ta) va navbatdagilar jadvali. */
export function RatingPrizeTable({ tier }: { tier: RatingPrizeTier }) {
  if (tier.winners.length === 0) {
    return (
      <p className="rounded-xl bg-[#f7f6fb] px-4 py-6 text-center text-sm text-muted">
        Hozircha eng ko&apos;p ko&apos;rilgan videosi {formatViewsRange(tier.minViews, tier.maxViews)} oralig&apos;ida
        bo&apos;lgan ishtirokchi yo&apos;q.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-line">
      <table className="w-full min-w-[760px] text-sm">
        <thead className="border-b border-line bg-slate-50 text-xs text-slate-500">
          <tr>
            <th className="w-24 px-4 py-2.5 text-left font-medium">O&apos;rin</th>
            <th className="px-4 py-2.5 text-left font-medium">Ishtirokchi</th>
            <th className="px-4 py-2.5 text-left font-medium">Telefon</th>
            <th className="px-4 py-2.5 text-left font-medium">Instagram</th>
            <th className="px-4 py-2.5 text-right font-medium">Ko&apos;rishlar</th>
            <th className="px-4 py-2.5 text-left font-medium">Reel</th>
            <th className="px-4 py-2.5 text-left font-medium">Belgilar</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {tier.winners.map((entry) => (
            <EntryRow key={entry.participant.id} entry={entry} />
          ))}
        </tbody>
        {tier.next.length > 0 && (
          <tbody className="divide-y divide-slate-100 border-t border-line">
            <tr>
              <th colSpan={7} scope="colgroup" className="bg-slate-50/70 px-4 py-2 text-left text-xs font-medium text-slate-500">
                Navbatdagilar — g&apos;olib chetlatilsa, o&apos;rnini shular oladi
              </th>
            </tr>
            {tier.next.map((entry) => (
              <EntryRow key={entry.participant.id} entry={entry} muted />
            ))}
          </tbody>
        )}
      </table>
    </div>
  );
}

function EntryRow({ entry, muted = false }: { entry: RatingPrizeEntry; muted?: boolean }) {
  const { participant } = entry;
  return (
    <tr className={cn("hover:bg-slate-50/60", muted && "text-slate-500")}>
      <td className="px-4 py-2.5">
        <p className={cn("font-semibold tabular-nums", muted ? "text-slate-500" : "text-ink")}>{entry.place}</p>
        <p className="text-[11px] whitespace-nowrap text-slate-400 tabular-nums">reytingda {entry.rank}</p>
      </td>
      <td className={cn("px-4 py-2.5 font-medium", !muted && "text-ink")}>
        {participant.firstName} {participant.lastName}
      </td>
      <td className="px-4 py-2.5 whitespace-nowrap tabular-nums">{participant.phone}</td>
      <td className="px-4 py-2.5">{participant.instagramUsername ? `@${participant.instagramUsername}` : "—"}</td>
      <td className="px-4 py-2.5 text-right font-medium tabular-nums">{formatNumber(entry.views)}</td>
      <td className="px-4 py-2.5">
        {entry.reelUrl ? (
          <a
            href={entry.reelUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-brand-700 hover:underline"
          >
            Ochish
            <ExternalLink className="size-3.5" aria-hidden />
          </a>
        ) : (
          "—"
        )}
      </td>
      <td className="px-4 py-2.5">
        {entry.hasTarget || entry.flagged ? (
          <span className="flex flex-wrap gap-1">
            {entry.hasTarget && <Badge tone="danger">Target aniqlangan</Badge>}
            {entry.flagged && <Badge tone="warning">Nakrutka shubhasi</Badge>}
          </span>
        ) : (
          <span className="text-slate-400">—</span>
        )}
      </td>
    </tr>
  );
}
