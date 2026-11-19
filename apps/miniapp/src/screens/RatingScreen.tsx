import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { ArrowRight, ChevronRight, Eye, Trophy } from "lucide-react";
import { useState } from "react";

import oliviaLogo from "../assets/olivia-logo.webp";
import { ChampionBackdrop } from "../components/ChampionBackdrop";
import { Avatar, Card, ErrorBlock, PageHeader, RankDelta, RoundIcon, Spinner } from "../components/ui";
import { t } from "../i18n/uz";
import * as api from "../lib/api";
import { daysUntil, formatCount } from "../lib/format";
import { haptic } from "../lib/telegram";
import type { RatingEntry } from "../lib/types";

type Filter = "all" | "top10" | "nearMe";

function applyFilter(entries: RatingEntry[], filter: Filter): RatingEntry[] {
  if (filter === "all") return entries;
  if (filter === "top10") return entries.slice(0, 10);
  const me = entries.findIndex((e) => e.isMe);
  return me < 0 ? [] : entries.slice(Math.max(0, me - 3), me + 4);
}

export function RatingScreen({
  firstName,
  fullName,
  onOpenReel,
  onOpenWinner,
}: {
  firstName: string;
  fullName: string;
  onOpenReel: () => void;
  onOpenWinner: () => void;
}) {
  const contest = useQuery({ queryKey: ["contest"], queryFn: api.getContest });
  const rating = useQuery({ queryKey: ["rating"], queryFn: api.getRating });
  const [filter, setFilter] = useState<Filter>("all");

  const days = contest.data ? daysUntil(contest.data.endsAt) : null;
  const filters: [Filter, string][] = [
    ["all", t.filterAll],
    ["top10", t.filterTop10],
    ["nearMe", t.filterNearMe],
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={<img src={oliviaLogo} alt="Olivia" width={78} height={32} className="h-8 w-auto" />}
        title={t.greeting(firstName)}
        subtitle={t.welcome}
        trailing={<Avatar name={fullName} dark />}
      />

      <div className="flex h-[60px] items-center rounded-full bg-surface pr-1.5 pl-5">
        <span className="flex-1 truncate text-[15px] font-medium">
          {days === null ? "…" : days === 0 ? t.contestFinished : t.daysLeft(days)}
        </span>
        <RoundIcon label={t.menuWinner} dark onClick={onOpenWinner}>
          <ArrowRight className="size-5" />
        </RoundIcon>
      </div>

      <div className="flex items-end justify-between">
        <h2 className="text-[22px] font-bold tracking-tight">{t.ratingTitle}</h2>
        {contest.data && (
          <span className="text-[13px] text-muted">
            {t.participants(formatCount(contest.data.participants))}
          </span>
        )}
      </div>

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
              filter === key ? "bg-ink text-white" : "bg-surface text-muted",
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
              <Card className="px-0 py-1.5">
                <ol>
                  {visible.map((entry, i) => (
                    <li
                      key={entry.rank}
                      className={clsx(
                        "mx-[18px] flex items-center gap-3 py-3",
                        i > 0 && "border-t border-line",
                      )}
                    >
                      <span
                        className={clsx(
                          "w-7 text-base font-bold",
                          entry.rank <= 3 ? "text-ink" : "text-muted",
                        )}
                      >
                        {entry.rank}
                      </span>
                      <Avatar name={entry.fullName} dark={entry.isMe} />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5">
                          <span className="truncate text-[15px] font-semibold">{entry.fullName}</span>
                          {entry.isMe && (
                            <span className="rounded-full bg-ink px-2 py-0.5 text-[11px] font-semibold text-white">
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
    <section className="relative isolate flex h-[300px] flex-col overflow-hidden rounded-card bg-[#0e0826] p-3.5 text-white">
      <ChampionBackdrop />
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
