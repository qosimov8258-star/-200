import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Veb-sayt sessiyasi: Telegram Login Widget orqali kirgandan keyin beriladigan, server
 * imzolagan qisqa token. `HttpOnly` cookie'da saqlanadi — JavaScript uni o'qiy olmaydi.
 *
 * Token: base64url({ t: telegramId, e: tugash vaqti (soniya) }) + "." + base64url(HMAC).
 * Kalit bot tokenidan olinadi (alohida maxfiy kalit sozlash shart emas); bot tokeni
 * almashtirilsa — barcha veb-sessiyalar bekor bo'ladi.
 */
export const SESSION_COOKIE = "reels_session";
export const SESSION_TTL_SECONDS = 30 * 86_400;
/**
 * Saytda (Telegram'siz) ro'yxatdan o'tgan hisob faqat shu cookie bilan tanilgan — boshqa kirish
 * yo'li yo'q. Shuning uchun uzoq: 400 kun (brauzerlar cookie'ni bundan uzoq saqlamaydi), tanlov
 * va sovrin topshirish davrini to'liq qamraydi.
 */
export const WEB_ACCOUNT_SESSION_TTL_SECONDS = 400 * 86_400;

const b64url = (buf: Buffer) => buf.toString("base64url");

function key(botToken: string): Buffer {
  return createHmac("sha256", "reels-web-session").update(botToken).digest();
}

function sign(payload: string, botToken: string): Buffer {
  return createHmac("sha256", key(botToken)).update(payload).digest();
}

export function createSessionToken(
  telegramId: number,
  botToken: string,
  now: number = Date.now(),
  ttlSeconds: number = SESSION_TTL_SECONDS,
): string {
  const payload = b64url(
    Buffer.from(JSON.stringify({ t: telegramId, e: Math.floor(now / 1000) + ttlSeconds })),
  );
  return `${payload}.${b64url(sign(payload, botToken))}`;
}

/** Imzo to'g'ri va muddati o'tmagan bo'lsa — telegramId, aks holda null. */
export function verifySessionToken(
  token: string,
  botToken: string,
  now: number = Date.now(),
): number | null {
  if (!botToken) return null;
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra !== undefined) return null;
  const expected = sign(payload, botToken);
  const given = Buffer.from(signature, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as unknown;
    if (typeof data !== "object" || data === null) return null;
    const { t, e } = data as { t?: unknown; e?: unknown };
    if (!Number.isSafeInteger(t) || typeof e !== "number" || e * 1000 <= now) return null;
    return t as number;
  } catch {
    return null;
  }
}

/** `Cookie` sarlavhasidan bitta qiymat. */
export function readCookie(header: string | undefined, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i).trim() === name) {
      try {
        return decodeURIComponent(part.slice(i + 1).trim());
      } catch {
        return null;
      }
    }
  }
  return null;
}

/** `Set-Cookie` qiymati. `maxAge` 0 — cookie o'chiriladi (chiqish). */
export function sessionCookie(value: string, maxAgeSeconds: number, secure: boolean): string {
  return [
    `${SESSION_COOKIE}=${encodeURIComponent(value)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAgeSeconds}`,
    secure ? "Secure" : null,
  ]
    .filter(Boolean)
    .join("; ");
}
