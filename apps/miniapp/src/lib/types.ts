/**
 * Mini App va backend o'rtasidagi ma'lumot tiplari (ishtirokchi tomoni).
 *
 * Holat nomlari admin panel tiplari (`apps/admin/src/lib/types.ts`) bilan bir xil.
 * Backend tayyor bo'lganda OpenAPI dan generatsiya qilingan tiplarga almashtiriladi.
 */

/** Sana "YYYY-MM-DD" — tanlov kuni (Asia/Tashkent). */
export type IsoDate = string;

/**
 * Bitta videoning holati. PENDING — avtomatik tekshiruv; ACCEPTED — ko'rishlari reytingga
 * qo'shiladi; MANUAL_REVIEW — Instagram'da 3 marta topilmadi, admin qo'lda tekshiradi;
 * REJECTED — rad etilgan (hisobga kirmaydi; shu linkni tuzatib qayta yuborish mumkin).
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
}

export interface RegisterRequest {
  firstName: string;
  lastName: string;
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
}

export interface RatingEntry {
  rank: number;
  fullName: string;
  views: number;
  /** Kechagiga nisbatan o'rin o'zgarishi: musbat — ko'tarilgan. */
  rankDelta: number;
  isMe: boolean;
}

export interface DailyViews {
  date: IsoDate;
  /** Shu kungi o'sish (kun oxiridagi jami − oldingi kun). */
  views: number;
}

/** Nega video qabul qilinmadi (backend: `participants.service.ts` → ReelRejectReason). */
export type ReelRejectReason =
  /** Instagram'da topilmadi: o'chirilgan, yopiq akkaunt yoki noto'g'ri link. */
  | "NOT_FOUND"
  /** Rasm yoki karusel — Reel emas. */
  | "NOT_A_VIDEO"
  /** Shu Instagram akkauntdan boshqa ishtirokchi video yuborgan. */
  | "OWNER_TAKEN";

/** Ishtirokchining bitta videosi (`MyReels.reels` ichida). */
export interface MyReelItem {
  url: string;
  shortcode: string;
  /** PENDING — server Instagram'da tekshirmoqda (odatda bir necha daqiqa). */
  status: ReelStatus;
  /** Rad etilgan bo'lsa — sababi. */
  rejectReason: ReelRejectReason | null;
  /** Shu videoning oxirgi yig'ilgan ko'rishlari (hali yig'ilmagan bo'lsa — 0). */
  views: number;
  /** Yuborilgan vaqt (UTC ISO). */
  submittedAt: string;
}

/**
 * Ishtirokchining barcha videolari va umumiy statistikasi. Videolar soni cheklanmagan;
 * reyting va asosiy sovrinlar uchun faqat ACCEPTED videolar ko'rishlari qo'shiladi.
 */
export interface MyReels {
  /** Qabul qilingan videolar ko'rishlari yig'indisi. */
  totalViews: number;
  /** Oxirgi kundagi umumiy o'sish. */
  todayViews: number;
  /** Qabul qilingan video yo'q bo'lsa — null. */
  rank: number | null;
  rankDelta: number;
  /** Qabul qilingan videolarning kunlik o'sishi yig'indisi, eskidan yangiga. */
  daily: DailyViews[];
  /** Videolar ichidagi eng so'nggi yangilanish (UTC ISO). */
  lastSyncedAt: string | null;
  /** Keyingi rejadagi yangilanish (UTC ISO); rejada yo'q bo'lsa — null. */
  nextSyncAt: string | null;
  /** Ko'rishlar necha kunda bir yangilanadi (0 — jadval yo'q). */
  syncEveryDays: number;
  /** Barcha yuborilgan videolar, yangisidan eskisiga; video yo'q bo'lsa — bo'sh. */
  reels: MyReelItem[];
}

/** Saytning kirish sahifasi uchun ochiq sozlamalar (GET /auth/config). */
export interface AuthConfig {
  /** Login Widget va "Botda ochish" havolasi uchun; sozlanmagan bo'lsa — null. */
  botUsername: string | null;
  prizeName: string;
}

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

/** Asosiy sovrin toifasi (aksiya yakunida, jami ko'rishlar bo'yicha). */
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
  /** Oy davomida shu oraliqda ko'rish yig'ganlar qatnashadi. */
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
