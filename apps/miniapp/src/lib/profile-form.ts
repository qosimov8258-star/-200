import { t } from "../i18n";

/** Ism: harflar, apostrof, defis va bo'sh joy — 2–40 belgi. */
export const NAME = /^[\p{L}'ʻʼ‘’\- ]{2,40}$/u;

/**
 * Ism tekshiruvi — Telegram va sayt formasi uchun umumiy. Ro'yxatdan o'tishda faqat ism va telefon
 * so'raladi (yosh — yo'q: 18 yosh sharti oferta qabul qilinganda tasdiqlanadi, g'olibda tekshiriladi).
 */
export function profileErrors(firstName: string): { firstName?: string } {
  return { firstName: NAME.test(firstName) ? undefined : t.nameInvalid };
}
