"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Eye, Info, MailWarning, RotateCw, Send, XCircle } from "lucide-react";

import { IosIcon } from "@/components/ui/ios-icon";
import { Segmented } from "@/components/ui/segmented";
import { StatCard } from "@/components/dashboard/stat-card";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Pagination } from "@/components/ui/pagination";
import { SearchInput } from "@/components/ui/search-input";
import { Select } from "@/components/ui/select";
import { TableSkeleton } from "@/components/ui/table-skeleton";
import { getTelegramMessages, resendTelegramMessage, resendUnreadTelegram } from "@/lib/api";
import { errorMessage } from "@/lib/api-error";
import { formatNumber, formatPercent } from "@/lib/format";
import { TELEGRAM_KIND_LABELS, TELEGRAM_STATUS_LABELS } from "@/lib/labels";
import type {
  TelegramDeliveryStatus,
  TelegramMessageKind,
  TelegramMessageListItem,
  TelegramMessageListResponse,
} from "@/lib/types";
import { cn } from "@/lib/utils";

import { TelegramTable } from "./telegram-table";

const PAGE_SIZE = 25;
const NOTICE_TIMEOUT_MS = 5000;
/** "Yuborildi" holatidagilar bo'lsa — tasdiq kelganini ko'rish uchun ro'yxat qayta so'raladi. */
const SENT_REFRESH_MS = 4000;

type StatusFilter = TelegramDeliveryStatus | "ALL";
type KindFilter = TelegramMessageKind | "ALL";

const STATUS_TABS: StatusFilter[] = ["ALL", "UNREAD", "READ", "DELIVERED", "SENT", "FAILED"];
const KINDS = Object.keys(TELEGRAM_KIND_LABELS) as TelegramMessageKind[];

export function TelegramView() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  const status = STATUS_TABS.find((tab) => tab === searchParams.get("status")) ?? "ALL";
  const kind = KINDS.find((item) => item === searchParams.get("kind")) ?? "ALL";
  const search = (searchParams.get("q") ?? "").slice(0, 100);
  const pageParam = Number.parseInt(searchParams.get("page") ?? "", 10);
  const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;

  const query = {
    status: status === "ALL" ? undefined : status,
    kind: kind === "ALL" ? undefined : kind,
    search: search || undefined,
    page,
    pageSize: PAGE_SIZE,
  };

  const { data, error, isPending, isError, isFetching, refetch } = useQuery({
    queryKey: ["telegram-messages", query],
    queryFn: () => getTelegramMessages(query),
    placeholderData: keepPreviousData,
    refetchInterval: (current) =>
      current.state.data?.items.some((item) => item.status === "SENT") ? SENT_REFRESH_MS : false,
  });

  const [notice, setNotice] = useState<string | null>(null);
  const [confirmBulk, setConfirmBulk] = useState(false);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), NOTICE_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [notice]);

  const resendOne = useMutation({
    mutationFn: (item: TelegramMessageListItem) => resendTelegramMessage(item.id),
    onSuccess: async (_result, item) => {
      await queryClient.invalidateQueries({ queryKey: ["telegram-messages"] });
      setNotice(`${item.participant.firstName} ${item.participant.lastName}ga qayta yuborildi.`);
    },
  });

  function navigate(patch: { status?: StatusFilter; kind?: KindFilter; search?: string; page?: number }) {
    const next = { status, kind, search, page: 1, ...patch };
    const params = new URLSearchParams();
    if (next.status !== "ALL") params.set("status", next.status);
    if (next.kind !== "ALL") params.set("kind", next.kind);
    if (next.search) params.set("q", next.search);
    if (next.page > 1) params.set("page", String(next.page));
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  const unreadCount = data?.statusCounts.UNREAD ?? 0;

  return (
    <div className="space-y-4">
      <p className="flex items-start gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
        <IosIcon icon={Info} tint="blue" size={22} />
        <span>
          Telegram bot xabar o&apos;qilganini o&apos;zi bildirmaydi. Shuning uchun har bir xabar
          ostida <strong className="font-medium">&quot;✅ O&apos;qidim&quot;</strong> tugmasi bor:
          bosilsa — &quot;O&apos;qildi&quot;, yetkazilganiga 24 soatdan oshib bosilmasa —
          &quot;O&apos;qilmadi&quot;. Telegramni ulamaganlarga xabarlar faqat ilovada boradi.
        </span>
      </p>

      <div role="status" aria-live="polite">
        {notice && (
          <div className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
            <CheckCircle2 className="size-4 shrink-0" aria-hidden />
            {notice}
          </div>
        )}
        {resendOne.isError && (
          <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <AlertTriangle className="size-4 shrink-0" aria-hidden />
            {errorMessage(resendOne.error)}
          </div>
        )}
      </div>

      {data && <TelegramSummary data={data} />}

      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <SearchInput
            value={search}
            onDebouncedChange={(value) => navigate({ search: value })}
            placeholder="Ism, telefon yoki @telegram"
            label="Telegram xabarlarini qidirish"
            className="w-full sm:w-72"
          />
          <Select
            value={kind}
            onChange={(event) => navigate({ kind: event.target.value as KindFilter })}
            aria-label="Xabar turi bo'yicha filtr"
            className="w-full sm:w-56"
          >
            <option value="ALL">Barcha xabarlar</option>
            {KINDS.map((item) => (
              <option key={item} value={item}>
                {TELEGRAM_KIND_LABELS[item]}
              </option>
            ))}
          </Select>
          <Button
            variant="secondary"
            className="sm:ml-auto"
            disabled={unreadCount === 0}
            onClick={() => setConfirmBulk(true)}
          >
            <RotateCw className="size-4" aria-hidden />
            O&apos;qilmaganlarga qayta yuborish ({formatNumber(unreadCount)})
          </Button>
        </div>

        <Segmented
          label="Holat bo'yicha filtr"
          value={status}
          onChange={(value) => navigate({ status: value })}
          options={STATUS_TABS.map((tab) => ({
            value: tab,
            label: tab === "ALL" ? "Hammasi" : TELEGRAM_STATUS_LABELS[tab],
            count: data?.statusCounts[tab],
            attention: tab === "FAILED" || tab === "UNREAD",
          }))}
        />
      </div>

      <Card className="overflow-hidden">
        {isPending ? (
          <TableSkeleton rows={8} />
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
            <IosIcon icon={Send} tint="gray" size={48} />
            <p className="text-sm text-slate-600">Xabar topilmadi.</p>
          </div>
        ) : data ? (
          <>
            <div
              className={cn("transition-opacity", isFetching && !resendOne.isPending && "opacity-60")}
              aria-busy={isFetching}
            >
              <TelegramTable
                items={data.items}
                resendingId={resendOne.isPending ? (resendOne.variables?.id ?? null) : null}
                onResend={(item) => resendOne.mutate(item)}
              />
            </div>
            <div className="border-t border-slate-200 px-4 py-3">
              <Pagination
                page={data.page}
                pageSize={data.pageSize}
                total={data.total}
                onPageChange={(nextPage) => {
                  navigate({ page: nextPage });
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
              />
            </div>
          </>
        ) : null}
      </Card>

      {confirmBulk && (
        <ConfirmDialog
          title="O'qilmaganlarga qayta yuborish"
          description={
            <>
              Yetkazilganiga 24 soatdan oshgan, lekin o&apos;qilmagan{" "}
              <strong className="font-medium text-slate-900">
                {formatNumber(unreadCount)} ta xabar
              </strong>{" "}
              qayta yuboriladi
              {kind !== "ALL" ? ` (faqat "${TELEGRAM_KIND_LABELS[kind]}")` : ""}
              {search ? ` (qidiruv: "${search}")` : ""}.
            </>
          }
          confirmLabel="Qayta yuborish"
          onConfirm={async () => {
            const result = await resendUnreadTelegram({
              kind: kind === "ALL" ? undefined : kind,
              search: search || undefined,
            });
            await queryClient.invalidateQueries({ queryKey: ["telegram-messages"] });
            setNotice(`${formatNumber(result.resent)} ta xabar qayta yuborildi.`);
          }}
          onClose={() => setConfirmBulk(false)}
          onDone={() => setConfirmBulk(false)}
        />
      )}
    </div>
  );
}

function TelegramSummary({ data }: { data: TelegramMessageListResponse }) {
  const counts = data.statusCounts;
  const delivered = counts.DELIVERED + counts.READ + counts.UNREAD;
  const { linkedParticipants, totalParticipants, blockedBot } = data.summary;

  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-500">
        Telegram ulangan:{" "}
        <span className="font-medium text-slate-700 tabular-nums">
          {formatNumber(linkedParticipants)} / {formatNumber(totalParticipants)}
        </span>{" "}
        ishtirokchi
        <span aria-hidden> · </span>
        botni bloklagan: <span className="tabular-nums">{formatNumber(blockedBot)}</span>
      </p>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Yuborilgan xabarlar" value={formatNumber(counts.ALL)} icon={Send} tint="cyan">
          Yetkazilgan: {formatNumber(delivered)}
        </StatCard>
        <StatCard label="O'qildi" value={formatNumber(counts.READ)} icon={Eye} tint="green">
          {delivered > 0 ? `${formatPercent(counts.READ / delivered)} yetkazilganlardan` : "—"}
        </StatCard>
        <StatCard
          label="O'qilmadi"
          value={formatNumber(counts.UNREAD)}
          icon={MailWarning}
          tint={counts.UNREAD > 0 ? "orange" : "gray"}
        >
          24 soatdan ko&apos;p javobsiz
        </StatCard>
        <StatCard label="Yuborilmadi" value={formatNumber(counts.FAILED)} icon={XCircle} tint="red">
          Bot bloklangan yoki tarmoq xatosi
        </StatCard>
      </div>
    </div>
  );
}
