"use client";

import { AlertTriangle, Inbox } from "lucide-react";

import { IosIcon } from "@/components/ui/ios-icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Pagination } from "@/components/ui/pagination";
import { SearchInput } from "@/components/ui/search-input";
import { Segmented } from "@/components/ui/segmented";
import { formatDayTime } from "@/lib/format";
import { SUPPORT_STATUS_LABELS, SUPPORT_STATUS_TONES } from "@/lib/labels";
import type {
  SupportStatusFilter,
  SupportTicketListItem,
  SupportTicketListResponse,
} from "@/lib/types";
import { cn } from "@/lib/utils";

export type SupportListFilter = SupportStatusFilter | "ALL";

/**
 * Filtr tablari. Doim ko'rinadi: "Ochiq" (yangi + ko'rilayotgan), "Yopilgan", "Hammasi".
 * "Yangi" va "Ko'rilmoqda" — faqat URL orqali (`?status=NEW`) ochilganda tab bo'lib chiqadi;
 * ro'yxatdagi belgi baribir ularni ajratib turadi.
 */
const FILTER_TABS: Array<{ value: SupportListFilter; label: string; always: boolean }> = [
  { value: "OPEN", label: "Ochiq", always: true },
  { value: "NEW", label: SUPPORT_STATUS_LABELS.NEW, always: false },
  { value: "IN_PROGRESS", label: SUPPORT_STATUS_LABELS.IN_PROGRESS, always: false },
  { value: "CLOSED", label: "Yopilgan", always: true },
  { value: "ALL", label: "Hammasi", always: true },
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
  const tabs = FILTER_TABS.filter((tab) => tab.always || tab.value === filter);
  const emptyText = search
    ? "Qidiruv bo'yicha murojaat topilmadi."
    : filter === "OPEN"
      ? "Ochiq murojaat yo'q — hammasi yopilgan. Yangi savol kelsa, shu yerda chiqadi."
      : "Bu bo'limda murojaat yo'q.";

  return (
    <Card className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="space-y-3 border-b border-slate-200 p-3">
        <SearchInput
          value={search}
          onDebouncedChange={onSearchChange}
          placeholder="Mavzu, ism yoki telefon"
          label="Murojaatlarni qidirish"
        />
        <Segmented
          size="sm"
          label="Holat bo'yicha filtr"
          value={filter}
          onChange={onFilterChange}
          options={tabs.map((tab) => ({
            value: tab.value,
            label: tab.label,
            count: data?.statusCounts[tab.value],
            attention: tab.value === "OPEN",
          }))}
        />
      </div>

      <div className="relative min-h-0 flex-1 overflow-y-auto">
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
            <IosIcon icon={Inbox} tint="gray" size={44} />
            <p className="text-sm text-slate-500">{emptyText}</p>
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

/**
 * Ro'yxatdagi murojaat: mavzu, kim yozgan, oxirgi xabar va bitta belgi — javob kerakmi.
 * Murojaat raqami — ochilgan murojaat sarlavhasida; qidiruv uni baribir topadi.
 */
function TicketListItem({
  ticket,
  selected,
  onSelect,
}: {
  ticket: SupportTicketListItem;
  selected: boolean;
  onSelect: () => void;
}) {
  const name = `${ticket.participant.firstName} ${ticket.participant.lastName}`.trim();

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

      <p className="mt-0.5 truncate text-xs text-slate-500">{name || "Ismsiz"}</p>

      <p className="mt-1 line-clamp-2 text-sm text-slate-600">
        {/* "Siz" emas: javobni boshqa xodim yoki Telegram guruhidagi operator yozgan bo'lishi mumkin. */}
        {ticket.lastMessage.author === "STAFF" && <span className="text-slate-400">Javob: </span>}
        {ticket.lastMessage.text}
      </p>

      <div className="mt-2">
        {ticket.awaitingReply ? (
          <Badge tone="brand">Javob kutmoqda</Badge>
        ) : (
          <Badge tone={SUPPORT_STATUS_TONES[ticket.status]}>{SUPPORT_STATUS_LABELS[ticket.status]}</Badge>
        )}
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
