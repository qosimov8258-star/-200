"use client";

import { useId } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Clapperboard, ExternalLink, Flag } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { IosIcon } from "@/components/ui/ios-icon";
import { Spinner } from "@/components/ui/spinner";
import { getParticipantReels } from "@/lib/api";
import { errorMessage } from "@/lib/api-error";
import { formatDateTime, formatNumber } from "@/lib/format";
import {
  MANUAL_REVIEW_REEL_LABEL,
  REEL_REJECT_REASON_LABELS,
  REEL_STATUS_LABELS,
  REEL_STATUS_TONES,
  reelFlagLabel,
} from "@/lib/labels";
import type {
  AdminReelItem,
  ParticipantListItem,
  ParticipantReelCounts,
  ParticipantReels,
} from "@/lib/types";

import { ReelCountBadges } from "./reel-count-badges";
import { fullName } from "./users-table";

interface ParticipantReelsDialogProps {
  participant: ParticipantListItem;
  onClose: () => void;
}

/** Ishtirokchining barcha yuborgan videolari: holati, ko'rishlari va shubha belgilari. */
export function ParticipantReelsDialog({ participant, onClose }: ParticipantReelsDialogProps) {
  const name = fullName(participant);
  const { data, error, isPending, isError, isFetching, refetch } = useQuery({
    queryKey: ["participant-reels", participant.id],
    queryFn: () => getParticipantReels(participant.id),
  });

  return (
    <Dialog open onClose={onClose} title={`Videolar — ${name}`} className="max-w-2xl">
      {isPending ? (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <IosIcon icon={AlertTriangle} tint="orange" size={40} />
          <p className="text-sm text-slate-600">{errorMessage(error)}</p>
          <Button variant="secondary" size="sm" loading={isFetching} onClick={() => refetch()}>
            Qayta urinish
          </Button>
        </div>
      ) : (
        <ReelsBody data={data} />
      )}

      <div className="mt-5 flex justify-end border-t border-slate-100 pt-4">
        <Button variant="secondary" onClick={onClose}>
          Yopish
        </Button>
      </div>
    </Dialog>
  );
}

function countReels(reels: AdminReelItem[]): ParticipantReelCounts {
  const counts: ParticipantReelCounts = { total: reels.length, accepted: 0, pending: 0, rejected: 0 };
  for (const reel of reels) {
    if (reel.status === "ACCEPTED") counts.accepted += 1;
    else if (reel.status === "PENDING") counts.pending += 1;
    else if (reel.status === "REJECTED") counts.rejected += 1;
  }
  return counts;
}

function ReelsBody({ data }: { data: ParticipantReels }) {
  // Backend eng yangisini birinchi beradi; tartib shunga tayanmasin.
  const reels = [...data.reels].sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
  const usernames = data.participant.instagramUsernames;
  const listTitleId = useId();

  return (
    <div className="space-y-4 text-sm">
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl bg-canvas px-3 py-3 sm:grid-cols-3">
        <div className="col-span-2 min-w-0 sm:col-span-1">
          <dt className="text-xs text-slate-500">
            {usernames.length > 1 ? "Instagram akkauntlar" : "Instagram"}
          </dt>
          <dd className="mt-0.5">
            {usernames.length === 0 ? (
              <span className="text-slate-400">Aniqlanmagan</span>
            ) : (
              <ul className="flex flex-wrap gap-x-3 gap-y-0.5">
                {usernames.map((username) => (
                  <li key={username} className="min-w-0">
                    <InstagramLink username={username} />
                  </li>
                ))}
              </ul>
            )}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Jami ko&apos;rishlar</dt>
          <dd className="mt-0.5 text-base font-semibold text-slate-900 tabular-nums">
            {formatNumber(data.totalViews)}
          </dd>
          <dd className="text-xs text-slate-500">qabul qilinganlari bo&apos;yicha</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Videolar</dt>
          <dd className="mt-0.5 text-base font-semibold text-slate-900 tabular-nums">
            {formatNumber(reels.length)} ta
          </dd>
          <dd className="mt-0.5">
            <ReelCountBadges counts={countReels(reels)} />
          </dd>
        </div>
      </dl>

      {reels.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <IosIcon icon={Clapperboard} tint="gray" size={40} />
          <p className="text-sm text-slate-600">Hali video yuborilmagan</p>
        </div>
      ) : (
        <section aria-labelledby={listTitleId}>
          <h3 id={listTitleId} className="mb-1 text-xs font-medium tracking-wide text-slate-500 uppercase">
            Yuborilgan videolar — eng yangisi yuqorida
          </h3>
          <ul className="max-h-[55vh] divide-y divide-slate-100 overflow-y-auto rounded-md border border-slate-200">
            {reels.map((reel) => (
              <ReelRow key={reel.shortcode} reel={reel} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function ReelRow({ reel }: { reel: AdminReelItem }) {
  const synced = reel.lastSyncedAt !== null;

  return (
    <li className="space-y-2 px-3 py-3">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
        <a
          href={reel.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-w-0 items-center gap-1 font-mono text-[13px] break-all text-brand-700 hover:underline"
        >
          {reel.shortcode}
          <ExternalLink className="size-3.5 shrink-0" aria-hidden />
          <span className="sr-only">(Instagramda, yangi oynada)</span>
        </a>
        {reel.manualReview ? (
          <Badge tone="brand">{MANUAL_REVIEW_REEL_LABEL}</Badge>
        ) : (
          <Badge tone={REEL_STATUS_TONES[reel.status]}>{REEL_STATUS_LABELS[reel.status]}</Badge>
        )}
      </div>

      {reel.status === "REJECTED" && reel.rejectReason && (
        <p className="rounded-md bg-[#fdecea] px-2.5 py-1.5 text-xs text-[#c2412b]">
          Rad etish sababi: {REEL_REJECT_REASON_LABELS[reel.rejectReason]}
        </p>
      )}

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-3">
        <Meta label="Akkaunt">
          {reel.owner ? (
            <InstagramLink username={reel.owner} />
          ) : (
            <span className="text-slate-400">Aniqlanmagan</span>
          )}
        </Meta>
        <Meta label="Ko'rishlar">
          <span className="tabular-nums">{synced ? formatNumber(reel.views) : "—"}</span>
        </Meta>
        <Meta label="Layklar">
          <span className="tabular-nums">{reel.likes === null ? "—" : formatNumber(reel.likes)}</span>
        </Meta>
        <Meta label="Yuborilgan">
          <span className="tabular-nums">{formatDateTime(reel.submittedAt)}</span>
        </Meta>
        <Meta label="Instagramda joylangan">
          <span className="tabular-nums">{reel.postedAt ? formatDateTime(reel.postedAt) : "—"}</span>
        </Meta>
        <Meta label="Oxirgi yangilanish">
          {reel.lastSyncedAt ? (
            <span className="tabular-nums">{formatDateTime(reel.lastSyncedAt)}</span>
          ) : (
            <span className="text-slate-400">Hali yig&apos;ilmagan</span>
          )}
        </Meta>
      </dl>

      {reel.flags.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label="Shubha belgilari">
          {reel.flags.map((flag) => (
            <li key={flag}>
              <Badge tone="warning" className="gap-1 text-left whitespace-normal">
                <Flag className="size-3 shrink-0" aria-hidden />
                {reelFlagLabel(flag)}
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

function Meta({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-slate-500">{label}</dt>
      <dd className="mt-0.5 truncate text-slate-900">{children}</dd>
    </div>
  );
}

function InstagramLink({ username }: { username: string }) {
  return (
    <a
      href={`https://www.instagram.com/${encodeURIComponent(username)}/`}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex max-w-full items-center gap-1 text-brand-700 hover:underline"
    >
      <span className="truncate">@{username}</span>
      <ExternalLink className="size-3 shrink-0" aria-hidden />
      <span className="sr-only">(yangi oynada)</span>
    </a>
  );
}
