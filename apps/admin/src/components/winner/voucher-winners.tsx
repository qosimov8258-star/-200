"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQueries, useQuery } from "@tanstack/react-query";
import { ArrowUpRight, Dices, Ticket } from "lucide-react";

import { MAIN_DRAW_RESULT_ANCHOR, VOUCHER_DRAW_ANCHOR } from "@/components/prizes/rating-prize";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { MoreDetails } from "@/components/ui/more-details";
import { Pagination } from "@/components/ui/pagination";
import { Spinner } from "@/components/ui/spinner";
import { getDraw, getDraws } from "@/lib/api";
import { errorMessage } from "@/lib/api-error";
import { stageLabel } from "@/lib/draw-rules";
import { formatDayMonth, formatNumber } from "@/lib/format";
import { DRAW_STATUS_LABELS, DRAW_STATUS_TONES } from "@/lib/labels";
import type { DrawEntry, VoucherDraw, VoucherDrawSummary } from "@/lib/types";
import { drawHref, voucherTabHref } from "@/lib/winner-links";

import { LinkButton } from "./link-button";

const PAGE_SIZE = 25;

const isMonthly = (draw: VoucherDrawSummary) => !draw.prizeId.startsWith("main-");

/** "#2 · 1-bosqich · 27.11–26.12"; asosiy sovrin — "#5 · iPhone 18 Pro". */
function drawTitle(draw: VoucherDrawSummary): string {
  if (!isMonthly(draw)) return `#${draw.number} · ${draw.prizeTitle}`;
  return `#${draw.number} · ${stageLabel(draw.stage)} · ${formatDayMonth(draw.periodFrom)}–${formatDayMonth(draw.periodTo)}`;
}

/**
 * "O'tkazilgan voucher tanlovlari" (G'oliblar → "Voucher" tabi): bitta ro'yxat — har qatorda
 * tanlov, g'oliblar soni, holati va "Ochish"; g'oliblar jadvali qator ichida yopiq turadi. Tepada —
 * barcha voucher g'oliblari ichida qidiruv. Bekor qilingan tanlovlar — pastda, yopiq bo'limda.
 * Har bir tanlov `GET /admin/draws/:id` dan (keshi tanlov natijasi bilan umumiy).
 */
export function VoucherWinners() {
  const draws = useQuery({ queryKey: ["draws"], queryFn: getDraws });
  // Faqat oylik voucher tanlovlari — asosiy sovrinlar "Asosiy sovrinlar" tabida.
  const live = useMemo(
    () => (draws.data ?? []).filter((draw) => draw.status !== "CANCELLED" && isMonthly(draw)),
    [draws.data],
  );
  // Bekor qilinganlar ham ochiladigan bo'lib qoladi (sababini ko'rish uchun), shu jumladan asosiy sovrinlarniki.
  const cancelled = useMemo(() => (draws.data ?? []).filter((draw) => draw.status === "CANCELLED"), [draws.data]);
  const details = useQueries({
    queries: live.map((draw) => ({ queryKey: ["draw", draw.id], queryFn: () => getDraw(draw.id) })),
  });
  const [search, setSearch] = useState("");
  const needle = search.trim().toLowerCase();

  if (draws.isPending) return <Spinner />;
  if (draws.isError) {
    return (
      <p role="alert" className="text-sm text-red-700">
        {errorMessage(draws.error)}
      </p>
    );
  }

  const total = live.reduce((sum, draw) => sum + draw.winners, 0);
  const nothingFound =
    needle !== "" &&
    details.every((detail) => detail.data) &&
    !details.some((detail) =>
      detail.data?.winnerEntries.some((entry) => entry.state === "ACTIVE" && matches(entry, needle)),
    );

  return (
    <div className="space-y-4">
      {live.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 px-4 py-12 text-center">
          <Ticket className="size-8 text-slate-300" aria-hidden />
          <p className="max-w-md text-sm text-slate-600">
            Hali voucher tanlovi o&apos;tkazilmagan. Tepadagi barabanda kerakli «Voucher» bosqichini tanlab,
            «Aylantirish»ni bosing.
          </p>
          <LinkButton href={`${voucherTabHref()}#baraban`}>
            <Dices className="size-4" aria-hidden />
            Barabanga o&apos;tish
          </LinkButton>
        </Card>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-600 tabular-nums">
              Jami <b className="font-semibold text-ink">{formatNumber(total)}</b> g&apos;olib ·{" "}
              {formatNumber(live.length)} ta tanlov
            </p>
            <Input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Ism yoki telefon"
              className="w-full sm:w-64"
              aria-label="Voucher g'oliblari ichida qidirish"
            />
          </div>
          {nothingFound && (
            <p className="rounded-2xl border border-line bg-white px-4 py-8 text-center text-sm text-slate-500">
              Hech kim topilmadi
            </p>
          )}
          <ul className="space-y-3" aria-label="O'tkazilgan voucher tanlovlari">
            {live.map((summary, index) => {
              const detail = details[index];
              return (
                <DrawRow
                  // Qidiruv o'zgarsa sahifalash boshidan boshlanadi va ro'yxat ochiladi.
                  key={`${summary.id}:${needle}`}
                  summary={summary}
                  draw={detail?.data}
                  loading={detail?.isPending ?? true}
                  error={detail?.isError ? errorMessage(detail.error) : null}
                  needle={needle}
                />
              );
            })}
          </ul>
        </>
      )}

      <p className="text-xs text-muted">
        Bir ishtirokchi bir necha oy voucher yutishi mumkin — har oy alohida tanlov. Bekor qilingan tanlovlar
        hisobga kirmaydi.
      </p>

      {cancelled.length > 0 && (
        <MoreDetails title="Bekor qilingan tanlovlar" meta={`${formatNumber(cancelled.length)} ta`} contentClassName="p-0">
          <ul className="divide-y divide-slate-100">
            {cancelled.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <span className="flex min-w-0 flex-wrap items-center gap-2 text-sm">
                  <span className="font-medium text-ink tabular-nums">{drawTitle(item)}</span>
                  <Badge tone={DRAW_STATUS_TONES[item.status]}>{DRAW_STATUS_LABELS[item.status]}</Badge>
                </span>
                <OpenLink summary={item} />
              </li>
            ))}
          </ul>
        </MoreDetails>
      )}
    </div>
  );
}

/**
 * "Ochish" — tanlov natijasi (asosiy sovrin — o'z tabida): sahifa natija sarlavhasiga suriladi,
 * tepadagi barabandagi sovrin saqlanadi.
 */
function OpenLink({ summary }: { summary: VoucherDrawSummary }) {
  const searchParams = useSearchParams();
  const anchor = isMonthly(summary) ? VOUCHER_DRAW_ANCHOR : MAIN_DRAW_RESULT_ANCHOR;
  return (
    <Link
      href={`${drawHref(summary, searchParams.get("prize"))}#${anchor}`}
      aria-label={`${drawTitle(summary)}: natijani ochish`}
      className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-brand-600 hover:text-brand-700"
    >
      Ochish
      <ArrowUpRight className="size-3.5" aria-hidden />
    </Link>
  );
}

/** Bitta tanlov: sarlavha qatori va yopiq g'oliblar jadvali. */
function DrawRow({
  summary,
  draw,
  loading,
  error,
  needle,
}: {
  summary: VoucherDrawSummary;
  draw: VoucherDraw | undefined;
  loading: boolean;
  error: string | null;
  needle: string;
}) {
  const [page, setPage] = useState(1);
  const winners = useMemo(() => {
    const active = (draw?.winnerEntries ?? []).filter((entry) => entry.state === "ACTIVE");
    return needle ? active.filter((entry) => matches(entry, needle)) : active;
  }, [draw, needle]);
  const rows = winners.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Qidiruvda topilmagan tanlov ko'rsatilmaydi.
  if (needle && draw && winners.length === 0) return null;

  return (
    <li>
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <h3 className="text-sm font-semibold text-ink tabular-nums">{drawTitle(summary)}</h3>
            <span className="text-sm text-muted tabular-nums" aria-hidden>
              ·
            </span>
            <span className="text-sm text-slate-600 tabular-nums">{formatNumber(summary.winners)} g&apos;olib</span>
            <Badge tone={DRAW_STATUS_TONES[summary.status]}>{DRAW_STATUS_LABELS[summary.status]}</Badge>
          </div>
          <OpenLink summary={summary} />
        </div>
        <MoreDetails
          title="G'oliblar ro'yxati"
          meta={needle && draw ? `${formatNumber(winners.length)} ta topildi` : null}
          // Qidiruvda — topilganlar darhol ko'rinsin.
          defaultOpen={needle !== ""}
          className="rounded-none border-x-0 border-b-0"
          contentClassName="p-0"
        >
          {loading ? (
            <Spinner className="px-5 py-4" />
          ) : error ? (
            <p className="px-5 py-4 text-sm text-red-700">{error}</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[440px] text-sm">
                  <thead className="border-b border-line bg-slate-50 text-xs text-slate-500">
                    <tr>
                      <th className="w-16 px-5 py-2.5 text-left font-medium">#</th>
                      <th className="px-4 py-2.5 text-left font-medium">Ishtirokchi</th>
                      <th className="px-4 py-2.5 text-left font-medium">Telefon</th>
                      <th className="px-5 py-2.5 text-right font-medium">Ko&apos;rishlar</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rows.map((entry) => (
                      <tr key={entry.candidate.participantId} className="hover:bg-slate-50/60">
                        <td className="px-5 py-2.5 font-medium text-slate-500 tabular-nums">{entry.position}</td>
                        <td className="px-4 py-2.5 font-medium whitespace-nowrap text-ink">
                          {entry.candidate.firstName} {entry.candidate.lastName}
                        </td>
                        <td className="px-4 py-2.5 whitespace-nowrap tabular-nums">{entry.candidate.phone}</td>
                        <td className="px-5 py-2.5 text-right tabular-nums">{formatNumber(entry.candidate.views)}</td>
                      </tr>
                    ))}
                    {rows.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-5 py-8 text-center text-slate-500">
                          G&apos;olib yo&apos;q
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {winners.length > PAGE_SIZE && (
                <div className="border-t border-line px-5 py-3">
                  <Pagination page={page} pageSize={PAGE_SIZE} total={winners.length} onPageChange={setPage} />
                </div>
              )}
            </>
          )}
        </MoreDetails>
      </Card>
    </li>
  );
}

function matches(entry: DrawEntry, needle: string): boolean {
  const { firstName, lastName, phone } = entry.candidate;
  return `${firstName} ${lastName} ${phone} ${phone.replace(/\D/g, "")}`.toLowerCase().includes(needle);
}
