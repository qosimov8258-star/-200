import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/** iOS tizim ranglari (yorug' rejim) — Sozlamalar ilovasidagi ikonkalar kabi. */
const TINTS = {
  blue: ["#4a8cf8", "#2f6fec"],
  indigo: ["#7a78f5", "#5856d6"],
  purple: ["#b77cf2", "#9b51e0"],
  pink: ["#f8678a", "#ee3f66"],
  red: ["#f45d6f", "#e8394f"],
  orange: ["#ffab3d", "#ff8a00"],
  yellow: ["#ffcf3f", "#f5ab00"],
  green: ["#4cd472", "#2fb553"],
  teal: ["#4fc8d8", "#22a6ba"],
  cyan: ["#5ac2f5", "#2a9fe0"],
  gray: ["#a3a3a9", "#8a8a91"],
  brown: ["#c09f78", "#9c7c55"],
} as const satisfies Record<string, readonly [string, string]>;

export type IosTint = keyof typeof TINTS;

interface IosIconProps {
  icon: LucideIcon;
  tint?: IosTint;
  /** Plitka o'lchami, px. */
  size?: number;
  className?: string;
}

/**
 * iOS uslubidagi ikonka: rangli yumaloq burchakli plitka (burchak ≈ o'lchamning 24%) va oq belgi.
 * Bezak uchun — `aria-hidden`; ma'noni yonidagi matn beradi.
 */
export function IosIcon({ icon: Icon, tint = "blue", size = 32, className }: IosIconProps) {
  const [from, to] = TINTS[tint];
  return (
    <span
      aria-hidden
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden text-white",
        "shadow-[0_1px_2px_rgba(15,23,42,0.14),0_4px_10px_-5px_rgba(15,23,42,0.3)]",
        className,
      )}
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.24),
        backgroundImage: `linear-gradient(180deg, ${from}, ${to})`,
      }}
    >
      <Icon className="relative" style={{ width: size * 0.52, height: size * 0.52 }} strokeWidth={2.1} />
    </span>
  );
}
