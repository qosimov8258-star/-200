import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement>;

/** Brauzerning o'z `<select>` i — klaviatura va ekran o'quvchilari bilan to'liq ishlaydi. */
export function Select({ className, children, ...props }: SelectProps) {
  return (
    <div className={cn("relative", className)}>
      <select
        className={cn(
          "h-10 w-full appearance-none rounded-xl border border-line bg-white pr-9 pl-3 text-sm text-ink",
          "focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none",
          "disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500",
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-slate-400"
        aria-hidden
      />
    </div>
  );
}
