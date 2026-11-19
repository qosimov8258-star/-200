/**
 * Muhit o'zgaruvchilari. Lokal ishga tushirishda `apps/backend/.env` (git'ga kirmaydi)
 * o'qiladi; namunasi repo ildizidagi `.env.example` da.
 */
try {
  process.loadEnvFile(".env");
} catch {
  // .env yo'q — o'zgaruvchilar muhitdan olinadi.
}

const str = (name: string): string | null => {
  const value = process.env[name]?.trim();
  return value ? value : null;
};

export const config = {
  port: Number(str("PORT") ?? 3000),
  /** Mini App joylashgan manzil(lar) — CORS uchun, vergul bilan. */
  corsOrigins: (str("CORS_ORIGINS") ?? "http://localhost:3001,http://localhost:3002").split(",").map((s) => s.trim()),

  telegram: {
    /** @BotFather bergan token. Yo'q bo'lsa — bot ishga tushmaydi, Mini App API hammani rad etadi. */
    botToken: str("TELEGRAM_BOT_TOKEN"),
    botUsername: str("TELEGRAM_BOT_USERNAME"),
    /** Mini App'ning https manzili (Telegram faqat https ni qabul qiladi). */
    miniAppUrl: str("TELEGRAM_MINIAPP_URL"),
    /** Support operatorlari guruhi (bot shu guruhga admin sifatida qo'shiladi). */
    supportChatId: str("TELEGRAM_SUPPORT_CHAT_ID"),
    /** initData necha soniyagacha amal qiladi. */
    initDataMaxAgeSeconds: Number(str("TELEGRAM_INITDATA_MAX_AGE") ?? 86_400),
    /**
     * `polling` — bot Telegram'dan yangilanishlarni o'zi so'raydi (lokal ishlab chiqish);
     * `off` — bot ishga tushmaydi, faqat API. `webhook` — prod uchun, hali qo'shilmagan.
     * Bir vaqtda faqat bitta jarayon polling qila oladi.
     */
    mode: (str("TELEGRAM_MODE") ?? "polling") as "polling" | "webhook" | "off",
  },

  /** Reel ko'rishlarini yig'ish (Meta API o'rniga — Apify). */
  stats: {
    /** `apify` — haqiqiy ma'lumot; `mock` — faqat lokal sinov uchun soxta ko'rishlar. */
    provider: (str("STATS_PROVIDER") ?? "apify") as "apify" | "mock",
    apifyToken: str("APIFY_API_TOKEN"),
    /** Kunning qaysi vaqtida yig'iladi (Asia/Tashkent, "HH:MM"). */
    syncTime: str("STATS_SYNC_TIME") ?? "06:00",
    /** Necha kunda bir marta: 1 — har kuni, 14 — ikki haftada; 0 — avtomatik yig'ish o'chiq. */
    syncEveryDays: Number(str("STATS_SYNC_EVERY_DAYS") ?? 1),
    /** Yangi videolar shuncha kutib, bitta so'rovda tekshiriladi (pulni tejash uchun). */
    verifyDelayMs: Number(str("STATS_VERIFY_DELAY_MS") ?? 5_000),
  },

  /**
   * VAQTINCHA: admin API kaliti (admin login qurilguncha). Bo'sh bo'lsa — admin API yopiq.
   */
  adminApiToken: str("ADMIN_API_TOKEN"),
} as const;
