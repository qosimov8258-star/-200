import { cn } from "@/lib/utils";

type BadgeTone = "neutral" | "brand" | "success" | "warning" | "danger";

const TONE_CLASSES: Record<BadgeTone, string> = {
  neutral: "bg-[#f3f2f6] text-[#5d5b66]",
  brand: "bg-brand-100 text-brand-700",
  success: "bg-[#e9f6ee] text-up",
  warning: "bg-[#fdf3e2] text-[#a7650f]",
  danger: "bg-[#fdecea] text-[#c2412b]",
};

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
}

export function Badge({ tone = "neutral", className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        TONE_CLASSES[tone],
        className,
      )}
      {...props}
    />
  );
}
