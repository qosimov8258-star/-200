"use client";

import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

interface MoreDetailsProps {
  /** Masalan: "Batafsil: sozlamalar va maxsus davr". */
  title: React.ReactNode;
  /** Sarlavha yonida kichik izoh (masalan, "2 ta filtr yoqilgan"). */
  meta?: React.ReactNode;
  /** Boshida ochiq bo'lsin (masalan, ichida xato yoki yoqilgan filtr bo'lsa). */
  defaultOpen?: boolean;
  className?: string;
  /** Ichki qism uchun qo'shimcha klasslar. */
  contentClassName?: string;
  children: React.ReactNode;
}

/**
 * Kamdan-kam kerak bo'ladigan sozlama yoki texnik tafsilotlar uchun yopiq bo'lim ("Batafsil").
 * Hamma sahifada bir xil ko'rinadi: chevron, "ochish/yopish" yozuvi, fokus halqasi. Oddiy
 * `<details>` — JavaScript'siz ham ishlaydi.
 */
export function MoreDetails({ title, meta, defaultOpen = false, className, contentClassName, children }: MoreDetailsProps) {
  return (
    <details open={defaultOpen || undefined} className={cn("group rounded-2xl border border-line bg-white", className)}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-2xl px-4 py-3 text-sm font-semibold text-ink hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-brand-500 [&::-webkit-details-marker]:hidden">
        <span className="flex min-w-0 flex-wrap items-baseline gap-x-2">
          {title}
          {meta && <span className="text-xs font-normal text-muted">{meta}</span>}
        </span>
        <span className="flex shrink-0 items-center gap-1 text-xs font-normal text-muted">
          <span className="group-open:hidden">ochish</span>
          <span className="hidden group-open:inline">yopish</span>
          <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden />
        </span>
      </summary>
      <div className={cn("border-t border-line p-4", contentClassName)}>{children}</div>
    </details>
  );
}
