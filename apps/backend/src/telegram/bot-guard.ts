/**
 * Botni suiiste'moldan himoya qilish (flood, spam, begona operatorlar) — Telegram'ga bog'liq
 * bo'lmagan, sinovdan o'tkaziladigan qoidalar. `TelegramService` shularni ishlatadi.
 */

/** Bitta foydalanuvchidan daqiqasiga shuncha yangilanish (xabar, tugma) — undan ko'pi tashlanadi. */
export const FLOOD_MAX_PER_MINUTE = 20;
const MINUTE_MS = 60_000;
/** Support murojaati: bitta ishtirokchidan 10 daqiqada shuncha xabar (Mini App'da — 5). */
export const BOT_SUPPORT_MAX_IN_WINDOW = 10;
export const BOT_SUPPORT_WINDOW_MS = 10 * 60_000;
/** Support xabari matni (Mini App'dagidek) va operator javobi chegarasi, belgi. */
export const SUPPORT_TEXT_MAX = 1_000;
export const OPERATOR_REPLY_MAX = 3_500;
/** Telegram chegaralari: oddiy xabar — 4096, rasm izohi — 1024 belgi. */
export const TELEGRAM_TEXT_MAX = 4_096;
export const TELEGRAM_CAPTION_MAX = 1_024;
/** Operator ruxsati (guruh adminligi) shuncha vaqt eslab qolinadi. */
const OPERATOR_CACHE_MS = 5 * 60_000;

export type FloodVerdict = "ok" | "warn" | "drop";

/**
 * Har bir foydalanuvchi uchun so'nggi bir daqiqadagi yangilanishlar. Chegaradan oshganda birinchi
 * marta — `warn` (bir marta ogohlantiriladi), keyin daqiqa tugaguncha — `drop` (javobsiz tashlanadi).
 */
export class FloodGuard {
  private readonly hits = new Map<number, number[]>();
  private readonly warned = new Map<number, number>();

  constructor(
    private readonly maxPerWindow = FLOOD_MAX_PER_MINUTE,
    private readonly windowMs = MINUTE_MS,
  ) {}

  check(userId: number, now: number = Date.now()): FloodVerdict {
    const recent = (this.hits.get(userId) ?? []).filter((at) => now - at < this.windowMs);
    recent.push(now);
    this.hits.set(userId, recent);
    if (this.hits.size > 50_000) this.prune(now);
    if (recent.length <= this.maxPerWindow) return "ok";
    const lastWarn = this.warned.get(userId);
    if (lastWarn !== undefined && now - lastWarn < this.windowMs) return "drop";
    this.warned.set(userId, now);
    return "warn";
  }

  private prune(now: number): void {
    for (const [id, times] of this.hits) {
      if (times.every((at) => now - at >= this.windowMs)) this.hits.delete(id);
    }
    for (const [id, at] of this.warned) if (now - at >= this.windowMs) this.warned.delete(id);
  }
}

/** Bir oynada bitta xabarnoma ("juda ko'p xabar") — javoblar bilan spamga javob bermaslik uchun. */
export class NoticeOnce {
  private readonly last = new Map<number, number>();

  constructor(private readonly windowMs: number) {}

  /** true — ogohlantirish yuborilsin; false — shu oynada allaqachon yuborilgan. */
  shouldNotify(userId: number, now: number = Date.now()): boolean {
    const at = this.last.get(userId);
    if (at !== undefined && now - at < this.windowMs) return false;
    this.last.set(userId, now);
    if (this.last.size > 50_000) this.last.clear();
    return true;
  }
}

/** Matnni `max` belgigacha qisqartiradi (oxiriga "…"). */
export function clip(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/** `TELEGRAM_SUPPORT_OPERATOR_IDS` — vergul bilan Telegram ID'lar; noto'g'ri qiymatlar tashlanadi. */
export function parseOperatorIds(raw: string | null): ReadonlySet<number> {
  const ids = (raw ?? "")
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isSafeInteger(n) && n > 0);
  return new Set(ids);
}

export type ChatMemberStatus = "creator" | "administrator" | "member" | "restricted" | "left" | "kicked";

/**
 * Support guruhida ishtirokchiga kim javob bera oladi: ruxsat ro'yxati berilgan bo'lsa — faqat
 * ulardagilar; aks holda — guruh egasi va adminlari (oddiy a'zo — yo'q: guruh havolasi begona
 * qo'liga tushsa ham, u bot nomidan ishtirokchilarga yoza olmasin).
 */
export function isOperator(userId: number, status: ChatMemberStatus | null, allowlist: ReadonlySet<number>): boolean {
  if (allowlist.size > 0) return allowlist.has(userId);
  return status === "creator" || status === "administrator";
}

/** Guruh a'zoligi holatini (Telegram API) qisqa muddat keshlaydi. */
export class OperatorCache {
  private readonly cache = new Map<number, { status: ChatMemberStatus | null; at: number }>();

  constructor(private readonly ttlMs = OPERATOR_CACHE_MS) {}

  async status(
    userId: number,
    load: (userId: number) => Promise<ChatMemberStatus | null>,
    now: number = Date.now(),
  ): Promise<ChatMemberStatus | null> {
    const hit = this.cache.get(userId);
    if (hit && now - hit.at < this.ttlMs) return hit.status;
    let status: ChatMemberStatus | null;
    try {
      status = await load(userId);
    } catch {
      status = null;
    }
    this.cache.set(userId, { status, at: now });
    return status;
  }
}

/** Xato matnidan bot tokenini yashiradi (log'ga tushmasin). */
export function maskToken(message: string, token: string | null): string {
  return token ? message.split(token).join("***") : message;
}
