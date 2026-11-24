/**
 * Mini App va backend o'rtasidagi ma'lumot tiplari (ishtirokchi tomoni).
 *
 * Holat nomlari admin panel tiplari (`apps/admin/src/lib/types.ts`) bilan bir xil.
 * Backend tayyor bo'lganda OpenAPI dan generatsiya qilingan tiplarga almashtiriladi.
 */

/** Sana "YYYY-MM-DD" — tanlov kuni (Asia/Tashkent). */
export type IsoDate = string;

/**
 * Bitta videoning holati. PENDING — avtomatik tekshiruv; ACCEPTED — qabul qilingan (reytingda
 * alohida qator bo'lib chiqadi; ishtirokchining o'rni va asosiy sovrin — eng ko'p ko'rilgan bitta
 * ACCEPTED videosi bo'yicha); MANUAL_REVIEW — Instagram'da 3 marta topilmadi, admin qo'lda
 * tekshiradi; REJECTED — rad etilgan (hisobga kirmaydi; shu linkni tuzatib qayta yuborish mumkin).
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
  | "OWNER_TAKEN";

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
  /**
   * Eng yaxshi natija: eng ko'p ko'rilgan ACCEPTED video (teng bo'lsa — oldinroq yuborilgani);
   * ishtirokchining o'rni (`MyReels.rank`) va asosiy sovrin shu video bo'yicha. Ro'yxatda faqat
   * birinchi video va faqat ACCEPTED bo'lsa true.
   */
  best: boolean;
  /**
   * Shu videoning reytingdagi o'rni (har bir video alohida qator). Faqat reytingdagi ACCEPTED
   * videoda raqam, qolganlarida — null.
   */
  rank: number | null;
}

/**
 * Ishtirokchining barcha videolari va natijasi. Videolar soni cheklanmagan; reytingda har bir
 * ACCEPTED video alohida qator, ishtirokchining o'rni va asosiy sovrinlar uchun esa eng ko'p
 * ko'rilgan bitta ACCEPTED videosi hisoblanadi — videolar ko'rishlari qo'shilmaydi.
 */
export interface MyReels {
  /** Eng ko'p ko'rilgan qabul qilingan video ko'rishlari; bunday video yo'q bo'lsa — 0. */
  bestViews: number;
  /** Eng ko'p ko'rilgan videoning oxirgi kundagi o'sishi. */
  todayViews: number;
  /**
   * Ishtirokchining o'rni — eng ko'p ko'rilgan videosining reytingdagi o'rni (reyting har bir video
   * bo'yicha, shuning uchun ishtirokchilar o'rinlari orasida raqamlar tushib qolishi mumkin).
   * Qabul qilingan video yo'q bo'lsa — null.
   */
  rank: number | null;
  /** Shu (eng yaxshi) o'rinning oldingi yangilanishga nisbatan o'zgarishi: musbat — ko'tarilgan. */
  rankDelta: number;
  /** Eng ko'p ko'rilgan videoning kunlik o'sishi, eskidan yangiga (oxirgi 30 kun). */
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
