"use client";

import { useState } from "react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRightLeft, Crosshair, ExternalLink } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Pagination } from "@/components/ui/pagination";
import { SearchInput } from "@/components/ui/search-input";
import { Segmented } from "@/components/ui/segmented";
import { TableSkeleton } from "@/components/ui/table-skeleton";
import { formatDate, formatNumber } from "@/lib/format";
import { TARGET_METHOD_LABELS, TARGET_STATE_LABELS, TARGET_STATE_TONES } from "@/lib/labels";
import { getOwnerTargets } from "@/lib/owner-api";
import { OWNER_STATUS_LABELS, OWNER_STATUS_TONES, OWNER_TARGET_LABELS, OWNER_TARGET_TONES } from "@/lib/owner-labels";
import type { OwnerParticipantStatus } from "@/lib/owner-types";
import type { TargetCaseListItem, TargetStatusFilter } from "@/lib/types";
import { cn } from "@/lib/utils";

import {
  EmptyState,
  ErrorState,
  formatOwnerPhone,
  NoticeBanner,
  OWNER_QUERY_KEY,
  ownerFullName,
  useNotice,
} from "./owner-common";
import { OwnerTargetDialog } from "./owner-target-dialog";

type ListFilter = TargetStatusFilter | "ALL";

const PAGE_SIZE = 25;

const FILTERS: Array<{ value: ListFilter; label: string }> = [
  { value: "ALL", label: "Hammasi" },
  { value: "OPEN", label: "Ochiq" },
  { value: "NEW", label: OWNER_TARGET_LABELS.NEW },
  { value: "WARNED", label: OWNER_TARGET_LABELS.WARNED },
  { value: "DISQUALIFIED", label: OWNER_TARGET_LABELS.DISQUALIFIED },
  { value: "DISMISSED", label: OWNER_TARGET_LABELS.DISMISSED },
];

/** Ishtirokchi holati ega ko'rinishida ("Ogohlantirilgan" alohida holat emas). */
function participantStatus(status: TargetCaseListItem["participant"]["status"]): OwnerParticipantStatus {
  return status === "WARNED" ? "ACTIVE" : status;
}

/** "Target" bo'limi: barcha holatlar; har birini istalgan holatga o'tkazish (izoh bilan). */
export function OwnerTargets() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<ListFilter>("ALL");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<TargetCaseListItem | null>(null);
  const [notice, setNotice] = useNotice();

  const query = {
    status: filter === "ALL" ? undefined : filter,
    search: search || undefined,
    page,
    pageSize: PAGE_SIZE,
  };

  const { data, error, isPending, isError, isFetching, refetch } = useQuery({
    queryKey: [OWNER_QUERY_KEY, "targets", query],
    queryFn: () => getOwnerTargets(query),
    placeholderData: keepPreviousData,
  });

  return (
    <div className="space-y-4">
      <NoticeBanner message={notice} />

      <div className="space-y-3">
        <SearchInput
          value={search}
          onDebouncedChange={(value) => {
            setSearch(value);
            setPage(1);
          }}
          placeholder="Ism, telefon yoki @instagram"
          label="Target holatlarini qidirish"
          className="w-full sm:w-80"
        />
        <Segmented
          label="Holat bo'yicha filtr"
          value={filter}
          onChange={(value) => {
            setFilter(value);
            setPage(1);
          }}
          options={FILTERS.map((item) => ({
            value: item.value,
            label: item.label,
            count: data?.statusCounts[item.value],
            attention: item.value === "NEW",
          }))}
        />
      </div>

      <Card className="overflow-hidden">
        {isPending ? (
          <TableSkeleton rows={6} />
        ) : isError && !data ? (
          <ErrorState error={error} onRetry={() => void refetch()} />
        ) : data && data.items.length === 0 ? (
          <EmptyState icon={Crosshair} text="Bu bo'limda target holati yo'q." />
        ) : data ? (
          <>
            <div className={cn("transition-opacity", isFetching && "opacity-60")} aria-busy={isFetching}>
              <TargetsTable items={data.items} onChange={setEditing} />
            </div>
            {data.total > data.pageSize && (
              <div className="border-t border-slate-200 px-4 py-3">
                <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPageChange={setPage} />
              </div>
            )}
          </>
        ) : null}
      </Card>

      {editing && (
        <OwnerTargetDialog
          key={editing.id}
          item={editing}
          onClose={() => setEditing(null)}
          onDone={(updated) => {
            setEditing(null);
            setNotice(`${ownerFullName(updated.participant)}: target holati — «${OWNER_TARGET_LABELS[updated.status]}».`);
            void queryClient.invalidateQueries({ queryKey: [OWNER_QUERY_KEY] });
          }}
        />
      )}
    </div>
  );
}

const TH = "px-4 py-2.5 text-left font-medium whitespace-nowrap";

function TargetsTable({ items, onChange }: { items: TargetCaseListItem[]; onChange: (item: TargetCaseListItem) => void }) {
  return (
    <div className="relative overflow-x-auto">
      <table className="w-full min-w-[960px] text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-500">
          <tr>
            <th scope="col" className={TH}>
              Ishtirokchi
            </th>
            <th scope="col" className={TH}>
              Reel
            </th>
            <th scope="col" className={TH}>
              Aniqlangan
            </th>
            <th scope="col" className={TH}>
              Dalil
            </th>
            <th scope="col" className={TH}>
              Holat
            </th>
            <th scope="col" className="sticky right-0 bg-slate-50 px-3 py-2.5">
              <span className="sr-only">Amallar</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {items.map((item) => (
            <TargetRow key={item.id} item={item} onChange={onChange} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TargetRow({ item, onChange }: { item: TargetCaseListItem; onChange: (item: TargetCaseListItem) => void }) {
  const name = ownerFullName(item.participant);
  const status = participantStatus(item.participant.status);

  return (
    <tr className="group align-top hover:bg-slate-50/70">
      <td className="px-4 py-3">
        <p className="font-medium whitespace-nowrap text-slate-900">{name}</p>
        <p className="text-xs whitespace-nowrap text-slate-500 tabular-nums">{formatOwnerPhone(item.participant.phone || null)}</p>
        <p className="text-xs text-slate-500">
          {item.participant.instagramUsername ? `@${item.participant.instagramUsername}` : "—"}
        </p>
        {status !== "ACTIVE" && (
          <Badge tone={OWNER_STATUS_TONES[status]} className="mt-1">
            {OWNER_STATUS_LABELS[status]}
          </Badge>
        )}
      </td>

      <td className="px-4 py-3">
        <a
          href={item.reelUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 whitespace-nowrap text-brand-700 hover:underline"
        >
          Reelni ochish
          <ExternalLink className="size-3.5" aria-hidden />
          <span className="sr-only">({name}, yangi oynada)</span>
        </a>
        <p className="text-xs whitespace-nowrap text-slate-500 tabular-nums">
          {formatNumber(item.views)} ko&apos;rish
          {item.rank !== null ? ` · ${item.rank}-o'rin` : " · reytingda yo'q"}
        </p>
      </td>

      <td className="px-4 py-3">
        <p className="whitespace-nowrap text-slate-900 tabular-nums">{formatDate(item.detectedOn)}</p>
        <p className="text-xs whitespace-nowrap text-slate-500">{TARGET_METHOD_LABELS[item.method]}</p>
      </td>

      <td className="max-w-72 px-4 py-3 text-slate-700">{item.evidence}</td>

      <td className="px-4 py-3">
        <div className="flex flex-col items-start gap-1.5">
          <Badge tone={OWNER_TARGET_TONES[item.status]}>{OWNER_TARGET_LABELS[item.status]}</Badge>
          <span className="text-xs whitespace-nowrap text-slate-500">
            Target:{" "}
            <Badge tone={TARGET_STATE_TONES[item.currentState]}>{TARGET_STATE_LABELS[item.currentState]}</Badge>
          </span>
        </div>
      </td>

      <td className="sticky right-0 bg-white px-3 py-3 text-right shadow-[-10px_0_12px_-12px_rgba(15,23,42,0.25)] group-hover:bg-slate-50">
        <Button variant="secondary" size="sm" onClick={() => onChange(item)} aria-label={`${name}: holatni o'zgartirish`}>
          <ArrowRightLeft className="size-4" aria-hidden />
          <span className="hidden sm:inline">O&apos;zgartirish</span>
        </Button>
      </td>
    </tr>
  );
}
