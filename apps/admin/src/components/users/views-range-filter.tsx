"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown, Eye } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatCompact, formatNumber } from "@/lib/format";
import { RATING_PRIZE_LABELS } from "@/lib/labels";
import { cn } from "@/lib/utils";

import { useViewsPresets, type ViewsPreset, type ViewsRange } from "./prize-ranges";

/** Tugmadagi yozuv: "Ko'rishlar: 100 ming – 1 mln". */
export function viewsRangeLabel({ min, max }: ViewsRange): string {
  if (min !== null && max !== null) return `${formatCompact(min)} – ${formatCompact(max)}`;
  if (min !== null) return `${formatCompact(min)} dan ko'p`;
  if (max !== null) return `${formatCompact(max)} gacha`;
  return "hammasi";
}

/** "100 000" yoki "100000" → 100000; bo'sh — null. */
export function parseDigits(text: string): number | null {
  const digits = text.replace(/\D/g, "");
  return digits ? Number(digits.slice(0, 13)) : null;
}

export const toText = (value: number | null) => (value === null ? "" : formatNumber(value));

/** Tanlangan oraliq tayyor oraliqlardan biri bo'lsa — o'sha. */
export function matchingPreset(presets: readonly ViewsPreset[], { min, max }: ViewsRange): ViewsPreset | null {
  return presets.find((preset) => preset.min === min && preset.max === max) ?? null;
}

/**
 * Tez tanlash tugmalari sarlavhasi bilan (Ishtirokchilar filtri va "Ko'rishlarni yangilash" oynasi
 * uchun bir xil). Sovrinlar hali yuklanmagan bo'lsa — umumiy oraliqlar, sarlavha "Tez tanlash".
 */
export function ViewsPresetChips({
  presets,
  value,
  onSelect,
  className,
}: {
  presets: readonly ViewsPreset[];
  value: ViewsRange;
  onSelect: (range: ViewsRange) => void;
  className?: string;
}) {
  const titleId = useId();
  const byPrize = presets.some((preset) => preset.kind !== null);

  return (
    <div className={className}>
      <p id={titleId} className="text-xs font-medium text-muted">
        {byPrize ? "Sovrin oralig'i bo'yicha tanlash" : "Tez tanlash"}
      </p>
      <div role="group" aria-labelledby={titleId} className="mt-2 flex flex-wrap gap-1.5">
        {presets.map((preset) => {
          const selected = preset.min === value.min && preset.max === value.max;
          return (
            <button
              key={preset.label}
              type="button"
              aria-pressed={selected}
              onClick={() => onSelect({ min: preset.min, max: preset.max })}
              className={cn(
                "rounded-full border px-3 py-1 text-left text-xs font-medium tabular-nums transition",
                selected
                  ? "border-brand-600 bg-brand-600 text-white"
                  : "border-slate-200 bg-white text-slate-700 hover:border-brand-300 hover:bg-brand-50",
              )}
            >
              {preset.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Ko'rishlar soni bo'yicha filtr (Ishtirokchilar): asosiy sovrinlar oraliqlari (oferta 6.2) yoki
 * "dan" / "gacha" qo'lda. Ikkala chegara ham kiradi; bittasi bo'sh qolsa — o'sha tomonda chegara
 * yo'q. Oraliq — ishtirokchining barcha qabul qilingan videolari ko'rishlari yig'indisi bo'yicha.
 */
export function ViewsRangeFilter({
  min,
  max,
  onChange,
  className,
}: ViewsRange & { onChange: (range: ViewsRange) => void; className?: string }) {
  const presets = useViewsPresets();
  const [open, setOpen] = useState(false);
  const [minText, setMinText] = useState(toText(min));
  const [maxText, setMaxText] = useState(toText(max));
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const hintId = useId();
  const active = min !== null || max !== null;
  const matched = matchingPreset(presets, { min, max });

  const draft: ViewsRange = { min: parseDigits(minText), max: parseDigits(maxText) };
  const invalid = draft.min !== null && draft.max !== null && draft.min > draft.max;

  function openPanel() {
    setMinText(toText(min));
    setMaxText(toText(max));
    setOpen(true);
  }

  function close(returnFocus: boolean) {
    setOpen(false);
    if (returnFocus) buttonRef.current?.focus();
  }

  function apply(range: ViewsRange) {
    onChange(range);
    close(true);
  }

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function handleKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setOpen(false);
      buttonRef.current?.focus();
    }
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  // Tanlangan oraliq sovrin oralig'i bo'lsa — sovrin nomi, aks holda — sonlar.
  const buttonValue = matched?.kind ? `${RATING_PRIZE_LABELS[matched.kind]} oralig'i` : viewsRangeLabel({ min, max });

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => (open ? close(false) : openPanel())}
        aria-expanded={open}
        aria-controls={panelId}
        className={cn(
          "flex h-10 w-full items-center gap-2 rounded-xl border bg-white pr-3 pl-3 text-left text-sm text-ink transition",
          "focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none",
          active ? "border-brand-300 bg-brand-50/60" : "border-line",
        )}
      >
        <Eye className={cn("size-4 shrink-0", active ? "text-brand-600" : "text-slate-400")} aria-hidden />
        <span className="min-w-0 flex-1 truncate">
          Ko&apos;rishlar: <span className={cn(active && "font-semibold text-brand-700")}>{buttonValue}</span>
        </span>
        <ChevronDown className={cn("size-4 shrink-0 text-slate-400 transition", open && "rotate-180")} aria-hidden />
      </button>

      {open && (
        <div
          id={panelId}
          role="dialog"
          aria-label="Ko'rishlar soni bo'yicha filtr"
          aria-describedby={hintId}
          className="absolute top-full left-0 z-30 mt-2 w-[min(24rem,calc(100vw-2rem))] rounded-2xl border border-line bg-white p-4 shadow-[0_20px_50px_-20px_rgba(39,38,39,0.35)]"
        >
          <p id={hintId} className="text-xs text-muted">
            Oraliq — barcha qabul qilingan videolar ko&apos;rishlari yig&apos;indisi bo&apos;yicha.
          </p>

          <ViewsPresetChips presets={presets} value={{ min, max }} onSelect={apply} className="mt-3" />

          <form
            className="mt-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (!invalid) apply(draft);
            }}
          >
            <p className="text-xs font-medium text-muted">Yoki o&apos;zingiz kiriting (ikkala chegara ham kiradi)</p>
            <div className="mt-2 flex items-center gap-2">
              <label className="relative flex-1">
                <span className="sr-only">Ko&apos;rishlar, dan</span>
                <input
                  inputMode="numeric"
                  autoFocus
                  placeholder="dan"
                  value={minText}
                  onChange={(event) => setMinText(toText(parseDigits(event.target.value)))}
                  aria-invalid={invalid || undefined}
                  className="h-10 w-full rounded-xl border border-line px-3 text-sm tabular-nums focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none aria-invalid:border-red-500"
                />
              </label>
              <span className="text-muted">–</span>
              <label className="relative flex-1">
                <span className="sr-only">Ko&apos;rishlar, gacha</span>
                <input
                  inputMode="numeric"
                  placeholder="gacha"
                  value={maxText}
                  onChange={(event) => setMaxText(toText(parseDigits(event.target.value)))}
                  aria-invalid={invalid || undefined}
                  className="h-10 w-full rounded-xl border border-line px-3 text-sm tabular-nums focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none aria-invalid:border-red-500"
                />
              </label>
            </div>
            {invalid && <p className="mt-1.5 text-xs text-red-600">«Dan» «gacha»dan katta bo&apos;lmasin.</p>}

            <div className="mt-4 flex items-center justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => apply({ min: null, max: null })}>
                Tozalash
              </Button>
              <Button type="submit" size="sm" disabled={invalid}>
                Qo&apos;llash
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
