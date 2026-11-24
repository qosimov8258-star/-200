import { ExternalLink } from "lucide-react";

import { RATING_PRIZE_ICONS } from "@/components/prizes/rating-prize";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { formatNumber, formatViewsRange } from "@/lib/format";
import { RATING_PRIZE_LABELS } from "@/lib/labels";
import type { RatingPrizeEntry, RatingPrizeTier } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * "Boshqa asosiy sovrinlar" kartochkasi (G'oliblar sahifasi): eni 350, bo'yi 400 px — yonma-yon
 * turadi (tor telefonda eni ekranga sig'adigan qilib qisqaradi). Tepada sovrin nomi va bir qator
 * qoida, pastda g'oliblar va navbatdagilar; ro'yxat uzun bo'lsa, kartochka ichida aylanadi
 * (sahifa cho'zilmaydi).
 */
export function RatingPrizeTile({ tier }: { tier: RatingPrizeTier }) {
  const Icon = RATING_PRIZE_ICONS[tier.kind];
  const label = RATING_PRIZE_LABELS[tier.kind];

  return (
    <Card className="flex h-[400px] w-[350px] max-w-full shrink-0 flex-col overflow-hidden">
      <div className="border-b border-line px-4 pt-4 pb-3">
        <div className="flex items-start gap-2.5">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600">
            <Icon className="size-[18px]" aria-hidden />
          </span>
          <div className="min-w-0">
            <h3 className="text-[15px] leading-tight font-semibold tracking-tight text-ink">
              {label}
            </h3>
            <Badge className="mt-1 px-2 text-[11px]">Reyting bo&apos;yicha</Badge>
          </div>
        </div>
        <p className="mt-2.5 text-xs text-muted tabular-nums">
          {formatNumber(tier.quantity)} ta ·{" "}
          <span className="whitespace-nowrap">{formatViewsRange(tier.minViews, tier.maxViews)}</span> ko&apos;rish
        </p>
      </div>

      {tier.winners.length === 0 ? (
        <p className="grid flex-1 place-items-center px-4 text-sm text-muted">Hozircha yo&apos;q</p>
      ) : (
        <div
          // Ro'yxat uzun bo'lsa aylanadi — klaviatura bilan ham aylantirish uchun fokuslanadi.
          tabIndex={0}
          role="region"
          aria-label={`${label}: g'oliblar`}
          className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-2 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-500"
        >
          <EntryList entries={tier.winners} />
          {tier.next.length > 0 && (
            <>
              <p className="px-2 pt-3 pb-1 text-[11px] font-medium text-slate-400">Navbatdagilar</p>
              <EntryList entries={tier.next} muted />
            </>
          )}
        </div>
      )}
    </Card>
  );
}

function EntryList({ entries, muted = false }: { entries: RatingPrizeEntry[]; muted?: boolean }) {
  return (
    <ol>
      {entries.map((entry) => (
        <EntryItem key={entry.participant.id} entry={entry} muted={muted} />
      ))}
    </ol>
  );
}

function EntryItem({ entry, muted }: { entry: RatingPrizeEntry; muted: boolean }) {
  const name = `${entry.participant.firstName} ${entry.participant.lastName}`;
  return (
    <li className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50">
      <span
        className={cn(
          "w-5 shrink-0 text-center text-xs font-semibold tabular-nums",
          muted ? "text-slate-400" : "text-ink",
        )}
      >
        {entry.place}
      </span>
      <div className="min-w-0 flex-1">
        <p className={cn("truncate text-sm font-medium", muted ? "text-slate-500" : "text-ink")} title={name}>
          {name}
        </p>
        <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted tabular-nums">
          <span>{formatNumber(entry.views)} ko&apos;rish</span>
          {entry.hasTarget && <Flag tone="danger" label="Target" rest="aniqlangan" />}
          {entry.flagged && <Flag tone="warning" label="Nakrutka" rest="shubhasi" />}
        </p>
      </div>
      {entry.reelUrl && (
        <a
          href={entry.reelUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${name}: Reelni ochish`}
          title="Reelni ochish"
          className="grid size-7 shrink-0 place-items-center rounded-md text-brand-700 hover:bg-brand-50"
        >
          <ExternalLink className="size-3.5" aria-hidden />
        </a>
      )}
    </li>
  );
}

/** Kichik belgi: rangli nuqta + bir so'z; to'liq matni ("Target aniqlangan") — sichqoncha va ekran o'quvchi uchun. */
function Flag({ tone, label, rest }: { tone: "danger" | "warning"; label: string; rest: string }) {
  return (
    <span
      title={`${label} ${rest}`}
      className={cn(
        "inline-flex items-center gap-1 font-medium",
        tone === "danger" ? "text-[#c2412b]" : "text-[#a7650f]",
      )}
    >
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      {label}
      <span className="sr-only"> {rest}</span>
    </span>
  );
}
