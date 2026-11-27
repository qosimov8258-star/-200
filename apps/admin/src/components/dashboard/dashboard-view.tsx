"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { IosIcon } from "@/components/ui/ios-icon";
import { MoreDetails } from "@/components/ui/more-details";
import { PageHint } from "@/components/ui/page-hint";
import { getDashboardStats } from "@/lib/api";
import { errorMessage } from "@/lib/api-error";
import { todayIso } from "@/lib/dates";
import { formatDate, formatDateTime } from "@/lib/format";
import { parsePeriod, periodPhrase, periodToQuery, periodToSearch, type Period } from "@/lib/period";
import { cn } from "@/lib/utils";

import { ContestMeters, ContestTimeline } from "./contest-meters";
import { DashboardSkeleton } from "./dashboard-skeleton";
import { KpiStrip } from "./kpi-strip";
import { PeriodSelect } from "./period-select";
import { ReelsBreakdown } from "./reels-breakdown";
import { TodoList } from "./todo-list";
import { TopPerformers } from "./top-performers";
import { ViewsChart } from "./views-chart";

/**
 * Bosh sahifa. Asosiy vazifa — "Bugun nima qilish kerak" (davrga bog'liq emas). Pastda — tanlangan
 * davr bo'yicha raqamlar: 4 ta ko'rsatkich, aksiya muddati, kunlik ko'rishlar va eng ko'p ko'rilgan
 * videolar. Videolar holati va tanlov ko'rsatkichlari — "Batafsil" ichida.
 */
export function DashboardView() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const today = todayIso();
  const period = parsePeriod(searchParams);
  const query = periodToQuery(period, today);
  const phrase = periodPhrase(period);

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
          <h1 className="text-[28px] leading-tight font-semibold tracking-tight text-ink">Aksiya holati</h1>
          {data && (
            <p className="mt-1 text-sm text-muted">
              Ko&apos;rishlar oxirgi marta <span className="tabular-nums">{formatDateTime(data.dataUpdatedAt)}</span> da
              yig&apos;ildi
              <span aria-hidden> · </span>
              Davr:{" "}
              <span className="tabular-nums">
                {formatDate(data.range.from)} – {formatDate(data.range.to)}
              </span>
              {rangeAdjusted && <span className="text-[#a7650f]"> (tanlov muddatiga moslashtirildi)</span>}
            </p>
          )}
        </div>
        <PeriodSelect value={period} onChange={handlePeriodChange} today={today} minDate={data?.contest.startsOn} />
      </header>

      <PageHint>
        Aksiya qanday ketyapti — bir qarashda. «Bugun nima qilish kerak» hozirgi holatni ko&apos;rsatadi, pastdagi
        raqamlar esa yuqoridagi «Davr» tugmasida tanlangan kunlar bo&apos;yicha.
      </PageHint>

      {/* Raqamlar yuklanmasa ham ishlar ro'yxati ko'rinadi — u o'z so'rovlari bilan ishlaydi. */}
      <TodoList />

      {isPending ? (
        <DashboardSkeleton withTodo={false} />
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
        <>
          <Card className={cn("overflow-hidden transition-opacity", isFetching && "opacity-60")} aria-busy={isFetching}>
            <KpiStrip stats={data} period={period} today={today} />
            <ContestTimeline contest={data.contest} today={today} />
            <div className="grid border-t border-line lg:grid-cols-2">
              <ViewsChart daily={data.daily} />
              <div className="border-t border-line lg:border-t-0 lg:border-l">
                <TopPerformers date={data.range.to} />
              </div>
            </div>
          </Card>

          <MoreDetails
            title="Batafsil: videolar holati va tanlov ko'rsatkichlari"
            className={cn("transition-opacity", isFetching && "opacity-60")}
            contentClassName="p-0"
          >
            <div className="grid lg:grid-cols-2">
              <ReelsBreakdown stats={data} phrase={phrase} />
              <div className="border-t border-line lg:border-t-0 lg:border-l">
                <ContestMeters stats={data} phrase={phrase} />
              </div>
            </div>
          </MoreDetails>
        </>
      ) : null}
    </div>
  );
}
