/**
 * Ishtirokchi interfeysi tili: o'zbek (lotin) yoki rus. Mini App har bir so'rovda `X-Lang`
 * sarlavhasini yuboradi; tanlangan til ishtirokchiga ham saqlanadi (bot xabarlari shu tilda).
 */
export type Lang = "uz" | "ru";

export const LANGS: readonly Lang[] = ["uz", "ru"];

/** Sarlavha yoki Telegram `language_code` dan til: `ru…` — rus, qolgani — o'zbek. */
export function langOf(value: string | null | undefined): Lang {
  return typeof value === "string" && value.trim().toLowerCase().startsWith("ru") ? "ru" : "uz";
}
