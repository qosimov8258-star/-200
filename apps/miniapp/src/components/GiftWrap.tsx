import clsx from "clsx";
import { useId, type CSSProperties, type ReactNode } from "react";

/**
 * Sovg'a o'rami: karta chetini qizil atlas lenta o'rab turadi, tepa o'rtasida tugunli bantik
 * (ikki halqa, tugun va qiya kesilgan ikki uchi). Ichki qism — oddiy oq karta.
 *
 * `bow` — bantik o'lchami: katta karta uchun `lg`, yonma-yon kichik kartalar uchun `sm`.
 */
export function GiftWrap({
  children,
  bow = "lg",
  className,
  innerClassName,
  style,
}: {
  children: ReactNode;
  bow?: "lg" | "sm";
  className?: string;
  innerClassName?: string;
  style?: CSSProperties;
}) {
  const large = bow === "lg";
  return (
    <div className={clsx("relative", large ? "pt-5" : "pt-4", className)} style={style}>
      {/* Lenta: atlasdek tovlanadigan qizil hoshiya, o'rtasidan yaltiroq chiziq o'tadi */}
      <div className="relative rounded-card bg-[linear-gradient(135deg,#9c1510_0%,#ff6a55_16%,#df3425_32%,#b81d17_50%,#ff5a47_68%,#df3425_84%,#9c1510_100%)] p-[8px] shadow-[inset_0_0_0_1px_rgba(120,18,14,0.35),0_14px_28px_-16px_rgba(173,31,44,0.8)]">
        <span
          aria-hidden
          className="pointer-events-none absolute inset-[3.5px] rounded-[24.5px] border border-white/35"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute inset-[1px] rounded-[27px] border border-[#ffb4a6]/30"
        />
        <div
          className={clsx(
            "relative h-full overflow-hidden rounded-[20px] bg-surface shadow-[0_0_0_1px_rgba(143,23,18,0.35)]",
            innerClassName,
          )}
        >
          {children}
        </div>
      </div>
      <GiftBow
        className={clsx(
          "pointer-events-none absolute left-1/2 -translate-x-1/2 drop-shadow-[0_4px_5px_rgba(120,20,16,0.35)]",
          large ? "-top-[8px] h-[64px] w-[112px]" : "-top-[6px] h-[50px] w-[86px]",
        )}
      />
    </div>
  );
}

/** Tugunli bantik (vektor): tugun lentaning tepa chetiga to'g'ri keladi. */
export function GiftBow({ className }: { className?: string }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const satin = `url(#bow-satin-${uid})`;
  const fold = `url(#bow-fold-${uid})`;
  // Chap halqa va chap uch; o'ng tomoni — ko'zgu aksi.
  const loop = "M48 25 C40 9 21 2 11 9 C2 15 7 30 22 31.5 C33 32.5 42 29 48 25Z";
  const loopInner = "M46 25 C38 15 25 10 18 13.5 C13 16 15 24 24 26.5 C32 28.5 40 27.5 46 25Z";
  const tail = "M45.5 29 C41 37 36 45 31 53 L37.5 51.5 L39 58 C43 49 47 39 49.5 31Z";
  return (
    <svg viewBox="0 0 96 60" aria-hidden className={clsx("overflow-visible", className)}>
      <defs>
        <linearGradient id={`bow-satin-${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ff7a63" />
          <stop offset="0.45" stopColor="#e23a2a" />
          <stop offset="1" stopColor="#a81d17" />
        </linearGradient>
        <linearGradient id={`bow-fold-${uid}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#7d120e" stopOpacity="0.55" />
          <stop offset="1" stopColor="#7d120e" stopOpacity="0.1" />
        </linearGradient>
      </defs>

      {/* Uchlari (halqalar ostida) */}
      <path d={tail} fill={satin} />
      <path d={tail} fill={satin} transform="translate(96 0) scale(-1 1)" />
      <path d="M44 33 C41 40 37.5 46 34 52" fill="none" stroke="#ffffff" strokeOpacity="0.3" strokeWidth="1.2" strokeLinecap="round" />

      {/* Halqalar */}
      {[false, true].map((mirrored) => (
        <g key={String(mirrored)} transform={mirrored ? "translate(96 0) scale(-1 1)" : undefined}>
          <path d={loop} fill={satin} />
          <path d={loopInner} fill={fold} />
          <path
            d="M14 11.5 C20 7.5 30 8.5 38 15"
            fill="none"
            stroke="#ffffff"
            strokeOpacity="0.45"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </g>
      ))}

      {/* Tugun */}
      <rect x="40.5" y="17.5" width="15" height="15.5" rx="5" fill={satin} />
      <rect x="40.5" y="17.5" width="15" height="15.5" rx="5" fill="none" stroke="#7d120e" strokeOpacity="0.35" strokeWidth="1" />
      <path d="M43.5 21 C45.5 19.5 49.5 19.5 51.5 21" fill="none" stroke="#ffffff" strokeOpacity="0.55" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}
