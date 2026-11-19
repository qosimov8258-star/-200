import { cn } from "@/lib/utils";

type DivProps = React.HTMLAttributes<HTMLDivElement>;

/** Oq karta: nozik chegara, katta yumaloq burchak, deyarli sezilmas soya. */
export function Card({ className, ...props }: DivProps) {
  return (
    <div
      className={cn(
        "rounded-panel border border-line bg-white shadow-[0_1px_2px_rgba(39,38,39,0.04),0_8px_24px_-12px_rgba(76,58,160,0.08)]",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: DivProps) {
  return <div className={cn("px-5 pt-5 pb-1", className)} {...props} />;
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn("text-base font-semibold tracking-tight text-ink", className)} {...props} />;
}

export function CardContent({ className, ...props }: DivProps) {
  return <div className={cn("px-5 py-4", className)} {...props} />;
}
