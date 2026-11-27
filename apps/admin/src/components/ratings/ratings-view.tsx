"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { AlertTriangle, ListOrdered } from "lucide-react";

import { IosIcon } from "@/components/ui/ios-icon";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Pagination } from "@/components/ui/pagination";
import { TableSkeleton } from "@/components/ui/table-skeleton";
import { getDailyRating } from "@/lib/api";
import { errorMessage } from "@/lib/api-error";
import { addDays, isIsoDate, todayIso } from "@/lib/dates";
import { formatDate, formatDateTime, formatNumber, formatSigned } from "@/lib/format";
import type { DailyRatingResponse, IsoDate } from "@/lib/types";
import { cn } from "@/lib/utils";

import { RatingDatePicker } from "./rating-date-picker";
import { RatingTable } from "./rating-table";

const PAGE_SIZE = 50;

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

  const shownDate = data?.date ?? requestedDate ?? today;

  function updateUrl(date: IsoDate, nextPage: number) {
    const params = new URLSearchParams();
    if (date !== today) params.set("date", date);
    if (nextPage > 1) params.set("page", String(nextPage));
    const search = params.toString();
    router.replace(search ? `${pathname}?${search}` : pathname, { scroll: false });
  }

  return (
    <div className="space-y-4">
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
            Reyting {formatDateTime(data.generatedAt)} holatiga tuzilgan
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
            <p className="text-sm text-slate-600">
              {formatDate(data.date)} kuni reytingda hali video yo&apos;q.
            </p>
          </div>
        ) : data ? (
          <>
            <div
              className={cn("transition-opacity", isFetching && "opacity-60")}
              aria-busy={isFetching}
            >
              <RatingTable entries={data.items} />
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
    </div>
  );
}

function RatingSummary({ data }: { data: DailyRatingResponse }) {
  const firstDay = data.date === data.availableRange.from;
  const items = [
    { label: "Ishtirokchilar", value: formatNumber(data.summary.participants) },
    { label: "Videolar", value: formatNumber(data.summary.videos) },
    { label: "Jami ko'rishlar", value: formatNumber(data.summary.totalViews) },
    { label: "Shu kungi o'sish", value: formatSigned(data.summary.totalGrowth) },
    {
      label: "Yangi kirgan videolar",
      value: firstDay ? "—" : formatNumber(data.summary.newEntries),
    },
  ];

  return (
    <Card className="px-5 py-4">
      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {items.map((item) => (
          <div key={item.label}>
            <dt className="text-xs text-slate-500">{item.label}</dt>
            <dd className="mt-0.5 text-lg font-semibold text-slate-900">{item.value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 border-t border-slate-100 pt-3 text-xs text-slate-500">
        Har bir video alohida qator. Ishtirokchining natijasi — barcha videolari yig&apos;indisi (Foydalanuvchilar
        bo&apos;limida); g&apos;oliblar o&apos;rin bo&apos;yicha emas, random aniqlanadi.{" "}
        {firstDay
          ? "Tanlovning birinchi kuni — o'rin o'zgarishi hisoblanmaydi."
          : `O'rin o'zgarishi ${formatDate(addDays(data.date, -1))} kuniga nisbatan.`}
      </p>
    </Card>
  );
}
