import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

interface SpinnerProps {
  label?: string;
  className?: string;
}

export function Spinner({ label = "Yuklanmoqda…", className }: SpinnerProps) {
  return (
    <div role="status" className={cn("flex items-center gap-2 text-sm text-slate-500", className)}>
      <Loader2 className="size-5 animate-spin text-brand-600" aria-hidden />
      <span>{label}</span>
    </div>
  );
}

/** Butun ekran markazidagi yuklanish holati. */
export function FullScreenSpinner({ label }: { label?: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <Spinner label={label} />
    </div>
  );
}
