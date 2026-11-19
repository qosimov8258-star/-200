import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";

/** Dashboard ichidagi bo'lim: sarlavha va o'ng tomonda boshqaruvlar (CareOps uslubi). */
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
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
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

export function IconButton({
  label,
  active = false,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string; active?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active || undefined}
      className={cn(ICON_BUTTON, active && "border-brand-200 bg-brand-50 text-brand-600", className)}
      {...props}
    />
  );
}

/** Karusel: ‹ › va "Barchasi". */
export function CarouselControls({
  page,
  pages,
  onPage,
  href,
}: {
  page: number;
  pages: number;
  onPage: (page: number) => void;
  href?: string;
}) {
  return (
    <>
      <IconButton label="Oldingi" disabled={page <= 0} onClick={() => onPage(page - 1)}>
        <ChevronLeft className="size-4" aria-hidden />
      </IconButton>
      <IconButton label="Keyingi" disabled={page >= pages - 1} onClick={() => onPage(page + 1)}>
        <ChevronRight className="size-4" aria-hidden />
      </IconButton>
      {href && (
        <Link
          href={href}
          className="ml-1 inline-flex h-8 items-center rounded-[10px] border border-line bg-white px-3 text-xs font-medium text-ink hover:border-brand-200"
        >
          Barchasi
        </Link>
      )}
    </>
  );
}
