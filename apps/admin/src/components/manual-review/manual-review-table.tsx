"use client";

import { Check, ExternalLink, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDateTime, formatNumber } from "@/lib/format";
import { MANUAL_REVIEW_AI_LABELS, MANUAL_REVIEW_KIND_LABELS, MANUAL_REVIEW_REJECT_LABELS, MANUAL_REVIEW_STATUS_LABELS, MANUAL_REVIEW_STATUS_TONES, PARTICIPANT_STATUS_LABELS, PARTICIPANT_STATUS_TONES } from "@/lib/labels";
import type { ManualReviewItem, ManualReviewStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

import { isInteractiveTarget } from "../users/users-table";

/** Sahifadagi tab: holat bo'yicha yoki hammasi. */
export type ManualReviewListFilter = ManualReviewStatus | "ALL";

interface ManualReviewTableProps {
  items: ManualReviewItem[];
  /**
   * Joriy tab: "Kutayotganlar" da "Holat" ustuni (hammasida bir xil) yashiriladi,
   * "Tasdiqlanganlar" / "Rad etilganlar" da — "Qaror" ustuni (qaror allaqachon qabul qilingan).
   */
  filter: ManualReviewListFilter;
  /** Admin shu sessiyada ochgan videolar — tasdiqlash faqat videoni ochgandan keyin. */
  opened: ReadonlySet<string>;
  onOpenLink: (item: ManualReviewItem) => void;
  onApprove: (item: ManualReviewItem) => void;
  onReject: (item: ManualReviewItem) => void;
  /** Ishtirokchi oynasini ochish: ma'lumotlari va barcha videolari ko'rishlari bilan. */
  onShowParticipant: (item: ManualReviewItem) => void;
}

export function ManualReviewTable({
  items,
  filter,
  opened,
  onOpenLink,
  onApprove,
  onReject,
  onShowParticipant,
}: ManualReviewTableProps) {
  // Tab almashganda yangi ro'yxat kelguncha eski tabning qatorlari ko'rinib turadi
  // (`keepPreviousData`) — ustunlar qatorlarga ham qarab tanlanadi, kutayotgan video tugmasiz qolmasin.
  const hasOpen = items.some((item) => item.status === "OPEN");
  const hasDecided = items.some((item) => item.status !== "OPEN");
  const showStatus = filter !== "OPEN" || hasDecided;
  const showDecision = filter === "OPEN" || filter === "ALL" || hasOpen;

  return (
    <div className="relative overflow-x-auto">
      <table className={cn("w-full text-sm", showStatus && showDecision ? "min-w-[920px]" : "min-w-[760px]")}>
        <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-500">
          <tr>
            <th scope="col" className="px-4 py-2.5 text-left font-medium">
              Ishtirokchi
            </th>
            <th scope="col" className="px-4 py-2.5 text-left font-medium">
              Video
            </th>
            <th scope="col" className="px-4 py-2.5 text-left font-medium">
              Nega tekshirish kerak
            </th>
            {showStatus && (
              <th scope="col" className="px-4 py-2.5 text-left font-medium">
                Holat
              </th>
            )}
            {showDecision && (
              <th scope="col" className="px-4 py-2.5 text-right font-medium">
                Qaror
              </th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {items.map((item) => (
            <ManualReviewRow
              key={item.id}
              item={item}
              showStatus={showStatus}
              showDecision={showDecision}
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
  showStatus,
  showDecision,
  opened,
  onOpenLink,
  onApprove,
  onReject,
  onShowParticipant,
}: {
  item: ManualReviewItem;
  showStatus: boolean;
  showDecision: boolean;
  opened: boolean;
  onOpenLink: ManualReviewTableProps["onOpenLink"];
  onApprove: ManualReviewTableProps["onApprove"];
  onReject: ManualReviewTableProps["onReject"];
  onShowParticipant: ManualReviewTableProps["onShowParticipant"];
}) {
  const name = `${item.participant.firstName} ${item.participant.lastName}`.trim();
  const decision = item.decision;
  const isOpen = item.status === "OPEN";

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
        {/* Kutayotgan videoda "Videoni ochish" — "Qaror" ustunida, qadamlar ketma-ket turadi. */}
        {!isOpen && (
          <a
            href={item.reelUrl}
            target="_blank"
            rel="noopener noreferrer"
            title={`Video kodi: ${item.shortcode}`}
            className="inline-flex items-center gap-1 font-medium whitespace-nowrap text-brand-700 hover:underline"
          >
            Videoni ochish
            <ExternalLink className="size-3.5" aria-hidden />
            <span className="sr-only">({name}, yangi oynada)</span>
          </a>
        )}
        {item.owner && <p className="text-xs whitespace-nowrap text-slate-500">@{item.owner}</p>}
        <ViewsLine item={item} />
      </td>

      <td className="max-w-80 px-4 py-3">
        <p className="text-slate-900">{MANUAL_REVIEW_KIND_LABELS[item.kind]}</p>
        {item.ai ? (
          <>
            <p
              className="text-xs text-slate-600"
              title={
                item.ai.confidence !== null ? `AI ishonchi: ${Math.round(item.ai.confidence * 100)}%` : undefined
              }
            >
              {MANUAL_REVIEW_AI_LABELS[item.ai.verdict]}
            </p>
            {item.ai.reason && (
              <p className="line-clamp-3 text-xs text-slate-500" title={item.ai.reason}>
                «{item.ai.reason}»
              </p>
            )}
          </>
        ) : (
          <p className="text-xs text-slate-500">
            {item.attempts > 0 ? `Tizim ${item.attempts} marta urinib ocha olmadi` : "Tizim videoni ocha olmadi"}
          </p>
        )}
        <p className="text-xs whitespace-nowrap text-slate-500 tabular-nums">
          {formatDateTime(item.requestedAt)}
        </p>
      </td>

      {showStatus && (
        <td className="max-w-72 px-4 py-3">
          <Badge tone={MANUAL_REVIEW_STATUS_TONES[item.status]}>{MANUAL_REVIEW_STATUS_LABELS[item.status]}</Badge>
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
      )}

      {showDecision && (
        <td className="px-4 py-3">
          {isOpen ? (
            <DecisionSteps
              item={item}
              name={name}
              opened={opened}
              onOpenLink={onOpenLink}
              onApprove={onApprove}
              onReject={onReject}
            />
          ) : (
            <span className="block text-right text-xs text-slate-400">
              —<span className="sr-only">qaror qabul qilingan</span>
            </span>
          )}
        </td>
      )}
    </tr>
  );
}

/**
 * Qaror qadamlari chapdan o'ngga: videoni ochish → rad etish yoki tasdiqlash. Tasdiqlash video
 * ochilgandan keyin yoqiladi (o'rta tugma bilan yangi tabda ochilsa ham hisoblanadi).
 */
function DecisionSteps({
  item,
  name,
  opened,
  onOpenLink,
  onApprove,
  onReject,
}: {
  item: ManualReviewItem;
  name: string;
  opened: boolean;
  onOpenLink: ManualReviewTableProps["onOpenLink"];
  onApprove: ManualReviewTableProps["onApprove"];
  onReject: ManualReviewTableProps["onReject"];
}) {
  const hintId = `open-first-${item.id}`;

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex flex-wrap justify-end gap-2">
        <a
          href={item.reelUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => onOpenLink(item)}
          onAuxClick={(event) => {
            // O'rta tugma — yangi tabda ochish.
            if (event.button === 1) onOpenLink(item);
          }}
          title={`Video kodi: ${item.shortcode}`}
          className={cn(
            "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-[10px] border px-3 text-sm font-medium whitespace-nowrap transition-colors",
            opened
              ? "border-green-200 bg-green-50 text-green-700 hover:bg-green-100"
              : "border-line bg-white text-ink hover:border-brand-200 hover:bg-brand-50/50",
          )}
        >
          {opened ? (
            <>
              Ochildi
              <Check className="size-4" aria-hidden />
            </>
          ) : (
            <>
              Videoni ochish
              <ExternalLink className="size-3.5" aria-hidden />
            </>
          )}
          <span className="sr-only">
            ({name}, {opened ? "qayta ochish, " : ""}yangi oynada)
          </span>
        </a>
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
          aria-describedby={opened ? undefined : hintId}
        >
          <Check className="size-4" aria-hidden />
          Tasdiqlash
        </Button>
      </div>
      {!opened && (
        <p id={hintId} className="text-xs text-slate-500">
          Avval videoni oching
        </p>
      )}
    </div>
  );
}

/**
 * Ko'rishlar — video katagi ostida kichik matn. Tasdiqlangan, lekin hali hisoblanmagan videoda
 * tizim ko'rishlarni qisqa vaqt ichida qayta so'raydi (2, 10, 30 daqiqa, 1, 3, 6 soat).
 */
function ViewsLine({ item }: { item: ManualReviewItem }) {
  if (item.lastViews === null) {
    return item.status === "APPROVED" ? (
      <>
        <p className="text-xs whitespace-nowrap text-slate-500">Hisoblanmoqda…</p>
        <p className="text-xs whitespace-nowrap text-slate-400">bir necha daqiqada chiqadi</p>
      </>
    ) : (
      <p className="text-xs whitespace-nowrap text-slate-400">Ko&apos;rishlar hali noma&apos;lum</p>
    );
  }
  const when = item.status === "OPEN" ? "oxirgi ma'lumi" : item.lastSyncedAt ? formatDateTime(item.lastSyncedAt) : null;
  return (
    <p className="text-xs whitespace-nowrap text-slate-500 tabular-nums">
      <span className="font-medium text-slate-700">{formatNumber(item.lastViews)} ko&apos;rish</span>
      {when && <span> · {when}</span>}
    </p>
  );
}
