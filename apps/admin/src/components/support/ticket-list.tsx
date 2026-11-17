"use client";

import { AlertTriangle, Inbox } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Pagination } from "@/components/ui/pagination";
import { SearchInput } from "@/components/ui/search-input";
import { formatDayTime, formatNumber } from "@/lib/format";
import { SUPPORT_STATUS_LABELS, SUPPORT_STATUS_TONES } from "@/lib/labels";
import type {
  SupportStatusFilter,
  SupportTicketListItem,
  SupportTicketListResponse,
} from "@/lib/types";
import { cn } from "@/lib/utils";

export type SupportListFilter = SupportStatusFilter | "ALL";

const FILTER_TABS: Array<{ value: SupportListFilter; label: string }> = [
  { value: "OPEN", label: "Ochiq" },
  { value: "NEW", label: SUPPORT_STATUS_LABELS.NEW },
  { value: "IN_PROGRESS", label: SUPPORT_STATUS_LABELS.IN_PROGRESS },
  { value: "CLOSED", label: SUPPORT_STATUS_LABELS.CLOSED },
  { value: "ALL", label: "Hammasi" },
];

interface TicketListProps {
  filter: SupportListFilter;
  search: string;
  data: SupportTicketListResponse | undefined;
  isPending: boolean;
  isFetching: boolean;
  error: string | null;
  selectedId: string | null;
  onFilterChange: (filter: SupportListFilter) => void;
  onSearchChange: (search: string) => void;
  onSelect: (id: string) => void;
  onPageChange: (page: number) => void;
  onRetry: () => void;
}

export function TicketList({
  filter,
  search,
  data,
  isPending,
  isFetching,
  error,
  selectedId,
  onFilterChange,
  onSearchChange,
  onSelect,
  onPageChange,
  onRetry,
}: TicketListProps) {
  return (
    <Card className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="space-y-3 border-b border-slate-200 p-3">
        <SearchInput
          value={search}
          onDebouncedChange={onSearchChange}
          placeholder="Mavzu, ism yoki telefon"
          label="Murojaatlarni qidirish"
        />
        <div role="group" aria-label="Holat bo'yicha filtr" className="flex flex-wrap gap-1.5">
          {FILTER_TABS.map((tab) => {
            const active = tab.value === filter;
            const count = data?.statusCounts[tab.value];
            return (
              <button
                key={tab.value}
                type="button"
                aria-pressed={active}
                onClick={() => onFilterChange(tab.value)}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
                  active
                    ? "border-brand-600 bg-brand-600 text-white"
                    : "border-slate-300 bg-white text-slate-600 hover:bg-slate-100",
                )}
              >
                {tab.label}
                {count !== undefined && (
                  <span className={cn("tabular-nums", active ? "text-white/80" : "text-slate-400")}>
                    {formatNumber(count)}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {isPending ? (
          <ListSkeleton />
        ) : error && !data ? (
          <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
            <AlertTriangle className="size-7 text-amber-500" aria-hidden />
            <p className="text-sm text-slate-600">{error}</p>
            <Button variant="secondary" size="sm" onClick={onRetry}>
              Qayta urinish
            </Button>
          </div>
        ) : data && data.items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
            <Inbox className="size-7 text-slate-300" aria-hidden />
            <p className="text-sm text-slate-500">Murojaat topilmadi.</p>
          </div>
        ) : data ? (
          <ul
            className={cn("divide-y divide-slate-100 transition-opacity", isFetching && "opacity-60")}
            aria-busy={isFetching}
          >
            {data.items.map((ticket) => (
              <li key={ticket.id}>
                <TicketListItem
                  ticket={ticket}
                  selected={ticket.id === selectedId}
                  onSelect={() => onSelect(ticket.id)}
                />
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {data && data.total > data.pageSize && (
        <div className="border-t border-slate-200 px-3 py-2">
          <Pagination
            page={data.page}
            pageSize={data.pageSize}
            total={data.total}
            onPageChange={onPageChange}
          />
        </div>
      )}
    </Card>
  );
}

function TicketListItem({
  ticket,
  selected,
  onSelect,
}: {
  ticket: SupportTicketListItem;
  selected: boolean;
  onSelect: () => void;
}) {
  const name = `${ticket.participant.firstName} ${ticket.participant.lastName}`;

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={selected ? "true" : undefined}
      className={cn(
        "block w-full px-3 py-3 text-left transition-colors focus-visible:-outline-offset-2",
        selected ? "bg-brand-50" : "hover:bg-slate-50",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="flex min-w-0 items-center gap-1.5 text-sm font-medium text-slate-900">
          {ticket.awaitingReply && (
            <span className="size-2 shrink-0 rounded-full bg-brand-600" aria-hidden />
          )}
          <span className="truncate">{ticket.subject}</span>
        </p>
        <time
          dateTime={ticket.updatedAt}
          className="shrink-0 text-xs whitespace-nowrap text-slate-400 tabular-nums"
        >
          {formatDayTime(ticket.updatedAt)}
        </time>
      </div>

      <p className="mt-0.5 truncate text-xs text-slate-500">
        {name} · {ticket.id}
      </p>

      <p className="mt-1 line-clamp-2 text-sm text-slate-600">
        {ticket.lastMessage.author === "STAFF" && (
          <span className="text-slate-400">Javob: </span>
        )}
        {ticket.lastMessage.text}
      </p>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <Badge tone={SUPPORT_STATUS_TONES[ticket.status]}>
          {SUPPORT_STATUS_LABELS[ticket.status]}
        </Badge>
        {ticket.awaitingReply && <Badge tone="brand">Javob kutilmoqda</Badge>}
        <span className="text-xs text-slate-400">{formatNumber(ticket.messageCount)} ta xabar</span>
      </div>
    </button>
  );
}

function ListSkeleton() {
  return (
    <div className="divide-y divide-slate-100" aria-hidden>
      {Array.from({ length: 6 }, (_, index) => (
        <div key={index} className="space-y-2 px-3 py-3">
          <div className="h-4 w-3/4 animate-pulse rounded bg-slate-200" />
          <div className="h-3 w-1/2 animate-pulse rounded bg-slate-200" />
          <div className="h-3 w-full animate-pulse rounded bg-slate-100" />
        </div>
      ))}
    </div>
  );
}
