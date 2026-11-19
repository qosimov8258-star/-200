import { createHash, createHmac, timingSafeEqual } from "node:crypto";

import type { TelegramIdentity } from "../telegram/init-data";

/** Telegram Login Widget qaytaradigan maydonlar (https://core.telegram.org/widgets/login). */
export interface LoginWidgetData {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

const STRING_FIELDS = ["first_name", "last_name", "username", "photo_url", "hash"] as const;
const ALLOWED = new Set(["id", "auth_date", ...STRING_FIELDS]);

/** Kiruvchi JSON ni tekshiradi: noma'lum maydon yoki noto'g'ri tip — null (CLAUDE.md). */
export function parseLoginWidget(body: unknown): LoginWidgetData | null {
  if (typeof body !== "object" || body === null || Array.isArray(body)) return null;
  const b = body as Record<string, unknown>;
  if (Object.keys(b).some((k) => !ALLOWED.has(k))) return null;
  if (!Number.isSafeInteger(b.id) || !Number.isSafeInteger(b.auth_date)) return null;
  for (const key of STRING_FIELDS) {
    const v = b[key];
    if (v !== undefined && (typeof v !== "string" || v.length > 512)) return null;
  }
  if (typeof b.first_name !== "string" || typeof b.hash !== "string") return null;
  return b as unknown as LoginWidgetData;
}

/**
 * Login Widget imzosini tekshiradi (Telegram hujjatidagi algoritm):
 *
 *   secret = SHA256(botToken)
 *   hash   = hex(HMAC_SHA256(key = secret, data = data_check_string))
 *
 * `data_check_string` — `hash` dan tashqari maydonlar, kalit bo'yicha tartiblangan,
 * `key=value` ko'rinishida, `\n` bilan. E'tibor: Mini App `initData` dan farqli kalit.
 */
export function verifyLoginWidget(
  data: LoginWidgetData,
  botToken: string,
  maxAgeSeconds: number,
  now: number = Date.now(),
): TelegramIdentity | null {
  if (!botToken || !/^[0-9a-f]{64}$/.test(data.hash)) return null;
  const { hash, ...fields } = data;
  const dataCheckString = Object.entries(fields)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}=${String(v)}`)
    .join("\n");

  const secret = createHash("sha256").update(botToken).digest();
  const expected = createHmac("sha256", secret).update(dataCheckString).digest();
  const given = Buffer.from(hash, "hex");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  if (now / 1000 - data.auth_date > maxAgeSeconds) return null;

  return { telegramId: data.id, firstName: data.first_name, username: data.username ?? null };
}
