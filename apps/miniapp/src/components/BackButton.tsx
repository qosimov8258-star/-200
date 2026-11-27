import { t } from "../i18n";

/**
 * Yangi yil uslubidagi "Orqaga" tugmasi: strelka o'rniga uchi bukilgan qizil-oq konfet tayoqcha.
 * Telegram ichida "Orqaga" Telegram panelida bo'ladi — bu tugma brauzer (veb-sayt) uchun.
 */
export function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded-full bg-surface py-1.5 pr-4 pl-2.5 text-[14px] font-semibold text-ink shadow-[0_4px_12px_-6px_rgba(30,31,34,0.3)] ring-1 ring-[#df3425]/10 transition active:scale-[0.96]"
    >
      <CandyCane className="size-8" />
      {t.back}
    </button>
  );
}

/**
 * Konfet tayoqcha (candy cane), uchi chapga qayrilgan — "orqaga" yo'nalishini bildiradi.
 * Qatlamlar: to'q qizil hoshiya → oq asos → qizil chiziqlar (dasharray) → yaltiroq.
 */
export function CandyCane({ className }: { className?: string }) {
  // O'ngdan chapga tekis tana, chap uchida pastga qayrilgan ilmoq.
  const d = "M21.5 8.5 H10 A4 4 0 0 0 10 16.5 H11.2";
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} stroke="#9c1b25" strokeWidth={4.6} />
      <path d={d} stroke="#ffffff" strokeWidth={3.3} />
      <path d={d} stroke="#e2372a" strokeWidth={3.3} strokeLinecap="butt" strokeDasharray="1.7 1.9" />
      <path d="M20.5 7.6 H10.2 A3.2 3.2 0 0 0 6.9 10.4" stroke="#ffffff" strokeOpacity={0.65} strokeWidth={0.8} />
    </svg>
  );
}
