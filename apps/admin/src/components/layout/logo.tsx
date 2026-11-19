import { Trophy } from "lucide-react";

import { cn } from "@/lib/utils";

/** Vaqtinchalik logotip — zavod brendi kelishilgach almashtiriladi (TZ, Q10). */
export function Logo({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <span className="flex size-9 items-center justify-center rounded-xl bg-[linear-gradient(135deg,#937ed6,#7c62db)] text-white shadow-[0_6px_14px_-6px_rgba(124,98,219,0.9)]">
        <Trophy className="size-5" aria-hidden />
      </span>
      <span className="leading-tight">
        <span className="block text-sm font-semibold text-ink">Reels tanlov</span>
        <span className="block text-xs text-muted">Admin panel</span>
      </span>
    </div>
  );
}
