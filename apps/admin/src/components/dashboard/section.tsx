import { cn } from "@/lib/utils";

/** Bosh sahifa ichidagi bo'lim: sarlavha va o'ng tomonda boshqaruvlar. */
export function DashboardSection({
  title,
  subtitle,
  actions,
  className,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn("p-5 sm:p-6", className)}>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold tracking-tight text-ink">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-1.5">{actions}</div>}
      </div>
      {children}
    </section>
  );
}

const ICON_BUTTON =
  "grid size-8 place-items-center rounded-[10px] border border-line bg-white text-muted transition-colors hover:border-brand-200 hover:text-ink disabled:cursor-not-allowed disabled:opacity-40";

/** Ikonkali tugma; `active` berilsa — almashtirgich (yoqilgan/o'chirilgan holati e'lon qilinadi). */
export function IconButton({
  label,
  active,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string; active?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      className={cn(ICON_BUTTON, active && "border-brand-200 bg-brand-50 text-brand-600", className)}
      {...props}
    />
  );
}
