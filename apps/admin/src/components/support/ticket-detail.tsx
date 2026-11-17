"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Image as ImageIcon,
  Lock,
  Send,
  UserRound,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { getSupportTicket, replyToSupportTicket, updateSupportTicketStatus } from "@/lib/api";
import { errorMessage } from "@/lib/api-error";
import { useCurrentAdmin } from "@/lib/auth-context";
import { formatDateTime, formatDayTime, formatFileSize } from "@/lib/format";
import {
  PARTICIPANT_STATUS_LABELS,
  PARTICIPANT_STATUS_TONES,
  SUPPORT_STATUS_LABELS,
  SUPPORT_STATUS_TONES,
} from "@/lib/labels";
import type { SupportMessage, SupportTicketDetail, SupportTicketStatus } from "@/lib/types";
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
        <AlertTriangle className="size-8 text-amber-500" aria-hidden />
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
// Sarlavha: mavzu, ishtirokchi, holat
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
  const [statusNotice, setStatusNotice] = useState<string | null>(null);
  const participantName = `${ticket.participant.firstName} ${ticket.participant.lastName}`;

  const statusMutation = useMutation({
    mutationFn: (status: SupportTicketStatus) => updateSupportTicketStatus(ticket.id, { status }),
    onSuccess: async (detail) => {
      await onUpdated(detail);
      setStatusNotice(`Holat "${SUPPORT_STATUS_LABELS[detail.status]}" ga o'zgartirildi.`);
    },
  });

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

        <div className="flex items-center gap-2">
          <label htmlFor="ticket-status" className="text-sm text-slate-500">
            Holat
          </label>
          <Select
            id="ticket-status"
            value={ticket.status}
            disabled={statusMutation.isPending}
            onChange={(event) => {
              setStatusNotice(null);
              statusMutation.mutate(event.target.value as SupportTicketStatus);
            }}
            className="w-40"
          >
            {STATUSES.map((status) => (
              <option key={status} value={status}>
                {SUPPORT_STATUS_LABELS[status]}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div role="status" aria-live="polite" className="text-xs">
        {statusMutation.isPending && <span className="text-slate-500">Saqlanmoqda…</span>}
        {statusMutation.isError && (
          <span className="text-red-600">{errorMessage(statusMutation.error)}</span>
        )}
        {!statusMutation.isPending && !statusMutation.isError && statusNotice && (
          <span className="text-green-700">{statusNotice}</span>
        )}
      </div>
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
// Javob yozish
// ---------------------------------------------------------------------------

function ReplyComposer({
  ticket,
  onUpdated,
}: {
  ticket: SupportTicketDetail;
  onUpdated: (detail: SupportTicketDetail) => Promise<void>;
}) {
  const [draft, setDraft] = useState("");
  const [showEmptyError, setShowEmptyError] = useState(false);

  const replyMutation = useMutation({
    mutationFn: (text: string) => replyToSupportTicket(ticket.id, { text }),
    onSuccess: async (detail) => {
      setDraft("");
      setShowEmptyError(false);
      await onUpdated(detail);
    },
  });

  const reopenMutation = useMutation({
    mutationFn: () => updateSupportTicketStatus(ticket.id, { status: "IN_PROGRESS" }),
    onSuccess: onUpdated,
  });

  if (ticket.status === "CLOSED") {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3">
        <p className="flex items-center gap-2 text-sm text-slate-500">
          <Lock className="size-4" aria-hidden />
          Murojaat yopilgan. Javob yozish uchun qayta oching.
        </p>
        <Button
          variant="secondary"
          size="sm"
          loading={reopenMutation.isPending}
          onClick={() => reopenMutation.mutate()}
        >
          Qayta ochish
        </Button>
      </div>
    );
  }

  const trimmed = draft.trim();
  const tooLong = trimmed.length > MAX_REPLY_LENGTH;

  function submit() {
    if (!trimmed) {
      setShowEmptyError(true);
      return;
    }
    if (!tooLong) {
      replyMutation.mutate(trimmed);
    }
  }

  return (
    <form
      className="space-y-2 border-t border-slate-200 p-3"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      {replyMutation.isError && (
        <p role="alert" className="flex items-center gap-1.5 text-sm text-red-600">
          <AlertCircle className="size-4 shrink-0" aria-hidden />
          {errorMessage(replyMutation.error)}
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
            submit();
          }
        }}
        placeholder="Javobingizni yozing…"
        rows={3}
        disabled={replyMutation.isPending}
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
        <Button type="submit" size="sm" loading={replyMutation.isPending} disabled={tooLong}>
          {!replyMutation.isPending && <Send className="size-4" aria-hidden />}
          Yuborish
        </Button>
      </div>
    </form>
  );
}
