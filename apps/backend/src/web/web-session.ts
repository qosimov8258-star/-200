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
/**
 * Saytga bir marta kiriladi — qayta kirish faqat admin ruxsati bilan (`ParticipantsService.startWebSession`).
 * Shuning uchun sessiya uzoq: 400 kun (brauzerlar cookie'ni bundan uzoq saqlamaydi), tanlov va sovrin
 * topshirish davrini to'liq qamraydi — muddati tugab, foydalanuvchi bekordan qulflanib qolmasin.
 */
export const WEB_ACCOUNT_SESSION_TTL_SECONDS = 400 * 86_400;
export const SESSION_TTL_SECONDS = WEB_ACCOUNT_SESSION_TTL_SECONDS;

/**
 * "Bitta qurilma — bitta hisob": shu brauzerda ochilgan (yoki kirilgan) hisob. Chiqib ketganda ham
 * qoladi — shu qurilmadan yangi hisob ochib bo'lmaydi. `HttpOnly`, imzolangan (soxtalashtirib bo'lmaydi).
 */
export const DEVICE_COOKIE = "reels_device";
const DEVICE_TTL_SECONDS = 400 * 86_400;

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
  const issued = Math.floor(now / 1000);
  const payload = b64url(Buffer.from(JSON.stringify({ t: telegramId, e: issued + ttlSeconds, i: issued })));
  return `${payload}.${b64url(sign(payload, botToken))}`;
}

/** Imzo to'g'ri va muddati o'tmagan bo'lsa — telegramId, aks holda null. */
export function verifySessionToken(token: string, botToken: string, now: number = Date.now()): number | null {
  return readSessionToken(token, botToken, now)?.id ?? null;
}

/**
 * Imzo to'g'ri va muddati o'tmagan bo'lsa — ID va berilgan vaqt (soniya; eski tokenlarda yo'q — 0),
 * aks holda null.
 */
export function readSessionToken(
  token: string,
  botToken: string,
  now: number = Date.now(),
): { id: number; issuedAt: number } | null {
  if (!botToken) return null;
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra !== undefined) return null;
  const expected = sign(payload, botToken);
  const given = Buffer.from(signature, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as unknown;
    if (typeof data !== "object" || data === null) return null;
    const { t, e, i } = data as { t?: unknown; e?: unknown; i?: unknown };
    if (!Number.isSafeInteger(t) || typeof e !== "number" || e * 1000 <= now) return null;
    return { id: t as number, issuedAt: typeof i === "number" ? i : 0 };
  } catch {
    return null;
  }
}

function deviceSignature(accountId: number, botToken: string): Buffer {
  const deviceKey = createHmac("sha256", "reels-device").update(botToken).digest();
  return createHmac("sha256", deviceKey).update(String(accountId)).digest();
}

/** Qurilma belgisi: "<hisob ID>.<imzo>". */
export function createDeviceToken(accountId: number, botToken: string): string {
  return `${accountId}.${b64url(deviceSignature(accountId, botToken))}`;
}

/** Imzo to'g'ri bo'lsa — hisob ID si, aks holda null. */
export function readDeviceToken(token: string, botToken: string): number | null {
  if (!botToken) return null;
  const [rawId, signature, extra] = token.split(".");
  const id = Number(rawId);
  if (!rawId || !signature || extra !== undefined || !Number.isSafeInteger(id)) return null;
  const expected = deviceSignature(id, botToken);
  const given = Buffer.from(signature, "base64url");
  return given.length === expected.length && timingSafeEqual(given, expected) ? id : null;
}

export function deviceCookie(value: string, secure: boolean): string {
  return cookie(DEVICE_COOKIE, value, "/", DEVICE_TTL_SECONDS, secure);
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
  return cookie(SESSION_COOKIE, value, "/", maxAgeSeconds, secure);
}

/** "Hisobim bor" so'rovining maxfiy kaliti — faqat shu so'rovni ochgan brauzerda. */
export const BOT_LOGIN_COOKIE = "reels_bot_login";
const BOT_LOGIN_COOKIE_PATH = "/api/v1/auth/bot-login";

/** `maxAge` 0 — o'chiriladi (sessiya berilgach). Faqat `/auth/bot-login*` so'rovlariga yuboriladi. */
export function botLoginCookie(value: string, maxAgeSeconds: number, secure: boolean): string {
  return cookie(BOT_LOGIN_COOKIE, value, BOT_LOGIN_COOKIE_PATH, maxAgeSeconds, secure);
}

function cookie(name: string, value: string, path: string, maxAgeSeconds: number, secure: boolean): string {
  return [
    `${name}=${encodeURIComponent(value)}`,
    `Path=${path}`,
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAgeSeconds}`,
    secure ? "Secure" : null,
  ]
    .filter(Boolean)
    .join("; ");
}
