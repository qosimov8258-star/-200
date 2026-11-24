"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQueries, useQuery } from "@tanstack/react-query";
import { ArrowUpRight, Info, Ticket } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { Spinner } from "@/components/ui/spinner";
import { getDraw, getDraws } from "@/lib/api";
import { errorMessage } from "@/lib/api-error";
import { periodLabel, stageLabel } from "@/lib/draw-rules";
import { formatNumber } from "@/lib/format";
import { DRAW_STATUS_LABELS, DRAW_STATUS_TONES } from "@/lib/labels";
import type { DrawEntry, VoucherDraw } from "@/lib/types";

const PAGE_SIZE = 25;

/**
 * "Voucher g'oliblari": bekor qilinmagan barcha random tanlovlarning faol g'oliblari, tanlov bo'yicha
 * guruhlangan. Har bir tanlov `GET /admin/draws/:id` dan (keshi Random tanlov bilan umumiy).
 */
export function VoucherWinners() {
  const draws = useQuery({ queryKey: ["draws"], queryFn: getDraws });
  const live = useMemo(() => (draws.data ?? []).filter((draw) => draw.status !== "CANCELLED"), [draws.data]);
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
      <p className="flex gap-2.5 rounded-2xl border border-brand-200 bg-brand-50/70 px-4 py-3 text-sm text-slate-700">
        <Info className="mt-0.5 size-4 shrink-0 text-brand-600" aria-hidden />
        <span>
          Voucher bir kishiga aksiya davomida bir marta beriladi — bu ro&apos;yxatdagilar keyingi tanlovlarda
          qatnashmaydi. Bekor qilingan tanlovlar kirmaydi.
        </span>
      </p>

      {live.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 px-4 py-12 text-center">
          <Ticket className="size-8 text-slate-300" aria-hidden />
          <p className="text-sm text-slate-600">Hali voucher g&apos;oliblari yo&apos;q.</p>
          <Link href="/draws" className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:text-brand-700">
            Random tanlovga o&apos;tish
            <ArrowUpRight className="size-3.5" aria-hidden />
          </Link>
        </Card>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-600 tabular-nums">
              Jami <b className="font-semibold text-ink">{formatNumber(total)}</b> g&apos;olib ·{" "}
              {formatNumber(live.length)} ta tanlov
            </p>
            <Input
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
          {live.map((summary, index) => {
            const detail = details[index];
            return (
              <DrawWinnersCard
                // Qidiruv o'zgarsa sahifalash boshidan boshlanadi.
                key={`${summary.id}:${needle}`}
                draw={detail?.data}
                loading={detail?.isPending ?? true}
                error={detail?.isError ? errorMessage(detail.error) : null}
                needle={needle}
                title={`#${summary.number} · ${stageLabel(summary.stage)} · ${periodLabel(summary.periodFrom, summary.periodTo)}`}
                status={summary.status}
                id={summary.id}
              />
            );
          })}
        </>
      )}
    </div>
  );
}

function DrawWinnersCard({
  draw,
  loading,
  error,
  needle,
  title,
  status,
  id,
}: {
  draw: VoucherDraw | undefined;
  loading: boolean;
  error: string | null;
  needle: string;
  title: string;
  status: VoucherDraw["status"];
  id: string;
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
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3.5">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold text-ink tabular-nums">{title}</h3>
          <Badge tone={DRAW_STATUS_TONES[status]}>{DRAW_STATUS_LABELS[status]}</Badge>
          {draw && (
            <span className="text-xs text-muted tabular-nums">
              {needle ? `${formatNumber(winners.length)} ta topildi` : `${formatNumber(winners.length)} g'olib`}
            </span>
          )}
        </div>
        <Link
          href={`/draws?id=${encodeURIComponent(id)}`}
          className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:text-brand-700"
        >
          Random tanlovda ochish
          <ArrowUpRight className="size-3.5" aria-hidden />
        </Link>
      </div>
      {loading ? (
        <Spinner />
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
    </Card>
  );
}

function matches(entry: DrawEntry, needle: string): boolean {
  const { firstName, lastName, phone } = entry.candidate;
  return `${firstName} ${lastName} ${phone} ${phone.replace(/\D/g, "")}`.toLowerCase().includes(needle);
}
