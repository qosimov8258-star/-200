import { Check } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type StepState = "done" | "current" | "todo";

/**
 * Ish tartibi qadamlari (masalan: 1. Tanlash → 2. Tasdiqlash → 3. Yuborish). Joriy qadam ajralib
 * turadi ("Hozir"), bajarilgani — yashil belgi bilan, keyingilari — xira. `actions` — shu qadamning
 * bitta asosiy tugmasi. Ro'yxat: `<ol className="grid gap-3 md:grid-cols-3">…</ol>`.
 */
export function Step({
  number,
  title,
  state,
  actions,
  children,
}: {
  number: number;
  title: string;
  state: StepState;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <li
      aria-current={state === "current" ? "step" : undefined}
      className={cn(
        "flex flex-col gap-2 rounded-panel border p-4",
        state === "current" && "border-brand-300 bg-brand-50/70 ring-1 ring-brand-200",
        state === "done" && "border-green-200 bg-green-50/50",
        state === "todo" && "border-line bg-white",
      )}
    >
      <div className="flex items-center gap-2.5">
        <span
          className={cn(
            "grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold tabular-nums",
            state === "done" && "bg-green-600 text-white",
            state === "current" && "bg-brand-500 text-white",
            state === "todo" && "bg-slate-100 text-slate-500",
          )}
        >
          {state === "done" ? <Check className="size-4" aria-hidden /> : number}
        </span>
        <h3 className={cn("text-sm font-semibold", state === "todo" ? "text-slate-500" : "text-ink")}>
          <span className="sr-only">{number}-qadam: </span>
          {title}
        </h3>
        {state === "done" && <span className="sr-only">(bajarildi)</span>}
        {state === "current" && (
          <Badge tone="brand" className="ml-auto">
            Hozir
          </Badge>
        )}
      </div>
      <div className={cn("text-sm", state === "todo" ? "text-slate-400" : "text-slate-600")}>{children}</div>
      {actions && <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">{actions}</div>}
    </li>
  );
}
