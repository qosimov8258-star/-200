"use client";

import { useId } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Clapperboard, ExternalLink, Flag, Trophy } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { IosIcon } from "@/components/ui/ios-icon";
import { Spinner } from "@/components/ui/spinner";
import { getParticipantReels } from "@/lib/api";
import { errorMessage } from "@/lib/api-error";
import { formatDate, formatDateTime, formatNumber } from "@/lib/format";
import {
  BEST_REEL_LABEL,
  MANUAL_REVIEW_REEL_LABEL,
  PARTICIPANT_STATUS_LABELS,
  PARTICIPANT_STATUS_TONES,
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
import { cn } from "@/lib/utils";

import { ReelCountBadges } from "./reel-count-badges";
import { fullName } from "./users-table";

interface ParticipantReelsDialogProps {
  participant: Pick<ParticipantListItem, "id" | "firstName" | "lastName">;
  /** Shu video ro'yxatda ajratib ko'rsatiladi (masalan, Qo'lda tekshiruvdan ochilganda). */
  highlight?: string;
  onClose: () => void;
}

/**
 * Ishtirokchi ma'lumotlari (telefon, yosh, holat, Instagram) va barcha yuborgan videolari:
 * holati, reytingdagi o'rni, ko'rishlari va shubha belgilari. Reytingda har bir qabul qilingan
 * video alohida qator; ishtirokchining natijasi va o'rni — eng ko'p ko'rilgan bitta videosi
 * bo'yicha (ko'rishlar qo'shilmaydi).
 */
export function ParticipantReelsDialog({ participant, highlight, onClose }: ParticipantReelsDialogProps) {
  const name = fullName(participant);
  const { data, error, isPending, isError, isFetching, refetch } = useQuery({
    queryKey: ["participant-reels", participant.id],
    queryFn: () => getParticipantReels(participant.id),
  });

  return (
    <Dialog open onClose={onClose} title={name} className="max-w-2xl">
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
        <ReelsBody data={data} highlight={highlight} />
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

function ReelsBody({ data, highlight }: { data: ParticipantReels; highlight?: string }) {
  // Tartib backenddan: qabul qilinganlar ko'rishlar bo'yicha (birinchisi — eng ko'p ko'rilgani),
  // keyin tekshiruvdagilar, keyin rad etilganlar.
  const reels = data.reels;
  const best = reels.find((reel) => reel.best);
  const profile = data.participant;
  const usernames = profile.instagramUsernames;
  const listTitleId = useId();

  return (
    <div className="space-y-4 text-sm">
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 px-1 sm:grid-cols-4">
        <div className="min-w-0">
          <dt className="text-xs text-slate-500">Telefon</dt>
          <dd className="mt-0.5 text-slate-900 tabular-nums">
            {profile.phone ? (
              <a href={`tel:${profile.phone}`} className="hover:underline">
                {profile.phone}
              </a>
            ) : (
              <span className="text-slate-400">—</span>
            )}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Yosh</dt>
          <dd className="mt-0.5 text-slate-900 tabular-nums">{profile.age > 0 ? profile.age : "—"}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Ro&apos;yxatdan o&apos;tgan</dt>
          <dd className="mt-0.5 text-slate-900 tabular-nums">{formatDate(profile.registeredOn)}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Holat</dt>
          <dd className="mt-0.5">
            <Badge tone={PARTICIPANT_STATUS_TONES[profile.status]}>{PARTICIPANT_STATUS_LABELS[profile.status]}</Badge>
          </dd>
        </div>
      </dl>

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
          <dt className="text-xs text-slate-500">Eng ko&apos;p ko&apos;rilgan video</dt>
          <dd className="mt-0.5 text-base font-semibold text-slate-900 tabular-nums">
            {formatNumber(data.bestViews)}
          </dd>
          <dd className="text-xs text-slate-500">
            {!best
              ? "qabul qilingan video yo'q"
              : best.rank !== null
                ? `ishtirokchi o'rni — ${best.rank}-o'rin`
                : "reytingda emas"}
          </dd>
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
            {best ? "Yuborilgan videolar — eng ko'p ko'rilgani yuqorida" : "Yuborilgan videolar"}
          </h3>
          <ul className="max-h-[55vh] divide-y divide-slate-100 overflow-y-auto rounded-md border border-slate-200">
            {reels.map((reel) => (
              <ReelRow key={reel.shortcode} reel={reel} highlighted={reel.shortcode === highlight} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function ReelRow({ reel, highlighted }: { reel: AdminReelItem; highlighted: boolean }) {
  const synced = reel.lastSyncedAt !== null;

  return (
    <li className={cn("space-y-2 px-3 py-3", highlighted && "bg-brand-50/60")} aria-current={highlighted || undefined}>
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
        {highlighted && <span className="sr-only">— qo&apos;lda tekshiruvdagi video</span>}
        <span className="inline-flex flex-wrap items-center gap-1.5">
          {reel.rank !== null && (
            <Badge tone="neutral" className="tabular-nums" title="Reytingdagi o'rni (har bir video alohida qator)">
              {reel.rank}-o&apos;rin
            </Badge>
          )}
          {reel.best && (
            <Badge tone="brand" className="gap-1">
              <Trophy className="size-3" aria-hidden />
              {BEST_REEL_LABEL}
            </Badge>
          )}
          {reel.manualReview ? (
            <Badge tone="brand">{MANUAL_REVIEW_REEL_LABEL}</Badge>
          ) : (
            <Badge tone={REEL_STATUS_TONES[reel.status]}>{REEL_STATUS_LABELS[reel.status]}</Badge>
          )}
        </span>
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
          {synced ? (
            <span className="font-semibold tabular-nums">{formatNumber(reel.views)}</span>
          ) : (
            <span className="text-slate-400">Hali o&apos;qilmagan</span>
          )}
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
