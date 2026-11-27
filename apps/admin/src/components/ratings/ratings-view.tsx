"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { AlertTriangle, ListOrdered } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { IosIcon } from "@/components/ui/ios-icon";
import { MoreDetails } from "@/components/ui/more-details";
import { PageHint } from "@/components/ui/page-hint";
import { Pagination } from "@/components/ui/pagination";
import { TableSkeleton } from "@/components/ui/table-skeleton";
import { ParticipantReelsDialog } from "@/components/users/participant-reels-dialog";
import { getDailyRating } from "@/lib/api";
import { errorMessage } from "@/lib/api-error";
import { addDays, isIsoDate, todayIso } from "@/lib/dates";
import { formatDate, formatDateTime, formatNumber, formatSigned } from "@/lib/format";
import type { DailyRatingResponse, IsoDate, RatingEntry } from "@/lib/types";
import { cn } from "@/lib/utils";
import { WINNER_PATH } from "@/lib/winner-links";

import { RatingDatePicker } from "./rating-date-picker";
import { RatingTable } from "./rating-table";

const PAGE_SIZE = 50;

/** Ishtirokchi oynasi: kim va reytingdagi qaysi videosidan ochilgan. */
interface OpenParticipant {
  participant: { id: string; firstName: string; lastName: string };
  shortcode: string;
}

export function RatingsView() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const today = todayIso();

  const dateParam = searchParams.get("date");
  const requestedDate = isIsoDate(dateParam) ? dateParam : undefined;
  const pageParam = Number.parseInt(searchParams.get("page") ?? "", 10);
  const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;

  const { data, error, isPending, isError, isFetching, refetch } = useQuery({
    queryKey: ["daily-rating", requestedDate ?? "today", page],
    queryFn: () => getDailyRating({ date: requestedDate, page, pageSize: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });

  const [reelsFor, setReelsFor] = useState<OpenParticipant | null>(null);

  const shownDate = data?.date ?? requestedDate ?? today;

  function updateUrl(date: IsoDate, nextPage: number) {
    const params = new URLSearchParams();
    if (date !== today) params.set("date", date);
    if (nextPage > 1) params.set("page", String(nextPage));
    const search = params.toString();
    router.replace(search ? `${pathname}?${search}` : pathname, { scroll: false });
  }

  function showParticipant(entry: RatingEntry) {
    setReelsFor({
      participant: { id: entry.participantId, firstName: entry.firstName, lastName: entry.lastName },
      shortcode: entry.shortcode,
    });
  }

  return (
    <div className="space-y-4">
      <PageHint>
        Bu — videolar reytingi: har bir video alohida, eng ko&apos;p ko&apos;rilgani tepada. Reyting faqat
        ma&apos;lumot uchun: g&apos;oliblar o&apos;rin bo&apos;yicha emas — «G&apos;oliblar» bo&apos;limida ko&apos;rishlar oraliqlari
        ichida baraban orqali random aniqlanadi.
        <span className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
          <Link href="/users" className="font-medium text-brand-700 hover:underline">
            Ishtirokchilarning umumiy natijasi →
          </Link>
          <Link href={WINNER_PATH} className="font-medium text-brand-700 hover:underline">
            G&apos;oliblar →
          </Link>
        </span>
      </PageHint>

      {/* Sana tanlash — u ta'sir qiladigan hamma narsadan yuqorida */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <RatingDatePicker
          date={shownDate}
          today={today}
          min={data?.availableRange.from}
          max={data?.availableRange.to}
          onChange={(date) => updateUrl(date, 1)}
        />
        {data && (
          <p className="text-xs text-slate-500">
            Ko&apos;rishlar oxirgi marta {formatDateTime(data.generatedAt)} da yig&apos;ilgan
          </p>
        )}
      </div>

      {data && <RatingSummary data={data} />}

      <Card className="overflow-hidden">
        {isPending ? (
          <TableSkeleton rows={10} />
        ) : isError && !data ? (
          <div className="flex flex-col items-center gap-3 px-4 py-12 text-center">
            <IosIcon icon={AlertTriangle} tint="orange" size={48} />
            <p className="text-sm text-slate-600">{errorMessage(error)}</p>
            <Button variant="secondary" onClick={() => refetch()}>
              Qayta urinish
            </Button>
          </div>
        ) : data && data.items.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-4 py-12 text-center">
            <IosIcon icon={ListOrdered} tint="gray" size={48} />
            <p className="max-w-md text-sm text-slate-600">
              {formatDate(data.date)} kuni reytingda hali video yo&apos;q. Videolar tekshiruvdan o&apos;tib,
              ko&apos;rishlari yig&apos;ilgach shu yerda chiqadi.
            </p>
            <Link
              href="/manual-review"
              className="inline-flex h-8 items-center rounded-[10px] border border-line bg-white px-3 text-sm font-medium text-ink transition-colors hover:border-brand-200 hover:bg-brand-50/50"
            >
              Qo&apos;lda tekshiruvga o&apos;tish
            </Link>
          </div>
        ) : data ? (
          <>
            <div
              className={cn("transition-opacity", isFetching && "opacity-60")}
              aria-busy={isFetching}
            >
              <RatingTable entries={data.items} isToday={data.date === today} onShowParticipant={showParticipant} />
            </div>
            <div className="border-t border-slate-200 px-4 py-3">
              <Pagination
                page={data.page}
                pageSize={data.pageSize}
                total={data.total}
                onPageChange={(nextPage) => {
                  updateUrl(data.date, nextPage);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
              />
            </div>
          </>
        ) : null}
      </Card>

      {reelsFor && (
        <ParticipantReelsDialog
          key={`${reelsFor.participant.id}:${reelsFor.shortcode}`}
          participant={reelsFor.participant}
          highlight={reelsFor.shortcode}
          highlightLabel="reytingdagi shu video"
          onClose={() => setReelsFor(null)}
        />
      )}
    </div>
  );
}

function RatingSummary({ data }: { data: DailyRatingResponse }) {
  const firstDay = data.date === data.availableRange.from;
  const items = [
    { label: "Videolar", value: formatNumber(data.summary.videos) },
    { label: "Jami ko'rishlar", value: formatNumber(data.summary.totalViews) },
    { label: "Shu kuni qo'shilgan ko'rishlar", value: formatSigned(data.summary.totalGrowth) },
  ];

  return (
    <Card className="px-5 py-4">
      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {items.map((item) => (
          <div key={item.label}>
            <dt className="text-xs text-slate-500">{item.label}</dt>
            <dd className="mt-0.5 text-lg font-semibold text-slate-900 tabular-nums">{item.value}</dd>
          </div>
        ))}
      </dl>

      <MoreDetails title="Batafsil" className="mt-4" contentClassName="space-y-3">
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div>
            <dt className="text-xs text-slate-500">Ishtirokchilar</dt>
            <dd className="mt-0.5 font-semibold text-slate-900 tabular-nums">
              {formatNumber(data.summary.participants)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Yangi kirgan videolar</dt>
            <dd className="mt-0.5 font-semibold text-slate-900 tabular-nums">
              {firstDay ? "—" : formatNumber(data.summary.newEntries)}
            </dd>
          </div>
        </dl>
        <p className="text-xs text-slate-500">
          {firstDay
            ? "Tanlovning birinchi kuni — o'rin o'zgarishi hisoblanmaydi."
            : `O'rin o'zgarishi ${formatDate(addDays(data.date, -1))} kuniga nisbatan.`}
        </p>
      </MoreDetails>
    </Card>
  );
}
