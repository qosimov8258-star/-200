import { createHmac, timingSafeEqual } from "node:crypto";

export interface TelegramIdentity {
  /** Telegram foydalanuvchi ID si — ishtirokchining asosiy kaliti. */
  telegramId: number;
  firstName: string;
  username: string | null;
}

/**
 * Mini App yuborgan `initData` satrini tekshiradi (Telegram hujjatidagi algoritm):
 *
 *   secret = HMAC_SHA256(key = "WebAppData", data = botToken)
 *   hash   = hex(HMAC_SHA256(key = secret, data = data_check_string))
 *
 * `data_check_string` — `hash` dan tashqari barcha maydonlar, kalit bo'yicha
 * tartiblangan, `key=value` ko'rinishida, `\n` bilan birlashtirilgan.
 *
 * Imzo to'g'ri va `auth_date` eskirmagan bo'lsa — foydalanuvchini qaytaradi, aks holda null.
 */
export function verifyInitData(
  raw: string,
  botToken: string,
  maxAgeSeconds: number,
  now: number = Date.now(),
): TelegramIdentity | null {
  if (!raw || !botToken) return null;

  const params = new URLSearchParams(raw);
  const hash = params.get("hash");
  if (!hash || !/^[0-9a-f]{64}$/.test(hash)) return null;
  params.delete("hash");

  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  const secret = createHmac("sha256", "WebAppData").update(botToken).digest();
  const expected = createHmac("sha256", secret).update(dataCheckString).digest();
  const given = Buffer.from(hash, "hex");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;

  const authDate = Number(params.get("auth_date"));
  if (!Number.isFinite(authDate) || now / 1000 - authDate > maxAgeSeconds) return null;

  let user: unknown;
  try {
    user = JSON.parse(params.get("user") ?? "null");
  } catch {
    return null;
  }
  if (
    typeof user !== "object" ||
    user === null ||
    typeof (user as { id?: unknown }).id !== "number"
  ) {
    return null;
  }
  const u = user as { id: number; first_name?: unknown; username?: unknown };
  return {
    telegramId: u.id,
    firstName: typeof u.first_name === "string" ? u.first_name : "",
    username: typeof u.username === "string" ? u.username : null,
  };
}
