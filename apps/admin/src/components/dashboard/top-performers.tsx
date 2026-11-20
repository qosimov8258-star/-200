"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Crosshair, ExternalLink, Flame, Trophy } from "lucide-react";

import { getDailyRating } from "@/lib/api";
import { formatCompact, formatNumber, formatPercent, formatSigned } from "@/lib/format";
import type { DashboardStats, IsoDate, RatingEntry } from "@/lib/types";
import { cn } from "@/lib/utils";

import { CarouselControls, DashboardSection } from "./section";

const PER_PAGE = 3;
const PAGES = 3;
const AVATAR_TONES = [
  "bg-[linear-gradient(135deg,#c5b9ea,#937ed6)]",
  "bg-[linear-gradient(135deg,#a8dcc0,#5cc085)]",
  "bg-[linear-gradient(135deg,#f6c99b,#e8955a)]",
];

/**
 * CareOps "Doctors performance": reyting boshi kartalarda va xulosa banneri. Reytingda har bir
 * video alohida qator, shuning uchun bir ishtirokchi bir necha kartada bo'lishi mumkin.
 */
export function TopPerformers({ stats, phrase }: { stats: DashboardStats; phrase: string }) {
  const date: IsoDate = stats.range.to;
  const [page, setPage] = useState(0);
  const rating = useQuery({
    queryKey: ["dashboard-top", date],
    queryFn: () => getDailyRating({ date, pageSize: PER_PAGE * PAGES }),
  });
  const items = rating.data?.items ?? [];
  const pages = Math.max(1, Math.ceil(items.length / PER_PAGE));
  const visible = items.slice(page * PER_PAGE, page * PER_PAGE + PER_PAGE);
  const share = stats.views.total > 0 ? stats.views.growthInRange / stats.views.total : 0;

  return (
    <DashboardSection
      title="Eng ko'p ko'rilgan videolar"
      subtitle="Ko'rishlar bo'yicha reyting boshi — har bir video alohida"
      actions={<CarouselControls page={page} pages={pages} onPage={setPage} href="/ratings" />}
    >
      <div className="grid gap-3 sm:grid-cols-3">
        {rating.isPending
          ? Array.from({ length: PER_PAGE }, (_, i) => (
              <div key={i} className="h-[150px] animate-pulse rounded-2xl border border-line bg-[#fbfbfd]" />
            ))
          : visible.map((entry, i) => <PerformerCard key={entry.shortcode} entry={entry} tone={AVATAR_TONES[i % AVATAR_TONES.length]} />)}
        {!rating.isPending && items.length === 0 && (
          <p className="col-span-full py-10 text-center text-sm text-muted">Reyting hali shakllanmagan</p>
        )}
      </div>

      {/* Xulosa banneri */}
      <Link
        href="/ratings"
        className="group mt-4 flex items-center gap-3 rounded-2xl border border-brand-100 bg-brand-50/70 px-4 py-3 transition-colors hover:bg-brand-50"
      >
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white text-brand-500 shadow-[0_2px_6px_rgba(124,98,219,0.15)]">
          <Flame className="size-4" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-ink">
            Ishtirokchilar {phrase} {formatCompact(stats.views.growthInRange)} ko&apos;rish yig&apos;di
          </span>
          <span className="block text-xs text-muted">Jami ko&apos;rishlarning {formatPercent(share)} qismi</span>
        </span>
        <span className="hidden shrink-0 items-center gap-1 text-sm font-medium text-brand-500 sm:inline-flex">
          Reytingni ko&apos;rish
          <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
        </span>
      </Link>
    </DashboardSection>
  );
}

function PerformerCard({ entry, tone }: { entry: RatingEntry; tone: string }) {
  const name = `${entry.firstName} ${entry.lastName}`;
  const initials = `${entry.firstName[0] ?? ""}${entry.lastName[0] ?? ""}`.toUpperCase();
  const delta = entry.previousRank === null ? null : entry.previousRank - entry.rank;
  return (
    <div className="rounded-2xl border border-line bg-white p-3.5">
      <div className="flex items-center gap-2.5">
        <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl text-sm font-semibold text-white", tone)}>
          {initials}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold text-ink">{name}</span>
          <span className="block truncate text-xs text-muted">
            {entry.instagramUsername ? `@${entry.instagramUsername}` : "Instagram ulanmagan"}
          </span>
        </span>
      </div>
      <dl className="mt-3 space-y-1.5 border-t border-line pt-3 text-xs">
        <div className="flex items-center justify-between gap-2">
          <dt className="text-muted">Video</dt>
          <dd className="min-w-0">
            <a
              href={entry.reelUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex max-w-full items-center gap-1 font-mono font-medium text-brand-600 hover:underline"
            >
              <span className="truncate">{entry.shortcode}</span>
              <ExternalLink className="size-3 shrink-0" aria-hidden />
              <span className="sr-only">({name} videosi, Instagramda, yangi oynada)</span>
            </a>
          </dd>
        </div>
        <Row label="Ko'rishlar" value={formatNumber(entry.views)} />
        <Row label="Kunlik o'sish" value={formatSigned(entry.viewsGrowth)} valueClass="text-up" />
        <div className="flex items-center justify-between">
          <dt className="text-muted">O&apos;rin</dt>
          <dd className="flex items-center gap-1.5 font-semibold text-ink tabular-nums">
            {entry.hasTarget && <Crosshair className="size-3.5 text-down" aria-label="Target aniqlangan" />}
            <Trophy className="size-3.5 text-[#e8b84a]" aria-hidden />
            {entry.rank}
            {delta !== null && delta !== 0 && (
              <span className={cn("text-[11px] font-medium", delta > 0 ? "text-up" : "text-down")}>
                {delta > 0 ? `↑${delta}` : `↓${-delta}`}
              </span>
            )}
          </dd>
        </div>
      </dl>
    </div>
  );
}

function Row({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-muted">{label}</dt>
      <dd className={cn("font-semibold text-ink tabular-nums", valueClass)}>{value}</dd>
    </div>
  );
}
