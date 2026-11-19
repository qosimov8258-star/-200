"use client";

import { useState } from "react";
import { AlertTriangle, ChevronDown, Fingerprint, Loader2, UsersRound } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { formatDate, formatNumber } from "@/lib/format";
import { DRAW_EXCLUSION_LABELS } from "@/lib/labels";
import type { DrawExclusion, DrawPreview } from "@/lib/types";
import { cn } from "@/lib/utils";

interface DrawPoolCardProps {
  preview: DrawPreview | undefined;
  loading: boolean;
  error: string | null;
  winnersCount: number;
  reservesCount: number;
}

/** Jonli hisob: nechta nomzod talabga javob beradi va qolganlari nega chetda qoldi. */
export function DrawPoolCard({ preview, loading, error, winnersCount, reservesCount }: DrawPoolCardProps) {
  const [showSample, setShowSample] = useState(false);
  const excluded = preview
    ? (Object.entries(preview.excluded) as Array<[DrawExclusion, number]>).filter(([, n]) => n > 0)
    : [];
  const maxExcluded = Math.max(1, ...excluded.map(([, n]) => n));
  const chance =
    preview && preview.eligibleCount > 0 ? Math.min(1, winnersCount / preview.eligibleCount) : null;

  return (
    <Card className="overflow-hidden">
      <div className="relative bg-[linear-gradient(135deg,#1e3a8a,#2563eb_55%,#7c3aed)] px-5 py-5 text-white">
        <div className="flex items-center justify-between">
          <p className="flex items-center gap-2 text-sm font-medium text-white/80">
            <UsersRound className="size-4" aria-hidden />
            Talabga javob beradiganlar
          </p>
          {loading && <Loader2 className="size-4 animate-spin text-white/80" aria-label="Hisoblanmoqda" />}
        </div>
        <p className="mt-2 text-5xl font-black tracking-tight tabular-nums">
          {preview ? formatNumber(preview.eligibleCount) : "—"}
        </p>
        {preview && (
          <p className="mt-1 text-sm text-white/75">
            {formatNumber(preview.totalReels)} ta Reeldan · ko&apos;rishlar {formatDate(preview.viewsAsOf)} holatiga
          </p>
        )}
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <Stat label="G'olib" value={formatNumber(winnersCount)} />
          <Stat label="Zaxira" value={formatNumber(reservesCount)} />
          <Stat label="Imkoniyat" value={chance === null ? "—" : `${Math.round(chance * 1000) / 10}%`} />
        </div>
      </div>

      <CardContent className="space-y-4">
        {error && (
          <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        {preview && preview.warnings.length > 0 && (
          <ul className="space-y-2">
            {preview.warnings.map((warning) => (
              <li
                key={warning}
                className="flex gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800"
              >
                <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
                {warning}
              </li>
            ))}
          </ul>
        )}

        {excluded.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Chetda qolganlar</h3>
            <ul className="mt-2 space-y-2">
              {excluded.map(([key, n]) => (
                <li key={key}>
                  <div className="flex justify-between text-xs text-slate-600">
                    <span>{DRAW_EXCLUSION_LABELS[key]}</span>
                    <span className="font-medium tabular-nums">{formatNumber(n)}</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-slate-400" style={{ width: `${(n / maxExcluded) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {preview && (
          <p className="flex items-center gap-2 text-xs text-slate-500">
            <Fingerprint className="size-4 shrink-0" aria-hidden />
            Nomzodlar izi: <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-slate-700">{preview.poolHash}</code>
          </p>
        )}

        {preview && preview.sample.length > 0 && (
          <div>
            <button
              type="button"
              onClick={() => setShowSample((open) => !open)}
              className="flex w-full items-center justify-between text-sm font-medium text-slate-700 hover:text-slate-900"
              aria-expanded={showSample}
            >
              Eng ko&apos;p ko&apos;rishli {preview.sample.length} nomzod
              <ChevronDown className={cn("size-4 transition", showSample && "rotate-180")} aria-hidden />
            </button>
            {showSample && (
              <ul className="mt-2 divide-y divide-slate-100 text-sm">
                {preview.sample.map((c) => (
                  <li key={c.participantId} className="flex items-center justify-between gap-3 py-1.5">
                    <span className="truncate">
                      {c.firstName} {c.lastName}
                    </span>
                    <span className="shrink-0 text-xs text-slate-500 tabular-nums">{formatNumber(c.views)} ko&apos;rish</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white/10 px-2 py-2 backdrop-blur">
      <p className="text-lg font-bold tabular-nums">{value}</p>
      <p className="text-[11px] text-white/70">{label}</p>
    </div>
  );
}
