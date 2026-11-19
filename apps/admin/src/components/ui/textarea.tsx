import { cn } from "@/lib/utils";

type TextareaProps = React.ComponentProps<"textarea">;

export function Textarea({ className, rows = 3, ...props }: TextareaProps) {
  return (
    <textarea
      rows={rows}
      className={cn(
        "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400",
        "focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none",
        "disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500",
        "aria-invalid:border-red-500 aria-invalid:focus:ring-red-500/20",
        className,
      )}
      {...props}
    />
  );
}
