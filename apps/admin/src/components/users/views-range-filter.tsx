"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown, Eye } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatCompact, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

interface Range {
  min: number | null;
  max: number | null;
}

/** Tez tanlash: ko'p so'raladigan oraliqlar (ikkala chegara ham kiradi). */
export const VIEWS_PRESETS: Array<Range & { label: string }> = [
  { label: "10 minggacha", min: null, max: 10_000 },
  { label: "10 ming – 100 ming", min: 10_000, max: 100_000 },
  { label: "100 ming – 1 mln", min: 100_000, max: 1_000_000 },
  { label: "1 mln dan ko'p", min: 1_000_000, max: null },
];

/** Tugmadagi yozuv: "Ko'rishlar: 100 ming – 1 mln". */
export function viewsRangeLabel({ min, max }: Range): string {
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

/**
 * Ko'rishlar soni bo'yicha filtr (Foydalanuvchilar): tayyor oraliqlar yoki "dan" / "gacha"
 * qo'lda. Ikkala chegara ham kiradi; bittasi bo'sh qolsa — o'sha tomonda chegara yo'q.
 */
export function ViewsRangeFilter({
  min,
  max,
  onChange,
  className,
}: Range & { onChange: (range: Range) => void; className?: string }) {
  const [open, setOpen] = useState(false);
  const [minText, setMinText] = useState(toText(min));
  const [maxText, setMaxText] = useState(toText(max));
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const active = min !== null || max !== null;

  const draft: Range = { min: parseDigits(minText), max: parseDigits(maxText) };
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

  function apply(range: Range) {
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
          Ko&apos;rishlar: <span className={cn(active && "font-semibold text-brand-700")}>{viewsRangeLabel({ min, max })}</span>
        </span>
        <ChevronDown className={cn("size-4 shrink-0 text-slate-400 transition", open && "rotate-180")} aria-hidden />
      </button>

      {open && (
        <div
          id={panelId}
          role="dialog"
          aria-label="Ko'rishlar soni bo'yicha filtr"
          className="absolute top-full left-0 z-30 mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-line bg-white p-4 shadow-[0_20px_50px_-20px_rgba(39,38,39,0.35)]"
        >
          <p className="text-xs font-medium text-muted">Tez tanlash</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {VIEWS_PRESETS.map((preset) => {
              const selected = preset.min === min && preset.max === max;
              return (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => apply({ min: preset.min, max: preset.max })}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-medium transition",
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

          <form
            className="mt-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (!invalid) apply(draft);
            }}
          >
            <p className="text-xs font-medium text-muted">Oraliq (ikkala chegara ham kiradi)</p>
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
