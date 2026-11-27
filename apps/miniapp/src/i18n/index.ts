import { ru } from "./ru";
import { t as uz } from "./uz";

/**
 * Ilova tili: o'zbek (lotin) yoki rus. Tanlov `localStorage` da saqlanadi; tanlanmagan bo'lsa —
 * Telegram tili (`ru` → rus), aks holda o'zbek. Til almashtirilganda sahifa qayta yuklanadi —
 * shunda barcha matnlar (va serverdan keladigan qoidalar, sovg'alar) yangi tilda bo'ladi.
 */
export type Lang = "uz" | "ru";

/** `as const` dagi aniq satrlarni oddiy `string` ga kengaytiradi — ruscha lug'at ham shu shaklda. */
type Widen<T> = T extends string
  ? string
  : T extends (...args: infer A) => infer R
    ? (...args: A) => Widen<R>
    : T extends readonly (infer U)[]
      ? readonly Widen<U>[]
      : T extends object
        ? { readonly [K in keyof T]: Widen<T[K]> }
        : T;

/** Lug'at shakli — o'zbekcha matnlar (`uz.ts`) asosida. */
export type Texts = Widen<typeof uz>;

const STORAGE_KEY = "lang";

function savedLang(): Lang | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === "uz" || value === "ru" ? value : null;
  } catch {
    return null;
  }
}

/** Telegram foydalanuvchisining tili (Mini App ichida); bo'lmasa — brauzer tili. */
function deviceLang(): Lang {
  const tg = (window as { Telegram?: { WebApp?: { initDataUnsafe?: { user?: { language_code?: string } } } } })
    .Telegram?.WebApp?.initDataUnsafe?.user?.language_code;
  const code = (tg ?? navigator.language ?? "").toLowerCase();
  return code.startsWith("ru") ? "ru" : "uz";
}

export const lang: Lang = savedLang() ?? deviceLang();

/** Foydalanuvchi tilni o'zi tanlaganmi (yo'q bo'lsa — birinchi ekran "Tilni tanlang"). */
export const langChosen: boolean = savedLang() !== null;

/** Joriy tildagi barcha matnlar. */
export const t: Texts = lang === "ru" ? ru : uz;

/** Tilni almashtiradi va sahifani qayta yuklaydi (tanlov saqlanadi). */
export function setLang(next: Lang): void {
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // Saqlab bo'lmasa ham (maxfiy rejim) — shu sessiya uchun almashadi.
  }
  // Birinchi tanlovda ham qayta yuklanadi — "Tilni tanlang" ekrani yopiladi.
  if (next !== lang || !langChosen) window.location.reload();
}

/** Sana va sonlarni formatlash uchun til kodi. */
export const locale = lang === "ru" ? "ru-RU" : "uz-UZ";
