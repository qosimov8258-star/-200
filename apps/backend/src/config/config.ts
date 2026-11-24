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
    /** Kunning qaysi vaqtida yig'iladi (Asia/Tashkent, "HH:MM"; standart — yarim tun, reyting har kuni 00:00 da). */
    syncTime: str("STATS_SYNC_TIME") ?? "00:00",
    /**
     * Tanlov boshlangan kundan (`contest.ts` → `startsOn`) boshlab necha kunda bir marta:
     * 1 — har kuni (standart; Mini App "har kuni tekshiriladi" deb yozadi), 7 — haftada bir marta;
     * 0 — avtomatik yig'ish o'chiq.
     */
    syncEveryDays: Number(str("STATS_SYNC_EVERY_DAYS") ?? 1),
    /** Yangi videolar shuncha kutib, bitta so'rovda tekshiriladi (bir vaqtda kelganlar birga). */
    verifyDelayMs: Number(str("STATS_VERIFY_DELAY_MS") ?? 1_500),
    /** Faqat `mock` rejimida: AI tekshiruvini lokal sinash uchun hamma videolarga shu fayl manzili. */
    mockVideoUrl: str("STATS_MOCK_VIDEO_URL"),
  },

  /**
   * AI video tekshiruvi (admin panel → AI). Videolarni alohida worker jarayoni (`npm run worker`)
   * tekshiradi: backend navbat va natijalarni saqlaydi, worker esa `/internal/ai/*` ga shu token
   * bilan murojaat qiladi. Claude kaliti (`ANTHROPIC_API_KEY`) faqat worker'da — backend'ga kerak emas.
   */
  ai: {
    /** Worker ↔ backend maxfiy kaliti (`openssl rand -hex 32`). Bo'sh bo'lsa — worker API yopiq. */
    workerToken: str("AI_WORKER_TOKEN"),
    model: str("AI_MODEL") ?? "claude-opus-5-5",
    /** Necha soniyada bir kadr (2 → 2 daqiqalik videodan ~60 kadr). */
    frameIntervalSec: Number(str("AI_FRAME_INTERVAL_SEC") ?? 2),
    /** Kadrning qisqa tomoni, px (720 = 720p). */
    frameHeight: Number(str("AI_FRAME_HEIGHT") ?? 720),
    /** Shundan past ishonch — SHUBHALI (qo'lda ko'riladi). */
    confidenceMin: Number(str("AI_CONFIDENCE_MIN") ?? 0.8),
  },

  /** Target (pullik reklama) tekshiruvi — Meta reklama kutubxonasi orqali (Apify). */
  targets: {
    /** Reytingning nechta yetakchisi tekshiriladi. */
    checkTop: Number(str("TARGET_CHECK_TOP") ?? 30),
    /**
     * Tanlov boshidan necha kunda bir (1 — har kuni, standart; 30 — oyiga bir marta);
     * 0 — avtomatik tekshiruv o'chiq (faqat admin "Hozir tekshirish" bosganda).
     */
    everyDays: Number(str("TARGET_CHECK_EVERY_DAYS") ?? 1),
  },

  /**
   * Skriptlar uchun admin API kaliti (`Authorization: Bearer ...`). Admin panel undan
   * foydalanmaydi — xodimlar login/parol bilan kiradi. Bo'sh bo'lsa — kalit bilan kirish yopiq.
   */
  adminApiToken: str("ADMIN_API_TOKEN"),

  /**
   * Ma'lumotlar saqlanadigan papka (holat fayli, zaxiralar, skrinshotlar). Ma'lumotlar bazasi
   * ulanguncha shu. Docker'da volume'ga ulanadi — aks holda konteyner almashganda o'chadi.
   */
  dataDir: str("DATA_DIR") ?? "data",

  /** Admin panel xodimlari va sessiyasi. */
  admin: {
    /**
     * Xodimlar: `login|ROL|Ism Familiya|parol`, bir nechta bo'lsa `;` bilan. ROL — ADMIN yoki
     * SUPPORT. Parolda `|` va `;` bo'lmasin. Bo'sh bo'lsa — admin panelga hech kim kira olmaydi.
     */
    users: str("ADMIN_USERS"),
    /** Sessiya cookie'sini imzolash kaliti (`openssl rand -base64 32`). */
    sessionSecret: str("ADMIN_SESSION_SECRET"),
    /** Sessiya necha soat amal qiladi. */
    sessionTtlHours: Number(str("ADMIN_SESSION_TTL_HOURS") ?? 12),
    /** Cookie faqat https orqali yuborilsin (prod da doim true). */
    cookieSecure: (str("ADMIN_COOKIE_SECURE") ?? (process.env.NODE_ENV === "production" ? "true" : "false")) === "true",
  },

  /**
   * Tashkilot egalari — yashirin bo'lim (`src/owner/`). Admin login'iga bog'liq emas: alohida
   * hisoblar va alohida sessiya. Imzo kaliti — `ADMIN_SESSION_SECRET` (boshqa HMAC konteksti
   * bilan: admin tokeni ega uchun yaroqsiz va aksincha), cookie xavfsizligi — `ADMIN_COOKIE_SECURE`.
   */
  owner: {
    /**
     * Egalar: `login|Ism Familiya|parol`, bir nechta bo'lsa `;` bilan; parol kamida 12 belgi,
     * ichida `|` va `;` bo'lmasin. Bo'sh bo'lsa — bo'limga hech kim kira olmaydi.
     */
    users: str("OWNER_USERS"),
    /** Sessiya necha daqiqa amal qiladi. */
    sessionTtlMinutes: Number(str("OWNER_SESSION_TTL_MINUTES") ?? 120),
  },
} as const;
