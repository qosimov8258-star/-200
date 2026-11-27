"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Image as ImageIcon,
  KeyRound,
  Lock,
  Send,
  UserRound,
} from "lucide-react";

import { IosIcon } from "@/components/ui/ios-icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { MoreDetails } from "@/components/ui/more-details";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { allowSupportWebLogin, getSupportTicket, replyToSupportTicket, updateSupportTicketStatus } from "@/lib/api";
import { errorMessage } from "@/lib/api-error";
import { useCurrentAdmin } from "@/lib/auth-context";
import { formatDateTime, formatDayTime, formatFileSize } from "@/lib/format";
import {
  PARTICIPANT_STATUS_LABELS,
  PARTICIPANT_STATUS_TONES,
  SUPPORT_STATUS_LABELS,
  SUPPORT_STATUS_TONES,
} from "@/lib/labels";
import type { SupportMessage, SupportTicketDetail, SupportTicketStatus, WebLoginState } from "@/lib/types";
import { cn } from "@/lib/utils";

const MAX_REPLY_LENGTH = 2000;
const STATUSES: SupportTicketStatus[] = ["NEW", "IN_PROGRESS", "CLOSED"];

interface TicketDetailProps {
  ticketId: string;
  /** Mobil ekranda ro'yxatga qaytish. */
  onBack: () => void;
}

export function TicketDetail({ ticketId, onBack }: TicketDetailProps) {
  const queryClient = useQueryClient();
  const queryKey = ["support-ticket", ticketId];

  const { data, error, isPending, isError, refetch } = useQuery({
    queryKey,
    queryFn: () => getSupportTicket(ticketId),
  });

  /** Javob yoki holat o'zgarsa — ro'yxat va dashboard ham yangilanadi. */
  async function applyUpdate(detail: SupportTicketDetail) {
    queryClient.setQueryData(queryKey, detail);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["support-tickets"] }),
      queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
    ]);
  }

  if (isPending) {
    return (
      <Card className="flex h-full items-center justify-center py-16">
        <Spinner label="Murojaat yuklanmoqda…" />
      </Card>
    );
  }

  if (isError || !data) {
    return (
      <Card className="flex h-full flex-col items-center justify-center gap-3 px-4 py-16 text-center">
        <IosIcon icon={AlertTriangle} tint="orange" size={48} />
        <p className="text-sm text-slate-600">{errorMessage(error)}</p>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onBack}>
            Ro&apos;yxatga qaytish
          </Button>
          <Button variant="secondary" onClick={() => refetch()}>
            Qayta urinish
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="flex h-full min-h-0 flex-col overflow-hidden">
      <TicketHeader ticket={data} onBack={onBack} onUpdated={applyUpdate} />
      <MessageThread messages={data.messages} />
      <ReplyComposer ticket={data} onUpdated={applyUpdate} />
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Sarlavha: mavzu, ishtirokchi, yopish tugmasi (holatni qo'lda tanlash — "Batafsil" ichida)
// ---------------------------------------------------------------------------

function TicketHeader({
  ticket,
  onBack,
  onUpdated,
}: {
  ticket: SupportTicketDetail;
  onBack: () => void;
  onUpdated: (detail: SupportTicketDetail) => Promise<void>;
}) {
  const admin = useCurrentAdmin();
  // Xabar qaysi holat uchun yozilgani bilan saqlanadi: holat boshqa yo'l bilan o'zgarsa
  // (masalan, "Yuborish va yopish"), eski xabar ko'rinmay qoladi.
  const [statusNotice, setStatusNotice] = useState<{ status: SupportTicketStatus; text: string } | null>(null);
  const participantName = `${ticket.participant.firstName} ${ticket.participant.lastName}`;
  const closed = ticket.status === "CLOSED";

  const statusMutation = useMutation({
    mutationFn: (status: SupportTicketStatus) => updateSupportTicketStatus(ticket.id, { status }),
    onSuccess: async (detail) => {
      await onUpdated(detail);
      setStatusNotice({
        status: detail.status,
        text:
          detail.status === "CLOSED"
            ? "Murojaat yopildi."
            : `Holat «${SUPPORT_STATUS_LABELS[detail.status]}» ga o'zgartirildi.`,
      });
    },
  });

  function changeStatus(status: SupportTicketStatus) {
    setStatusNotice(null);
    statusMutation.mutate(status);
  }

  const closing = statusMutation.isPending && statusMutation.variables === "CLOSED";
  const notice = statusNotice && statusNotice.status === ticket.status ? statusNotice.text : null;

  return (
    <div className="space-y-3 border-b border-slate-200 p-4">
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={onBack}
          className="-ml-1 rounded-md p-1 text-slate-500 hover:bg-slate-100 lg:hidden"
          aria-label="Murojaatlar ro'yxatiga qaytish"
        >
          <ArrowLeft className="size-5" aria-hidden />
        </button>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold text-slate-900">{ticket.subject}</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            {ticket.id} · {formatDateTime(ticket.createdAt)} da ochilgan
          </p>
        </div>
        <Badge tone={SUPPORT_STATUS_TONES[ticket.status]}>
          {SUPPORT_STATUS_LABELS[ticket.status]}
        </Badge>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2 text-sm">
          <UserRound className="size-4 shrink-0 text-slate-400" aria-hidden />
          <span className="font-medium text-slate-900">{participantName}</span>
          <span className="text-slate-500 tabular-nums">{ticket.participant.phone}</span>
          {ticket.participant.status !== "ACTIVE" && (
            <Badge tone={PARTICIPANT_STATUS_TONES[ticket.participant.status]}>
              {PARTICIPANT_STATUS_LABELS[ticket.participant.status]}
            </Badge>
          )}
          {admin.role === "ADMIN" && (
            <Link
              href={`/users?q=${encodeURIComponent(ticket.participant.phone.replace(/\D/g, ""))}`}
              className="text-xs text-brand-700 hover:underline"
            >
              Profil
            </Link>
          )}
        </div>

        {!closed && (
          <Button
            size="sm"
            variant="secondary"
            loading={closing}
            disabled={statusMutation.isPending}
            onClick={() => changeStatus("CLOSED")}
          >
            {!closing && <Lock className="size-4" aria-hidden />}
            Murojaatni yopish
          </Button>
        )}
      </div>

      <WebLoginRow ticket={ticket} participantName={participantName} onUpdated={onUpdated} />

      <MoreDetails title="Batafsil: holatni qo'lda o'zgartirish" contentClassName="space-y-2 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="ticket-status" className="text-sm text-slate-500">
            Holat
          </label>
          <Select
            id="ticket-status"
            value={ticket.status}
            disabled={statusMutation.isPending}
            onChange={(event) => changeStatus(event.target.value as SupportTicketStatus)}
            className="w-40"
          >
            {STATUSES.map((status) => (
              <option key={status} value={status}>
                {SUPPORT_STATUS_LABELS[status]}
              </option>
            ))}
          </Select>
        </div>
        <p className="text-xs text-slate-500">
          Odatda kerak emas: javob yuborilganda holat o&apos;zi «{SUPPORT_STATUS_LABELS.IN_PROGRESS}» bo&apos;ladi.
        </p>
      </MoreDetails>

      <div role="status" aria-live="polite" className="text-xs">
        {statusMutation.isPending && <span className="text-slate-500">Saqlanmoqda…</span>}
        {statusMutation.isError && (
          <span className="text-red-600">{errorMessage(statusMutation.error)}</span>
        )}
        {!statusMutation.isPending && !statusMutation.isError && notice && (
          <span className="text-green-700">{notice}</span>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Saytga kirish: hisobga bir marta kiriladi — qayta kirishga ruxsat shu yerdan.
// Faqat foydali bo'lganda ko'rinadi: saytga hali kirmagan ishtirokchida qator chiqmaydi.
// ---------------------------------------------------------------------------

const WEB_LOGIN_LABELS: Record<WebLoginState, string | null> = {
  NEVER: null,
  USED: "Bu ishtirokchi saytga bir marta kirgan. Yangi telefon yoki brauzerdan kira olmasa — ruxsat bering.",
  GRANTED: "Saytga qayta kirishga ruxsat berildi — ishtirokchi hali kirmadi.",
};

function WebLoginRow({
  ticket,
  participantName,
  onUpdated,
}: {
  ticket: SupportTicketDetail;
  participantName: string;
  onUpdated: (detail: SupportTicketDetail) => Promise<void>;
}) {
  const [confirming, setConfirming] = useState(false);
  const state = ticket.participant.webLogin;
  const label = WEB_LOGIN_LABELS[state];

  if (!label) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm">
      <span className="flex min-w-0 items-center gap-2 text-slate-600">
        <KeyRound className="size-4 shrink-0 text-slate-400" aria-hidden />
        {label}
      </span>
      {state === "USED" && (
        <Button size="sm" variant="secondary" onClick={() => setConfirming(true)}>
          Saytga qayta kirishga ruxsat berish
        </Button>
      )}
      {confirming && (
        <ConfirmDialog
          title="Saytga qayta kirishga ruxsat berasizmi?"
          description={
            <>
              {participantName} saytdagi hisobiga <b>bir marta</b> qayta kira oladi («Hisobim bor — kirish»).
              Yangi kirish boshqa qurilmadagi eski kirishni yopadi. Ishtirokchiga bot orqali xabar boradi.
              Murojaat egasi hisob egasi ekanini tekshirib bering.
            </>
          }
          confirmLabel="Ruxsat berish"
          onConfirm={async () => onUpdated(await allowSupportWebLogin(ticket.id))}
          onClose={() => setConfirming(false)}
          onDone={() => setConfirming(false)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Yozishma
// ---------------------------------------------------------------------------

function MessageThread({ messages }: { messages: SupportMessage[] }) {
  const admin = useCurrentAdmin();
  const threadRef = useRef<HTMLDivElement>(null);

  // Yangi xabar qo'shilganda pastga aylantiramiz.
  useEffect(() => {
    const thread = threadRef.current;
    if (thread) thread.scrollTop = thread.scrollHeight;
  }, [messages.length]);

  return (
    <div
      ref={threadRef}
      className="relative min-h-64 flex-1 overflow-y-auto bg-slate-50/60 px-4 py-4"
      aria-label="Yozishma"
      role="log"
    >
      <ol className="space-y-3">
        {messages.map((message) => {
          const staff = message.author === "STAFF";
          const authorLabel =
            staff && message.authorName === admin.fullName ? "Siz" : message.authorName;
          return (
            <li key={message.id} className={cn("flex", staff ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "max-w-[85%] rounded-lg px-3.5 py-2.5 text-sm shadow-sm",
                  staff
                    ? "bg-brand-50 text-slate-900 ring-1 ring-brand-100"
                    : "bg-white text-slate-900 ring-1 ring-slate-200",
                )}
              >
                <p className="mb-1 text-xs text-slate-500">
                  <span className="font-medium text-slate-700">{authorLabel}</span>
                  {staff && <span> (support)</span>}
                  <span aria-hidden> · </span>
                  <time dateTime={message.at}>{formatDayTime(message.at)}</time>
                </p>
                <p className="break-words whitespace-pre-wrap">{message.text}</p>
                {message.attachments.length > 0 && (
                  <ul className="mt-2 flex flex-wrap gap-2">
                    {message.attachments.map((attachment) => (
                      <li key={attachment.id}>
                        <AttachmentChip
                          fileName={attachment.fileName}
                          sizeBytes={attachment.sizeBytes}
                          url={attachment.url}
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function AttachmentChip({
  fileName,
  sizeBytes,
  url,
}: {
  fileName: string;
  sizeBytes: number;
  url: string | null;
}) {
  const content = (
    <>
      <ImageIcon className="size-4 text-slate-400" aria-hidden />
      <span className="max-w-40 truncate">{fileName}</span>
      <span className="text-slate-400">{formatFileSize(sizeBytes)}</span>
    </>
  );
  const classes =
    "inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700";

  if (!url) {
    return (
      <span className={classes} title="Mock rejimda fayl mavjud emas">
        {content}
      </span>
    );
  }

  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className={cn(classes, "hover:bg-slate-50")}>
      {content}
      <span className="sr-only">(yangi oynada)</span>
    </a>
  );
}

// ---------------------------------------------------------------------------
// Javob yozish: "Yuborish" yoki "Yuborish va yopish" (savol hal bo'lganda)
// ---------------------------------------------------------------------------

interface ReplyResult {
  detail: SupportTicketDetail;
  /** Javob yuborildi, lekin murojaat yopilmadi — sababi; yopish so'ralmagan yoki o'tgan bo'lsa — null. */
  closeError: string | null;
}

function ReplyComposer({
  ticket,
  onUpdated,
}: {
  ticket: SupportTicketDetail;
  onUpdated: (detail: SupportTicketDetail) => Promise<void>;
}) {
  const [draft, setDraft] = useState("");
  const [showEmptyError, setShowEmptyError] = useState(false);
  const [closeError, setCloseError] = useState<string | null>(null);

  const replyMutation = useMutation({
    mutationFn: async ({ text, close }: { text: string; close: boolean }): Promise<ReplyResult> => {
      const replied = await replyToSupportTicket(ticket.id, { text });
      if (!close) return { detail: replied, closeError: null };
      try {
        return { detail: await updateSupportTicketStatus(ticket.id, { status: "CLOSED" }), closeError: null };
      } catch (error) {
        // Javob allaqachon ketgan — matn tozalanadi, faqat murojaat yopilmagani aytiladi.
        return { detail: replied, closeError: errorMessage(error) };
      }
    },
    onMutate: () => setCloseError(null),
    onSuccess: async (result) => {
      setDraft("");
      setShowEmptyError(false);
      setCloseError(result.closeError);
      await onUpdated(result.detail);
    },
  });

  const reopenMutation = useMutation({
    mutationFn: () => updateSupportTicketStatus(ticket.id, { status: "IN_PROGRESS" }),
    onSuccess: async (detail) => {
      setCloseError(null);
      await onUpdated(detail);
    },
  });

  if (ticket.status === "CLOSED") {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3">
        <p className="flex items-center gap-2 text-sm text-slate-500">
          <Lock className="size-4 shrink-0" aria-hidden />
          Murojaat yopilgan. Yana yozish kerak bo&apos;lsa — «Qayta ochish» ni bosing.
        </p>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {reopenMutation.isError && (
            <p role="alert" className="flex items-center gap-1.5 text-sm text-red-600">
              <AlertCircle className="size-4 shrink-0" aria-hidden />
              {errorMessage(reopenMutation.error)}
            </p>
          )}
          <Button
            variant="secondary"
            size="sm"
            loading={reopenMutation.isPending}
            onClick={() => reopenMutation.mutate()}
          >
            Qayta ochish
          </Button>
        </div>
      </div>
    );
  }

  const trimmed = draft.trim();
  const tooLong = trimmed.length > MAX_REPLY_LENGTH;
  const sending = replyMutation.isPending;
  const sendingAndClosing = sending && replyMutation.variables?.close === true;
  const sendingOnly = sending && !sendingAndClosing;

  function submit(close: boolean) {
    if (!trimmed) {
      setShowEmptyError(true);
      return;
    }
    if (!tooLong && !sending) {
      replyMutation.mutate({ text: trimmed, close });
    }
  }

  return (
    <form
      className="space-y-2 border-t border-slate-200 p-3"
      onSubmit={(event) => {
        event.preventDefault();
        submit(false);
      }}
    >
      {replyMutation.isError && (
        <p role="alert" className="flex items-center gap-1.5 text-sm text-red-600">
          <AlertCircle className="size-4 shrink-0" aria-hidden />
          {errorMessage(replyMutation.error)}
        </p>
      )}
      {closeError && (
        <p role="alert" className="flex items-center gap-1.5 text-sm text-red-600">
          <AlertCircle className="size-4 shrink-0" aria-hidden />
          Javob yuborildi, lekin murojaat yopilmadi: {closeError}
        </p>
      )}

      <label htmlFor="reply-text" className="sr-only">
        Javob matni
      </label>
      <Textarea
        id="reply-text"
        value={draft}
        onChange={(event) => {
          setDraft(event.target.value);
          if (showEmptyError) setShowEmptyError(false);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
            event.preventDefault();
            submit(false);
          }
        }}
        placeholder="Javobingizni yozing…"
        rows={3}
        disabled={sending}
        aria-invalid={showEmptyError || tooLong || undefined}
        aria-describedby="reply-hint"
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p
          id="reply-hint"
          className={cn("text-xs", showEmptyError || tooLong ? "text-red-600" : "text-slate-500")}
        >
          {showEmptyError
            ? "Javob matnini yozing."
            : tooLong
              ? `Javob ${MAX_REPLY_LENGTH} belgidan oshmasligi kerak (${trimmed.length}).`
              : "Javob ishtirokchiga ilovada va Telegramda ko'rinadi. Ctrl+Enter — yuborish."}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            loading={sendingAndClosing}
            disabled={tooLong || sending}
            onClick={() => submit(true)}
          >
            Yuborish va yopish
          </Button>
          <Button
            type="submit"
            size="sm"
            loading={sendingOnly}
            disabled={tooLong || sending}
          >
            {!sendingOnly && <Send className="size-4" aria-hidden />}
            Yuborish
          </Button>
        </div>
      </div>
    </form>
  );
}
