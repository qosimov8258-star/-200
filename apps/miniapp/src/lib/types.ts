/**
 * Mini App va backend o'rtasidagi ma'lumot tiplari (ishtirokchi tomoni).
 *
 * Holat nomlari admin panel tiplari (`apps/admin/src/lib/types.ts`) bilan bir xil.
 * Backend tayyor bo'lganda OpenAPI dan generatsiya qilingan tiplarga almashtiriladi.
 */

/** Sana "YYYY-MM-DD" — tanlov kuni (Asia/Tashkent). */
export type IsoDate = string;

/**
 * Bitta videoning holati. PENDING — avtomatik tekshiruv (Apify, so'ng AI); ACCEPTED — qabul qilingan
 * (reytingda alohida qator bo'lib chiqadi; ishtirokchining o'rni va asosiy sovrin — eng ko'p ko'rilgan
 * bitta ACCEPTED videosi bo'yicha); MANUAL_REVIEW — AI mahsulotni topmadi yoki Instagram'da 3 marta
 * topilmadi, admin qo'lda tekshiradi; REJECTED — rad etilgan (hisobga kirmaydi; shu linkni tuzatib qayta yuborish mumkin).
 */
export type ReelStatus = "PENDING" | "ACCEPTED" | "MANUAL_REVIEW" | "REJECTED";

/**
 * Ishtirokchining ro'yxatdan o'tish bosqichi. Bosqichlar ketma-ket:
 * raqam ulashish → ism/familiya/yosh → qoidalarga rozilik → faol.
 */
export type ParticipantStage =
  | "NEEDS_CONTACT"
  | "NEEDS_PROFILE"
  | "NEEDS_CONSENT"
  | "ACTIVE"
  | "BLOCKED"
  | "DISQUALIFIED";

export interface Profile {
  firstName: string;
  /** Eski ishtirokchilarda bo'lishi mumkin; yangilarida — bo'sh satr. */
  lastName: string;
  age: number;
}

export interface Me {
  stage: ParticipantStage;
  /** Bot orqali ulashilgan raqam (yashirilgan ko'rinishda), ulashilmagan bo'lsa — null. */
  phoneMasked: string | null;
  profile: Profile | null;
  /**
   * Avval rozilik bergan, lekin admin qoidalarni muhim tarzda o'zgartirgan —
   * qaytadan rozilik so'raladi (`stage` = NEEDS_CONSENT).
   */
  rulesUpdated: boolean;
  /**
   * `web` — saytda (Telegram'siz) ro'yxatdan o'tgan: hisob faqat shu brauzerdagi sessiya bilan
   * tanilgan (chiqib bo'lmaydi). Eski backend yubormasa — Telegram deb hisoblanadi.
   */
  account?: "telegram" | "web";
  /** Serverda saqlangan til (bot xabarlari shu tilda); hali tanlanmagan — null. */
  lang?: "uz" | "ru" | null;
}

/** Profil: ism va yosh (familiya endi so'ralmaydi — uning o'rnida telefon raqam). */
export interface RegisterRequest {
  firstName: string;
  lastName?: string;
  age: number;
}

/** Saytdan (Telegram'siz) ro'yxatdan o'tish. `phone` — "90 123 45 67" (+998 siz) yoki to'liq. */
export interface WebRegisterRequest {
  firstName: string;
  phone: string;
  age: number;
}

export interface ContestInfo {
  endsAt: string;
  participants: number;
  minAge: number;
  prizeName: string;
}

export interface RulesSection {
  title: string;
  body: string;
}

export interface ContestRules {
  /** Rozilik qaysi versiyaga berilgani serverda saqlanadi. */
  version: number;
  sections: RulesSection[];
  /**
   * Qoidalarni tushuntiruvchi video (admin panelda yuklanadi) — qoidalar ustida eng tepada
   * ko'rsatiladi; yo'q bo'lsa — null. Fayl: `rulesVideoUrl(id)`.
   */
  video: { id: string; mime: string } | null;
}

/**
 * Reytingning bitta qatori — bitta qabul qilingan VIDEO (ishtirokchi emas). Bitta ishtirokchining
 * har bir ACCEPTED videosi alohida qator: bir xil `fullName` bir necha marta chiqishi va bir nechta
 * qatorda `isMe: true` bo'lishi mumkin. Tartib: ko'rishlar bo'yicha kamayib (teng bo'lsa — oldinroq
 * yuborilgan video). Video linklari ommaviy reytingda berilmaydi.
 */
export interface RatingEntry {
  /** Qatorning (videoning) o'rni: 1..N, har bir qatorda boshqa — React kaliti sifatida ham shu. */
  rank: number;
  /** Video egasining ismi — takrorlanishi mumkin (kalit sifatida ishlatilmaydi). */
  fullName: string;
  /** Shu videoning ko'rishlari. */
  views: number;
  /** Shu videoning oldingi yangilanishga nisbatan o'rin o'zgarishi: musbat — ko'tarilgan; yangi video — 0. */
  rankDelta: number;
  /** Video joriy ishtirokchiniki. Birinchi shunday qator — uning eng yaxshi videosi (`MyReels.rank`). */
  isMe: boolean;
}

export interface DailyViews {
  date: IsoDate;
  /** Shu kungi o'sish (videoning kun oxiridagi ko'rishlari − oldingi kundagi). */
  views: number;
}

/** Nega video qabul qilinmadi (backend: `participants.service.ts` → ReelRejectReason). */
export type ReelRejectReason =
  /** Instagram'da topilmadi: o'chirilgan, yopiq akkaunt yoki noto'g'ri link. */
  | "NOT_FOUND"
  /** Rasm yoki karusel — Reel emas. */
  | "NOT_A_VIDEO"
  /** Shu Instagram akkauntdan boshqa ishtirokchi video yuborgan. */
  | "OWNER_TAKEN"
  /** Videoda tanlov mahsuloti ko'rinmaydi. */
  | "NO_PRODUCT";

/** Ishtirokchining bitta videosi (`MyReels.reels` ichida). */
export interface MyReelItem {
  url: string;
  shortcode: string;
  /**
   * PENDING — server Instagram'da tekshiradi (ko'rishlar jadvali — `MyReels.syncEveryDays`;
   * ekranda shu haqda izoh chiqadi).
   */
  status: ReelStatus;
  /** Rad etilgan bo'lsa — sababi. */
  rejectReason: ReelRejectReason | null;
  /** Shu videoning oxirgi yig'ilgan ko'rishlari (hali yig'ilmagan bo'lsa — 0). */
  views: number;
  /** Yuborilgan vaqt (UTC ISO). */
  submittedAt: string;
}

/**
 * Ishtirokchining barcha videolari va natijasi. Videolar soni cheklanmagan; natija — barcha ACCEPTED
 * videolari ko'rishlarining yig'indisi (oferta 7.1).
 */
export interface MyReels {
  /** Umumiy tasdiqlangan ko'rishlar (barcha qabul qilingan videolar yig'indisi); yo'q bo'lsa — 0. */
  totalViews: number;
  /** Umumiy ko'rishlarning oxirgi yangilanishdagi o'sishi. */
  todayViews: number;
  /** Ishtirokchilar reytingidagi o'rni (umumiy ko'rishlar bo'yicha, faqat ma'lumot); bo'lmasa — null. */
  rank: number | null;
  /** O'rinning oldingi yangilanishga nisbatan o'zgarishi: musbat — ko'tarilgan. */
  rankDelta: number;
  /** Umumiy ko'rishlarning har yangilanishdagi o'sishi, eskidan yangiga (oxirgi 30 ta). */
  daily: DailyViews[];
  /** Videolar ichidagi eng so'nggi yangilanish (UTC ISO). */
  lastSyncedAt: string | null;
  /** Keyingi rejadagi yangilanish (UTC ISO); rejada yo'q bo'lsa — null. */
  nextSyncAt: string | null;
  /** Ko'rishlar necha kunda bir yangilanadi (0 — jadval yo'q). */
  syncEveryDays: number;
  /**
   * Barcha yuborilgan videolar; video yo'q bo'lsa — bo'sh. Tartib: avval ACCEPTED — ko'rishlar
   * bo'yicha kamayib (teng bo'lsa — oldinroq yuborilgani; birinchisi `best`), keyin hali hal
   * qilinmaganlar (PENDING, MANUAL_REVIEW) — yangisi tepada, oxirida REJECTED — yangisi tepada.
   */
  reels: MyReelItem[];
}

/** Saytning kirish sahifasi uchun ochiq sozlamalar (GET /auth/config). */
export interface AuthConfig {
  /** Login Widget va "Botda ochish" havolasi uchun; sozlanmagan bo'lsa — null. */
  botUsername: string | null;
  prizeName: string;
}

/**
 * "Hisobim bor" — Telegram bot orqali kirish so'rovi (POST /auth/bot-login). `code` saytda va
 * botda ko'rinadi; maxfiy kalit brauzerning `HttpOnly` cookie'sida (JavaScript ko'rmaydi).
 */
export interface BotLoginStart {
  id: string;
  code: string;
  /** `https://t.me/<bot>?start=login_<id>` */
  botUrl: string;
  expiresAt: string;
}

/**
 * PENDING — botda tasdiq kutilmoqda; CONFIRMED — kirildi (sessiya cookie'si qo'yildi);
 * DENIED — botda "Men emas"; FAILED — raqam boshqa hisobga bog'langan; EXPIRED — eskirgan/ishlatilgan.
 */
export type BotLoginStatus = "PENDING" | "CONFIRMED" | "DENIED" | "FAILED" | "EXPIRED";

/** Telegram Login Widget `onauth` qaytaradigan obyekt — backendga o'zgartirmasdan yuboriladi. */
export interface TelegramLoginUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

/** Support yozishmasi: ishtirokchi xabarlari va operator javoblari (eskisidan yangisiga). */
export interface SupportMessage {
  from: "PARTICIPANT" | "OPERATOR";
  text: string;
  createdAt: string;
}

export interface SupportThread {
  messages: SupportMessage[];
}

export interface Winner {
  fullName: string;
  finalViews: number;
  announcedAt: string;
}

/**
 * Istoriya — ishtirokchining 24 soat ko'rinadigan qisqa videosi (Instagram istoriyalari kabi).
 * Tekshirilmaydi, reyting va sovrinlarga kirmaydi. Video: `api.storyVideoUrl(id)`.
 */
export interface StoryItem {
  /** Tasodifiy (shaffof bo'lmagan) identifikator. */
  id: string;
  /** Joylangan vaqt (UTC ISO). */
  createdAt: string;
  /** O'chib ketish vaqti (UTC ISO) — `createdAt` + 24 soat. */
  expiresAt: string;
}

/** Bitta ishtirokchining istoriyalari (aylana — bitta guruh). */
export interface StoryGroup {
  /**
   * Ishtirokchining barqaror shaffof bo'lmagan kaliti (telegramId EMAS) — React kaliti va
   * "ko'rilgan" belgisi uchun.
   */
  authorKey: string;
  /** "Ism Familiya". */
  fullName: string;
  /** Joriy ishtirokchining o'z istoriyalari (ro'yxatda birinchi). */
  isMe: boolean;
  /** Eskisidan yangisiga — ko'rsatish tartibi. */
  stories: StoryItem[];
}

/** Xato kodlari — ekranda mos matn ko'rsatish uchun. */
export type ApiErrorCode =
  | "INVALID_LINK"
  | "REEL_ALREADY_SUBMITTED"
  | "REEL_TAKEN"
  | "UNDER_AGE"
  | "INVALID_PROFILE"
  | "PROFILE_LOCKED"
  | "RULES_OUTDATED"
  /** Shikoyat: Reel linki yoki @username noto'g'ri yozilgan. */
  | "REPORT_TARGET_INVALID"
  /** Shikoyat: bu Reel yoki akkaunt tanlov ishtirokchisi emas. */
  | "REPORT_NOT_FOUND"
  /** Shikoyat: o'zingiz haqingizda. */
  | "REPORT_SELF"
  /** Shikoyat: bugun shu ishtirokchi haqida allaqachon yuborgansiz. */
  | "REPORT_DUPLICATE"
  /** Shikoyat: bugungi chegara tugadi. */
  | "REPORT_LIMIT"
  /** Skrinshot yaroqsiz (rasm emas yoki juda katta). */
  | "INVALID_IMAGE"
  /** Support: xabar bo'sh yoki juda uzun. */
  | "SUPPORT_INVALID"
  /** Support: qisqa vaqtda juda ko'p xabar. */
  | "SUPPORT_LIMIT"
  /** Istoriya: video 50 MB dan katta (nginx'ning HTML 413 javobi ham shu). */
  | "STORY_TOO_LARGE"
  /** Istoriya: qo'llab-quvvatlanmaydigan, buzilgan yoki bo'sh video. */
  | "STORY_INVALID_FILE"
  /** Istoriya: 10 ta faol istoriya chegarasi. */
  | "STORY_LIMIT"
  /** Topilmadi (masalan, o'chirilgan yoki muddati tugagan istoriya). */
  | "NOT_FOUND"
  /** Saytdan ro'yxatdan o'tish: raqam noto'g'ri. */
  | "INVALID_PHONE"
  /** Saytdan ro'yxatdan o'tish: bu raqam bilan allaqachon ro'yxatdan o'tilgan. */
  | "PHONE_TAKEN"
  /** Qisqa vaqtda juda ko'p urinish. */
  | "TOO_MANY"
  | "UNAUTHORIZED"
  | "SERVER";

/** "Reklamani ko'rdim": boshqa ishtirokchining Reeli target bilan ko'rsatilayotgani haqida. */
export interface TargetReportRequest {
  /** Reel linki, profil linki yoki @username. */
  target: string;
  /** Siqilgan skrinshot: `data:image/jpeg;base64,...` (≤ 2 MB). */
  screenshot: string;
  comment?: string;
}

/** Asosiy sovrin toifasi (aksiya yakunida, eng ko'p ko'rilgan bitta video ko'rishlari bo'yicha). */
export type PrizeTierKind = "tablet" | "phone" | "travel" | "car";

export interface PrizeTier {
  kind: PrizeTierKind;
  /** "Planshet", "iPhone 18 Pro"… */
  title: string;
  quantity: number;
  /** Miqdor birligi ("yo'llanma"); null — oddiy "ta". */
  unit: string | null;
  minViews: number;
  /** null — "va undan ko'p". */
  maxViews: number | null;
}

/** Har oylik sovrin (voucher), g'oliblar tasodifiy tanlanadi. */
export interface MonthlyPrize {
  title: string;
  /** Bitta voucher qiymati, so'm. */
  amount: number;
  perMonth: number;
  total: number;
  /** Oy davomidagi eng ko'p ko'rilgan qabul qilingan Reeli shu oraliqda bo'lganlar qatnashadi. */
  minViews: number;
  maxViews: number;
}

/** Oylik o'yin bosqichi; sanalar Asia/Tashkent bo'yicha, ikkalasi ham kiradi. */
export interface PrizeStage {
  startsOn: IsoDate;
  endsOn: IsoDate;
}

export interface ContestPrizes {
  monthly: MonthlyPrize;
  stages: PrizeStage[];
  /** Arzonidan qimmatiga. */
  tiers: PrizeTier[];
  /** "Muhim" bandlari. */
  notes: string[];
}
