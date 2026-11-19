"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ExternalLink, Image as ImageIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { getTargetCase } from "@/lib/api";
import { errorMessage } from "@/lib/api-error";
import { formatDate, formatDateTime, formatFileSize, formatSigned } from "@/lib/format";
import {
  TARGET_CASE_STATUS_LABELS,
  TARGET_CASE_STATUS_TONES,
  TARGET_METHOD_LABELS,
  TARGET_STATE_LABELS,
  TARGET_STATE_TONES,
} from "@/lib/labels";
import type { TargetAction, TargetCaseDetail, TargetCaseListItem } from "@/lib/types";
import { cn } from "@/lib/utils";

import { availableTargetActions, TARGET_ACTION_LABELS } from "./target-action-dialog";

interface TargetEvidenceDialogProps {
  item: TargetCaseListItem;
  onClose: () => void;
  /** Oynadan turib qaror qabul qilish (sabab oynasi ochiladi). */
  onAction: (item: TargetCaseListItem, action: TargetAction) => void;
}

/** TZ 6: "Target yoqqanlar" — dalil. TZ 5.2: target holati va o'zgarishlar tarixi. */
export function TargetEvidenceDialog({ item, onClose, onAction }: TargetEvidenceDialogProps) {
  const name = `${item.participant.firstName} ${item.participant.lastName}`;
  const { data, error, isPending, isError } = useQuery({
    queryKey: ["target-case", item.id],
    queryFn: () => getTargetCase(item.id),
  });
  const detail = data ?? null;
  const actions = availableTargetActions(detail ?? item);

  return (
    <Dialog open onClose={onClose} title={`Target dalili — ${name}`} className="max-w-2xl">
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
        <EvidenceBody detail={detail} />
      )}

      <div className="mt-5 flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={onClose}>
          Yopish
        </Button>
        {detail &&
          actions.map((action) => (
            <Button
              key={action}
              variant={action === "disqualify" ? "danger" : action === "warn" ? "primary" : "secondary"}
              onClick={() => onAction(detail, action)}
            >
              {TARGET_ACTION_LABELS[action]}
            </Button>
          ))}
      </div>
    </Dialog>
  );
}

function EvidenceBody({ detail }: { detail: TargetCaseDetail }) {
  return (
    <div className="space-y-5 text-sm">
      <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
        <Field label="Aniqlangan sana">{formatDate(detail.detectedOn)}</Field>
        <Field label="Aniqlash usuli">{TARGET_METHOD_LABELS[detail.method]}</Field>
        <Field label="Ko'rib chiqish holati">
          <Badge tone={TARGET_CASE_STATUS_TONES[detail.status]}>
            {TARGET_CASE_STATUS_LABELS[detail.status]}
          </Badge>
        </Field>
        <Field label="Target hozir">
          <Badge tone={TARGET_STATE_TONES[detail.currentState]}>
            {TARGET_STATE_LABELS[detail.currentState]}
          </Badge>
        </Field>
        <Field label="Reel">
          <a
            href={detail.reelUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-brand-700 hover:underline"
          >
            Instagramda ochish
            <ExternalLink className="size-3.5" aria-hidden />
          </a>
        </Field>
        <Field label="Telefon">
          <span className="tabular-nums">{detail.participant.phone}</span>
        </Field>
      </dl>

      <section>
        <h3 className="mb-1 text-xs font-medium tracking-wide text-slate-500 uppercase">Dalil</h3>
        <p className="rounded-md bg-amber-50 px-3 py-2 text-amber-900">{detail.evidence}</p>
        {detail.evidenceUrl && (
          <a
            href={detail.evidenceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex items-center gap-1 text-brand-700 hover:underline"
          >
            Reklamani kutubxonada ko&apos;rish
            <ExternalLink className="size-3.5" aria-hidden />
          </a>
        )}
        {detail.attachments.length > 0 && detail.reports.length === 0 && (
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
        )}
      </section>

      {detail.reports.length > 0 && <ReportsSection detail={detail} />}

      <section>
        <h3 className="mb-1 text-xs font-medium tracking-wide text-slate-500 uppercase">
          Kunlik ko&apos;rishlar o&apos;sishi
        </h3>
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
                    {day.flagged && <Badge tone="danger">Reklama kuni</Badge>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h3 className="mb-1 text-xs font-medium tracking-wide text-slate-500 uppercase">
          Target holati tarixi
        </h3>
        <ol className="space-y-2 border-l border-slate-200 pl-4">
          {detail.history.map((event, index) => (
            <li key={`${event.date}-${index}`} className="relative">
              <span
                className="absolute top-1.5 -left-[21px] size-2.5 rounded-full border-2 border-white bg-slate-300"
                aria-hidden
              />
              <p className="flex flex-wrap items-center gap-2">
                <span className="text-slate-500 tabular-nums">{formatDate(event.date)}</span>
                <Badge tone={TARGET_STATE_TONES[event.state]}>{TARGET_STATE_LABELS[event.state]}</Badge>
              </p>
              <p className="text-slate-700">{event.note}</p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

/** Shikoyatlar: kim, qachon, izoh va skrinshot. Shikoyatchi ishtirokchiga ko'rsatilmaydi. */
function ReportsSection({ detail }: { detail: TargetCaseDetail }) {
  return (
    <section>
      <h3 className="mb-1 text-xs font-medium tracking-wide text-slate-500 uppercase">
        Shikoyatlar ({detail.reports.length})
      </h3>
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
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-slate-900">{children}</dd>
    </div>
  );
}
