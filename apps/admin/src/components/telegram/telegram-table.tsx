"use client";

import { RotateCw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDayTime } from "@/lib/format";
import {
  TELEGRAM_FAILURE_LABELS,
  TELEGRAM_KIND_LABELS,
  TELEGRAM_KIND_TONES,
  TELEGRAM_STATUS_LABELS,
  TELEGRAM_STATUS_TONES,
} from "@/lib/labels";
import type { TelegramMessageListItem } from "@/lib/types";

interface TelegramTableProps {
  items: TelegramMessageListItem[];
  /** Hozir qayta yuborilayotgan xabar. */
  resendingId: string | null;
  onResend: (item: TelegramMessageListItem) => void;
}

export function TelegramTable({ items, resendingId, onResend }: TelegramTableProps) {
  return (
    <div className="relative overflow-x-auto">
      <table className="w-full min-w-[900px] text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-500">
          <tr>
            <th scope="col" className="px-4 py-2.5 text-left font-medium">
              Ishtirokchi
            </th>
            <th scope="col" className="px-4 py-2.5 text-left font-medium">
              Xabar
            </th>
            <th scope="col" className="px-4 py-2.5 text-left font-medium">
              Yuborilgan
            </th>
            <th scope="col" className="px-4 py-2.5 text-left font-medium">
              Holat
            </th>
            <th scope="col" className="w-40 px-4 py-2.5">
              <span className="sr-only">Amal</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {items.map((item) => (
            <TelegramRow
              key={item.id}
              item={item}
              resending={resendingId === item.id}
              onResend={onResend}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TelegramRow({
  item,
  resending,
  onResend,
}: {
  item: TelegramMessageListItem;
  resending: boolean;
  onResend: TelegramTableProps["onResend"];
}) {
  const name = `${item.participant.firstName} ${item.participant.lastName}`;

  return (
    <tr className="align-top hover:bg-slate-50/70">
      <td className="px-4 py-3">
        <p className="font-medium whitespace-nowrap text-slate-900">{name}</p>
        <p className="text-xs whitespace-nowrap text-slate-500">
          {item.participant.telegramUsername
            ? `@${item.participant.telegramUsername}`
            : item.participant.phone}
        </p>
      </td>

      <td className="max-w-md px-4 py-3">
        <Badge tone={TELEGRAM_KIND_TONES[item.kind]}>{TELEGRAM_KIND_LABELS[item.kind]}</Badge>
        <p className="mt-1 text-slate-700">{item.text}</p>
      </td>

      <td className="px-4 py-3 whitespace-nowrap">
        <time dateTime={item.lastSentAt} className="text-slate-900 tabular-nums">
          {formatDayTime(item.lastSentAt)}
        </time>
        {item.attempts > 1 && (
          <p className="text-xs text-slate-500">{item.attempts}-urinish</p>
        )}
      </td>

      <td className="px-4 py-3">
        <Badge tone={TELEGRAM_STATUS_TONES[item.status]}>{TELEGRAM_STATUS_LABELS[item.status]}</Badge>
        <p className="mt-1 text-xs whitespace-nowrap text-slate-500">
          <StatusDetail item={item} />
        </p>
      </td>

      <td className="px-4 py-3 text-right">
        {item.canResend ? (
          <Button
            variant="secondary"
            size="sm"
            loading={resending}
            onClick={() => onResend(item)}
            aria-label={`${name}ga qayta yuborish`}
          >
            {!resending && <RotateCw className="size-3.5" aria-hidden />}
            Qayta yuborish
          </Button>
        ) : item.failureReason === "BOT_BLOCKED" ? (
          <span className="text-xs text-slate-400">Qayta yuborib bo&apos;lmaydi</span>
        ) : null}
      </td>
    </tr>
  );
}

function StatusDetail({ item }: { item: TelegramMessageListItem }) {
  switch (item.status) {
    case "READ":
      return item.readAt ? <>&quot;O&apos;qidim&quot; bosilgan: {formatDayTime(item.readAt)}</> : null;
    case "DELIVERED":
    case "UNREAD":
      return item.deliveredAt ? <>Yetkazilgan: {formatDayTime(item.deliveredAt)}</> : null;
    case "SENT":
      return <>Telegram tasdig&apos;i kutilmoqda…</>;
    case "FAILED":
      return item.failureReason ? <>{TELEGRAM_FAILURE_LABELS[item.failureReason]}</> : null;
  }
}
