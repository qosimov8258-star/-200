import clsx from "clsx";
import { ChevronRight } from "lucide-react";
import { useEffect } from "react";

import { OliviaFestive } from "../components/OliviaFestive";
import { lang, setLang, type Lang } from "../i18n";
import { hideSplash } from "../lib/splash";
import { haptic } from "../lib/telegram";

const OPTIONS: { value: Lang; flag: string; label: string; hint: string }[] = [
  { value: "uz", flag: "🇺🇿", label: "O'zbekcha", hint: "Davom etish" },
  { value: "ru", flag: "🇷🇺", label: "Русский", hint: "Продолжить" },
];

/**
 * Ro'yxatdan o'tishning birinchi qadami: ilova tilini tanlash (ism va telefondan oldin). Keyingi
 * barcha ekranlar, ommaviy oferta, sovg'alar va bot xabarlari shu tilda bo'ladi. Til o'zgarsa
 * sahifa shu tilda qayta yuklanadi; o'sha til tanlansa — `onDone`. Keyin profilda almashtirish mumkin.
 */
export function LanguageScreen({ onDone }: { onDone?: () => void }) {
  useEffect(() => {
    hideSplash();
  }, []);

  const choose = (next: Lang) => {
    haptic.select();
    if (!setLang(next)) onDone?.();
  };

  return (
    <main className="flex min-h-dvh flex-col justify-center gap-6 px-5 pt-[calc(var(--safe-top)+24px)] pb-[calc(var(--safe-bottom)+24px)]">
      <OliviaFestive variant="brand" className="mx-auto h-16 w-auto" />
      <div className="text-center">
        <h1 className="text-[26px] font-bold tracking-tight">Tilni tanlang</h1>
        <p className="mt-1 text-[17px] text-muted">Выберите язык</p>
      </div>
      <div className="flex flex-col gap-3" role="radiogroup" aria-label="Til / Язык">
        {OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={option.value === lang}
            onClick={() => choose(option.value)}
            className={clsx(
              "flex items-center gap-4 rounded-card bg-surface px-5 py-4 text-left shadow-[0_10px_28px_-18px_rgba(30,31,34,0.45)] ring-1 transition-transform active:scale-[0.98]",
              option.value === lang ? "ring-[#df3425]/40" : "ring-black/5",
            )}
          >
            <span aria-hidden className="text-[32px] leading-none">
              {option.flag}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[18px] font-semibold">{option.label}</span>
              <span className="block text-[13px] text-muted">{option.hint}</span>
            </span>
            <ChevronRight aria-hidden className="size-5 text-muted" />
          </button>
        ))}
      </div>
    </main>
  );
}
