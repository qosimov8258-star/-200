import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Admin panel sessiyasi: server imzolagan token `HttpOnly` cookie'da (JavaScript o'qiy olmaydi).
 * Token: base64url({ l: login, f: parol barmoq izi, e: tugash vaqti (soniya) }) + "." + HMAC.
 * Server qayta ishga tushsa ham sessiya saqlanadi (holat serverda emas, imzoda); parol yoki
 * `ADMIN_SESSION_SECRET` o'zgarsa — barcha eski sessiyalar bekor bo'ladi.
 */
export const ADMIN_COOKIE = "reels_admin";
/** Cookie faqat admin API so'rovlarida yuboriladi (sayt va Mini App so'rovlarida emas). */
export const ADMIN_COOKIE_PATH = "/api/v1/admin";

export interface AdminSessionClaims {
  login: string;
  fingerprint: string;
}

const sign = (payload: string, secret: Buffer) => createHmac("sha256", secret).update(payload).digest();

export function createAdminToken(
  claims: AdminSessionClaims,
  ttlSeconds: number,
  secret: Buffer,
  now: number = Date.now(),
): string {
  const payload = Buffer.from(
    JSON.stringify({ l: claims.login, f: claims.fingerprint, e: Math.floor(now / 1000) + ttlSeconds }),
  ).toString("base64url");
  return `${payload}.${sign(payload, secret).toString("base64url")}`;
}

/** Imzo to'g'ri va muddati o'tmagan bo'lsa — da'volar, aks holda null. */
export function verifyAdminToken(token: string, secret: Buffer, now: number = Date.now()): AdminSessionClaims | null {
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra !== undefined) return null;
  const expected = sign(payload, secret);
  const given = Buffer.from(signature, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as unknown;
    if (typeof data !== "object" || data === null) return null;
    const { l, f, e } = data as { l?: unknown; f?: unknown; e?: unknown };
    if (typeof l !== "string" || typeof f !== "string" || typeof e !== "number" || e * 1000 <= now) return null;
    return { login: l, fingerprint: f };
  } catch {
    return null;
  }
}

/** `Set-Cookie` qiymati. `maxAgeSeconds` 0 — cookie o'chiriladi (chiqish). */
export function adminCookie(value: string, maxAgeSeconds: number, secure: boolean): string {
  return [
    `${ADMIN_COOKIE}=${encodeURIComponent(value)}`,
    `Path=${ADMIN_COOKIE_PATH}`,
    "HttpOnly",
    // Strict: boshqa saytdan kelgan so'rovlarga cookie qo'shilmaydi (CSRF'dan himoya).
    "SameSite=Strict",
    `Max-Age=${maxAgeSeconds}`,
    secure ? "Secure" : null,
  ]
    .filter(Boolean)
    .join("; ");
}
