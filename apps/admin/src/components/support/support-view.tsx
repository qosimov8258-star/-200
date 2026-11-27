"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { MessagesSquare } from "lucide-react";

import { IosIcon } from "@/components/ui/ios-icon";
import { Card } from "@/components/ui/card";
import { getSupportTickets } from "@/lib/api";
import { errorMessage } from "@/lib/api-error";
import { cn } from "@/lib/utils";

import { TicketDetail } from "./ticket-detail";
import { TicketList, type SupportListFilter } from "./ticket-list";

const PAGE_SIZE = 25;
const DEFAULT_FILTER: SupportListFilter = "OPEN";
/** "Yangi" va "Ko'rilmoqda" tab sifatida ko'rinmaydi, lekin URL orqali (`?status=NEW`) ochiladi. */
const FILTERS: SupportListFilter[] = ["OPEN", "NEW", "IN_PROGRESS", "CLOSED", "ALL"];

interface SupportUrlState {
  filter: SupportListFilter;
  search: string;
  page: number;
  ticket: string | null;
}

function parseState(params: Pick<URLSearchParams, "get">): SupportUrlState {
  const filter = FILTERS.find((item) => item === params.get("status")) ?? DEFAULT_FILTER;
  const page = Number.parseInt(params.get("page") ?? "", 10);
  return {
    filter,
    search: (params.get("q") ?? "").slice(0, 100),
    page: Number.isFinite(page) && page > 0 ? page : 1,
    ticket: params.get("ticket"),
  };
}

function toSearch(state: SupportUrlState): string {
  const params = new URLSearchParams();
  if (state.filter !== DEFAULT_FILTER) params.set("status", state.filter);
  if (state.search) params.set("q", state.search);
  if (state.page > 1) params.set("page", String(state.page));
  if (state.ticket) params.set("ticket", state.ticket);
  return params.toString();
}

/**
 * Support: chapda murojaatlar ro'yxati, o'ngda tanlangan murojaat yozishmasi.
 * Mobil ekranda bir vaqtda faqat bittasi ko'rinadi.
 */
export function SupportView() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const state = parseState(searchParams);

  const listQuery = {
    status: state.filter === "ALL" ? undefined : state.filter,
    search: state.search || undefined,
    page: state.page,
    pageSize: PAGE_SIZE,
  };

  const list = useQuery({
    queryKey: ["support-tickets", listQuery],
    queryFn: () => getSupportTickets(listQuery),
    placeholderData: keepPreviousData,
  });

  function navigate(patch: Partial<SupportUrlState>, mode: "push" | "replace" = "replace") {
    const search = toSearch({ ...state, ...patch });
    const url = search ? `${pathname}?${search}` : pathname;
    if (mode === "push") {
      router.push(url, { scroll: false });
    } else {
      router.replace(url, { scroll: false });
    }
  }

  return (
    <div className="gap-4 lg:grid lg:h-[calc(100dvh-7rem)] lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
      <section
        aria-label="Murojaatlar ro'yxati"
        className={cn("min-h-0 lg:flex lg:flex-col", state.ticket ? "hidden" : "flex flex-col")}
      >
        <TicketList
          filter={state.filter}
          search={state.search}
          data={list.data}
          isPending={list.isPending}
          isFetching={list.isFetching}
          error={list.isError ? errorMessage(list.error) : null}
          selectedId={state.ticket}
          onFilterChange={(filter) => navigate({ filter, page: 1 })}
          onSearchChange={(search) => navigate({ search, page: 1 })}
          onSelect={(ticket) => navigate({ ticket }, "push")}
          onPageChange={(page) => navigate({ page })}
          onRetry={() => list.refetch()}
        />
      </section>

      <section
        aria-label="Tanlangan murojaat"
        className={cn("min-h-0", state.ticket ? "block" : "hidden lg:block")}
      >
        {state.ticket ? (
          <TicketDetail
            key={state.ticket}
            ticketId={state.ticket}
            onBack={() => navigate({ ticket: null })}
          />
        ) : (
          <Card className="flex h-full flex-col items-center justify-center gap-2 px-4 py-16 text-center">
            <IosIcon icon={MessagesSquare} tint="gray" size={48} />
            <p className="max-w-md text-sm leading-relaxed text-slate-600">
              Bu yerda ishtirokchilar bot yoki sayt orqali yozgan savollar turadi. Chapdan murojaatni
              tanlang va javob yozing — javob ishtirokchiga Telegramda boradi. Savol hal bo&apos;lgach
              «Yuborish va yopish» ni bosing.
            </p>
          </Card>
        )}
      </section>
    </div>
  );
}
