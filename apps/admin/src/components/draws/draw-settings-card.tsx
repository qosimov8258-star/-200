"use client";

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, CheckCircle2, ChevronDown, Lock, Pencil, SlidersHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { saveDrawSettings } from "@/lib/api";
import { errorMessage } from "@/lib/api-error";
import { drawSettingsInputOf, renderDrawMessage, validateDrawSettingsInput } from "@/lib/draw-rules";
import { formatDateTime, formatNumber, formatViewsRange } from "@/lib/format";
import { DRAW_DATE_BASIS_LABELS } from "@/lib/labels";
import type { DrawSettingsInput, DrawSetup, SavedDrawSettings } from "@/lib/types";
import { cn } from "@/lib/utils";

import {
  DATE_BASIS_HINTS,
  DrawMessagePreview,
  DrawSettingsForm,
  PREVIOUS_WINNERS_RULE,
  type DrawMessageExample,
} from "./draw-settings-form";

const NOTICE_TIMEOUT_MS = 4000;

interface DrawSettingsCardProps {
  setup: DrawSetup;
  /** Tahrirlash rejimi (ota komponent "Tanlash"ni shu payt o'chiradi). */
  editing: boolean;
  onEditingChange: (editing: boolean) => void;
}

/**
 * "Sozlamalar" kartasi. Hali tasdiqlanmagan bo'lsa — forma va "Tasdiqlash"; tasdiqlangan bo'lsa —
 * qisqa xulosa va "Tahrirlash" (forma → "Saqlash" / "Bekor qilish"). Har tanlovda qayta kiritilmaydi.
 */
export function DrawSettingsCard({ setup, editing, onEditingChange }: DrawSettingsCardProps) {
  const queryClient = useQueryClient();
  const saved = setup.saved;
  const formOpen = saved === null || editing;
  const [draft, setDraft] = useState<DrawSettingsInput | null>(null);
  const value = draft ?? drawSettingsInputOf(saved ?? setup.defaults);
  const errors = validateDrawSettingsInput(value);
  const valid = Object.keys(errors).length === 0;
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), NOTICE_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [notice]);

  const example: DrawMessageExample = {
    prizeTitle: setup.prizes.find((prize) => prize.id === setup.defaults.prizeId)?.title ?? "Voucher",
    stage: setup.defaults.stage,
    periodFrom: setup.defaults.periodFrom,
    periodTo: setup.defaults.periodTo,
  };

  const save = useMutation({
    mutationFn: (input: DrawSettingsInput) => saveDrawSettings(input),
    onSuccess: async (next) => {
      queryClient.setQueryData(["draw-setup"], next);
      setDraft(null);
      onEditingChange(false);
      setNotice(saved === null ? "Sozlamalar tasdiqlandi. Endi bosqichni tanlab, «Tanlash»ni bosing." : "Sozlamalar saqlandi.");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["draw-preview"] }),
        queryClient.invalidateQueries({ queryKey: ["audit-log"] }),
      ]);
    },
  });

  const cancel = () => {
    setDraft(null);
    save.reset();
    onEditingChange(false);
  };

  return (
    <Card>
      <CardHeader className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <CardTitle className="flex items-center gap-2">
            <SlidersHorizontal className="size-4 text-brand-600" aria-hidden />
            Sozlamalar
          </CardTitle>
          <p className="mt-0.5 text-xs text-muted">
            {saved === null
              ? "Bir marta tasdiqlang — keyingi tanlovlar shu sozlamalar bilan o'tadi."
              : editing
                ? "O'zgarishlar keyingi tanlovlarga qo'llanadi. O'tkazilgan tanlovlar o'zgarmaydi."
                : "Har tanlovda shu sozlamalar ishlatiladi."}
          </p>
        </div>
        {saved !== null && !editing && (
          <Button variant="secondary" size="sm" onClick={() => onEditingChange(true)}>
            <Pencil className="size-3.5" aria-hidden />
            Tahrirlash
          </Button>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        <div role="status" aria-live="polite">
          {notice && (
            <p className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
              <CheckCircle2 className="size-4 shrink-0" aria-hidden />
              {notice}
            </p>
          )}
        </div>

        {formOpen ? (
          <>
            <DrawSettingsForm
              value={value}
              errors={errors}
              onChange={setDraft}
              placeholders={setup.placeholders}
              example={example}
              disabled={save.isPending}
            />
            {save.isError && (
              <p role="alert" className="flex gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
                {errorMessage(save.error)}
              </p>
            )}
            <div className="flex flex-col-reverse gap-2 border-t border-line pt-4 sm:flex-row sm:justify-end">
              {saved !== null && (
                <Button variant="secondary" onClick={cancel} disabled={save.isPending}>
                  Bekor qilish
                </Button>
              )}
              <Button onClick={() => save.mutate(value)} disabled={!valid} loading={save.isPending}>
                <CheckCircle2 className="size-4" aria-hidden />
                {saved === null ? "Tasdiqlash" : "Saqlash"}
              </Button>
            </div>
          </>
        ) : (
          <DrawSettingsSummary saved={saved} example={example} />
        )}
      </CardContent>
    </Card>
  );
}

/** Tasdiqlangan sozlamalarning qisqa ko'rinishi (faqat o'qish). */
function DrawSettingsSummary({ saved, example }: { saved: SavedDrawSettings; example: DrawMessageExample }) {
  const [showMessage, setShowMessage] = useState(false);
  const message = renderDrawMessage(saved.messageTemplate, {
    firstName: "Dilnoza",
    lastName: "Rahimova",
    ...example,
    views: 24_560,
  });

  return (
    <div className="space-y-4">
      <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
        <Row label="Reel sanasi" value={DRAW_DATE_BASIS_LABELS[saved.dateBasis]} hint={DATE_BASIS_HINTS[saved.dateBasis]} />
        <Row
          label="Ko'rishlar oralig'i"
          value={formatViewsRange(saved.minViews, saved.maxViews)}
          hint="Davrdagi barcha tasdiqlangan videolar ko'rishlarining yig'indisi (oferta 7.1–7.2)"
        />
        <Row
          label="G'oliblar va zaxira"
          value={`${formatNumber(saved.winnersCount)} g'olib · ${formatNumber(saved.reservesCount)} zaxira`}
        />
        <Row label="Chetda qoladi" value={excludedLabel(saved)} hint={includedHint(saved)} />
      </dl>

      <p className="flex items-start gap-2.5 rounded-xl bg-[#f7f6fb] px-3.5 py-2.5 text-sm">
        <Lock className="mt-0.5 size-4 shrink-0 text-brand-600" aria-hidden />
        <span className="min-w-0 flex-1 font-medium text-ink">
          {PREVIOUS_WINNERS_RULE}{" "}
          <span className="ml-1 inline-block rounded-full bg-brand-100 px-2 py-0.5 align-middle text-[11px] font-medium whitespace-nowrap text-brand-700">
            Ofertada
          </span>
        </span>
      </p>

      <div>
        <button
          type="button"
          onClick={() => setShowMessage((open) => !open)}
          aria-expanded={showMessage}
          className="flex items-center gap-1.5 text-sm font-medium text-slate-700 hover:text-slate-900"
        >
          G&apos;oliblarga bot xabari
          <ChevronDown className={cn("size-4 transition", showMessage && "rotate-180")} aria-hidden />
        </button>
        {showMessage && (
          <div className="mt-2">
            <DrawMessagePreview text={message} />
          </div>
        )}
      </div>

      <p className="border-t border-line pt-3 text-xs text-muted">
        Saqlangan: {formatDateTime(saved.updatedAt)} · {saved.updatedBy}
      </p>
    </div>
  );
}

/** "Target aniqlanganlar, ogohlantirilganlar, bloklanganlar". */
function excludedLabel(saved: SavedDrawSettings): string {
  const list: string[] = [];
  if (saved.excludeTargets) list.push("target aniqlanganlar");
  if (saved.excludeWarned) list.push("ogohlantirilganlar");
  list.push("bloklanganlar");
  return list.join(", ");
}

/** Chetga chiqarilmaganlar haqida eslatma (hammasi chetda bo'lsa — yo'q). */
function includedHint(saved: SavedDrawSettings): string | undefined {
  const list: string[] = [];
  if (!saved.excludeTargets) list.push("target aniqlanganlar");
  if (!saved.excludeWarned) list.push("ogohlantirilganlar");
  if (list.length === 0) return undefined;
  const text = list.join(" va ");
  return `${text.charAt(0).toUpperCase()}${text.slice(1)} qatnashadi.`;
}

function Row({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-0.5 font-medium text-ink tabular-nums first-letter:uppercase">{value}</dd>
      {hint && <dd className="text-xs text-muted">{hint}</dd>}
    </div>
  );
}
