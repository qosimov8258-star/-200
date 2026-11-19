import { cn } from "@/lib/utils";

type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export function Input({ className, type = "text", ...props }: InputProps) {
  return (
    <input
      type={type}
      className={cn(
        "h-10 w-full rounded-xl border border-line bg-white px-3 text-sm text-ink placeholder:text-slate-400",
        "focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none",
        "disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500",
        "aria-invalid:border-red-500 aria-invalid:focus:ring-red-500/20",
        className,
      )}
      {...props}
    />
  );
}
