import type { LucideIcon } from "lucide-react";

interface SectionTitleProps {
  id: string;
  icon: LucideIcon;
  title: string;
  /** Sarlavha yonidagi qisqa izoh (soni, oralig'i…). */
  meta?: string | null;
  /** O'ng tomondagi tugma (masalan, "Yangi tanlov"). */
  action?: React.ReactNode;
}

/** G'oliblar sahifasidagi bo'lim sarlavhasi: ikonka, nom, izoh va ixtiyoriy tugma. */
export function SectionTitle({ id, icon: Icon, title, meta = null, action = null }: SectionTitleProps) {
  const heading = (
    <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
      <h2 id={id} className="flex items-center gap-2 text-lg font-semibold tracking-tight text-ink">
        <Icon className="size-5 text-brand-600" aria-hidden />
        {title}
      </h2>
      {meta && <p className="text-sm text-muted tabular-nums">{meta}</p>}
    </div>
  );
  if (!action) return heading;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      {heading}
      {action}
    </div>
  );
}
