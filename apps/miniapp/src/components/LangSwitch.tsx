import clsx from "clsx";

import { lang, setLang, type Lang } from "../i18n";
import { haptic } from "../lib/telegram";

const OPTIONS: { value: Lang; label: string; title: string }[] = [
  { value: "uz", label: "UZ", title: "O'zbekcha" },
  { value: "ru", label: "RU", title: "Русский" },
];

/**
 * Til almashtirgich: O'zbekcha / Русский. Tanlov saqlanadi va sahifa qayta yuklanadi (barcha matnlar,
 * oferta va sovg'alar yangi tilda). `onChange` — qayta yuklashdan oldin (masalan, botga ham tilni
 * saqlash uchun serverga yuborish).
 */
export function LangSwitch({
  className,
  dark = false,
  onChange,
}: {
  className?: string;
  /** Qorong'i fon ustida (bosh sahifa sarlavhasi). */
  dark?: boolean;
  onChange?: (next: Lang) => Promise<void> | void;
}) {
  const choose = async (next: Lang) => {
    if (next === lang) return;
    haptic.select();
    try {
      await onChange?.(next);
    } catch {
      // Serverga saqlanmasa ham ilova tili almashadi.
    }
    setLang(next);
  };

  return (
    <div
      role="radiogroup"
      aria-label="Til / Язык"
      className={clsx(
        "inline-flex rounded-full p-0.5 text-[12px] font-semibold ring-1",
        dark ? "bg-white/12 ring-white/25" : "bg-white/70 ring-black/10",
        className,
      )}
    >
      {OPTIONS.map((option) => {
        const active = option.value === lang;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            title={option.title}
            onClick={() => void choose(option.value)}
            className={clsx(
              "min-w-9 rounded-full px-2.5 py-1 transition-colors",
              active
                ? dark
                  ? "bg-white text-ink"
                  : "bg-ink text-white"
                : dark
                  ? "text-white/80 hover:text-white"
                  : "text-ink/70 hover:text-ink",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
