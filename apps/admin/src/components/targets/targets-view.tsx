"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Crosshair, Info } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Pagination } from "@/components/ui/pagination";
import { SearchInput } from "@/components/ui/search-input";
import { TableSkeleton } from "@/components/ui/table-skeleton";
import { getTargetCases } from "@/lib/api";
import { errorMessage } from "@/lib/api-error";
import { formatNumber } from "@/lib/format";
import { TARGET_CASE_STATUS_LABELS } from "@/lib/labels";
import type { TargetAction, TargetCaseListItem, TargetStatusFilter } from "@/lib/types";
import { cn } from "@/lib/utils";

import { TargetActionDialog } from "./target-action-dialog";
import { TargetEvidenceDialog } from "./target-evidence-dialog";
import { TargetsTable } from "./targets-table";

type ListFilter = TargetStatusFilter | "ALL";

const PAGE_SIZE = 25;
const NOTICE_TIMEOUT_MS = 5000;
const DEFAULT_FILTER: ListFilter = "OPEN";

const FILTER_TABS: Array<{ value: ListFilter; label: string }> = [
  { value: "OPEN", label: "Ro'yxatda" },
  { value: "NEW", label: TARGET_CASE_STATUS_LABELS.NEW },
  { value: "WARNED", label: TARGET_CASE_STATUS_LABELS.WARNED },
  { value: "DISQUALIFIED", label: TARGET_CASE_STATUS_LABELS.DISQUALIFIED },
  { value: "DISMISSED", label: TARGET_CASE_STATUS_LABELS.DISMISSED },
  { value: "ALL", label: "Hammasi" },
];

type Overlay =
  | { kind: "evidence"; item: TargetCaseListItem }
  | { kind: "action"; item: TargetCaseListItem; action: TargetAction };

export function TargetsView() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const filter = FILTER_TABS.find((tab) => tab.value === searchParams.get("status"))?.value ?? DEFAULT_FILTER;
  const search = (searchParams.get("q") ?? "").slice(0, 100);
  const pageParam = Number.parseInt(searchParams.get("page") ?? "", 10);
  const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;

  const query = {
    status: filter === "ALL" ? undefined : filter,
    search: search || undefined,
    page,
    pageSize: PAGE_SIZE,
  };

  const { data, error, isPending, isError, isFetching, refetch } = useQuery({
    queryKey: ["target-cases", query],
    queryFn: () => getTargetCases(query),
    placeholderData: keepPreviousData,
  });

  const [overlay, setOverlay] = useState<Overlay | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), NOTICE_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [notice]);

  function navigate(patch: { filter?: ListFilter; search?: string; page?: number }) {
    const next = { filter, search, page: 1, ...patch };
    const params = new URLSearchParams();
    if (next.filter !== DEFAULT_FILTER) params.set("status", next.filter);
    if (next.search) params.set("q", next.search);
    if (next.page > 1) params.set("page", String(next.page));
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  return (
    <div className="space-y-4">
      <p className="flex items-start gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
        <Info className="mt-0.5 size-4 shrink-0 text-slate-400" aria-hidden />
        <span>
          AI har kuni har bir Reelni tekshiradi va signal beradi. Qarorni (ogohlantirish,
          diskvalifikatsiya yoki ro&apos;yxatdan chiqarish) faqat Admin qabul qiladi.
        </span>
      </p>

      <div role="status" aria-live="polite">
        {notice && (
          <div className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
            <CheckCircle2 className="size-4 shrink-0" aria-hidden />
            {notice}
          </div>
        )}
      </div>

      <div className="space-y-3">
        <SearchInput
          value={search}
          onDebouncedChange={(value) => navigate({ search: value })}
          placeholder="Ism, telefon yoki @instagram"
          label="Target yoqqanlarni qidirish"
          className="w-full sm:w-80"
        />
        <div role="group" aria-label="Holat bo'yicha filtr" className="flex flex-wrap gap-2">
          {FILTER_TABS.map((tab) => {
            const active = tab.value === filter;
            const count = data?.statusCounts[tab.value];
            return (
              <button
                key={tab.value}
                type="button"
                aria-pressed={active}
                onClick={() => navigate({ filter: tab.value })}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium transition-colors",
                  active
                    ? "border-brand-600 bg-brand-600 text-white"
                    : "border-slate-300 bg-white text-slate-600 hover:bg-slate-100",
                )}
              >
                {tab.label}
                {count !== undefined && (
                  <span
                    className={cn(
                      "rounded-full px-1.5 text-xs tabular-nums",
                      active ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500",
                    )}
                  >
                    {formatNumber(count)}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <Card className="overflow-hidden">
        {isPending ? (
          <TableSkeleton rows={6} />
        ) : isError && !data ? (
          <div className="flex flex-col items-center gap-3 px-4 py-12 text-center">
            <AlertTriangle className="size-8 text-amber-500" aria-hidden />
            <p className="text-sm text-slate-600">{errorMessage(error)}</p>
            <Button variant="secondary" onClick={() => refetch()}>
              Qayta urinish
            </Button>
          </div>
        ) : data && data.items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
            <Crosshair className="size-8 text-slate-300" aria-hidden />
            <p className="text-sm text-slate-600">Bu bo&apos;limda hech kim yo&apos;q.</p>
          </div>
        ) : data ? (
          <>
            <div
              className={cn("transition-opacity", isFetching && "opacity-60")}
              aria-busy={isFetching}
            >
              <TargetsTable
                items={data.items}
                onShowEvidence={(item) => setOverlay({ kind: "evidence", item })}
                onAction={(item, action) => setOverlay({ kind: "action", item, action })}
              />
            </div>
            {data.total > data.pageSize && (
              <div className="border-t border-slate-200 px-4 py-3">
                <Pagination
                  page={data.page}
                  pageSize={data.pageSize}
                  total={data.total}
                  onPageChange={(nextPage) => navigate({ page: nextPage })}
                />
              </div>
            )}
          </>
        ) : null}
      </Card>

      {overlay?.kind === "evidence" && (
        <TargetEvidenceDialog
          key={`evidence:${overlay.item.id}`}
          item={overlay.item}
          onClose={() => setOverlay(null)}
          onAction={(item, action) => setOverlay({ kind: "action", item, action })}
        />
      )}
      {overlay?.kind === "action" && (
        <TargetActionDialog
          key={`action:${overlay.item.id}:${overlay.action}`}
          item={overlay.item}
          action={overlay.action}
          onClose={() => setOverlay(null)}
          onDone={(message) => {
            setOverlay(null);
            setNotice(message);
          }}
        />
      )}
    </div>
  );
}
