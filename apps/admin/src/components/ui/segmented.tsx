"use client";

import type { LucideIcon } from "lucide-react";

import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  /** Yonidagi son (masalan, shu holatdagilar). */
  count?: number;
  /** `true` va son > 0 — son qizil bo'ladi (e'tibor talab qiladi: yangi, xato, bloklangan…). */
  attention?: boolean;
  icon?: LucideIcon;
}

interface SegmentedProps<T extends string> {
  options: SegmentedOption<T>[];
  /** Tanlangan qiymat; hech biri tanlanmagan bo'lsa — null. */
  value: T | null;
  onChange: (value: T) => void;
  /** Guruh nomi (ekran o'quvchilari uchun). */
  label: string;
  size?: "sm" | "md";
  /** Butun kenglikni egallash (segmentlar teng). */
  fill?: boolean;
  className?: string;
}

/**
 * iOS uslubidagi segment: kulrang "yo'lak" ichida tanlangani oq, yumshoq soyali pill.
 * Sig'masa — gorizontal aylantiriladi (qatorga bo'linmaydi).
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  size = "md",
  fill = false,
  className,
}: SegmentedProps<T>) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        "max-w-full gap-1 overflow-x-auto rounded-full bg-slate-200/70 p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        fill ? "flex w-full" : "inline-flex",
        className,
      )}
    >
      {options.map((option) => {
        const active = option.value === value;
        const Icon = option.icon;
        const highlight = option.attention && (option.count ?? 0) > 0;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full font-medium whitespace-nowrap transition-all duration-200",
              size === "sm" ? "px-3 py-1 text-xs" : "px-4 py-1.5 text-sm",
              fill && "flex-1",
              active
                ? "bg-white text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.1),0_4px_12px_-4px_rgba(15,23,42,0.18)]"
                : "text-slate-600 hover:text-slate-900",
            )}
          >
            {Icon && <Icon className={size === "sm" ? "size-3.5" : "size-4"} aria-hidden />}
            {option.label}
            {option.count !== undefined && (
              <span
                className={cn(
                  "tabular-nums",
                  highlight ? "font-semibold text-red-600" : "text-slate-400",
                )}
              >
                {formatNumber(option.count)}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
