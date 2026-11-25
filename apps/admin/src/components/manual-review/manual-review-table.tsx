"use client";

import { Check, ExternalLink, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDateTime, formatNumber } from "@/lib/format";
import {
  MANUAL_REVIEW_KIND_LABELS,
  MANUAL_REVIEW_REJECT_LABELS,
  MANUAL_REVIEW_STATUS_LABELS,
  MANUAL_REVIEW_STATUS_TONES,
  PARTICIPANT_STATUS_LABELS,
  PARTICIPANT_STATUS_TONES,
} from "@/lib/labels";
import type { ManualReviewItem } from "@/lib/types";

import { isInteractiveTarget } from "../users/users-table";

interface ManualReviewTableProps {
  items: ManualReviewItem[];
  /** Admin shu sessiyada ochgan linklar — tasdiqlash faqat linkni ochgandan keyin. */
  opened: ReadonlySet<string>;
  onOpenLink: (item: ManualReviewItem) => void;
  onApprove: (item: ManualReviewItem) => void;
  onReject: (item: ManualReviewItem) => void;
  /** Ishtirokchi oynasini ochish: ma'lumotlari va barcha videolari ko'rishlari bilan. */
  onShowParticipant: (item: ManualReviewItem) => void;
}

export function ManualReviewTable({
  items,
  opened,
  onOpenLink,
  onApprove,
  onReject,
  onShowParticipant,
}: ManualReviewTableProps) {
  return (
    <div className="relative overflow-x-auto">
      <table className="w-full min-w-[1000px] text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-500">
          <tr>
            <th scope="col" className="px-4 py-2.5 text-left font-medium">
              Ishtirokchi
            </th>
            <th scope="col" className="px-4 py-2.5 text-left font-medium">
              Video
            </th>
            <th
              scope="col"
              className="px-4 py-2.5 text-right font-medium"
              title="Apify o'qigan oxirgi ko'rishlar (tasdiqlangandan keyin — joriy ko'rishlar)"
            >
              Ko&apos;rishlar
            </th>
            <th scope="col" className="px-4 py-2.5 text-left font-medium">
              Nega qo&apos;lda
            </th>
            <th scope="col" className="px-4 py-2.5 text-left font-medium">
              Holat
            </th>
            <th scope="col" className="px-4 py-2.5 text-right font-medium">
              Qaror
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {items.map((item) => (
            <ManualReviewRow
              key={item.id}
              item={item}
              opened={opened.has(item.id)}
              onOpenLink={onOpenLink}
              onApprove={onApprove}
              onReject={onReject}
              onShowParticipant={onShowParticipant}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ManualReviewRow({
  item,
  opened,
  onOpenLink,
  onApprove,
  onReject,
  onShowParticipant,
}: {
  item: ManualReviewItem;
  opened: boolean;
  onOpenLink: ManualReviewTableProps["onOpenLink"];
  onApprove: ManualReviewTableProps["onApprove"];
  onReject: ManualReviewTableProps["onReject"];
  onShowParticipant: ManualReviewTableProps["onShowParticipant"];
}) {
  const name = `${item.participant.firstName} ${item.participant.lastName}`.trim();
  const decision = item.decision;

  return (
    // Sichqoncha uchun butun qator bosiladi; klaviaturada — ism tugmasi (Tab + Enter).
    <tr
      className="cursor-pointer align-top hover:bg-slate-50/70"
      onClick={(event) => {
        if (isInteractiveTarget(event.target)) return;
        if (window.getSelection()?.toString()) return;
        onShowParticipant(item);
      }}
    >
      <td className="px-4 py-3">
        <button
          type="button"
          onClick={() => onShowParticipant(item)}
          className="rounded text-left font-medium whitespace-nowrap text-slate-900 hover:text-brand-700 hover:underline"
        >
          {name || "Ismsiz"}
          <span className="sr-only"> — ma&apos;lumotlari va videolarini ko&apos;rish</span>
        </button>
        <p className="text-xs whitespace-nowrap text-slate-500 tabular-nums">{item.participant.phone}</p>
        {item.participant.status !== "ACTIVE" && (
          <Badge tone={PARTICIPANT_STATUS_TONES[item.participant.status]} className="mt-1">
            {PARTICIPANT_STATUS_LABELS[item.participant.status]}
          </Badge>
        )}
      </td>

      <td className="px-4 py-3">
        <a
          href={item.reelUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => onOpenLink(item)}
          className="inline-flex items-center gap-1 font-medium whitespace-nowrap text-brand-700 hover:underline"
        >
          Linkni ochish
          <ExternalLink className="size-3.5" aria-hidden />
          <span className="sr-only">({name}, yangi oynada)</span>
        </a>
        <p className="font-mono text-xs text-slate-500">{item.shortcode}</p>
        {item.owner && <p className="text-xs text-slate-500">@{item.owner}</p>}
      </td>

      <td className="px-4 py-3 text-right">
        <ViewsCell item={item} />
      </td>

      <td className="px-4 py-3">
        <p className="whitespace-nowrap text-slate-900">{MANUAL_REVIEW_KIND_LABELS[item.kind]}</p>
        <p className="text-xs whitespace-nowrap text-slate-500">
          Apify {item.attempts} marta topa olmadi
        </p>
        <p className="text-xs whitespace-nowrap text-slate-500 tabular-nums">
          {formatDateTime(item.requestedAt)}
        </p>
      </td>

      <td className="max-w-72 px-4 py-3">
        <Badge tone={MANUAL_REVIEW_STATUS_TONES[item.status]}>
          {MANUAL_REVIEW_STATUS_LABELS[item.status]}
        </Badge>
        {decision && (
          <div className="mt-1.5 space-y-0.5 text-xs text-slate-500">
            {decision.reason && <p className="text-slate-700">{MANUAL_REVIEW_REJECT_LABELS[decision.reason]}</p>}
            {decision.note && <p>«{decision.note}»</p>}
            <p className="tabular-nums">
              {decision.by}, {formatDateTime(decision.at)}
            </p>
          </div>
        )}
      </td>

      <td className="px-4 py-3">
        {item.status === "OPEN" ? (
          <div className="flex flex-col items-end gap-1.5">
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => onReject(item)}
                aria-label={`${name} videosini rad etish`}
              >
                <X className="size-4" aria-hidden />
                Rad etish
              </Button>
              <Button
                size="sm"
                onClick={() => onApprove(item)}
                disabled={!opened}
                aria-label={`${name} videosini tasdiqlash`}
                aria-describedby={opened ? undefined : `open-first-${item.id}`}
              >
                <Check className="size-4" aria-hidden />
                Tasdiqlash
              </Button>
            </div>
            {!opened && (
              <p id={`open-first-${item.id}`} className="text-xs text-slate-500">
                Avval linkni ochib tekshiring
              </p>
            )}
          </div>
        ) : (
          <span className="block text-right text-xs text-slate-400">—</span>
        )}
      </td>
    </tr>
  );
}

/**
 * Ko'rishlar: Apify oxirgi o'qigan son va qachon o'qilgani. Tasdiqlangan, lekin hali o'qilmagan
 * video — Apify uni qisqa vaqt ichida qayta so'raydi (2, 10, 30 daqiqa, 1, 3, 6 soat).
 */
function ViewsCell({ item }: { item: ManualReviewItem }) {
  if (item.lastViews === null) {
    return item.status === "APPROVED" ? (
      <>
        <p className="whitespace-nowrap text-slate-500">Hali o&apos;qilmagan</p>
        <p className="text-xs whitespace-nowrap text-slate-400">Apify qayta o&apos;qiydi</p>
      </>
    ) : (
      <span className="text-slate-300">
        —<span className="sr-only">ko&apos;rishlar hali o&apos;qilmagan</span>
      </span>
    );
  }
  return (
    <>
      <p className="font-semibold whitespace-nowrap text-slate-900 tabular-nums">{formatNumber(item.lastViews)}</p>
      <p className="text-xs whitespace-nowrap text-slate-500 tabular-nums">
        {item.status === "OPEN" ? "oxirgi ma'lumi" : item.lastSyncedAt ? formatDateTime(item.lastSyncedAt) : ""}
      </p>
    </>
  );
}
