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

/** Ishtirokchi ismi: familiya endi so'ralmaydi (bo'sh bo'lishi mumkin) — ortiqcha bo'shliqsiz. */
export function telegramParticipantName(item: TelegramMessageListItem): string {
  return `${item.participant.firstName} ${item.participant.lastName}`.trim();
}

export function TelegramTable({ items, resendingId, onResend }: TelegramTableProps) {
  return (
    <div className="relative overflow-x-auto">
      <table className="w-full min-w-[760px] text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-500">
          <tr>
            <th scope="col" className="px-4 py-2.5 text-left font-medium">
              Ishtirokchi
            </th>
            <th scope="col" className="px-4 py-2.5 text-left font-medium">
              Xabar
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
  const name = telegramParticipantName(item) || "Ismsiz";

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

      {/* Holat, yuborilgan vaqt va urinishlar — bitta katakda. */}
      <td className="px-4 py-3">
        <Badge tone={TELEGRAM_STATUS_TONES[item.status]}>{TELEGRAM_STATUS_LABELS[item.status]}</Badge>
        <p className="mt-1 text-xs whitespace-nowrap text-slate-500">
          Yuborilgan:{" "}
          <time dateTime={item.lastSentAt} className="tabular-nums">
            {formatDayTime(item.lastSentAt)}
          </time>
          {item.attempts > 1 && ` · ${item.attempts}-urinish`}
        </p>
        <StatusDetail item={item} />
      </td>

      <td className="px-4 py-3 text-right">
        {item.canResend && (
          <Button variant="secondary" size="sm" loading={resending} onClick={() => onResend(item)}>
            {!resending && <RotateCw className="size-3.5" aria-hidden />}
            Qayta yuborish
            <span className="sr-only">: {name}</span>
          </Button>
        )}
      </td>
    </tr>
  );
}

/** Holat ostidagi qisqa izoh: qachon yetkazilgan/o'qilgan yoki nega yetib bormagan. */
function StatusDetail({ item }: { item: TelegramMessageListItem }) {
  const text = statusDetailText(item);
  if (!text) return null;
  return <p className="text-xs whitespace-nowrap text-slate-500">{text}</p>;
}

function statusDetailText(item: TelegramMessageListItem): string | null {
  switch (item.status) {
    case "READ":
      return item.readAt ? `O'qigan: ${formatDayTime(item.readAt)}` : null;
    case "DELIVERED":
    case "UNREAD":
      return item.deliveredAt ? `Yetkazilgan: ${formatDayTime(item.deliveredAt)}` : null;
    case "SENT":
      return "Yetib borishi kutilmoqda…";
    case "FAILED":
      if (item.failureReason === "BOT_BLOCKED") return "Botni bloklagan — yuborib bo'lmaydi";
      return item.failureReason ? TELEGRAM_FAILURE_LABELS[item.failureReason] : null;
  }
}
