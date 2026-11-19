import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { ChevronRight, Eye, Trophy } from "lucide-react";
import { useState } from "react";

import { ChampionBackdrop } from "../components/ChampionBackdrop";
import { HangingOrnament, RankOrnament, SnowCap } from "../components/Ornaments";
import { Snowfall } from "../components/Snowfall";
import { Avatar, Card, ErrorBlock, PageHeader, RankDelta, Spinner } from "../components/ui";
import { t } from "../i18n/uz";
import * as api from "../lib/api";
import { formatCount } from "../lib/format";
import { haptic } from "../lib/telegram";
import type { RatingEntry } from "../lib/types";

type Filter = "all" | "top10" | "nearMe";

function applyFilter(entries: RatingEntry[], filter: Filter): RatingEntry[] {
  if (filter === "all") return entries;
  if (filter === "top10") return entries.slice(0, 10);
  const me = entries.findIndex((e) => e.isMe);
  return me < 0 ? [] : entries.slice(Math.max(0, me - 3), me + 4);
}

/**
 * "Reyting" bo'limi: 1-o'rin kartasi va ishtirokchilar ro'yxati (filtrlar bilan).
 * Yangi yil uslubida: sarlavha yonida osilgan archa o'yinchog'i, konfet-tayoqcha filtrlar,
 * qor yog'ayotgan qishki tun sahnasi, ro'yxat ustida qor va top-3 uchun o'yinchoq-medallar.
 */
export function RatingScreen({ onOpenReel }: { onOpenReel: () => void }) {
  const contest = useQuery({ queryKey: ["contest"], queryFn: api.getContest });
  const rating = useQuery({ queryKey: ["rating"], queryFn: api.getRating });
  const [filter, setFilter] = useState<Filter>("all");

  const filters: [Filter, string][] = [
    ["all", t.filterAll],
    ["top10", t.filterTop10],
    ["nearMe", t.filterNearMe],
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title={t.ratingTitle}
        subtitle={contest.data ? t.participants(formatCount(contest.data.participants)) : undefined}
        trailing={<HangingOrnament className="-mt-6 mr-1 h-[72px] w-[46px] shrink-0 self-start" />}
      />

      <div className="-mx-5 flex gap-2 overflow-x-auto px-5 [scrollbar-width:none]">
        {filters.map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => {
              haptic.select();
              setFilter(key);
            }}
            className={clsx(
              "h-11 shrink-0 rounded-full px-5 text-[15px] font-medium transition",
              filter === key
                ? // Konfet tayoqcha: qizil asos ustida qiya oq chiziqlar (orqaga tugmasi bilan bir uslub).
                  "bg-[#df3425] bg-[repeating-linear-gradient(-45deg,rgba(255,255,255,0.2)_0_7px,transparent_7px_14px)] font-semibold text-white shadow-[0_6px_14px_-8px_rgba(223,52,37,0.9)]"
                : "bg-surface text-muted",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {rating.isPending ? (
        <Spinner />
      ) : rating.isError ? (
        <ErrorBlock onRetry={() => void rating.refetch()} />
      ) : rating.data.length === 0 ? (
        <Card className="py-7 text-center text-muted">{t.ratingEmpty}</Card>
      ) : (
        <>
          <LeaderCard
            leader={rating.data[0]}
            me={rating.data.find((e) => e.isMe) ?? null}
            onOpenReel={onOpenReel}
          />
          {(() => {
            const visible = applyFilter(rating.data, filter);
            if (visible.length === 0) {
              return <Card className="py-7 text-center text-muted">{t.nearMeEmpty}</Card>;
            }
            return (
              <Card className="relative mt-2 px-0 py-1.5">
                <SnowCap className="absolute inset-x-5 -top-[11px] h-[18px] w-[calc(100%-2.5rem)] drop-shadow-[0_1px_1.5px_rgba(60,70,110,0.28)]" />
                <ol>
                  {visible.map((entry, i) => (
                    <li
                      key={entry.rank}
                      className={clsx(
                        "mx-[18px] flex items-center gap-3 py-3",
                        i > 0 && "border-t border-line",
                      )}
                    >
                      {entry.rank <= 3 ? (
                        <span className="w-[30px]">
                          <RankOrnament rank={entry.rank as 1 | 2 | 3} />
                          <span className="sr-only">{entry.rank}</span>
                        </span>
                      ) : (
                        <span className="w-[30px] text-center text-base font-bold text-muted">{entry.rank}</span>
                      )}
                      <Avatar name={entry.fullName} dark={entry.isMe} />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5">
                          <span className="truncate text-[15px] font-semibold">{entry.fullName}</span>
                          {entry.isMe && (
                            <span className="rounded-full bg-[#df3425] px-2 py-0.5 text-[11px] font-semibold text-white">
                              {t.you}
                            </span>
                          )}
                        </span>
                        <span className="block text-[13px] text-muted">
                          {t.views(formatCount(entry.views))}
                        </span>
                      </span>
                      <RankDelta delta={entry.rankDelta} />
                    </li>
                  ))}
                </ol>
              </Card>
            );
          })()}
        </>
      )}
    </div>
  );
}

function LeaderCard({
  leader,
  me,
  onOpenReel,
}: {
  leader: RatingEntry;
  me: RatingEntry | null;
  onOpenReel: () => void;
}) {
  return (
    <section className="relative isolate flex h-[300px] flex-col overflow-hidden rounded-card bg-[#10132e] p-3.5 text-white shadow-[0_20px_44px_-24px_rgba(11,13,31,0.9)]">
      <ChampionBackdrop />
      <Snowfall density={0.75} />
      <span className="ml-auto grid size-11 place-items-center rounded-full border border-white/50 bg-[#0a1a2a]/30 backdrop-blur-sm">
        <Trophy className="size-[22px]" />
      </span>
      <div className="mt-auto px-1.5 [text-shadow:0_1px_10px_rgba(5,4,15,0.9)]">
        <p className="text-[13px] text-white/75">{t.firstPlace}</p>
        <p className="truncate text-[22px] font-bold tracking-tight">{leader.fullName}</p>
        <p className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-white/50 px-2.5 py-1 text-[13px] font-semibold">
          <Eye className="size-3.5" />
          {t.views(formatCount(leader.views))}
        </p>
      </div>
      <button
        type="button"
        onClick={onOpenReel}
        className="mt-3.5 flex items-center rounded-full bg-white/20 py-[5px] pr-[5px] pl-5 text-left backdrop-blur-sm transition active:scale-[0.98]"
      >
        <span className="flex-1 truncate text-[15px] font-semibold">
          {me ? t.myRank(me.rank) : t.sendVideoCta}
        </span>
        <span className="grid size-11 place-items-center rounded-full bg-white text-ink">
          <ChevronRight className="size-5" />
        </span>
      </button>
    </section>
  );
}
