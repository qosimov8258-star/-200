"use client";

import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Ticket } from "lucide-react";

import { Card } from "@/components/ui/card";
import { IosIcon } from "@/components/ui/ios-icon";
import { getDrawStock } from "@/lib/api";
import { errorMessage } from "@/lib/api-error";
import { todayIso } from "@/lib/dates";
import { formatDayMonth, formatNumber } from "@/lib/format";
import type { DrawStock, DrawStockStage } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * G'oliblar → "Voucher" tabi tepasidagi karta: oylik voucherlardan hozir nechtasi qolgani
 * (jami / yuborilgan / tasdiqlangan / tasdiqlanmagan) va bosqichlar bo'yicha taqsimot.
 * So'rov kaliti `["draws", …]` — tanlov o'tkazilsa, tasdiqlansa yoki yuborilsa o'zi yangilanadi.
 */
export function DrawStockSummary() {
  const stock = useQuery({ queryKey: ["draws", "stock"], queryFn: getDrawStock });

  if (stock.isPending) {
    return <div aria-hidden className="h-[188px] animate-pulse rounded-panel border border-line bg-white" />;
  }
  if (stock.isError) {
    return (
      <p role="alert" className="text-sm text-red-700">
        Voucherlar qoldig&apos;ini yuklab bo&apos;lmadi: {errorMessage(stock.error)}
      </p>
    );
  }
  return (
    <div className="space-y-4">
      {stock.data.map((item) => (
        <StockCard key={item.prizeId} stock={item} />
      ))}
    </div>
  );
}

const SEGMENTS = [
  { key: "sent", label: "Yuborilgan", dot: "bg-up-bar", bar: "bg-up-bar" },
  { key: "confirmed", label: "Tasdiqlangan", dot: "bg-brand-500", bar: "bg-brand-500" },
  { key: "draft", label: "Tasdiqlanmagan", dot: "bg-amber-400", bar: "bg-amber-300 bg-hatch" },
] as const;

function StockCard({ stock }: { stock: DrawStock }) {
  const share = (value: number) => (stock.total > 0 ? (value / stock.total) * 100 : 0);
  const today = todayIso();

  return (
    <Card className="overflow-hidden">
      <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)] lg:items-center lg:gap-8">
        <div className="flex items-start gap-4">
          <IosIcon icon={Ticket} tint="orange" size={44} />
          <div className="min-w-0">
            <p className="text-[13px] font-medium text-muted">Qolgan voucherlar</p>
            <p className="mt-0.5 flex items-baseline gap-1.5">
              <span className="text-[34px] leading-none font-semibold tracking-tight text-ink tabular-nums">
                {formatNumber(stock.remaining)}
              </span>
              <span className="text-sm text-muted tabular-nums">/ {formatNumber(stock.total)} ta</span>
            </p>
            <p className="mt-1.5 truncate text-xs text-muted" title={stock.title}>
              {stock.title}
            </p>
          </div>
        </div>

        <div className="min-w-0 space-y-3">
          <div
            role="img"
            aria-label={`Jami ${stock.total}: yuborilgan ${stock.sent}, tasdiqlangan ${stock.confirmed}, tasdiqlanmagan ${stock.draft}, qolgan ${stock.remaining}`}
            className="flex h-3 overflow-hidden rounded-full bg-[#efeef4]"
          >
            {SEGMENTS.map((segment) =>
              stock[segment.key] > 0 ? (
                <span
                  key={segment.key}
                  className={cn("h-full border-r-2 border-white last:border-r-0", segment.bar)}
                  style={{ width: `${share(stock[segment.key])}%` }}
                />
              ) : null,
            )}
          </div>
          <ul className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs">
            {SEGMENTS.map((segment) => (
              <li key={segment.key} className="flex items-center gap-1.5 text-muted">
                <span aria-hidden className={cn("size-2 rounded-full", segment.dot)} />
                {segment.label}
                <span className="font-semibold text-ink tabular-nums">{formatNumber(stock[segment.key])}</span>
              </li>
            ))}
            <li className="flex items-center gap-1.5 text-muted">
              <span aria-hidden className="size-2 rounded-full bg-[#dddbe6]" />
              Qolgan
              <span className="font-semibold text-ink tabular-nums">{formatNumber(stock.remaining)}</span>
            </li>
          </ul>
          {stock.draft > 0 && (
            <p className="text-xs text-amber-700">
              Tasdiqlanmagan {formatNumber(stock.draft)} ta hali qoldiqdan ayrilmagan — natija tasdiqlangach ayriladi.
            </p>
          )}
        </div>
      </div>

      {stock.stages.length > 0 && (
        <ul
          className="grid divide-y divide-line border-t border-line sm:grid-cols-[repeat(var(--stages),minmax(0,1fr))] sm:divide-x sm:divide-y-0"
          style={{ "--stages": stock.stages.length } as React.CSSProperties}
        >
          {stock.stages.map((stage) => (
            <StageCell key={stage.index} stage={stage} today={today} />
          ))}
        </ul>
      )}
    </Card>
  );
}

function StageCell({ stage, today }: { stage: DrawStockStage; today: string }) {
  const given = stage.sent + stage.confirmed;
  const done = stage.quantity > 0 && given >= stage.quantity;
  const state = stage.finished ? "finished" : stage.startsOn <= today ? "current" : "upcoming";

  return (
    <li className="px-5 py-3.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-ink">{stage.index}-bosqich</span>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[11px] font-medium",
            state === "finished" && "bg-[#e9f6ee] text-up",
            state === "current" && "bg-amber-50 text-amber-700",
            state === "upcoming" && "bg-[#f3f2f6] text-muted",
          )}
        >
          {state === "finished" ? "tugagan" : state === "current" ? "davom etmoqda" : "boshlanmagan"}
        </span>
      </div>
      <p className="mt-0.5 text-xs text-muted tabular-nums">
        {formatDayMonth(stage.startsOn)} – {formatDayMonth(stage.endsOn)}
      </p>
      <div className="mt-2.5 flex items-baseline justify-between gap-2 text-xs">
        <span className="flex items-center gap-1 text-muted">
          {done && <CheckCircle2 className="size-3.5 text-up" aria-hidden />}
          Berildi
        </span>
        <span className="text-muted tabular-nums">
          <span className="font-semibold text-ink">{formatNumber(given)}</span> / {formatNumber(stage.quantity)}
        </span>
      </div>
      <div className="mt-1.5 flex h-1.5 overflow-hidden rounded-full bg-[#efeef4]" aria-hidden>
        {stage.quantity > 0 && (
          <>
            <span className="h-full bg-up-bar" style={{ width: `${Math.min(100, (stage.sent / stage.quantity) * 100)}%` }} />
            <span
              className="h-full bg-brand-500"
              style={{ width: `${Math.min(100, (stage.confirmed / stage.quantity) * 100)}%` }}
            />
            <span
              className="h-full bg-amber-300 bg-hatch"
              style={{ width: `${Math.min(100, (stage.draft / stage.quantity) * 100)}%` }}
            />
          </>
        )}
      </div>
      {stage.draft > 0 && (
        <p className="mt-1.5 text-[11px] text-amber-700">Tasdiqlanmagan: {formatNumber(stage.draft)}</p>
      )}
    </li>
  );
}
