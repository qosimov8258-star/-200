"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { IosIcon } from "@/components/ui/ios-icon";
import { getDashboardStats } from "@/lib/api";
import { errorMessage } from "@/lib/api-error";
import { todayIso } from "@/lib/dates";
import { formatDate, formatDateTime } from "@/lib/format";
import { parsePeriod, periodPhrase, periodToQuery, periodToSearch, type Period } from "@/lib/period";
import { cn } from "@/lib/utils";

import { ContestMeters } from "./contest-meters";
import { DashboardSkeleton } from "./dashboard-skeleton";
import { KpiStrip } from "./kpi-strip";
import { PeriodSelect } from "./period-select";
import { ReelsBreakdown } from "./reels-breakdown";
import { TopPerformers } from "./top-performers";
import { ViewsChart } from "./views-chart";

/** Boshqaruv paneli — CareOps "Operations dashboard" uslubida. */
export function DashboardView() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const today = todayIso();
  const period = parsePeriod(searchParams);
  const query = periodToQuery(period, today);

  const { data, error, isPending, isError, isFetching, refetch } = useQuery({
    queryKey: ["dashboard", query.from ?? "start", query.to ?? "today"],
    queryFn: () => getDashboardStats(query),
    // Davr almashganda eski raqamlar xira holda qoladi — sakrash va "skelet" bo'lmaydi.
    placeholderData: keepPreviousData,
  });

  // So'ralgan davr tanlov muddatidan chiqib ketgan bo'lsa, backend uni qisadi — buni ko'rsatamiz.
  const rangeAdjusted =
    data !== undefined &&
    ((query.from !== undefined && data.range.from !== query.from) ||
      (query.to !== undefined && data.range.to !== query.to));

  function handlePeriodChange(next: Period) {
    const search = periodToSearch(next);
    router.replace(search ? `${pathname}?${search}` : pathname, { scroll: false });
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[28px] leading-tight font-semibold tracking-tight text-ink">Boshqaruv paneli</h1>
          {data && (
            <p className="mt-1 text-sm text-muted">
              <span className="tabular-nums">
                {formatDate(data.range.from)} – {formatDate(data.range.to)}
              </span>
              {rangeAdjusted && <span className="text-[#a7650f]"> (tanlov muddatiga moslashtirildi)</span>}
              <span aria-hidden> · </span>
              ma&apos;lumotlar {formatDateTime(data.dataUpdatedAt)} holatiga
            </p>
          )}
        </div>
        <PeriodSelect value={period} onChange={handlePeriodChange} today={today} minDate={data?.contest.startsOn} />
      </header>

      {isPending ? (
        <DashboardSkeleton />
      ) : isError && !data ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <IosIcon icon={AlertTriangle} tint="orange" size={48} />
            <p className="text-sm text-muted">{errorMessage(error)}</p>
            <Button variant="secondary" onClick={() => refetch()}>
              Qayta urinish
            </Button>
          </CardContent>
        </Card>
      ) : data ? (
        <Card className={cn("overflow-hidden transition-opacity", isFetching && "opacity-60")} aria-busy={isFetching}>
          <KpiStrip stats={data} period={period} today={today} />
          <div className="grid border-t border-line lg:grid-cols-2">
            <ViewsChart daily={data.daily} />
            <div className="border-t border-line lg:border-t-0 lg:border-l">
              <TopPerformers stats={data} phrase={periodPhrase(period)} />
            </div>
            <div className="border-t border-line">
              <ReelsBreakdown stats={data} phrase={periodPhrase(period)} />
            </div>
            <div className="border-t border-line lg:border-l">
              <ContestMeters stats={data} today={today} />
            </div>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
