import { Trophy } from "lucide-react";

import { cn } from "@/lib/utils";

/** Vaqtinchalik logotip — zavod brendi kelishilgach almashtiriladi (TZ, Q10). */
export function Logo({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <span className="flex size-9 items-center justify-center rounded-lg bg-brand-600 text-white">
        <Trophy className="size-5" aria-hidden />
      </span>
      <span className="leading-tight">
        <span className="block text-sm font-semibold text-slate-900">Reels tanlov</span>
        <span className="block text-xs text-slate-500">Admin panel</span>
      </span>
    </div>
  );
}
