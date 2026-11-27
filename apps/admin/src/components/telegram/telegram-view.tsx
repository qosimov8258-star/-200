"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, MailCheck, MailWarning, RotateCw, Send, XCircle } from "lucide-react";

import { IosIcon } from "@/components/ui/ios-icon";
import { Segmented } from "@/components/ui/segmented";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { MoreDetails } from "@/components/ui/more-details";
import { PageHint } from "@/components/ui/page-hint";
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

import { TelegramTable, telegramParticipantName } from "./telegram-table";

const PAGE_SIZE = 25;
const NOTICE_TIMEOUT_MS = 5000;
/** "Yuborildi" holatidagilar bo'lsa — tasdiq kelganini ko'rish uchun ro'yxat qayta so'raladi. */
const SENT_REFRESH_MS = 4000;

type StatusFilter = TelegramDeliveryStatus | "ALL";
type KindFilter = TelegramMessageKind | "ALL";
type NavigatePatch = { status?: StatusFilter; kind?: KindFilter; search?: string; page?: number };

/** URL orqali ochiladigan barcha holatlar (`?status=…`). */
const STATUS_TABS: StatusFilter[] = ["ALL", "UNREAD", "FAILED", "READ", "DELIVERED", "SENT"];
/**
 * Tab sifatida ko'rinadiganlari — muammolar birinchi. "Yuborildi" va "Yetkazildi" — bir necha
 * soniya–soat davom etadigan oraliq holatlar: tab emas, faqat "Batafsil" va havola orqali.
 */
const VISIBLE_TABS: StatusFilter[] = ["ALL", "UNREAD", "FAILED", "READ"];
/** Tab nomlari — faqat shu sahifada (jadvaldagi belgilar `TELEGRAM_STATUS_LABELS` dan). */
const TAB_LABELS: Record<StatusFilter, string> = {
  ALL: "Hammasi",
  UNREAD: "O'qilmagan",
  FAILED: "Yetib bormagan",
  READ: "O'qilgan",
  DELIVERED: TELEGRAM_STATUS_LABELS.DELIVERED,
  SENT: TELEGRAM_STATUS_LABELS.SENT,
};
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
      const name = telegramParticipantName(item);
      setNotice(name ? `Xabar qayta yuborildi: ${name}.` : "Xabar qayta yuborildi.");
    },
  });

  function navigate(patch: NavigatePatch) {
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
  /** Sonlar (`statusCounts`) qidiruv va tur filtriga bog'liq — holat filtriga emas. */
  const filtered = kind !== "ALL" || search !== "";
  // Oraliq holat URL orqali ochilgan bo'lsa — tanlangani ko'rinib tursin.
  const tabs = VISIBLE_TABS.includes(status) ? VISIBLE_TABS : [...VISIBLE_TABS, status];

  const emptyText = search
    ? "Qidiruv bo'yicha xabar topilmadi."
    : status === "UNREAD"
      ? "O'qilmagan xabar yo'q."
      : status === "FAILED"
        ? "Yetib bormagan xabar yo'q — hammasi joyida."
        : status === "ALL" && kind === "ALL"
          ? "Bot hali hech kimga xabar yubormagan."
          : "Bu filtr bo'yicha xabar yo'q.";

  return (
    <div className="space-y-4">
      <PageHint>
        Bu yerda bot ishtirokchilarga yuborgan xabarlar. Ishtirokchi xabar ostidagi «O&apos;qidim»
        tugmasini 24 soat ichida bosmasa — xabar «O&apos;qilmagan» bo&apos;ladi va unga qayta yuborish
        mumkin.
      </PageHint>

      {data && (
        <ResendBlock
          data={data}
          filtered={filtered}
          showFailedLink={status !== "FAILED"}
          onResendAll={() => setConfirmBulk(true)}
          onShowFailed={() => navigate({ status: "FAILED" })}
        />
      )}

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
            <option value="ALL">Xabar turi: hammasi</option>
            {KINDS.map((item) => (
              <option key={item} value={item}>
                {TELEGRAM_KIND_LABELS[item]}
              </option>
            ))}
          </Select>
        </div>

        <Segmented
          label="Holat bo'yicha filtr"
          value={status}
          onChange={(value) => navigate({ status: value })}
          options={tabs.map((tab) => ({
            value: tab,
            label: TAB_LABELS[tab],
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
            <p className="max-w-md text-sm text-slate-600">{emptyText}</p>
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
            {data.total > data.pageSize && (
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
            )}
          </>
        ) : null}
      </Card>

      {data && <TelegramStats data={data} filtered={filtered} onNavigate={navigate} />}

      {confirmBulk && (
        <ConfirmDialog
          title="O'qilmagan xabarlarni qayta yuborish"
          description={
            <>
              «O&apos;qidim» 24 soat ichida bosilmagan{" "}
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

/**
 * Sahifaning asosiy amali: o'qilmagan xabarlarni qayta yuborish. Ostida — yetib bormagan
 * xabarlar soni va ularni ko'rish havolasi.
 */
function ResendBlock({
  data,
  filtered,
  showFailedLink,
  onResendAll,
  onShowFailed,
}: {
  data: TelegramMessageListResponse;
  filtered: boolean;
  showFailedLink: boolean;
  onResendAll: () => void;
  onShowFailed: () => void;
}) {
  const unread = data.statusCounts.UNREAD;
  const failed = data.statusCounts.FAILED;

  return (
    <Card role="region" aria-labelledby="telegram-unread-title">
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <IosIcon icon={unread > 0 ? MailWarning : MailCheck} tint={unread > 0 ? "orange" : "green"} size={44} />
          <div className="min-w-0">
            <h2 id="telegram-unread-title" className="text-sm font-medium text-muted">
              O&apos;qilmagan xabarlar
              {filtered && <span className="font-normal"> (faqat joriy filtr bo&apos;yicha)</span>}
            </h2>
            <p className="text-[28px] leading-tight font-semibold tracking-tight text-ink tabular-nums">
              {formatNumber(unread)} ta
            </p>
            <p className="text-sm text-slate-600">Ishtirokchi 24 soat ichida «O&apos;qidim»ni bosmagan.</p>
          </div>
        </div>
        {unread > 0 ? (
          <Button onClick={onResendAll} className="h-11 px-5">
            <RotateCw className="size-4" aria-hidden />
            Hammasiga qayta yuborish
          </Button>
        ) : (
          <p className="text-sm text-slate-600 sm:max-w-64 sm:text-right">
            Javobsiz qolgan xabar yo&apos;q — qayta yuborish kerak emas.
          </p>
        )}
      </div>

      {failed > 0 && (
        <p className="flex flex-wrap items-center gap-x-1.5 border-t border-line px-5 py-3 text-sm text-slate-600">
          <XCircle className="size-4 shrink-0 text-red-600" aria-hidden />
          <span>
            Yetib bormagan:{" "}
            <strong className="font-semibold text-red-700 tabular-nums">{formatNumber(failed)} ta</strong>{" "}
            (botni bloklagan yoki tarmoq xatosi)
          </span>
          {showFailedLink && (
            <>
              <span aria-hidden>—</span>
              <button
                type="button"
                onClick={onShowFailed}
                className="rounded font-medium text-brand-700 hover:underline"
              >
                ko&apos;rish
                <span className="sr-only"> (yetib bormagan xabarlar)</span>
              </button>
            </>
          )}
        </p>
      )}
    </Card>
  );
}

/** "Batafsil": umumiy statistika, Telegram ulaganlar va oraliq holatlar. */
function TelegramStats({
  data,
  filtered,
  onNavigate,
}: {
  data: TelegramMessageListResponse;
  filtered: boolean;
  onNavigate: (patch: NavigatePatch) => void;
}) {
  const counts = data.statusCounts;
  const delivered = counts.DELIVERED + counts.READ + counts.UNREAD;
  const { linkedParticipants, totalParticipants, blockedBot } = data.summary;

  // Bo'lim jadval ostida — tanlangan ro'yxat ko'rinishi uchun sahifa tepasiga qaytiladi.
  function openStatus(status: TelegramDeliveryStatus) {
    onNavigate({ status });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <MoreDetails
      title="Batafsil: statistika"
      meta={`${formatNumber(linkedParticipants)} / ${formatNumber(totalParticipants)} ishtirokchi Telegram ulagan`}
    >
      <div className="space-y-4 text-sm text-slate-600">
        <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Stat label="Jami xabarlar" value={counts.ALL}>
            Yetkazilgan: {formatNumber(delivered)}
          </Stat>
          <Stat label="O'qilgan" value={counts.READ}>
            {delivered > 0 ? `${formatPercent(counts.READ / delivered)} yetkazilganlardan` : "—"}
          </Stat>
          <Stat label="O'qilmagan" value={counts.UNREAD}>
            24 soatdan ko&apos;p javobsiz
          </Stat>
          <Stat label="Yetib bormagan" value={counts.FAILED}>
            Botni bloklagan yoki tarmoq xatosi
          </Stat>
        </dl>
        {filtered && <p className="text-xs text-muted">Sonlar joriy qidiruv va xabar turi bo&apos;yicha.</p>}

        <p>
          Yo&apos;ldagi xabarlar:{" "}
          <StatusLink count={counts.SENT} onClick={() => openStatus("SENT")}>
            {TELEGRAM_STATUS_LABELS.SENT}
          </StatusLink>
          <span aria-hidden> · </span>
          <StatusLink count={counts.DELIVERED} onClick={() => openStatus("DELIVERED")}>
            {TELEGRAM_STATUS_LABELS.DELIVERED}
          </StatusLink>
          . Bu oraliq holatlar: Telegram tasdig&apos;i kelgach yoki 24 soat o&apos;tgach o&apos;zi
          o&apos;zgaradi.
        </p>

        <p>
          Telegram ulangan:{" "}
          <span className="font-medium text-slate-900 tabular-nums">
            {formatNumber(linkedParticipants)} / {formatNumber(totalParticipants)}
          </span>{" "}
          ishtirokchi
          <span aria-hidden> · </span>
          botni bloklagan: <span className="tabular-nums">{formatNumber(blockedBot)}</span>.
          Telegramni ulamaganlarga xabarlar faqat ilovada boradi.
        </p>

        <p>
          Telegram bot xabar o&apos;qilganini o&apos;zi bildirmaydi. Shuning uchun har bir xabar ostida
          «✅ O&apos;qidim» tugmasi bor: bosilsa — «{TELEGRAM_STATUS_LABELS.READ}», yetkazilganiga 24
          soatdan oshib bosilmasa — «{TELEGRAM_STATUS_LABELS.UNREAD}».
        </p>
      </div>
    </MoreDetails>
  );
}

function Stat({ label, value, children }: { label: string; value: number; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-line px-4 py-3">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="text-xl font-semibold text-ink tabular-nums">{formatNumber(value)}</dd>
      <dd className="text-xs text-muted">{children}</dd>
    </div>
  );
}

function StatusLink({
  count,
  onClick,
  children,
}: {
  count: number;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button type="button" onClick={onClick} className="rounded font-medium text-brand-700 hover:underline">
      {children} <span className="tabular-nums">({formatNumber(count)})</span>
    </button>
  );
}
