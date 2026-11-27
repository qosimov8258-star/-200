"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import {
  AlertCircle,
  ArrowRight,
  ArrowRightLeft,
  Ban,
  Check,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  RotateCw,
  Send,
} from "lucide-react";

import { CAR_PRIZE_ID, CAR_WINNER_HREF, withDrumPrize } from "@/components/prizes/rating-prize";
import { LinkButton } from "@/components/winner/link-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { MoreDetails } from "@/components/ui/more-details";
import { Pagination } from "@/components/ui/pagination";
import { ReasonDialog } from "@/components/ui/reason-dialog";
import { Step } from "@/components/ui/steps";
import { cancelDraw, confirmDraw, getWinnerOverview, replaceDrawWinner, sendDraw } from "@/lib/api";
import { errorMessage } from "@/lib/api-error";
import { renderDrawMessage, stageLabel } from "@/lib/draw-rules";
import { formatDate, formatDateTime, formatDayMonth, formatNumber } from "@/lib/format";
import { DRAW_NOTIFY_LABELS, DRAW_NOTIFY_TONES, DRAW_STATUS_LABELS, DRAW_STATUS_TONES } from "@/lib/labels";
import type { DrawCandidate, DrawEntry, VoucherDraw, WinnerStage } from "@/lib/types";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 50;

type Tab = "winners" | "reserves" | "replaced";
type DialogState =
  | { type: "replace"; entry: DrawEntry }
  | { type: "confirm" }
  | { type: "cancel" }
  | { type: "send"; count: number }
  | null;
type BadgeTone = React.ComponentProps<typeof Badge>["tone"];

const fullName = (c: DrawCandidate) => `${c.firstName} ${c.lastName}`;

/** Avtomobil tanlovi sarlavhasidagi belgi: tanlov holati emas, g'olib qayerda turgani. */
const CAR_STAGE_BADGES: Record<WinnerStage, { label: string; tone: BadgeTone }> = {
  NOT_STARTED: { label: "G'olib tekshiruvda", tone: "warning" },
  CANDIDATE: { label: "G'olib tekshiruvda", tone: "warning" },
  CONFIRMED: { label: "G'olib tasdiqlangan", tone: "brand" },
  ANNOUNCED: { label: "G'olib e'lon qilingan", tone: "success" },
};

/**
 * Tanlov natijasi oddiy tilda: tepada bir gaplik xulosa va kimlar qatnashgani, keyin qadamlar
 * (o'tkazildi → tasdiqlash → xabar yuborish) — joriy qadam ajratilgan va tugmasi shu qadamning
 * ichida. Pastda g'oliblar ro'yxati, eng oxirida yopiq "Batafsil" (tanlov halolligi kaliti).
 *
 * Avtomobil (`main-car`) boshqacha: g'olibga xabar bu yerdan yuborilmaydi — u G'oliblar →
 * "Asosiy sovrinlar" dagi avtomobil kartasida yuzma-yuz tekshiriladi, tasdiqlanadi va e'lon qilinadi
 * (tabrik e'lon bilan birga boradi). Shuning uchun bu yerda ikki qadam: o'tkazildi → kartaga o'tish.
 */
export function DrawResult({ draw }: { draw: VoucherDraw }) {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<Tab>("winners");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [dialog, setDialog] = useState<DialogState>(null);

  const isCar = draw.prizeId === CAR_PRIZE_ID;
  // Avtomobil g'olibi qaysi qadamda — kartadagi holat bilan umumiy kesh (`["winner"]`).
  const winner = useQuery({ queryKey: ["winner"], queryFn: getWinnerOverview, enabled: isCar });
  const carStage = isCar ? (winner.data?.stage ?? null) : null;
  // G'olib tasdiqlangan yoki e'lon qilingan bo'lsa, tanlovni o'zgartirish g'olib kartasini buzadi.
  const carLocked = carStage === "CONFIRMED" || carStage === "ANNOUNCED";
  // Avtomobil kartasiga o'tilganda tepadagi baraban tanlangan sovrinda qoladi.
  const carWinnerHref = withDrumPrize(CAR_WINNER_HREF, searchParams.get("prize"));

  const activeWinners = draw.winnerEntries.filter((e) => e.state === "ACTIVE");
  const replaced = draw.winnerEntries.filter((e) => e.state === "REPLACED");
  const pendingCount = activeWinners.filter((e) => e.notify.status !== "SENT").length;
  // Avtomobil nomzodi kartadagi «Nomzodni rad etish» bilan almashtiriladi (bir joyda).
  const canReplace =
    !isCar && draw.status !== "CANCELLED" && draw.reserveEntries.some((e) => e.state === "ACTIVE");

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
    await Promise.all(
      // Asosiy sovrin plitkalari va avtomobil kartasi ham shu tanlovdan o'qiydi.
      ["draws", "draw-preview", "audit-log", "rating-prizes", "winner"].map((key) =>
        queryClient.invalidateQueries({ queryKey: [key] }),
      ),
    );
    setDialog(null);
  };

  const sendMutation = useMutation({ mutationFn: () => sendDraw(draw.id), onSuccess: done });

  const sample = activeWinners[0]?.candidate;
  const message =
    sample && !isCar
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

  const cancelButton = (
    <Button
      variant="ghost"
      size="sm"
      className="text-red-600 hover:bg-red-50 hover:text-red-700"
      onClick={() => setDialog({ type: "cancel" })}
    >
      <Ban className="size-4" aria-hidden />
      Tanlovni bekor qilish
    </Button>
  );

  // Uchinchi ustun: almashtirilganlarda — sabab, zaxirada — holat, g'oliblarda — bot xabari
  // (avtomobilda bot xabari yo'q — ustun ko'rsatilmaydi).
  const statusColumn =
    tab === "replaced" ? "Sabab" : tab === "reserves" ? "Holat" : isCar ? null : "Bot xabari";
  const columns = statusColumn ? 5 : 4;
  const headerBadge =
    isCar && draw.status !== "CANCELLED" && carStage
      ? CAR_STAGE_BADGES[carStage]
      : { label: DRAW_STATUS_LABELS[draw.status], tone: DRAW_STATUS_TONES[draw.status] };

  return (
    <div className="space-y-5">
      {/* Xulosa */}
      <Card className="overflow-hidden">
        <div className="space-y-4 px-5 py-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-medium text-slate-500">Tanlov #{draw.number}</p>
              <h2 className="mt-0.5 text-lg font-semibold">{draw.prizeTitle}</h2>
            </div>
            <Badge tone={headerBadge.tone} className="text-sm">
              {headerBadge.label}
            </Badge>
          </div>
          <DrawSummary draw={draw} />
          <Participation draw={draw} />
        </div>

        {draw.status === "CANCELLED" && draw.cancelled && (
          <p className="flex gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3 text-sm text-slate-700">
            <Ban className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>
              Bu tanlov bekor qilingan — {formatDateTime(draw.cancelled.at)}, {draw.cancelled.by}. Sabab: «
              {draw.cancelled.reason}». G&apos;oliblar sovg&apos;a olmaydi.
            </span>
          </p>
        )}
      </Card>

      {/* Qadamlar */}
      {draw.status !== "CANCELLED" &&
        (isCar ? (
          <ol className="grid gap-3 lg:grid-cols-2" aria-label="Tanlov qadamlari">
            <Step number={1} title="Tanlov o'tkazildi" state="done">
              G&apos;olib va zaxiralar tasodifiy tanlandi — {formatDateTime(draw.createdAt)}, {draw.createdBy}.
            </Step>
            <Step
              number={2}
              title="G'olibni tekshirish va e'lon qilish"
              state={carStage === "ANNOUNCED" ? "done" : "current"}
              actions={
                <LinkButton href={carWinnerHref} variant={carStage === "ANNOUNCED" ? "secondary" : "primary"}>
                  {carStage === "ANNOUNCED"
                    ? "G'olib kartasini ochish"
                    : carStage === "CONFIRMED"
                      ? "E'lon qilishga o'tish"
                      : "Avtomobil g'olibini tekshirish"}
                  <ArrowRight className="size-4" aria-hidden />
                </LinkButton>
              }
            >
              {carStage === "ANNOUNCED" ? (
                <>
                  G&apos;olib e&apos;lon qilindi
                  {winner.data?.announced &&
                    ` — ${formatDateTime(winner.data.announced.at)}, ${winner.data.announced.by}`}
                  .
                </>
              ) : carStage === "CONFIRMED" ? (
                <>
                  G&apos;olib tasdiqlangan — avtomobil kartasida «G&apos;olibni e&apos;lon qilish»ni bosing. Tabrik
                  xabari e&apos;lon bilan birga boradi.
                </>
              ) : (
                <>
                  Avtomobil g&apos;olibi bilan yuzma-yuz uchrashib, reklama tarixini ko&apos;rasiz, keyin tasdiqlab
                  e&apos;lon qilasiz. Tabrik xabari e&apos;lon bilan birga boradi.
                </>
              )}
            </Step>
          </ol>
        ) : (
          <ol className="grid gap-3 lg:grid-cols-3" aria-label="Tanlov qadamlari">
            <Step number={1} title="Tanlov o'tkazildi" state="done">
              G&apos;oliblar tasodifiy tanlandi — {formatDateTime(draw.createdAt)}, {draw.createdBy}.
            </Step>

            <Step
              number={2}
              title="Natijani tasdiqlash"
              state={draw.status === "DRAFT" ? "current" : "done"}
              actions={
                draw.status === "DRAFT" && (
                  <>
                    <Button size="sm" onClick={() => setDialog({ type: "confirm" })}>
                      <CheckCircle2 className="size-4" aria-hidden />
                      Natijani tasdiqlash
                    </Button>
                    {cancelButton}
                  </>
                )
              }
            >
              {draw.status === "DRAFT" ? (
                "Pastdagi ro'yxatni ko'rib chiqing. Tasdiqlanmaguncha hech kimga xabar bormaydi."
              ) : draw.confirmed ? (
                <>
                  Tasdiqlandi — {formatDateTime(draw.confirmed.at)}, {draw.confirmed.by}.
                </>
              ) : (
                "Tasdiqlandi."
              )}
            </Step>

            <SendStep
              draw={draw}
              pendingCount={pendingCount}
              sending={sendMutation.isPending}
              error={sendMutation.isError ? errorMessage(sendMutation.error) : null}
              onSend={() => setDialog({ type: "send", count: pendingCount })}
              cancelButton={draw.status === "CONFIRMED" ? cancelButton : null}
              message={message}
              sampleName={sample ? fullName(sample) : null}
            />
          </ol>
        ))}

      {/* Ro'yxat */}
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-3">
          <div className="flex flex-wrap gap-1" role="tablist" aria-label="Ro'yxat">
            <TabButton active={tab === "winners"} onClick={() => { setTab("winners"); setPage(1); }}>
              G&apos;oliblar ({formatNumber(activeWinners.length)})
            </TabButton>
            <TabButton active={tab === "reserves"} onClick={() => { setTab("reserves"); setPage(1); }}>
              Zaxira ({formatNumber(draw.reserveEntries.length)})
            </TabButton>
            {replaced.length > 0 && (
              <TabButton active={tab === "replaced"} onClick={() => { setTab("replaced"); setPage(1); }}>
                Almashtirilganlar ({formatNumber(replaced.length)})
              </TabButton>
            )}
          </div>
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Ism, telefon yoki Instagram"
              className="w-full sm:w-64"
              aria-label="G'oliblar ichida qidirish"
            />
            <Button variant="secondary" onClick={() => downloadCsv(draw)}>
              <Download className="size-4" aria-hidden />
              Ro&apos;yxatni yuklab olish (Excel)
            </Button>
          </div>
        </div>
        {tab === "winners" && draw.status === "DRAFT" && canReplace && (
          <p className="border-b border-slate-100 bg-slate-50/60 px-5 py-2 text-xs text-slate-600">
            Kim mos kelmasa — «Almashtirish»: o&apos;rniga navbatdagi zaxira o&apos;tadi.
          </p>
        )}
        {/* Tasdiqlangan yoki e'lon qilingan g'olibni rad etib bo'lmaydi — u holda izoh chiqmaydi. */}
        {isCar && tab === "winners" && draw.status !== "CANCELLED" && carStage !== null && !carLocked && (
          <p className="border-b border-slate-100 bg-slate-50/60 px-5 py-2 text-xs text-slate-600">
            Nomzod mos kelmasa, avtomobil g&apos;olibi kartasida «Nomzodni rad etish»ni bosing: o&apos;rniga
            navbatdagi zaxira o&apos;tadi.
          </p>
        )}
        {/* `relative` — ichidagi `sr-only` (absolute) ham shu aylanadigan blok ichida qoladi, sahifa kengaymaydi. */}
        <div className="relative overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-500">
              <tr>
                <th className="w-16 px-4 py-2.5 text-left font-medium">#</th>
                <th className="px-4 py-2.5 text-left font-medium">Ishtirokchi</th>
                <th className="px-4 py-2.5 text-right font-medium">Ko&apos;rishlar</th>
                {statusColumn && <th className="px-4 py-2.5 text-left font-medium">{statusColumn}</th>}
                <th className="w-36 px-4 py-2.5 text-right font-medium">
                  <span className="sr-only">Amal</span>
                </th>
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
                        <Badge tone="brand" className="ml-2">
                          zaxiradan o&apos;tdi
                        </Badge>
                      )}
                    </p>
                    <p className="flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
                      <span className="tabular-nums">{entry.candidate.phone}</span>
                      <a
                        href={entry.candidate.reelUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-brand-700 hover:underline"
                      >
                        {entry.candidate.instagramUsername ? `@${entry.candidate.instagramUsername}` : "Video"}
                        <ExternalLink className="size-3" aria-hidden />
                      </a>
                    </p>
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{formatNumber(entry.candidate.views)}</td>
                  {statusColumn && (
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
                  )}
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
                  <td colSpan={columns} className="px-4 py-10 text-center text-slate-500">
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

      {/* Kamdan-kam kerak bo'ladiganlar */}
      <div className="space-y-3">
        {isCar && draw.status !== "CANCELLED" && (
          <MoreDetails title="Batafsil: tanlovni bekor qilish">
            {carStage === "ANNOUNCED" ? (
              <p className="text-sm text-slate-600">G&apos;olib e&apos;lon qilingan — tanlovni bekor qilib bo&apos;lmaydi.</p>
            ) : carLocked ? (
              <p className="text-sm text-slate-600">
                G&apos;olib tasdiqlangan. Tanlovni bekor qilish uchun avval avtomobil g&apos;olibi kartasida
                «Tasdiqni bekor qilish»ni bosing.
              </p>
            ) : carStage === null ? (
              <p className="text-sm text-slate-600">
                {winner.isError ? errorMessage(winner.error) : "G'olib holati yuklanmoqda…"}
              </p>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-slate-600">
                  Natija bekor qilinadi va barabanda qaytadan aylantirish mumkin bo&apos;ladi. Faqat xato bo&apos;lsa
                  kerak (masalan, sozlamalar noto&apos;g&apos;ri edi).
                </p>
                {cancelButton}
              </div>
            )}
          </MoreDetails>
        )}
        <TechnicalDetails draw={draw} />
      </div>

      {dialog?.type === "replace" && (
        <ReasonDialog
          title="G'olibni almashtirish"
          description={
            <>
              <b>{fullName(dialog.entry.candidate)}</b> g&apos;oliblar ro&apos;yxatidan chiqariladi, o&apos;rniga navbatdagi zaxira
              ({fullName(draw.reserveEntries.find((e) => e.state === "ACTIVE")?.candidate ?? dialog.entry.candidate)})
              qo&apos;yiladi. Sabab amallar tarixiga yoziladi.
            </>
          }
          confirmLabel="Almashtirish"
          variant="danger"
          placeholder="Masalan: 5 kun ichida bog'lanmadi"
          onConfirm={(reason) => replaceDrawWinner(draw.id, { participantId: dialog.entry.candidate.participantId, reason }).then(done)}
          onClose={() => setDialog(null)}
          onDone={() => setDialog(null)}
        />
      )}
      {dialog?.type === "confirm" && (
        <ConfirmDialog
          title="Natijani tasdiqlash"
          description={`${formatNumber(activeWinners.length)} kishi g'olib sifatida tasdiqlanadi. Shundan keyin ularga bot orqali xabar yuborish mumkin bo'ladi.`}
          confirmLabel="Tasdiqlash"
          onConfirm={() => confirmDraw(draw.id).then(done)}
          onClose={() => setDialog(null)}
          onDone={() => setDialog(null)}
        />
      )}
      {dialog?.type === "cancel" && (
        <ReasonDialog
          title="Tanlovni bekor qilish"
          description="Natija bekor qilinadi va shu davr uchun yangi tanlov o'tkazish mumkin bo'ladi. Sabab amallar tarixiga yoziladi."
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
          description={`${formatNumber(dialog.count)} kishiga Telegram bot orqali tabrik xabari yuboriladi. Yuborilgan xabarni qaytarib bo'lmaydi.`}
          confirmLabel="Yuborish"
          onConfirm={() => sendMutation.mutateAsync()}
          onClose={() => setDialog(null)}
          onDone={() => setDialog(null)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Xulosa
// ---------------------------------------------------------------------------

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/**
 * "1-bosqich (31.10–29.11): 91 kishi qatnashdi, 91 kishi g'olib bo'ldi." + zaxira haqida bir gap.
 * Asosiy sovrin tanlovida bosqich yo'q — u butun aksiya davri bo'yicha ("maxsus davr" emas).
 */
function DrawSummary({ draw }: { draw: VoucherDraw }) {
  const periodName = draw.prizeId.startsWith("main-") ? "Aksiya davri" : capitalize(stageLabel(draw.stage));
  const period = `${periodName} (${formatDayMonth(draw.periodFrom)}–${formatDayMonth(draw.periodTo)})`;
  const pool = formatNumber(draw.poolSize);
  const winners = formatNumber(draw.winners);
  const cancelled = draw.status === "CANCELLED";
  const wanted = draw.settings.winnersCount;

  let note: string | null = null;
  if (!cancelled) {
    if (draw.poolSize < wanted) {
      note = `G'oliblar soni ${formatNumber(wanted)} edi, lekin talabga javob bergan ${pool} kishi — hammasi g'olib bo'ldi, zaxira yo'q.`;
    } else if (draw.reserves > 0) {
      note = `Yana ${formatNumber(draw.reserves)} kishi zaxirada: g'olib chetlatilsa, o'rniga navbatdagi zaxira o'tadi.`;
    } else if (draw.reserveEntries.length > 0) {
      note = "Zaxiradagilar hammasi g'oliblar o'rniga o'tdi — zaxira qolmadi.";
    } else if (draw.settings.reservesCount > 0) {
      note = "Zaxira yo'q: g'oliblardan ortiqcha nomzod qolmadi.";
    }
  }

  return (
    <div className="space-y-1">
      <p className="text-base font-medium text-ink">
        {period}:{" "}
        {cancelled
          ? `${pool} kishi qatnashgan, ${winners} kishi tanlangan edi.`
          : `${pool} kishi qatnashdi, ${winners} kishi g'olib bo'ldi.`}
      </p>
      {note && <p className="text-sm text-slate-600">{note}</p>}
    </div>
  );
}

/** "Kimlar qatnashdi:" — tanlov sozlamalaridan oddiy so'z bilan. */
function Participation({ draw }: { draw: VoucherDraw }) {
  const { settings } = draw;
  const dates = `${formatDate(draw.periodFrom)} – ${formatDate(draw.periodTo)}`;
  const rules = [
    settings.dateBasis === "POSTED"
      ? `Videoni ${dates} kunlari Instagram'ga joylaganlar`
      : `Videoni ${dates} kunlari ilovaga yuborganlar`,
    settings.maxViews >= 1_000_000_000
      ? `Videolari jami ${formatNumber(settings.minViews)} va undan ko'p ko'rish yig'ganlar`
      : `Videolari jami ${formatNumber(settings.minViews)} – ${formatNumber(settings.maxViews)} ko'rish yig'ganlar`,
    ...(settings.excludePreviousWinners ? ["Boshqa asosiy sovrin yutmaganlar"] : []),
    ...(settings.excludeTargets ? ["Pullik reklama (target) aniqlanmaganlar"] : []),
    ...(settings.excludeWarned ? ["Ogohlantirish olmaganlar"] : []),
  ];

  return (
    <div className="rounded-xl bg-[#f7f6fb] px-4 py-3">
      <p className="text-sm font-medium text-ink">Kimlar qatnashdi:</p>
      <ul className="mt-1.5 grid gap-x-6 gap-y-1 text-sm text-slate-700 sm:grid-cols-2">
        {rules.map((rule) => (
          <li key={rule} className="flex gap-2">
            <Check className="mt-0.5 size-4 shrink-0 text-green-600" aria-hidden />
            <span className="tabular-nums">{rule}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Kalit, nomzodlar izi va ko'rishlar sanasi — yopiq bo'limda, natija o'zgarmaganini tekshirish uchun. */
function TechnicalDetails({ draw }: { draw: VoucherDraw }) {
  const [copied, setCopied] = useState(false);

  const copySeed = async () => {
    try {
      await navigator.clipboard.writeText(draw.seed);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Ruxsat yo'q.
    }
  };

  return (
    <MoreDetails title="Batafsil: tanlov halolligini tekshirish (kalit)">
      <div className="space-y-3">
        <p className="text-xs text-slate-500">
          Shu kalit va nomzodlar ro&apos;yxati bilan natijani istalgan payt qayta hisoblab, o&apos;zgarmaganini
          tekshirish mumkin.
        </p>
        <dl className="grid grid-cols-[max-content_minmax(0,1fr)] items-center gap-x-4 gap-y-2 text-sm">
          <dt className="text-xs text-slate-500">Tasodifiy kalit</dt>
          <dd className="flex min-w-0 items-center gap-2">
            <code className="min-w-0 rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs break-all">{draw.seed}</code>
            <button
              type="button"
              onClick={() => void copySeed()}
              className="shrink-0 text-slate-400 hover:text-slate-700"
              aria-label={copied ? "Kalit nusxalandi" : "Kalitni nusxalash"}
            >
              {copied ? <CheckCircle2 className="size-4 text-green-600" aria-hidden /> : <Copy className="size-4" aria-hidden />}
            </button>
          </dd>
          <dt className="text-xs text-slate-500">Nomzodlar izi</dt>
          <dd className="min-w-0">
            <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs break-all">{draw.poolHash}</code>
          </dd>
          <dt className="text-xs text-slate-500">Ko&apos;rishlar holati</dt>
          <dd className="tabular-nums">{formatDate(draw.viewsAsOf)}</dd>
        </dl>
      </div>
    </MoreDetails>
  );
}

// ---------------------------------------------------------------------------
// Qadamlar
// ---------------------------------------------------------------------------

/** 3-qadam: botda yuborish va yetkazish natijasi oddiy so'z bilan; xabar namunasi — yopiq bo'limda. */
function SendStep({
  draw,
  pendingCount,
  sending,
  error,
  onSend,
  cancelButton,
  message,
  sampleName,
}: {
  draw: VoucherDraw;
  pendingCount: number;
  sending: boolean;
  error: string | null;
  onSend: () => void;
  cancelButton: React.ReactNode;
  message: string | null;
  sampleName: string | null;
}) {
  const { sent, failed, notSent } = draw.delivery;
  const title = "G'oliblarga xabar yuborish";

  const preview = message && (
    <MoreDetails title="Xabar matnini ko'rish" meta={sampleName ? `${sampleName} uchun` : null} className="mt-3">
      <div className="rounded-xl bg-[#e6ebf1] p-3">
        <div className="max-w-md rounded-2xl rounded-bl-md bg-white px-3.5 py-2.5 text-sm whitespace-pre-line text-ink shadow-sm">
          {message}
        </div>
      </div>
    </MoreDetails>
  );

  if (draw.status === "DRAFT") {
    return (
      <Step number={3} title={title} state="todo">
        Natija tasdiqlangandan keyin ochiladi. G&apos;oliblarga Telegram bot orqali tabrik xabari boradi.
        {preview}
      </Step>
    );
  }

  const errorLine = error && (
    <p role="alert" className="mt-2 flex gap-2 text-red-700">
      <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
      {error}
    </p>
  );

  if (draw.status === "CONFIRMED") {
    return (
      <Step
        number={3}
        title={title}
        state="current"
        actions={
          <>
            <Button size="sm" loading={sending} onClick={onSend} disabled={pendingCount === 0}>
              <Send className="size-4" aria-hidden />
              Xabar yuborish ({formatNumber(pendingCount)})
            </Button>
            {cancelButton}
          </>
        }
      >
        {formatNumber(pendingCount)} kishiga Telegram bot orqali tabrik xabari boradi. Yuborilgan xabarni qaytarib
        bo&apos;lmaydi.
        {errorLine}
        {preview}
      </Step>
    );
  }

  // SENT: hammasi yetib borgan bo'lsa — tugagan, aks holda qayta yuborish shu yerda.
  return (
    <Step
      number={3}
      title={title}
      state={pendingCount > 0 ? "current" : "done"}
      actions={
        pendingCount > 0 && (
          <Button size="sm" loading={sending} onClick={onSend}>
            {failed > 0 ? <RotateCw className="size-4" aria-hidden /> : <Send className="size-4" aria-hidden />}
            {failed > 0 ? "Qayta yuborish" : `Yuborish (${formatNumber(pendingCount)})`}
          </Button>
        )
      }
    >
      <ul className="space-y-1">
        <li className="flex gap-2">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-green-600" aria-hidden />
          <span>
            <b className="font-semibold text-ink">{formatNumber(sent)} kishiga yuborildi</b>
            {draw.sent && <span className="text-slate-500"> — {formatDateTime(draw.sent.at)}</span>}
          </span>
        </li>
        {failed > 0 && (
          <li className="flex gap-2 text-red-700">
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>
              {formatNumber(failed)} kishiga yetib bormadi — {failed === 1 ? "u" : "ular"} botni bloklagan
              bo&apos;lishi mumkin.
            </span>
          </li>
        )}
        {notSent > 0 && (
          <li className="flex gap-2 text-amber-800">
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>
              {formatNumber(notSent)} kishiga hali yuborilmagan (zaxiradan o&apos;tganlar).
            </span>
          </li>
        )}
      </ul>
      {errorLine}
      {preview}
    </Step>
  );
}

// ---------------------------------------------------------------------------

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
  const header = ["Holat", "O'rin", "Ism", "Familiya", "Telefon", "Instagram", "Ko'rishlar", "Video", "Bot xabari"];
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
  a.download = `tanlov-${draw.number}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
