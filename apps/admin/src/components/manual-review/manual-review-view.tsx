"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, ClipboardCheck } from "lucide-react";

import { IosIcon } from "@/components/ui/ios-icon";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MoreDetails } from "@/components/ui/more-details";
import { PageHint } from "@/components/ui/page-hint";
import { Pagination } from "@/components/ui/pagination";
import { SearchInput } from "@/components/ui/search-input";
import { TableSkeleton } from "@/components/ui/table-skeleton";
import { Segmented } from "@/components/ui/segmented";
import { getManualReviews } from "@/lib/api";
import { errorMessage } from "@/lib/api-error";
import type { ManualReviewItem } from "@/lib/types";
import { cn } from "@/lib/utils";

import { ParticipantReelsDialog } from "../users/participant-reels-dialog";
import { ApproveDialog, RejectDialog } from "./manual-review-dialogs";
import { ManualReviewTable, type ManualReviewListFilter } from "./manual-review-table";

const PAGE_SIZE = 25;
const NOTICE_TIMEOUT_MS = 5000;
/** Tasdiqlangan, lekin ko'rishlari hali hisoblanmagan video bor — ro'yxat shu oraliqda yangilanadi. */
const AWAITING_VIEWS_REFETCH_MS = 30_000;
const DEFAULT_FILTER: ManualReviewListFilter = "OPEN";

/**
 * Tab nomlari — faqat shu sahifada (jadvaldagi holat belgilari `MANUAL_REVIEW_STATUS_LABELS` dan
 * olinadi va o'zgarmaydi).
 */
const FILTER_TABS: Array<{ value: ManualReviewListFilter; label: string }> = [
  { value: "OPEN", label: "Kutayotganlar" },
  { value: "APPROVED", label: "Tasdiqlanganlar" },
  { value: "REJECTED", label: "Rad etilganlar" },
  { value: "ALL", label: "Hammasi" },
];

type Overlay = { kind: "approve" | "reject" | "participant"; item: ManualReviewItem };

export function ManualReviewView() {
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
    queryKey: ["manual-reviews", query],
    queryFn: () => getManualReviews(query),
    placeholderData: keepPreviousData,
    // Tasdiqdan keyin ko'rishlar bir necha soniya–daqiqada hisoblanadi — sahifani yangilamasdan ko'rinsin.
    refetchInterval: (q) =>
      q.state.data?.items.some((item) => item.status === "APPROVED" && item.lastViews === null)
        ? AWAITING_VIEWS_REFETCH_MS
        : false,
  });

  const [overlay, setOverlay] = useState<Overlay | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [opened, setOpened] = useState<ReadonlySet<string>>(() => new Set());

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), NOTICE_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [notice]);

  function navigate(patch: { filter?: ManualReviewListFilter; search?: string; page?: number }) {
    const next = { filter, search, page: 1, ...patch };
    const params = new URLSearchParams();
    if (next.filter !== DEFAULT_FILTER) params.set("status", next.filter);
    if (next.search) params.set("q", next.search);
    if (next.page > 1) params.set("page", String(next.page));
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  const emptyText = search
    ? "Qidiruv bo'yicha video topilmadi."
    : filter === "OPEN"
      ? "Hammasi tekshirildi — kutayotgan video yo'q. Yangi video tushsa, shu yerda chiqadi."
      : "Bu bo'limda video yo'q.";

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <PageHint>
          Bu yerga tizim o&apos;zi tekshira olmagan videolar tushadi. Videoni oching: video ochiq va
          unda OLIVIA mahsuloti ko&apos;rinsa — «Tasdiqlash», aks holda sababini tanlab — «Rad
          etish». Ishtirokchiga bot orqali xabar boradi.
        </PageHint>
        <MoreDetails title="Batafsil: video bu yerga qachon tushadi" contentClassName="p-3">
          <p className="text-sm text-slate-600">
            Tizim videoni ketma-ket 3 marta ocha olmasa yoki AI videoda mahsulotni aniq ko&apos;rmasa, video
            shu yerga tushadi va ishtirokchiga «videongizni administrator tekshiradi» degan xabar boradi.
            Keyinroq tizim videoni o&apos;zi topsa, holat avtomatik yopiladi.
          </p>
        </MoreDetails>
      </div>

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
          placeholder="Ism, telefon yoki video kodi"
          label="Qo'lda tekshiruvdagi videolarni qidirish"
          className="w-full sm:w-80"
        />
        <Segmented
          label="Holat bo'yicha filtr"
          value={filter}
          onChange={(value) => navigate({ filter: value })}
          options={FILTER_TABS.map((tab) => ({
            value: tab.value,
            label: tab.label,
            count: data?.statusCounts[tab.value],
            attention: tab.value === "OPEN",
          }))}
        />
      </div>

      <Card className="overflow-hidden">
        {isPending ? (
          <TableSkeleton rows={6} />
        ) : isError && !data ? (
          <div className="flex flex-col items-center gap-3 px-4 py-12 text-center">
            <IosIcon icon={AlertTriangle} tint="orange" size={48} />
            <p className="text-sm text-slate-600">{errorMessage(error)}</p>
            <Button variant="secondary" onClick={() => refetch()}>
              Qayta urinish
            </Button>
          </div>
        ) : data && data.items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
            <IosIcon icon={ClipboardCheck} tint="gray" size={48} />
            <p className="max-w-md text-sm text-slate-600">{emptyText}</p>
          </div>
        ) : data ? (
          <>
            <div className={cn("transition-opacity", isFetching && "opacity-60")} aria-busy={isFetching}>
              <ManualReviewTable
                items={data.items}
                filter={filter}
                opened={opened}
                onOpenLink={(item) => setOpened((prev) => new Set(prev).add(item.id))}
                onApprove={(item) => setOverlay({ kind: "approve", item })}
                onReject={(item) => setOverlay({ kind: "reject", item })}
                onShowParticipant={(item) => setOverlay({ kind: "participant", item })}
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

      {overlay?.kind === "approve" && (
        <ApproveDialog
          key={`approve:${overlay.item.id}`}
          item={overlay.item}
          onClose={() => setOverlay(null)}
          onDone={(message) => {
            setOverlay(null);
            setNotice(message);
          }}
        />
      )}
      {overlay?.kind === "participant" && (
        <ParticipantReelsDialog
          key={`participant:${overlay.item.id}`}
          participant={overlay.item.participant}
          highlight={overlay.item.shortcode}
          onClose={() => setOverlay(null)}
        />
      )}
      {overlay?.kind === "reject" && (
        <RejectDialog
          key={`reject:${overlay.item.id}`}
          item={overlay.item}
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
