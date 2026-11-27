"use client";

import { useId } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ExternalLink, Image as ImageIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { MoreDetails } from "@/components/ui/more-details";
import { Spinner } from "@/components/ui/spinner";
import { getTargetCase } from "@/lib/api";
import { errorMessage } from "@/lib/api-error";
import { formatDate, formatDateTime, formatFileSize, formatNumber, formatSigned } from "@/lib/format";
import { TARGET_CASE_STATUS_LABELS, TARGET_CASE_STATUS_TONES, TARGET_METHOD_LABELS, TARGET_STATE_TONES } from "@/lib/labels";
import type { TargetAction, TargetCaseDetail, TargetCaseListItem } from "@/lib/types";
import { cn } from "@/lib/utils";

import {
  availableTargetActions,
  TARGET_ACTION_CONSEQUENCES,
  TARGET_ACTION_LABELS,
  targetParticipantName,
} from "./target-action-dialog";
import { AD_STATE_TEXT } from "./target-labels";

interface TargetEvidenceDialogProps {
  item: TargetCaseListItem;
  onClose: () => void;
  /** Oynadan turib qaror qabul qilish (sabab oynasi ochiladi). */
  onAction: (item: TargetCaseListItem, action: TargetAction) => void;
}

const SECTION_TITLE = "mb-2 text-xs font-medium tracking-wide text-slate-500 uppercase";

/**
 * TZ 6: "Target yoqqanlar" — dalil va qaror. Tartib: nima topildi → qaror (har tugma yonida
 * oqibati) → "Batafsil": kunlik ko'rishlar va reklama holati tarixi (TZ 5.2).
 */
export function TargetEvidenceDialog({ item, onClose, onAction }: TargetEvidenceDialogProps) {
  const name = targetParticipantName(item) || "Ismsiz";
  const { data, error, isPending, isError } = useQuery({
    queryKey: ["target-case", item.id],
    queryFn: () => getTargetCase(item.id),
  });
  const detail = data ?? null;

  return (
    <Dialog open onClose={onClose} title={`${name} — reklama shubhasi`} className="max-w-2xl">
      {isPending ? (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      ) : isError || !detail ? (
        <p className="flex items-center gap-2 py-6 text-sm text-slate-600">
          <AlertTriangle className="size-5 text-amber-500" aria-hidden />
          {errorMessage(error)}
        </p>
      ) : (
        <div className="space-y-6 text-sm">
          <Findings detail={detail} />
          <Decision detail={detail} onAction={onAction} />
          <History detail={detail} />
        </div>
      )}

      <div className="mt-5 flex justify-end border-t border-slate-100 pt-4">
        <Button variant="secondary" onClick={onClose}>
          Yopish
        </Button>
      </div>
    </Dialog>
  );
}

/** 1. Nima topildi: dalil, kutubxona havolasi yoki skrinshotlar, shikoyatlar, video va telefon. */
function Findings({ detail }: { detail: TargetCaseDetail }) {
  const titleId = useId();

  return (
    <section aria-labelledby={titleId}>
      <h3 id={titleId} className={SECTION_TITLE}>
        Nima topildi
      </h3>
      <p className="rounded-md bg-amber-50 px-3 py-2 text-amber-900">{detail.evidence}</p>
      <p className="mt-1.5 text-xs text-slate-500">
        {TARGET_METHOD_LABELS[detail.method]}
        <span aria-hidden> · </span>
        <span className="tabular-nums">{formatDate(detail.detectedOn)}</span>
      </p>

      {detail.evidenceUrl && (
        <a
          href={detail.evidenceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-flex items-center gap-1 text-brand-700 hover:underline"
        >
          Reklamani kutubxonada ko&apos;rish
          <ExternalLink className="size-3.5" aria-hidden />
          <span className="sr-only">(yangi oynada)</span>
        </a>
      )}

      {detail.attachments.length > 0 && detail.reports.length === 0 && <Attachments detail={detail} />}
      {detail.reports.length > 0 && <Reports detail={detail} />}

      <p className="mt-3 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-slate-600">
        <a
          href={detail.reelUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 font-medium text-brand-700 hover:underline"
        >
          Videoni ochish
          <ExternalLink className="size-3.5" aria-hidden />
          <span className="sr-only">(yangi oynada)</span>
        </a>
        <span aria-hidden>·</span>
        <span className="tabular-nums">{formatNumber(detail.views)} ko&apos;rish</span>
        <span aria-hidden>·</span>
        <span>{detail.rank !== null ? `${detail.rank}-o'rin` : "reytingda yo'q"}</span>
        <span aria-hidden>·</span>
        <span>
          Telefon: <span className="tabular-nums">{detail.participant.phone}</span>
        </span>
      </p>
    </section>
  );
}

/** Dalil fayllari (shikoyatsiz holatlarda — masalan, reklama kabineti skrinshoti). */
function Attachments({ detail }: { detail: TargetCaseDetail }) {
  return (
    <ul className="mt-2 flex flex-wrap gap-2">
      {detail.attachments.map((attachment) => {
        const content = (
          <>
            <ImageIcon className="size-4 text-slate-400" aria-hidden />
            {attachment.fileName}
            <span className="text-slate-400">{formatFileSize(attachment.sizeBytes)}</span>
          </>
        );
        const classes =
          "inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-700";
        return (
          <li key={attachment.id}>
            {/* `url` — backenddagi nisbiy yo'l, sessiya cookie'si bilan ochiladi. */}
            {attachment.url ? (
              <a
                href={attachment.url}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(classes, "hover:bg-slate-50")}
              >
                {content}
                <span className="sr-only">(yangi oynada)</span>
              </a>
            ) : (
              <span className={classes} title="Mock rejimda fayl mavjud emas">
                {content}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** Shikoyatlar: kim, qachon, izoh va skrinshot. Shikoyatchi ishtirokchiga ko'rsatilmaydi. */
function Reports({ detail }: { detail: TargetCaseDetail }) {
  return (
    <div className="mt-3">
      <h4 className="mb-1 text-xs font-medium text-slate-500">Shikoyatlar ({detail.reports.length})</h4>
      <ul className="divide-y divide-slate-100 rounded-md border border-slate-200">
        {detail.reports.map((report) => {
          const file = detail.attachments.find((attachment) => attachment.id === report.attachmentId);
          return (
            <li key={report.id} className="flex gap-3 px-3 py-2.5">
              {/* `url` — backenddagi nisbiy yo'l (`/api/v1/admin/targets/:id/attachments/:attachmentId`),
                  rasm sessiya cookie'si bilan yuklanadi — Authorization sarlavhasi kerak emas. */}
              {file?.url ? (
                <a href={file.url} target="_blank" rel="noopener noreferrer" className="shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={file.url} alt={file.fileName} className="h-16 w-11 rounded object-cover object-top" />
                </a>
              ) : (
                <span
                  className="grid h-16 w-11 shrink-0 place-items-center rounded bg-slate-100 text-slate-400"
                  title="Mock rejimda fayl mavjud emas"
                >
                  <ImageIcon className="size-4" aria-hidden />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-slate-900">
                  <span className="font-medium">{report.reporter.fullName}</span>
                  {report.reporter.phone && (
                    <span className="ml-2 text-slate-500 tabular-nums">{report.reporter.phone}</span>
                  )}
                </p>
                <p className="text-xs text-slate-500">
                  {formatDateTime(report.at)}
                  {file && ` · ${file.fileName}, ${formatFileSize(file.sizeBytes)}`}
                </p>
                {report.comment && <p className="mt-1 text-slate-700">«{report.comment}»</p>}
              </div>
            </li>
          );
        })}
      </ul>
      <p className="mt-1.5 text-xs text-slate-500">Shikoyatchilar ishtirokchiga ko&apos;rsatilmaydi.</p>
    </div>
  );
}

/** 2. Qaror: har bir tugma yonida — oqibati. Qaror berilgan bo'lsa — hozirgi holat. */
function Decision({
  detail,
  onAction,
}: {
  detail: TargetCaseDetail;
  onAction: TargetEvidenceDialogProps["onAction"];
}) {
  const titleId = useId();
  const baseId = useId();
  const actions = availableTargetActions(detail);
  const status = (
    <Badge tone={TARGET_CASE_STATUS_TONES[detail.status]}>{TARGET_CASE_STATUS_LABELS[detail.status]}</Badge>
  );

  return (
    <section aria-labelledby={titleId}>
      <h3 id={titleId} className={SECTION_TITLE}>
        Qaror
      </h3>
      {actions.length === 0 ? (
        <p className="flex flex-wrap items-center gap-2 text-slate-600">Qaror qabul qilingan: {status}</p>
      ) : (
        <>
          {detail.status !== "NEW" && (
            <p className="mb-2 flex flex-wrap items-center gap-2 text-slate-600">Hozirgi holat: {status}</p>
          )}
          <ul className="space-y-2">
            {actions.map((action) => {
              const hintId = `${baseId}-${action}`;
              return (
                <li
                  key={action}
                  className="flex flex-col gap-2 rounded-xl border border-line p-3 sm:flex-row sm:items-center sm:gap-4"
                >
                  <Button
                    variant={action === "disqualify" ? "danger" : action === "warn" ? "primary" : "secondary"}
                    className="sm:w-52"
                    aria-describedby={hintId}
                    onClick={() => onAction(detail, action)}
                  >
                    {TARGET_ACTION_LABELS[action]}
                  </Button>
                  <p id={hintId} className="text-slate-600">
                    {TARGET_ACTION_CONSEQUENCES[action]}
                  </p>
                </li>
              );
            })}
          </ul>
          <p className="mt-2 text-xs text-slate-500">
            Tizim o&apos;zi hech kimni chetlatmaydi — qarorni faqat siz qabul qilasiz. Qaror sababi
            «Amallar tarixi»ga yoziladi.
          </p>
        </>
      )}
    </section>
  );
}

/** 3. Batafsil: reklama holati, kunlik ko'rishlar o'sishi va reklama holati tarixi (TZ 5.2). */
function History({ detail }: { detail: TargetCaseDetail }) {
  return (
    <MoreDetails
      title="Batafsil: kunlik ko'rishlar va reklama tarixi"
      meta={`Reklama hozir: ${AD_STATE_TEXT[detail.currentState]}`}
      contentClassName="space-y-5"
    >
      <p className="flex flex-wrap items-center gap-2 text-slate-600">
        Oxirgi tekshiruvda reklama:
        <Badge tone={TARGET_STATE_TONES[detail.currentState]}>{AD_STATE_TEXT[detail.currentState]}</Badge>
      </p>

      <section>
        <h4 className={SECTION_TITLE}>Kunlik ko&apos;rishlar o&apos;sishi</h4>
        {detail.dailyGrowth.length === 0 ? (
          <p className="text-slate-500">Ma&apos;lumot yo&apos;q.</p>
        ) : (
          <div className="relative max-h-56 overflow-y-auto rounded-md border border-slate-200">
            <table className="w-full text-sm">
              <caption className="sr-only">Aniqlangan kun atrofidagi kunlik ko&apos;rishlar o&apos;sishi</caption>
              <thead className="sticky top-0 bg-slate-50 text-xs text-slate-500">
                <tr>
                  <th scope="col" className="px-3 py-1.5 text-left font-medium">
                    Sana
                  </th>
                  <th scope="col" className="px-3 py-1.5 text-right font-medium">
                    Yangi ko&apos;rishlar
                  </th>
                  <th scope="col" className="px-3 py-1.5 text-left font-medium">
                    <span className="sr-only">Belgi</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {detail.dailyGrowth.map((day) => (
                  <tr key={day.date} className={cn(day.flagged && "bg-red-50/70")}>
                    <td className="px-3 py-1.5 tabular-nums">{formatDate(day.date)}</td>
                    <td
                      className={cn(
                        "px-3 py-1.5 text-right tabular-nums",
                        day.flagged && "font-semibold text-red-800",
                      )}
                    >
                      {formatSigned(day.viewsGrowth)}
                    </td>
                    <td className="px-3 py-1.5">
                      {day.flagged && <Badge tone="danger">Shubhali kun</Badge>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h4 className={SECTION_TITLE}>Reklama holati tarixi</h4>
        {detail.history.length === 0 ? (
          <p className="text-slate-500">Ma&apos;lumot yo&apos;q.</p>
        ) : (
          <ol className="space-y-2 border-l border-slate-200 pl-4">
            {detail.history.map((event, index) => (
              <li key={`${event.date}-${index}`} className="relative">
                <span
                  className="absolute top-1.5 -left-[21px] size-2.5 rounded-full border-2 border-white bg-slate-300"
                  aria-hidden
                />
                <p className="flex flex-wrap items-center gap-2">
                  <span className="text-slate-500 tabular-nums">{formatDate(event.date)}</span>
                  <Badge tone={TARGET_STATE_TONES[event.state]}>Reklama {AD_STATE_TEXT[event.state]}</Badge>
                </p>
                <p className="text-slate-700">{event.note}</p>
              </li>
            ))}
          </ol>
        )}
      </section>
    </MoreDetails>
  );
}
