import { t } from "../i18n";

/** Ism: harflar, apostrof, defis va bo'sh joy — 2–40 belgi. */
export const NAME = /^[\p{L}'ʻʼ‘’\- ]{2,40}$/u;
export const MAX_AGE = 100;

/** Ism (2–40 harf) va yosh (minimal yoshdan) tekshiruvi — Telegram va sayt formasi uchun umumiy. */
export function profileErrors(
  firstName: string,
  ageText: string,
  minAge: number,
): { firstName?: string; age?: string } {
  const age = Number.parseInt(ageText, 10);
  return {
    firstName: NAME.test(firstName) ? undefined : t.nameInvalid,
    age:
      !Number.isFinite(age) || age < 1 || age > MAX_AGE
        ? t.ageInvalid
        : age < minAge
          ? t.ageTooYoung(minAge)
          : undefined,
  };
}

/** Yosh maydoni: faqat raqam, 3 tagacha. */
export const ageInput = (value: string): string => value.replace(/\D/g, "").slice(0, 3);
