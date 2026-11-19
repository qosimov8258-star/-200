"use client";

import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowRightLeft,
  Ban,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  Fingerprint,
  KeyRound,
  Send,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { ReasonDialog } from "@/components/ui/reason-dialog";
import { cancelDraw, confirmDraw, replaceDrawWinner, sendDraw } from "@/lib/api";
import { errorMessage } from "@/lib/api-error";
import { periodLabel, renderDrawMessage, stageLabel } from "@/lib/draw-rules";
import { formatDate, formatDateTime, formatNumber } from "@/lib/format";
import {
  DRAW_DATE_BASIS_LABELS,
  DRAW_NOTIFY_LABELS,
  DRAW_NOTIFY_TONES,
  DRAW_STATUS_LABELS,
  DRAW_STATUS_TONES,
} from "@/lib/labels";
import type { DrawCandidate, DrawEntry, DrawStatus, VoucherDraw } from "@/lib/types";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 50;

type Tab = "winners" | "reserves" | "replaced";
type DialogState =
  | { type: "replace"; entry: DrawEntry }
  | { type: "confirm" }
  | { type: "cancel" }
  | { type: "send"; count: number }
  | null;

const STEPS: Array<{ status: DrawStatus; label: string }> = [
  { status: "DRAFT", label: "Tanlov o'tkazildi" },
  { status: "CONFIRMED", label: "Natija tasdiqlandi" },
  { status: "SENT", label: "G'oliblarga yuborildi" },
];

const fullName = (c: DrawCandidate) => `${c.firstName} ${c.lastName}`;

/** Tanlov natijasi: g'oliblar, zaxira, almashtirish, tasdiqlash va botga yuborish. */
export function DrawResult({ draw }: { draw: VoucherDraw }) {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("winners");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [copied, setCopied] = useState(false);

  const activeWinners = draw.winnerEntries.filter((e) => e.state === "ACTIVE");
  const replaced = draw.winnerEntries.filter((e) => e.state === "REPLACED");
  const pendingCount = activeWinners.filter((e) => e.notify.status !== "SENT").length;
  const canReplace = draw.status !== "CANCELLED" && draw.reserveEntries.some((e) => e.state === "ACTIVE");

  const rows = useMemo(() => {
    const list = tab === "winners" ? activeWinners : tab === "reserves" ? draw.reserveEntries : replaced;
    const needle = search.trim().toLowerCase();
    return needle
      ? list.filter((e) =>
          `${fullName(e.candidate)} ${e.candidate.phone} ${e.candidate.instagramUsername ?? ""}`
            .toLowerCase()
            .includes(needle),
        )
      : list;
  }, [tab, activeWinners, draw.reserveEntries, replaced, search]);
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const done = async (next: VoucherDraw) => {
    queryClient.setQueryData(["draw", next.id], next);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["draws"] }),
      queryClient.invalidateQueries({ queryKey: ["draw-preview"] }),
      queryClient.invalidateQueries({ queryKey: ["audit-log"] }),
    ]);
    setDialog(null);
  };

  const sendMutation = useMutation({ mutationFn: () => sendDraw(draw.id), onSuccess: done });

  const sample = activeWinners[0]?.candidate;
  const message = sample
    ? renderDrawMessage(draw.settings.messageTemplate, {
        firstName: sample.firstName,
        lastName: sample.lastName,
        prizeTitle: draw.prizeTitle,
        stage: draw.stage,
        periodFrom: draw.periodFrom,
        periodTo: draw.periodTo,
        views: sample.views,
      })
    : null;

  const copySeed = async () => {
    try {
      await navigator.clipboard.writeText(draw.seed);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Ruxsat yo'q.
    }
  };

  const total = Math.max(1, activeWinners.length);
  const stepIndex = draw.status === "CANCELLED" ? -1 : STEPS.findIndex((s) => s.status === draw.status);

  return (
    <div className="space-y-5">
      {/* Sarlavha */}
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div>
            <p className="text-xs font-medium text-slate-500">
              Tanlov #{draw.number} · {formatDateTime(draw.createdAt)} · {draw.createdBy}
            </p>
            <h2 className="mt-1 text-lg font-semibold">
              {draw.prizeTitle} — {stageLabel(draw.stage)}
            </h2>
            <p className="text-sm text-slate-600">{periodLabel(draw.periodFrom, draw.periodTo)}</p>
          </div>
          <Badge tone={DRAW_STATUS_TONES[draw.status]} className="text-sm">
            {DRAW_STATUS_LABELS[draw.status]}
          </Badge>
        </div>

        {draw.status === "CANCELLED" && draw.cancelled ? (
          <p className="flex gap-2 bg-slate-50 px-5 py-3 text-sm text-slate-700">
            <Ban className="mt-0.5 size-4 shrink-0" aria-hidden />
            {formatDateTime(draw.cancelled.at)} da {draw.cancelled.by} bekor qildi: «{draw.cancelled.reason}»
          </p>
        ) : (
          <ol className="grid grid-cols-3 gap-2 px-5 py-4">
            {STEPS.map((step, i) => (
              <li key={step.status} className="flex items-center gap-2">
                <span
                  className={cn(
                    "grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold",
                    i <= stepIndex ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-500",
                  )}
                >
                  {i < stepIndex || (i === stepIndex && step.status === "SENT") ? (
                    <CheckCircle2 className="size-4" aria-hidden />
                  ) : (
                    i + 1
                  )}
                </span>
                <span className={cn("text-sm", i <= stepIndex ? "font-medium text-slate-900" : "text-slate-500")}>
                  {step.label}
                </span>
              </li>
            ))}
          </ol>
        )}

        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 border-t border-slate-200 px-5 py-4 text-sm sm:grid-cols-4">
          <Meta label="G'oliblar" value={formatNumber(draw.winners)} />
          <Meta label="Zaxirada qoldi" value={formatNumber(draw.reserves)} />
          <Meta label="Nomzodlar" value={formatNumber(draw.poolSize)} />
          <Meta label="Ko'rishlar holati" value={formatDate(draw.viewsAsOf)} />
          <Meta label="Reel sanasi" value={DRAW_DATE_BASIS_LABELS[draw.settings.dateBasis]} />
          <Meta
            label="Ko'rishlar oralig'i"
            value={`${formatNumber(draw.settings.minViews)} – ${formatNumber(draw.settings.maxViews)}`}
          />
          <div className="col-span-2">
            <dt className="flex items-center gap-1.5 text-xs text-slate-500">
              <KeyRound className="size-3.5" aria-hidden /> Tasodifiy kalit (seed) va nomzodlar izi
            </dt>
            <dd className="mt-0.5 flex flex-wrap items-center gap-2">
              <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs">{draw.seed}</code>
              <button
                type="button"
                onClick={() => void copySeed()}
                className="text-slate-400 hover:text-slate-700"
                aria-label="Kalitni nusxalash"
              >
                {copied ? <CheckCircle2 className="size-4 text-green-600" /> : <Copy className="size-4" />}
              </button>
              <code className="flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs">
                <Fingerprint className="size-3.5" aria-hidden />
                {draw.poolHash}
              </code>
            </dd>
          </div>
        </dl>
      </Card>

      {/* Amallar */}
      {draw.status !== "CANCELLED" && (
        <Card>
          <CardContent className="space-y-4">
            {(draw.status === "CONFIRMED" || draw.status === "SENT") && (
              <div>
                <div className="flex justify-between text-sm">
                  <span className="font-medium">Bot xabarlari</span>
                  <span className="text-slate-500 tabular-nums">
                    {formatNumber(draw.delivery.sent)} yuborildi · {formatNumber(draw.delivery.failed)} xato ·{" "}
                    {formatNumber(draw.delivery.notSent)} kutmoqda
                  </span>
                </div>
                <div className="mt-2 flex h-2.5 overflow-hidden rounded-full bg-slate-100">
                  <div className="bg-green-500" style={{ width: `${(draw.delivery.sent / total) * 100}%` }} />
                  <div className="bg-red-500" style={{ width: `${(draw.delivery.failed / total) * 100}%` }} />
                </div>
              </div>
            )}
            {sendMutation.isError && (
              <p role="alert" className="flex gap-2 text-sm text-red-700">
                <AlertCircle className="mt-0.5 size-4" aria-hidden />
                {errorMessage(sendMutation.error)}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              {draw.status === "DRAFT" && (
                <Button onClick={() => setDialog({ type: "confirm" })}>
                  <CheckCircle2 className="size-4" aria-hidden />
                  Natijani tasdiqlash
                </Button>
              )}
              {(draw.status === "CONFIRMED" || draw.status === "SENT") && pendingCount > 0 && (
                <Button loading={sendMutation.isPending} onClick={() => setDialog({ type: "send", count: pendingCount })}>
                  <Send className="size-4" aria-hidden />
                  {draw.status === "SENT"
                    ? `Qolganlarga yuborish (${formatNumber(pendingCount)})`
                    : `G'oliblarga botda yuborish (${formatNumber(pendingCount)})`}
                </Button>
              )}
              <Button variant="secondary" onClick={() => downloadCsv(draw)}>
                <Download className="size-4" aria-hidden />
                CSV yuklab olish
              </Button>
              {(draw.status === "DRAFT" || draw.status === "CONFIRMED") && (
                <Button variant="ghost" className="text-red-600 hover:bg-red-50 hover:text-red-700" onClick={() => setDialog({ type: "cancel" })}>
                  <Ban className="size-4" aria-hidden />
                  Bekor qilish
                </Button>
              )}
            </div>
            {draw.status === "DRAFT" && (
              <p className="text-xs text-slate-500">
                Tasdiqlashdan oldin g&apos;oliblarni tekshiring: kerak bo&apos;lsa, «Almashtirish» bilan navbatdagi zaxirani qo&apos;ying.
                Xabarlar faqat tasdiqlangandan keyin yuboriladi.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Jadval */}
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-3">
          <div className="flex gap-1" role="tablist">
            <TabButton active={tab === "winners"} onClick={() => { setTab("winners"); setPage(1); }}>
              G&apos;oliblar ({formatNumber(activeWinners.length)})
            </TabButton>
            <TabButton active={tab === "reserves"} onClick={() => { setTab("reserves"); setPage(1); }}>
              Zaxira ({formatNumber(draw.reserveEntries.length)})
            </TabButton>
            {replaced.length > 0 && (
              <TabButton active={tab === "replaced"} onClick={() => { setTab("replaced"); setPage(1); }}>
                Chetlatilganlar ({formatNumber(replaced.length)})
              </TabButton>
            )}
          </div>
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Ism, telefon yoki Instagram"
            className="w-64"
            aria-label="G'oliblar ichida qidirish"
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-500">
              <tr>
                <th className="w-16 px-4 py-2.5 text-left font-medium">#</th>
                <th className="px-4 py-2.5 text-left font-medium">Ishtirokchi</th>
                <th className="px-4 py-2.5 text-left font-medium">Instagram</th>
                <th className="px-4 py-2.5 text-right font-medium">Ko&apos;rishlar</th>
                <th className="px-4 py-2.5 text-left font-medium">
                  {tab === "replaced" ? "Sabab" : tab === "reserves" ? "Holat" : "Bot xabari"}
                </th>
                <th className="w-36 px-4 py-2.5 text-right font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pageRows.map((entry) => (
                <tr key={`${entry.candidate.participantId}-${entry.state}`} className="hover:bg-slate-50/60">
                  <td className="px-4 py-2.5 font-medium text-slate-500 tabular-nums">{entry.position}</td>
                  <td className="px-4 py-2.5">
                    <p className="font-medium">
                      {fullName(entry.candidate)}
                      {entry.promotedFor && tab === "winners" && (
                        <Badge tone="brand" className="ml-2">zaxiradan</Badge>
                      )}
                    </p>
                    <p className="text-xs text-slate-500 tabular-nums">{entry.candidate.phone}</p>
                  </td>
                  <td className="px-4 py-2.5">
                    <a
                      href={entry.candidate.reelUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-brand-700 hover:underline"
                    >
                      {entry.candidate.instagramUsername ? `@${entry.candidate.instagramUsername}` : "Reel"}
                      <ExternalLink className="size-3.5" aria-hidden />
                    </a>
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{formatNumber(entry.candidate.views)}</td>
                  <td className="px-4 py-2.5">
                    {tab === "replaced" && entry.replaced ? (
                      <span className="text-xs text-slate-600">
                        «{entry.replaced.reason}» — {entry.replaced.by}, {formatDateTime(entry.replaced.at)}
                      </span>
                    ) : tab === "reserves" ? (
                      entry.state === "PROMOTED" ? (
                        <Badge tone="brand">G&apos;olib bo&apos;ldi</Badge>
                      ) : (
                        <Badge>Navbatda</Badge>
                      )
                    ) : (
                      <span title={entry.notify.error ?? undefined}>
                        <Badge tone={DRAW_NOTIFY_TONES[entry.notify.status]}>
                          {DRAW_NOTIFY_LABELS[entry.notify.status]}
                        </Badge>
                        {entry.notify.error && <span className="ml-2 text-xs text-red-600">{entry.notify.error}</span>}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {tab === "winners" && canReplace && (
                      <Button size="sm" variant="ghost" onClick={() => setDialog({ type: "replace", entry })}>
                        <ArrowRightLeft className="size-4" aria-hidden />
                        Almashtirish
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
              {pageRows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                    Hech kim topilmadi
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {rows.length > PAGE_SIZE && (
          <div className="border-t border-slate-200 px-5 py-3">
            <Pagination page={page} pageSize={PAGE_SIZE} total={rows.length} onPageChange={setPage} />
          </div>
        )}
      </Card>

      {message && (
        <Card>
          <CardContent>
            <p className="mb-2 text-sm font-medium">Bot xabari ({fullName(activeWinners[0].candidate)} uchun):</p>
            <div className="rounded-xl bg-[#e6ebf1] p-3">
              <div className="max-w-md rounded-2xl rounded-bl-md bg-white px-3.5 py-2.5 text-sm whitespace-pre-line shadow-sm">
                {message}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {dialog?.type === "replace" && (
        <ReasonDialog
          title="G'olibni almashtirish"
          description={
            <>
              <b>{fullName(dialog.entry.candidate)}</b> g&apos;oliblar ro&apos;yxatidan chiqariladi, o&apos;rniga navbatdagi zaxira
              ({fullName(draw.reserveEntries.find((e) => e.state === "ACTIVE")?.candidate ?? dialog.entry.candidate)})
              qo&apos;yiladi. Sabab audit logga yoziladi.
            </>
          }
          confirmLabel="Almashtirish"
          variant="danger"
          placeholder="Masalan: mahsulot xaridi tasdiqlanmadi"
          onConfirm={(reason) => replaceDrawWinner(draw.id, { participantId: dialog.entry.candidate.participantId, reason }).then(done)}
          onClose={() => setDialog(null)}
          onDone={() => setDialog(null)}
        />
      )}
      {dialog?.type === "confirm" && (
        <ConfirmDialog
          title="Natijani tasdiqlash"
          description={`${formatNumber(activeWinners.length)} ta g'olib tasdiqlanadi. Shundan keyin ularga bot orqali xabar yuborish mumkin bo'ladi.`}
          confirmLabel="Tasdiqlash"
          onConfirm={() => confirmDraw(draw.id).then(done)}
          onClose={() => setDialog(null)}
          onDone={() => setDialog(null)}
        />
      )}
      {dialog?.type === "cancel" && (
        <ReasonDialog
          title="Tanlovni bekor qilish"
          description="Natija bekor qilinadi va shu davr uchun yangi tanlov o'tkazish mumkin bo'ladi. Sabab audit logga yoziladi."
          confirmLabel="Bekor qilish"
          variant="danger"
          placeholder="Masalan: davr sanalari noto'g'ri tanlangan"
          onConfirm={(reason) => cancelDraw(draw.id, { reason }).then(done)}
          onClose={() => setDialog(null)}
          onDone={() => setDialog(null)}
        />
      )}
      {dialog?.type === "send" && (
        <ConfirmDialog
          title="G'oliblarga xabar yuborish"
          description={`${formatNumber(dialog.count)} ta g'olibga Telegram bot orqali tabrik xabari yuboriladi. Bu amalni ortga qaytarib bo'lmaydi.`}
          confirmLabel="Yuborish"
          onConfirm={() => sendMutation.mutateAsync()}
          onClose={() => setDialog(null)}
          onDone={() => setDialog(null)}
        />
      )}
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-0.5 font-medium tabular-nums">{value}</dd>
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
        active ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-100",
      )}
    >
      {children}
    </button>
  );
}

/** Voucherlarni topshirish uchun ro'yxat (Excel ochadi: UTF-8 BOM bilan). */
function downloadCsv(draw: VoucherDraw) {
  const header = ["Holat", "O'rin", "Ism", "Familiya", "Telefon", "Instagram", "Ko'rishlar", "Reel", "Bot xabari"];
  const line = (role: string, e: DrawEntry) => [
    role,
    String(e.position),
    e.candidate.firstName,
    e.candidate.lastName,
    e.candidate.phone,
    e.candidate.instagramUsername ?? "",
    String(e.candidate.views),
    e.candidate.reelUrl,
    role === "G'olib" ? DRAW_NOTIFY_LABELS[e.notify.status] : "",
  ];
  const rows = [
    header,
    ...draw.winnerEntries.filter((e) => e.state === "ACTIVE").map((e) => line("G'olib", e)),
    ...draw.reserveEntries.filter((e) => e.state === "ACTIVE").map((e) => line("Zaxira", e)),
  ];
  const csv = rows.map((r) => r.map((v) => `"${v.replace(/"/g, '""')}"`).join(";")).join("\r\n");
  const url = URL.createObjectURL(new Blob(["﻿", csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `random-tanlov-${draw.number}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
