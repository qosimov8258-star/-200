import { ru } from "./ru";
import { t as uz } from "./uz";

/**
 * Ilova tili: o'zbek (lotin) yoki rus. Tanlov `localStorage` da saqlanadi; tanlanmagan bo'lsa —
 * Telegram tili (`ru` → rus), aks holda o'zbek. Til almashtirilganda sahifa qayta yuklanadi —
 * shunda barcha matnlar (va serverdan keladigan qoidalar, sovg'alar) yangi tilda bo'ladi.
 * Xotiraga yozib bo'lmasa (masalan, web.telegram.org uchinchi tomon cookie'lari bloklangan
 * brauzerda) — til ekrani o'tkaziladi va ilova qurilma tilida ochiladi: qayta yuklash tanlovni
 * baribir unutardi va til ekrani cheksiz qaytaverardi.
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
/** `index.html` dagi skript o'qiydi: qayta yuklanishda "Olivia" animatsiyasi qayta chiqmaydi. */
const SKIP_SPLASH_KEY = "skipSplash";
/** Shu sessiyada (yorliq yopilguncha) til ekrani o'tildi — ro'yxatdan o'tishning birinchi qadami. */
const CONFIRMED_KEY = "langConfirmed";
/**
 * Shu qurilmada tanlangan til hali serverga yetib bormagan. Ilova serverga faqat shunday (yangi)
 * tanlovni yozadi; aks holda keyinroq botda (/lang) yoki boshqa qurilmada tanlangan til yutadi.
 */
const SYNC_KEY = "langSync";
/** `localStorage` ga yozib bo'lishini tekshirish uchun vaqtinchalik kalit. */
const PROBE_KEY = "__langProbe";

function savedLang(): Lang | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === "uz" || value === "ru" ? value : null;
  } catch {
    return null;
  }
}

/** `localStorage` ga yozib bo'ladimi (maxfiy rejim yoki bloklangan sayt ma'lumotlarida — yo'q). */
function storageWritable(): boolean {
  try {
    localStorage.setItem(PROBE_KEY, "1");
    localStorage.removeItem(PROBE_KEY);
    return true;
  } catch {
    return false;
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

/**
 * Til tanlovini saqlab bo'ladimi. Yo'q bo'lsa — til almashtirgich ko'rsatilmaydi: tanlov qayta
 * yuklanishda baribir unutiladi (tugma hech narsa qilmaydigan bo'lib qolmasin).
 */
export const langSaveable: boolean = storageWritable();

/**
 * Foydalanuvchi tilni o'zi tanlaganmi (yo'q bo'lsa — birinchi ekran "Tilni tanlang"). Tanlovni
 * saqlab bo'lmasa — tanlangan deb hisoblanadi (`langConfirmed` dagi kabi), aks holda ekran
 * har qayta yuklanishda qaytaverardi.
 */
export const langChosen: boolean = savedLang() !== null || !langSaveable;

/**
 * Til shu qurilmada haqiqatan tanlangan va saqlangan. Faqat shunda u serverga va botga yuboriladi:
 * xotira yopiq brauzerdagi taxminiy qurilma tili botdagi tanlovni bosib ketmasin.
 */
export const langPicked: boolean = savedLang() !== null;

/** Joriy tildagi barcha matnlar. */
export const t: Texts = lang === "ru" ? ru : uz;

/**
 * Ro'yxatdan o'tmagan foydalanuvchi shu sessiyada tilni tanladimi. Tanlamagan bo'lsa — ism va
 * telefondan oldin "Tilni tanlang" ekrani chiqadi. `sessionStorage` yopiq bo'lsa — qadam o'tkaziladi
 * (aks holda ekran qayta yuklanishdan keyin ham qaytaverardi).
 */
export function langConfirmed(): boolean {
  try {
    return sessionStorage.getItem(CONFIRMED_KEY) === "1";
  } catch {
    return true;
  }
}

/**
 * Tilni saqlaydi. Til o'zgarsa (yoki birinchi tanlov bo'lsa) sahifa shu tilda qayta yuklanadi —
 * `true` qaytaradi; o'sha til qayta tanlansa yoki tanlovni saqlab bo'lmasa — `false` (ilova
 * joriy tilda davom etadi).
 */
export function setLang(next: Lang): boolean {
  let saved = true;
  try {
    localStorage.setItem(STORAGE_KEY, next);
    localStorage.setItem(SYNC_KEY, "1");
  } catch {
    saved = false;
  }
  try {
    sessionStorage.setItem(CONFIRMED_KEY, "1");
  } catch {
    // `langConfirmed` bu holda baribir `true`.
  }
  // Saqlanmagan tanlov qayta yuklanishda yo'qoladi — sahifani bekorga yangilamaymiz.
  if (!saved || (next === lang && langChosen)) return false;
  // Qayta yuklanishda yuklanish animatsiyasi ikkinchi marta ko'rsatilmaydi.
  try {
    sessionStorage.setItem(SKIP_SPLASH_KEY, "1");
  } catch {
    // Saqlab bo'lmasa — animatsiya odatdagidek ko'rinadi.
  }
  window.location.reload();
  return true;
}

/** Shu qurilmadagi til tanlovi hali serverga yozilmaganmi (`setLang` dan keyin). */
export function langSyncPending(): boolean {
  try {
    return localStorage.getItem(SYNC_KEY) === "1";
  } catch {
    return false;
  }
}

/** Tanlov serverga yozildi (yoki serverdagi bilan bir xil). */
export function langSynced(): void {
  try {
    localStorage.removeItem(SYNC_KEY);
  } catch {
    // Saqlab bo'lmasa — keyingi ochilishda qayta yoziladi, zarari yo'q.
  }
}

/**
 * Serverdagi (botda yoki boshqa qurilmada tanlangan) tilga o'tadi: saqlaydi va sahifani shu tilda
 * qayta yuklaydi. Serverga qayta yozilmaydi. Saqlab bo'lmasa — hech narsa qilmaydi (aks holda
 * sahifa cheksiz qayta yuklanardi).
 */
export function adoptLang(next: Lang): void {
  try {
    localStorage.setItem(STORAGE_KEY, next);
    localStorage.removeItem(SYNC_KEY);
  } catch {
    return;
  }
  try {
    sessionStorage.setItem(SKIP_SPLASH_KEY, "1");
  } catch {
    // Saqlab bo'lmasa — animatsiya odatdagidek ko'rinadi.
  }
  window.location.reload();
}

/** Dev "Boshidan boshlash": til tanlovi ham unutiladi — ilova yana tildan boshlanadi. */
export function forgetLang(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(SYNC_KEY);
    sessionStorage.removeItem(CONFIRMED_KEY);
  } catch {
    // Saqlab bo'lmasa — til odatdagidek qoladi.
  }
}

/** Sana va sonlarni formatlash uchun til kodi. */
export const locale = lang === "ru" ? "ru-RU" : "uz-UZ";
