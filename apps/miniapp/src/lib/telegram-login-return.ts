import type { TelegramLoginUser } from "./types";

/**
 * Telefonda (iPhone Safari va boshqalar) Telegram Login Widget tasdiqdan keyin natijani qalqib
 * chiquvchi oyna orqali qaytara olmaydi: Telegram sahifani qayta ochadi va ma'lumotni manzil
 * oxiriga qo'shadi — `#tgAuthResult=<base64url JSON>`. Vidjetning o'z skripti buni faqat vidjet
 * sahifada turganda o'qiydi; bizda vidjet "Profil" bo'limida, sayt esa "Asosiy" dan ochiladi.
 * Shuning uchun natijani ilova ishga tushishi bilan shu yerda o'qiymiz.
 */
const RESULT = /[#?&]tgAuthResult=([A-Za-z0-9\-_=]*)$/;

function isTelegramLoginUser(value: unknown): value is TelegramLoginUser {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === "number" &&
    typeof v.first_name === "string" &&
    typeof v.auth_date === "number" &&
    typeof v.hash === "string" &&
    v.hash.length > 0
  );
}

/** base64url → UTF-8 matn (ism kirill yoki o'zbekcha harflarda bo'lishi mumkin). */
function decodeBase64Url(data: string): string {
  let base64 = data.replace(/-/g, "+").replace(/_/g, "/");
  const pad = base64.length % 4;
  if (pad > 1) base64 += "=".repeat(4 - pad);
  const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/**
 * Manzilda Telegram kirish natijasi bo'lsa — uni oladi va manzildan darhol olib tashlaydi
 * (sahifa yangilansa, qayta yuborilmasin). Bo'lmasa yoki buzilgan bo'lsa — null.
 */
export function takeTelegramAuthResult(): TelegramLoginUser | null {
  const match = window.location.hash.match(RESULT);
  if (!match) return null;
  const rest = window.location.hash.replace(RESULT, "");
  window.history.replaceState(window.history.state, "", window.location.pathname + window.location.search + rest);
  try {
    const parsed: unknown = JSON.parse(decodeBase64Url(match[1] ?? ""));
    return isTelegramLoginUser(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
