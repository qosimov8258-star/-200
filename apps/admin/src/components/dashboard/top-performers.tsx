"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, ExternalLink } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getDailyRating } from "@/lib/api";
import { errorMessage } from "@/lib/api-error";
import { formatNumber, formatSigned } from "@/lib/format";
import type { IsoDate, RatingEntry } from "@/lib/types";

import { DashboardSection } from "./section";

const LIMIT = 5;

/** O'rin o'zgarishi oddiy so'z bilan (qatorning sichqoncha izohi uchun). */
function rankChange(entry: RatingEntry): string {
  if (entry.previousRank === null) return "oldingi kuni reytingda yo'q edi";
  const delta = entry.previousRank - entry.rank;
  if (delta > 0) return `oldingi kunga nisbatan ${delta} o'rin yuqoriga chiqdi`;
  if (delta < 0) return `oldingi kunga nisbatan ${-delta} o'rin pastga tushdi`;
  return "o'rni o'zgarmagan";
}

/**
 * Eng ko'p ko'rilgan 5 ta video — oddiy ro'yxat. Reytingda har bir video alohida qator, shuning
 * uchun bir ishtirokchi bir necha qatorda bo'lishi mumkin. Texnik tafsilotlar (shortcode, kunlik
 * o'sish, o'rin o'zgarishi) — qatorning sichqoncha izohida; to'liq ro'yxat — "Reyting" bo'limida.
 */
export function TopPerformers({ date }: { date: IsoDate }) {
  const rating = useQuery({
    // "daily-rating" — qaror (qo'lda tekshiruv, target) dan keyin shu kalit bilan yangilanadi.
    queryKey: ["daily-rating", "dashboard-top", date, LIMIT],
    queryFn: () => getDailyRating({ date, pageSize: LIMIT }),
  });
  const items = rating.data?.items ?? [];

  return (
    <DashboardSection
      title="Eng ko'p ko'rilgan videolar"
      subtitle="Eng ko'p ko'rilgan 5 ta video. Bu faqat ma'lumot: g'oliblar o'rin bo'yicha emas, ko'rishlar oralig'i ichida random aniqlanadi."
    >
      {rating.isPending ? (
        <div className="space-y-2" aria-busy="true" aria-label="Yuklanmoqda">
          {Array.from({ length: LIMIT }, (_, i) => (
            <div key={i} className="h-[52px] animate-pulse rounded-xl bg-[#fbfbfd]" />
          ))}
        </div>
      ) : rating.isError ? (
        <div role="alert" className="flex flex-col items-center gap-3 py-10 text-center">
          <p className="text-sm text-muted">{errorMessage(rating.error)}</p>
          <Button variant="secondary" size="sm" onClick={() => void rating.refetch()}>
            Qayta urinish
          </Button>
        </div>
      ) : items.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted">Reyting hali shakllanmagan</p>
      ) : (
        <ol className="divide-y divide-line rounded-2xl border border-line">
          {items.map((entry) => (
            <PerformerRow key={entry.shortcode} entry={entry} />
          ))}
        </ol>
      )}

      <Link
        href="/ratings"
        className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:underline"
      >
        To&apos;liq reytingni ochish
        <ArrowRight className="size-4" aria-hidden />
      </Link>
    </DashboardSection>
  );
}

function PerformerRow({ entry }: { entry: RatingEntry }) {
  // Familiya endi so'ralmaydi — bo'sh bo'lsa, ortiqcha bo'sh joy qolmasin.
  const name = [entry.firstName, entry.lastName].filter(Boolean).join(" ");
  const details = `Video: ${entry.shortcode} · kunlik o'sish: ${formatSigned(entry.viewsGrowth)} · ${rankChange(entry)}`;

  return (
    <li title={details} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3.5 py-3">
      <span className="w-6 shrink-0 text-sm font-semibold text-muted tabular-nums">{entry.rank}.</span>
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-semibold text-ink">{name}</span>
          {entry.hasTarget && (
            <Badge tone="danger" className="shrink-0">
              Target aniqlangan
            </Badge>
          )}
        </span>
        <span className="block truncate text-xs text-muted">
          {entry.instagramUsername ? `@${entry.instagramUsername}` : "Instagram ulanmagan"}
        </span>
      </span>
      <span className="flex shrink-0 flex-col items-end gap-0.5">
        <span className="text-sm font-semibold text-ink tabular-nums">
          {formatNumber(entry.views)} <span className="text-xs font-normal text-muted">ko&apos;rish</span>
        </span>
        <a
          href={entry.reelUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline"
        >
          Videoni ochish
          <ExternalLink className="size-3 shrink-0" aria-hidden />
          <span className="sr-only">({name} videosi, Instagramda, yangi oynada)</span>
        </a>
      </span>
    </li>
  );
}
