import { Crosshair, Crown, ExternalLink } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { formatNumber, formatSigned } from "@/lib/format";
import type { RatingEntry } from "@/lib/types";
import { cn } from "@/lib/utils";

import { RankChange } from "./rank-change";

export function RatingTable({ entries }: { entries: RatingEntry[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-500">
          <tr>
            <th scope="col" className="w-20 px-4 py-2.5 text-left font-medium">
              O&apos;rin
            </th>
            <th scope="col" className="w-28 px-4 py-2.5 text-left font-medium">
              O&apos;zgarish
            </th>
            <th scope="col" className="px-4 py-2.5 text-left font-medium">
              Ishtirokchi
            </th>
            <th scope="col" className="px-4 py-2.5 text-left font-medium">
              Reel
            </th>
            <th scope="col" className="px-4 py-2.5 text-right font-medium">
              Ko&apos;rishlar
            </th>
            <th scope="col" className="px-4 py-2.5 text-right font-medium">
              Kunlik o&apos;sish
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {entries.map((entry) => (
            <RatingRow key={entry.participantId} entry={entry} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RatingRow({ entry }: { entry: RatingEntry }) {
  const name = `${entry.firstName} ${entry.lastName}`;
  const leader = entry.rank === 1;

  return (
    <tr className={cn(leader ? "bg-amber-50/60" : "hover:bg-slate-50/70")}>
      <td className="px-4 py-3 tabular-nums">
        {leader ? (
          <span className="inline-flex items-center gap-1 font-semibold text-slate-900">
            <Crown className="size-4 text-amber-500" aria-hidden />1
          </span>
        ) : (
          <span className="font-medium text-slate-900">{entry.rank}</span>
        )}
      </td>

      <td className="px-4 py-3">
        <RankChange rank={entry.rank} previousRank={entry.previousRank} />
      </td>

      <td className="px-4 py-3">
        <p className="flex flex-wrap items-center gap-1.5 font-medium text-slate-900">
          <span className="whitespace-nowrap">{name}</span>
          {leader && <Badge tone="warning">Avtomobilga da&apos;vogar</Badge>}
          {entry.hasTarget && (
            <Badge tone="warning" className="gap-1">
              <Crosshair className="size-3" aria-hidden />
              Target
            </Badge>
          )}
        </p>
        <p className="text-xs text-slate-500">
          {entry.instagramUsername ? `@${entry.instagramUsername}` : "Instagram ulanmagan"}
        </p>
      </td>

      <td className="px-4 py-3">
        <a
          href={entry.reelUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 whitespace-nowrap text-brand-700 hover:underline"
        >
          Ochish
          <ExternalLink className="size-3.5" aria-hidden />
          <span className="sr-only">({name} Reeli, yangi oynada)</span>
        </a>
      </td>

      <td className="px-4 py-3 text-right font-medium whitespace-nowrap text-slate-900 tabular-nums">
        {formatNumber(entry.views)}
      </td>

      <td className="px-4 py-3 text-right whitespace-nowrap text-slate-600 tabular-nums">
        {formatSigned(entry.viewsGrowth)}
      </td>
    </tr>
  );
}
