"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, SearchX } from "lucide-react";

import { IosIcon } from "@/components/ui/ios-icon";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Pagination } from "@/components/ui/pagination";
import { getParticipants } from "@/lib/api";
import { errorMessage } from "@/lib/api-error";
import type { ParticipantAction, ParticipantListItem, ParticipantSort } from "@/lib/types";
import {
  DEFAULT_SORT_ORDER,
  hasActiveFilters,
  parseUsersFilters,
  usersFiltersToQuery,
  usersFiltersToSearch,
  type UsersFilters,
} from "@/lib/users-filters";
import { cn } from "@/lib/utils";

import { ParticipantActionDialog } from "./participant-action-dialog";
import { UsersTable } from "./users-table";
import { TableSkeleton } from "@/components/ui/table-skeleton";
import { UsersToolbar } from "./users-toolbar";
import { ViewsRefreshDialog } from "./views-refresh-dialog";

const NOTICE_TIMEOUT_MS = 5000;

interface PendingAction {
  participant: ParticipantListItem;
  action: ParticipantAction;
}

export function UsersView() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const filters = parseUsersFilters(searchParams);
  const query = usersFiltersToQuery(filters);

  const { data, error, isPending, isError, isFetching, refetch } = useQuery({
    queryKey: ["participants", query],
    queryFn: () => getParticipants(query),
    placeholderData: keepPreviousData,
  });

  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [refreshOpen, setRefreshOpen] = useState(false);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), NOTICE_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [notice]);

  /** Filtr o'zgarsa birinchi sahifaga qaytamiz; sahifa almashganda — yo'q. */
  function updateFilters(patch: Partial<UsersFilters>) {
    const next: UsersFilters = { ...filters, page: 1, ...patch };
    const search = usersFiltersToSearch(next);
    router.replace(search ? `${pathname}?${search}` : pathname, { scroll: false });
  }

  function handleSortChange(sort: ParticipantSort) {
    const order =
      sort === filters.sort
        ? filters.order === "asc"
          ? "desc"
          : "asc"
        : DEFAULT_SORT_ORDER[sort];
    updateFilters({ sort, order });
  }

  function clearFilters() {
    updateFilters({ search: "", status: "ALL", reel: "ALL", minViews: null, maxViews: null });
  }

  return (
    <div className="space-y-4">
      <div role="status" aria-live="polite">
        {notice && (
          <div className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
            <CheckCircle2 className="size-4 shrink-0" aria-hidden />
            {notice}
          </div>
        )}
      </div>

      <UsersToolbar
        filters={filters}
        counts={data?.statusCounts}
        onSearchChange={(search) => updateFilters({ search })}
        onStatusChange={(status) => updateFilters({ status })}
        onReelChange={(reel) => updateFilters({ reel })}
        onViewsChange={({ min, max }) => updateFilters({ minViews: min, maxViews: max })}
        onRefreshViews={() => setRefreshOpen(true)}
        onClear={clearFilters}
      />

      {refreshOpen && (
        <ViewsRefreshDialog
          open
          onClose={() => setRefreshOpen(false)}
          initialMin={filters.minViews}
          initialMax={filters.maxViews}
        />
      )}

      <Card className="overflow-hidden">
        {isPending ? (
          <TableSkeleton />
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
            <IosIcon icon={SearchX} tint="gray" size={48} />
            <p className="text-sm text-slate-600">Hech kim topilmadi.</p>
            {hasActiveFilters(filters) && (
              <Button variant="secondary" size="sm" onClick={clearFilters}>
                Filtrlarni tozalash
              </Button>
            )}
          </div>
        ) : data ? (
          <>
            <div
              className={cn("transition-opacity", isFetching && "opacity-60")}
              aria-busy={isFetching}
            >
              <UsersTable
                items={data.items}
                sort={filters.sort}
                order={filters.order}
                onSortChange={handleSortChange}
                onAction={(participant, action) => setPendingAction({ participant, action })}
              />
            </div>
            <div className="border-t border-slate-200 px-4 py-3">
              <Pagination
                page={data.page}
                pageSize={data.pageSize}
                total={data.total}
                onPageChange={(page) => {
                  updateFilters({ page });
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
              />
            </div>
          </>
        ) : null}
      </Card>

      {pendingAction && (
        <ParticipantActionDialog
          key={`${pendingAction.participant.id}:${pendingAction.action}`}
          participant={pendingAction.participant}
          action={pendingAction.action}
          onClose={() => setPendingAction(null)}
          onDone={(message) => {
            setPendingAction(null);
            setNotice(message);
          }}
        />
      )}
    </div>
  );
}
