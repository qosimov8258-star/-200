"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getDashboardStats } from "@/lib/api";
import { errorMessage } from "@/lib/api-error";
import { todayIso } from "@/lib/dates";
import { formatDate, formatDateTime } from "@/lib/format";
import { parsePeriod, periodToQuery, periodToSearch, type Period } from "@/lib/period";
import { cn } from "@/lib/utils";

import { DailyGrowthChart } from "./daily-growth-chart";
import { DashboardSkeleton } from "./dashboard-skeleton";
import { PeriodFilter } from "./period-filter";
import { StatsGrid } from "./stats-grid";

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

  function handlePeriodChange(next: Period) {
    const search = periodToSearch(next);
    router.replace(search ? `${pathname}?${search}` : pathname, { scroll: false });
  }

  return (
    <div className="space-y-6">
      {/* Filtrlar — bitta qatorda, ular ta'sir qiladigan hamma narsadan yuqorida */}
      <div className="space-y-2">
        <PeriodFilter
          value={period}
          onChange={handlePeriodChange}
          today={today}
          minDate={data?.contest.startsOn}
        />
        {data && (
          <p className="text-xs text-slate-500">
            Davr:{" "}
            <span className="font-medium text-slate-700 tabular-nums">
              {formatDate(data.range.from)} – {formatDate(data.range.to)}
            </span>
            <span aria-hidden> · </span>
            Ma&apos;lumotlar {formatDateTime(data.dataUpdatedAt)} holatiga (har kuni yangilanadi)
          </p>
        )}
      </div>

      {isPending ? (
        <DashboardSkeleton />
      ) : isError && !data ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <AlertTriangle className="size-8 text-amber-500" aria-hidden />
            <p className="text-sm text-slate-600">{errorMessage(error)}</p>
            <Button variant="secondary" onClick={() => refetch()}>
              Qayta urinish
            </Button>
          </CardContent>
        </Card>
      ) : data ? (
        <div
          className={cn("space-y-6 transition-opacity", isFetching && "opacity-60")}
          aria-busy={isFetching}
        >
          <StatsGrid stats={data} period={period} today={today} />
          <DailyGrowthChart daily={data.daily} />
        </div>
      ) : null}
    </div>
  );
}
