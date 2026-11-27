import { Info } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Sahifa tepasidagi bir-ikki qatorlik izoh: bu sahifa nima uchun va nima qilish kerak — oddiy
 * tilda, texnik so'zlarsiz. Har bo'limda bir xil ko'rinadi.
 */
export function PageHint({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p
      className={cn(
        "flex items-start gap-2.5 rounded-2xl border border-brand-100 bg-brand-50/60 px-4 py-3 text-sm leading-relaxed text-slate-700",
        className,
      )}
    >
      <Info className="mt-0.5 size-4 shrink-0 text-brand-600" aria-hidden />
      <span className="min-w-0">{children}</span>
    </p>
  );
}
