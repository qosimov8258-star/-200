import { Crosshair, Crown, ExternalLink } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { TARGET_HINT } from "@/components/users/users-table";
import { formatNumber, formatSigned } from "@/lib/format";
import type { RatingEntry } from "@/lib/types";
import { cn } from "@/lib/utils";

import { RankChange } from "./rank-change";

interface RatingTableProps {
  entries: RatingEntry[];
  /** Ko'rsatilayotgan kun — bugunmi ("bugun +N" yoki "shu kuni +N"). */
  isToday: boolean;
  /** Ishtirokchi oynasini ochish (barcha videolari va umumiy ko'rishlari). */
  onShowParticipant: (entry: RatingEntry) => void;
}

/**
 * Kunlik reyting jadvali: har bir qator — bitta video, shuning uchun bir ishtirokchi bir necha
 * marta uchrashi mumkin (qator kaliti — `shortcode`). O'rin — faqat ma'lumot: g'oliblar o'rin
 * bo'yicha emas, random aniqlanadi.
 */
export function RatingTable({ entries, isToday, onShowParticipant }: RatingTableProps) {
  return (
    <div className="relative overflow-x-auto">
      <table className="w-full min-w-[640px] text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-500">
          <tr>
            <th scope="col" className="w-32 px-4 py-2.5 text-left font-medium">
              O&apos;rin
            </th>
            <th scope="col" className="px-4 py-2.5 text-left font-medium">
              Ishtirokchi
            </th>
            <th scope="col" className="px-4 py-2.5 text-right font-medium">
              Ko&apos;rishlar
            </th>
            <th scope="col" className="w-28 px-4 py-2.5 text-left font-medium">
              Video
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {entries.map((entry) => (
            <RatingRow
              key={entry.shortcode}
              entry={entry}
              isToday={isToday}
              onShowParticipant={onShowParticipant}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** "bugun +1 234", "shu kuni o'sish yo'q". */
function growthText(growth: number, isToday: boolean): string {
  const day = isToday ? "bugun" : "shu kuni";
  return growth === 0 ? `${day} o'sish yo'q` : `${day} ${formatSigned(growth)}`;
}

function RatingRow({
  entry,
  isToday,
  onShowParticipant,
}: {
  entry: RatingEntry;
  isToday: boolean;
  onShowParticipant: RatingTableProps["onShowParticipant"];
}) {
  const name = `${entry.firstName} ${entry.lastName}`.trim();
  const leader = entry.rank === 1;

  return (
    <tr className={cn(leader ? "bg-amber-50/60" : "hover:bg-slate-50/70")}>
      <td className="px-4 py-3">
        <span className="inline-flex items-center gap-2 tabular-nums">
          {leader ? (
            <span className="inline-flex items-center gap-1 font-semibold text-slate-900" title="Eng ko'p ko'rilgan video">
              <Crown className="size-4 text-amber-500" aria-hidden />1
              <span className="sr-only">(eng ko&apos;p ko&apos;rilgan video)</span>
            </span>
          ) : (
            <span className="font-medium text-slate-900">{entry.rank}</span>
          )}
          <RankChange rank={entry.rank} previousRank={entry.previousRank} />
        </span>
      </td>

      <td className="px-4 py-3">
        <p className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => onShowParticipant(entry)}
            className="rounded text-left font-medium text-slate-900 hover:text-brand-700 hover:underline"
          >
            {name}
            <span className="sr-only"> — barcha videolari va umumiy ko&apos;rishlari</span>
          </button>
          {entry.hasTarget && (
            <Badge tone="warning" className="gap-1" title={TARGET_HINT}>
              <Crosshair className="size-3" aria-hidden />
              Target (reklama)
            </Badge>
          )}
        </p>
        <p className="text-xs text-slate-500">
          {entry.instagramUsername ? (
            `@${entry.instagramUsername}`
          ) : (
            <span className="text-slate-300">
              —<span className="sr-only">Instagram aniqlanmagan</span>
            </span>
          )}
        </p>
      </td>

      <td className="px-4 py-3 text-right whitespace-nowrap tabular-nums">
        <p className="font-medium text-slate-900">{formatNumber(entry.views)}</p>
        <p className="text-xs text-slate-500">{growthText(entry.viewsGrowth, isToday)}</p>
      </td>

      <td className="px-4 py-3">
        <a
          href={entry.reelUrl}
          target="_blank"
          rel="noopener noreferrer"
          title={`Video: ${entry.shortcode}`}
          className="inline-flex items-center gap-1 font-medium whitespace-nowrap text-brand-700 hover:underline"
        >
          Ochish
          <ExternalLink className="size-3.5 shrink-0" aria-hidden />
          <span className="sr-only">({name} videosi, Instagramda, yangi oynada)</span>
        </a>
      </td>
    </tr>
  );
}
