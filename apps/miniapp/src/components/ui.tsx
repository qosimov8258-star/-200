import clsx from "clsx";
import { ArrowDown, ArrowUp, LoaderCircle, Snowflake } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";

import { t } from "../i18n";
import { GiftButton } from "./GiftButton";
import { initials } from "../lib/format";

export function Card({
  className,
  dark = false,
  ...props
}: ComponentProps<"div"> & { dark?: boolean }) {
  return (
    <div
      className={clsx(
        "rounded-card p-[18px]",
        // Qorong'i karta — qishki tun ko'kida.
        dark ? "bg-[linear-gradient(150deg,#262f5f,#151a39_70%)] text-white" : "bg-surface",
        className,
      )}
      {...props}
    />
  );
}

/** Asosiy tugma — qishki bayramda sovg'a qutisi ko'rinishida (lenta va tepasida bantik). */
export function PillButton(props: ComponentProps<"button"> & { loading?: boolean; icon?: ReactNode }) {
  return <GiftButton {...props} />;
}

export function RoundIcon({
  label,
  dark = false,
  size = 48,
  children,
  className,
  ...props
}: ComponentProps<"button"> & { label: string; dark?: boolean; size?: number }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      style={{ width: size, height: size }}
      className={clsx(
        "grid shrink-0 place-items-center rounded-full transition active:scale-95 disabled:opacity-60",
        dark ? "bg-ink text-white" : "bg-surface text-ink",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function TextField({
  label,
  error,
  className,
  ...props
}: ComponentProps<"input"> & { label?: string; error?: string | null }) {
  return (
    <label className={clsx("block", className)}>
      {label && <span className="mb-1.5 ml-1.5 block text-[13px] text-muted">{label}</span>}
      <input
        className={clsx(
          "h-14 w-full rounded-full border bg-surface px-5 text-base outline-none transition placeholder:text-muted focus:border-[#df3425]/45 focus:ring-4 focus:ring-[#df3425]/10",
          error ? "border-negative" : "border-transparent",
        )}
        aria-invalid={error ? true : undefined}
        {...props}
      />
      {error && <span className="mt-1.5 ml-1.5 block text-[13px] text-negative">{error}</span>}
    </label>
  );
}

export function Avatar({ name, dark = false, size = 44 }: { name: string; dark?: boolean; size?: number }) {
  return (
    <span
      style={{ width: size, height: size, fontSize: size * 0.36 }}
      className={clsx(
        "grid shrink-0 place-items-center rounded-full font-bold",
        dark ? "bg-ink text-white" : "bg-chip text-ink",
      )}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}

export function RankDelta({ delta, large = false }: { delta: number; large?: boolean }) {
  if (delta === 0) return <span className="text-muted">—</span>;
  const up = delta > 0;
  const Icon = up ? ArrowUp : ArrowDown;
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-0.5 font-bold",
        up ? "text-positive" : "text-negative",
        large ? "text-2xl" : "text-[13px]",
      )}
    >
      <Icon className={large ? "size-5" : "size-3.5"} strokeWidth={3} />
      {Math.abs(delta)}
    </span>
  );
}

export function PageHeader({
  title,
  subtitle,
  trailing,
  eyebrow,
}: {
  title: string;
  subtitle?: string;
  trailing?: ReactNode;
  /** Sarlavha ustidagi kichik element (masalan, brend logosi). */
  eyebrow?: ReactNode;
}) {
  return (
    <header className="flex items-center gap-3">
      <div className="min-w-0 flex-1">
        {eyebrow && <div className="mb-1.5">{eyebrow}</div>}
        <h1 className="truncate text-[26px] font-bold tracking-tight">
          {title}
          <Snowflake
            aria-hidden
            className="ml-2 inline-block size-[18px] align-[3px] text-[#df3425]/60 motion-safe:animate-[spin_14s_linear_infinite]"
            strokeWidth={2.2}
          />
        </h1>
        {subtitle && <p className="mt-0.5 text-[13px] text-muted">{subtitle}</p>}
      </div>
      {trailing}
    </header>
  );
}

export function Spinner() {
  return (
    <div className="flex justify-center py-12" role="status" aria-label={t.loading}>
      <LoaderCircle className="size-7 animate-spin text-ink" />
    </div>
  );
}

export function ErrorBlock({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="py-8 text-center">
      <p>{t.loadError}</p>
      <button type="button" onClick={onRetry} className="mt-2 font-semibold underline">
        {t.retry}
      </button>
    </div>
  );
}

