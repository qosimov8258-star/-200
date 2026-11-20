import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Ega sessiyasi: server imzolagan token `HttpOnly` cookie'da (JavaScript o'qiy olmaydi).
 * Token: base64url({ k: "owner", l: login, f: parol barmoq izi, e: tugash vaqti (soniya) }) + "." + HMAC.
 *
 * Kalit — `ADMIN_SESSION_SECRET` dan HMAC bilan hosil qilingan alohida kalit (`deriveOwnerKey`):
 * admin sessiyasi tokeni bu yerda yaroqsiz, ega tokeni esa admin API'da yaroqsiz (imzo mos
 * kelmaydi; ustiga `k` belgisi ham tekshiriladi). Parol yoki kalit o'zgarsa — eski sessiyalar
 * bekor bo'ladi.
 */
export const OWNER_COOKIE = "reels_owner";
/** Cookie faqat ega API so'rovlarida yuboriladi (admin, sayt va Mini App so'rovlarida emas). */
export const OWNER_COOKIE_PATH = "/api/v1/owner";

const KEY_CONTEXT = "reels-contest/owner-session/v1";
const KIND = "owner";

export interface OwnerSessionClaims {
  login: string;
  fingerprint: string;
}

/** Umumiy maxfiy kalitdan faqat ega sessiyalari uchun kalit. */
export const deriveOwnerKey = (secret: Buffer): Buffer => createHmac("sha256", secret).update(KEY_CONTEXT).digest();

const sign = (payload: string, key: Buffer) => createHmac("sha256", key).update(payload).digest();

export function createOwnerToken(
  claims: OwnerSessionClaims,
  ttlSeconds: number,
  key: Buffer,
  now: number = Date.now(),
): string {
  const payload = Buffer.from(
    JSON.stringify({ k: KIND, l: claims.login, f: claims.fingerprint, e: Math.floor(now / 1000) + ttlSeconds }),
  ).toString("base64url");
  return `${payload}.${sign(payload, key).toString("base64url")}`;
}

/** Imzo to'g'ri, ega tokeni va muddati o'tmagan bo'lsa — da'volar, aks holda null. */
export function verifyOwnerToken(token: string, key: Buffer, now: number = Date.now()): OwnerSessionClaims | null {
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra !== undefined) return null;
  const expected = sign(payload, key);
  const given = Buffer.from(signature, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as unknown;
    if (typeof data !== "object" || data === null) return null;
    const { k, l, f, e } = data as { k?: unknown; l?: unknown; f?: unknown; e?: unknown };
    if (k !== KIND || typeof l !== "string" || typeof f !== "string") return null;
    if (typeof e !== "number" || e * 1000 <= now) return null;
    return { login: l, fingerprint: f };
  } catch {
    return null;
  }
}

/** `Set-Cookie` qiymati. `maxAgeSeconds` 0 — cookie o'chiriladi (chiqish). */
export function ownerCookie(value: string, maxAgeSeconds: number, secure: boolean): string {
  return [
    `${OWNER_COOKIE}=${encodeURIComponent(value)}`,
    `Path=${OWNER_COOKIE_PATH}`,
    "HttpOnly",
    // Strict: boshqa saytdan kelgan so'rovlarga cookie qo'shilmaydi (CSRF'dan himoya).
    "SameSite=Strict",
    `Max-Age=${maxAgeSeconds}`,
    secure ? "Secure" : null,
  ]
    .filter(Boolean)
    .join("; ");
}
