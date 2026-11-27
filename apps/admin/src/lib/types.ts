/**
 * Admin panel va backend o'rtasidagi ma'lumot tiplari (API kontrakti).
 *
 * Bu fayl mock va haqiqiy API uchun umumiy. Backend tayyor bo'lganda
 * tiplar OpenAPI dan generatsiya qilingan klientga moslashtiriladi.
 */

/** Sana "YYYY-MM-DD" ko'rinishida — tanlov kuni (Asia/Tashkent). */
export type IsoDate = string;

// ---------------------------------------------------------------------------
// Xodimlar va auth
// ---------------------------------------------------------------------------

/** Panel xodimining roli (TZ, 2-bo'lim). */
export type AdminRole = "ADMIN" | "SUPPORT";

/** Tizimga kirgan xodim. */
export interface AdminUser {
  id: string;
  login: string;
  fullName: string;
  role: AdminRole;
}

/** Login so'rovi. */
export interface LoginRequest {
  login: string;
  password: string;
}

// ---------------------------------------------------------------------------
// Tanlov holatlari (PLAN.md, 5-bo'lim)
// ---------------------------------------------------------------------------

export type ParticipantStatus = "ACTIVE" | "WARNED" | "DISQUALIFIED" | "BLOCKED";

export type ReelStatus = "PENDING" | "ACCEPTED" | "REJECTED" | "REMOVED";

/**
 * Nega video qabul qilinmadi: NOT_FOUND — Instagramda topilmadi (o'chirilgan, yopiq akkaunt
 * yoki noto'g'ri link); NOT_A_VIDEO — rasm yoki karusel; OWNER_TAKEN — shu Instagram akkaunt
 * boshqa ishtirokchining videosida ishlatilgan; NO_PRODUCT — videoda tanlov mahsuloti ko'rinmaydi
 * (AI topmadi, admin tekshirib rad etdi).
 */
export type ReelRejectReason = "NOT_FOUND" | "NOT_A_VIDEO" | "OWNER_TAKEN" | "NO_PRODUCT";

/**
 * Nakrutka shubhasi belgisi (backend `ReelFlagType`) — admin ko'rib chiqishi uchun,
 * reytingga o'zi ta'sir qilmaydi. API `flags: string[]` beradi: yangi tur qo'shilsa ham
 * panel buzilmaydi (noma'lum belgi kodi o'zicha ko'rsatiladi).
 */
export type ReelFlagType = "LOW_ENGAGEMENT" | "VIEW_SPIKE" | "ENGAGEMENT_GAP" | "VIEW_DROP";

export type SupportTicketStatus = "NEW" | "IN_PROGRESS" | "CLOSED";

// ---------------------------------------------------------------------------
// Umumiy
// ---------------------------------------------------------------------------

export type SortOrder = "asc" | "desc";

/** Sahifalangan ro'yxat javobi. `page` 1 dan boshlanadi. */
export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

// ---------------------------------------------------------------------------
// Ishtirokchilar (Foydalanuvchilar bo'limi)
// ---------------------------------------------------------------------------

export type ParticipantSort = "rank" | "views" | "name";

export interface ParticipantListQuery {
  /** Ism, familiya, telefon yoki Instagram username bo'yicha qidiruv. */
  search?: string;
  status?: ParticipantStatus;
  /**
   * Kamida bitta videosi shu holatda bo'lganlar (`PENDING` — qo'lda tekshiruvdagilar bilan);
   * "NONE" — umuman video yubormaganlar.
   */
  reel?: ReelStatus | "NONE";
  /** Ko'rishlar oralig'i (ikkala chegara ham kiradi); berilmasa — chegara yo'q. */
  minViews?: number;
  maxViews?: number;
  sort?: ParticipantSort;
  order?: SortOrder;
  page?: number;
  pageSize?: number;
}

export interface ParticipantListItem {
  id: string;
  firstName: string;
  lastName: string;
  age: number;
  phone: string;
  /**
   * Instagram akkaunt — rad etilmagan videolar ichida birinchi aniqlangani; hali aniqlanmagan
   * bo'lsa — null. Ishtirokchining barcha akkauntlari — `ParticipantReels.participant`.
   */
  instagramUsername: string | null;
  status: ParticipantStatus;
  registeredOn: IsoDate;
  /** Yuborilgan videolar soni holat bo'yicha. Videolarning o'zi — `getParticipantReels`. */
  reels: ParticipantReelCounts;
  /**
   * Umumiy tasdiqlangan ko'rishlar — barcha qabul qilingan videolari oxirgi ko'rishlarining yig'indisi
   * (oferta 7.1). Qabul qilingan video yo'q — 0.
   */
  views: number;
  /**
   * Bugungi reytingdagi o'rni — eng ko'p ko'rilgan videosining o'rni. Reytingda har bir video
   * alohida qator, shuning uchun ishtirokchilar o'rinlari oralab ketishi mumkin (1, 4, 5…).
   * Reytingda bo'lmasa — null.
   */
  rank: number | null;
  /** Target (pullik reklama) aniqlanganmi. */
  hasTarget: boolean;
}

/** Ishtirokchi videolari soni. Ishtirokchi videolarni cheklovsiz yuborishi mumkin. */
export interface ParticipantReelCounts {
  total: number;
  accepted: number;
  /** Tekshirilayotganlar, qo'lda tekshiruvdagilar ham shu yerda. */
  pending: number;
  rejected: number;
}

export interface ParticipantListResponse extends Paginated<ParticipantListItem> {
  /** Holat bo'yicha sonlar (qidiruv, Reel va ko'rishlar filtri hisobga olingan, holat filtri — yo'q). */
  statusCounts: Record<ParticipantStatus | "ALL", number>;
}

/**
 * "Ko'rishlarni yangilash": oraliqdagi videolar Instagram'dan hoziroq qayta o'qiladi (Apify).
 * `includeNear` — pastki chegaradan 20% pastdagilar ham (shu orada chegaradan o'tgan bo'lishi mumkin).
 */
export interface ViewsRefreshRequest {
  minViews: number | null;
  maxViews: number | null;
  includeNear: boolean;
}

export interface ViewsRefreshReport {
  startedAt: string;
  /** Hali tugamagan bo'lsa — null. */
  finishedAt: string | null;
  requested: number;
  updated: number;
  /** Instagram'da topilmaganlar. */
  missing: number;
  error: string | null;
}

export interface ViewsRefreshPreview {
  /** Nechta video yangilanadi. */
  count: number;
  /** Amalda qo'llanadigan chegaralar (yaqinlar qo'shilgan holda). */
  range: { from: number | null; to: number | null };
  /** Oxirgi umumiy (rejadagi) yig'ish vaqti. */
  lastSyncAt: string | null;
  /** Yig'ish yoki yangilash hozir ketyaptimi. */
  running: boolean;
  lastReport: ViewsRefreshReport | null;
}

/** Ishtirokchining barcha yuborgan videolari ("Videolar" oynasi). */
export interface ParticipantReels {
  participant: {
    id: string;
    fullName: string;
    /** Rad etilmagan videolardagi Instagram akkauntlar (takrorlanmaydi). */
    instagramUsernames: string[];
    phone: string;
    age: number;
    /** Ro'yxatdagi `status` bilan bir xil (ochiq target ogohlantirishi bo'lsa — WARNED). */
    status: ParticipantStatus;
    registeredOn: IsoDate;
  };
  /**
   * Ro'yxatdagi `views` bilan bir xil: umumiy tasdiqlangan ko'rishlar — barcha qabul qilingan
   * videolari ko'rishlarining yig'indisi (oferta 7.1). Qabul qilingan video yo'q — 0.
   */
  totalViews: number;
  /**
   * Tartib: qabul qilinganlar ko'rishlar kamayishi bo'yicha (teng bo'lsa — oldinroq yuborilgani),
   * keyin tekshiruvdagilar (qo'lda tekshiruvdagilar ham), keyin rad etilgan va o'chirilganlar;
   * oxirgi ikkalasida eng yangisi birinchi.
   */
  reels: AdminReelItem[];
}

export interface AdminReelItem {
  shortcode: string;
  url: string;
  /** Qo'lda tekshiruvdagi video `PENDING` bo'lib keladi va `manualReview: true` bo'ladi. */
  status: ReelStatus;
  /** Apify videoni topa olmadi — admin "Qo'lda tekshiruv" bo'limida qaror qiladi. */
  manualReview: boolean;
  /** Faqat rad etilgan videoda; boshqalarida — null. */
  rejectReason: ReelRejectReason | null;
  /** Instagram akkaunt (username); hali aniqlanmagan bo'lsa — null. */
  owner: string | null;
  /** Oxirgi yig'ilgan ko'rishlar (hali yig'ilmagan bo'lsa — 0). */
  views: number;
  likes: number | null;
  /** Ilovaga yuborilgan vaqt (UTC ISO). */
  submittedAt: string;
  /** Instagramda joylangan vaqt (UTC ISO); hali aniqlanmagan — null. */
  postedAt: string | null;
  /** Ko'rishlar oxirgi marta yig'ilgan vaqt (UTC ISO); hali yig'ilmagan — null. */
  lastSyncedAt: string | null;
  /** Nakrutka shubhasi belgilari (`ReelFlagType` qiymatlari, takrorlanmaydi). */
  flags: string[];
}

/** Admin ishtirokchi ustida bajaradigan amallar. */
export type ParticipantAction = "block" | "unblock" | "disqualify";

/** Bloklash, blokdan chiqarish va diskvalifikatsiya so'rovi. Sabab audit logga yoziladi. */
export interface ParticipantActionRequest {
  reason: string;
}

// ---------------------------------------------------------------------------
// Target yoqqanlar (TZ 4, 5.2, 6-bo'limlar)
// ---------------------------------------------------------------------------

/** Reel uchun target holati (TZ 5.2): yoqilgan / yoqilmagan / aniqlanmadi. */
export type TargetState = "ON" | "OFF" | "UNKNOWN";

/**
 * Target qanday aniqlangan (TZ 5.2):
 * AD_LIBRARY — Meta reklama kutubxonasida faol reklama topildi (Apify, reyting yetakchilari);
 * GROWTH_ANALYSIS — ko'rishlar keskin oshgan va/yoki layklar o'smagan (pullik reklamaga xos);
 * REPORT — boshqa ishtirokchilar lentasida «Reklama» belgisi bilan ko'rib, skrinshot yuborgan.
 */
export type TargetDetectionMethod = "AD_LIBRARY" | "GROWTH_ANALYSIS" | "REPORT";

/**
 * Target holatining (case) ko'rib chiqilish holati:
 * NEW — Admin hali ko'rmagan; WARNED — ishtirokchi ogohlantirilgan;
 * DISQUALIFIED — diskvalifikatsiya qilingan; DISMISSED — ro'yxatdan chiqarilgan.
 */
export type TargetCaseStatus = "NEW" | "WARNED" | "DISQUALIFIED" | "DISMISSED";

/** "OPEN" — ro'yxatda turganlar: yangi va ogohlantirilganlar. */
export type TargetStatusFilter = TargetCaseStatus | "OPEN";

export type TargetAction = "warn" | "disqualify" | "dismiss";

export interface TargetCaseListQuery {
  status?: TargetStatusFilter;
  /** Ism, telefon yoki Instagram bo'yicha. */
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface TargetCaseListItem {
  id: string;
  participant: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string;
    instagramUsername: string | null;
    status: ParticipantStatus;
  };
  reelUrl: string;
  detectedOn: IsoDate;
  method: TargetDetectionMethod;
  /** Qisqa dalil, masalan "Kunlik o'sish 11× oshgan". */
  evidence: string;
  /** Oxirgi tekshiruvdagi target holati. */
  currentState: TargetState;
  status: TargetCaseStatus;
  views: number;
  /** Bugungi reytingdagi o'rni (eng ko'p ko'rilgan videosining o'rni); reytingda bo'lmasa — null. */
  rank: number | null;
}

export interface TargetCaseListResponse extends Paginated<TargetCaseListItem> {
  statusCounts: Record<TargetStatusFilter | "ALL", number>;
}

export interface TargetCaseDetail extends TargetCaseListItem {
  /** Aniqlangan kun atrofidagi kunlik ko'rishlar o'sishi. */
  dailyGrowth: Array<{ date: IsoDate; viewsGrowth: number; flagged: boolean }>;
  /** Target holati o'zgarishlari tarixi (TZ 5.2). */
  history: Array<{ date: IsoDate; state: TargetState; note: string }>;
  /** Dalil fayllari (masalan, reklama kabineti skrinshoti). */
  attachments: SupportAttachment[];
  /** Dalil havolasi (masalan, Meta reklama kutubxonasidagi reklama sahifasi); yo'q bo'lsa — null. */
  evidenceUrl: string | null;
  /** REPORT usulida — shikoyatlar (boshqalarida bo'sh). Shikoyatchi faqat adminga ko'rinadi. */
  reports: TargetCaseReport[];
}

/**
 * Ishtirokchi shikoyati. Skrinshot — `attachments` dagi `attachmentId` li fayl:
 * `GET /api/v1/admin/targets/:id/attachments/:attachmentId` (sessiya cookie'si bilan, rasm qaytadi).
 */
export interface TargetCaseReport {
  id: string;
  at: string;
  comment: string | null;
  attachmentId: string;
  reporter: { id: string; fullName: string; phone: string };
}

/** Meta reklama kutubxonasi tekshiruvi natijasi (reyting yetakchilari). */
export interface TargetAdsCheckReport {
  /** "schedule" — har kungi ko'rishlar yig'ilgandan keyin; "admin" — qo'lda ishga tushirilgan. */
  reason: "schedule" | "admin";
  at: string;
  /** Nechta akkaunt tekshirildi. */
  checked: number;
  /** Shu tekshiruvda faol reklamasi topilganlar. */
  found: number;
  /** Tekshiruv xato bilan tugagan bo'lsa — sababi. */
  error: string | null;
}

export interface TargetCheckStatus {
  running: boolean;
  lastCheck: TargetAdsCheckReport | null;
  /** Keyingi rejadagi avtomatik tekshiruv kuni (oyiga bir marta); rejada yo'q bo'lsa — null. */
  nextCheckOn: IsoDate | null;
}

export interface TargetActionRequest {
  action: TargetAction;
  /** Audit logga yoziladi. */
  reason: string;
}

// ---------------------------------------------------------------------------
// Qo'lda tekshiruv — AI videoda mahsulotni topmaganda yoki Apify videoni 3 marta topa olmaganda
// (backend: `apps/backend/src/admin/admin-manual-review.controller.ts`)
// ---------------------------------------------------------------------------

/**
 * AI_CHECK — AI yangi videoda tanlov mahsulotini topmadi (yoki videoni ko'ra olmadi);
 * NEW_REEL — Apify yangi videoni 3 marta topa olmadi (hali qabul qilinmagan);
 * LOST_REEL — avval qabul qilingan video endi topilmayapti (reytingdan vaqtincha chiqqan).
 */
export type ManualReviewKind = "NEW_REEL" | "LOST_REEL" | "AI_CHECK";

/** AI qarori (AI_CHECK): RAD ETDI, SHUBHALI (ishonchi past) yoki FAILED — videoni ko'ra olmadi. */
export interface ManualReviewAi {
  verdict: "REJECTED" | "UNCERTAIN" | "FAILED";
  /** AI izohi yoki xato sababi. */
  reason: string | null;
  /** 0–1; FAILED da — null. */
  confidence: number | null;
}

/** OPEN — admin qarorini kutmoqda. */
export type ManualReviewStatus = "OPEN" | "APPROVED" | "REJECTED";

/** Rad etish sababi — ishtirokchiga bot orqali shunga mos matn yuboriladi. */
export type ManualReviewRejectReason = ReelRejectReason;

export interface ManualReviewListQuery {
  status?: ManualReviewStatus;
  /** Ism, telefon, shortcode yoki @instagram bo'yicha. */
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface ManualReviewItem {
  /** Reel shortcode. */
  id: string;
  participant: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string;
    status: ParticipantStatus;
  };
  reelUrl: string;
  shortcode: string;
  kind: ManualReviewKind;
  /** Qo'lda tekshiruvga o'tgunga qadar avtomatik urinishlar soni (Apify). */
  attempts: number;
  /** AI_CHECK da — AI nega o'tkazmagani; boshqalarida — null. */
  ai: ManualReviewAi | null;
  /** Qo'lda tekshiruvga o'tgan vaqt (UTC ISO). */
  requestedAt: string;
  /** Video yuborilgan vaqt (UTC ISO). */
  submittedAt: string;
  /**
   * Oxirgi o'qilgan ko'rishlar: avval qabul qilingan videoda — oxirgi ma'lumi, tasdiqlangandan
   * keyin — Apify o'qigan joriy ko'rishlar. Hali bir marta ham o'qilmagan — null.
   */
  lastViews: number | null;
  /** Ko'rishlar oxirgi marta o'qilgan vaqt (UTC ISO); hali o'qilmagan — null. */
  lastSyncedAt: string | null;
  /** Instagram akkaunt (Apify avval topgan bo'lsa); noma'lum — null. */
  owner: string | null;
  status: ManualReviewStatus;
  /** `by: "Avtomatik"` — Apify keyingi yig'ishda videoni o'zi topgan. */
  decision: {
    at: string;
    by: string;
    reason: ManualReviewRejectReason | null;
    note: string;
  } | null;
}

export interface ManualReviewListResponse extends Paginated<ManualReviewItem> {
  statusCounts: Record<ManualReviewStatus | "ALL", number>;
}

export type ManualReviewDecisionRequest =
  | { decision: "approve"; note?: string }
  | { decision: "reject"; reason: ManualReviewRejectReason; note?: string };

// ---------------------------------------------------------------------------
// Sozlamalar (TZ 6-bo'lim: tanlov muddati, qoidalar matni, yangilanish vaqti, minimal yosh)
// ---------------------------------------------------------------------------

export interface ContestSettings {
  startsOn: IsoDate;
  endsOn: IsoDate;
  /** Ko'rishlar yig'iladigan vaqt, "HH:MM" (Toshkent) — TZ 5.1. */
  syncTime: string;
  /**
   * Ko'rishlar (va reyting) tanlov boshidan necha kunda bir yig'iladi: 7 — haftada bir (standart),
   * 1 — har kuni (1–30). Yangi videolar yuborilganda darhol tekshiriladi.
   */
  syncEveryDays: number;
  /** Ro'yxatdan o'tish uchun minimal yosh (PLAN.md Q3). */
  minAge: number;
  updatedAt: string | null;
  updatedBy: string | null;
}

export interface ContestSettingsResponse {
  settings: ContestSettings;
  /** Tanlov boshlanganmi — boshlangan bo'lsa, boshlanish sanasini o'zgartirib bo'lmaydi. */
  contestStarted: boolean;
  today: IsoDate;
}

export type ContestSettingsUpdate = Pick<ContestSettings, "startsOn" | "endsOn" | "syncTime" | "syncEveryDays" | "minAge">;

// ---------------------------------------------------------------------------
// Tanlov qoidalari (TZ 4) — Mini App'da bo'limlar ko'rinishida ko'rsatiladi
// ---------------------------------------------------------------------------

/** Qoidaning bitta bo'limi: sarlavha va matn. */
export interface RulesSection {
  title: string;
  body: string;
}

export interface ContestRules {
  /**
   * Rozilik versiyasi. Faqat "muhim o'zgarish" belgilansa oshadi — shunda barcha
   * ishtirokchilar Mini App'da yangilangan qoidalarga qaytadan rozilik beradi.
   */
  version: number;
  sections: RulesSection[];
  updatedAt: string | null;
  updatedBy: string | null;
}

export interface ContestRulesUpdate {
  sections: RulesSection[];
  /** true — versiya oshadi va ishtirokchilardan qayta rozilik so'raladi. */
  requireReconsent: boolean;
}

/** Backend bilan bir xil cheklovlar (`apps/backend/src/rules/rules.service.ts`). */
export const RULES_LIMITS = {
  minSections: 1,
  maxSections: 20,
  titleMin: 2,
  titleMax: 120,
  bodyMin: 5,
  bodyMax: 3000,
} as const;

/** Qoida videosi formati: `video/quicktime` — iPhone'dagi .mov. */
export type RulesVideoMime = "video/mp4" | "video/quicktime" | "video/webm";

/**
 * Qoida videosi — Mini App'dagi "Qoidalar" bo'limida eng tepada (bo'limlardan oldin) ko'rsatiladi.
 * Bitta bo'ladi: yangisi yuklansa eskisi o'chiriladi. Yuklanmagan bo'lsa API `null` qaytaradi.
 */
export interface RulesVideo {
  /** Har yuklashda yangi — video manzili (`rulesVideoUrl(id)`) shu bo'yicha. */
  id: string;
  mime: RulesVideoMime;
  /** Video hajmi, bayt. */
  sizeBytes: number;
  /** Yuklangan vaqt (UTC ISO). */
  updatedAt: string;
  /** Yuklagan xodimning to'liq ismi. */
  updatedBy: string;
}

/** Backend bilan bir xil cheklovlar (`apps/backend/src/rules/rules-video.service.ts`). */
export const RULES_VIDEO_LIMITS = {
  /** 100 MB. */
  maxBytes: 100 * 1024 * 1024,
  mimeTypes: ["video/mp4", "video/quicktime", "video/webm"],
} as const satisfies { maxBytes: number; mimeTypes: readonly RulesVideoMime[] };

// ---------------------------------------------------------------------------
// Sovg'alar (Aksiya qoidalari, 6-bo'lim: sovrinlar jamg'armasi)
// ---------------------------------------------------------------------------

/** `MAIN` — aksiya yakunidagi asosiy sovrin; `MONTHLY` — har oylik bosqich sovrini. */
export type PrizeKind = "MAIN" | "MONTHLY";

export interface Prize {
  id: string;
  /** Sovg'a nomi, masalan "BYD Chazor avtomobili". */
  title: string;
  /** Qo'shimcha izoh (bo'lmasa — bo'sh). */
  description: string;
  /** Rasm manzili; rasm yuklanmagan bo'lsa — null. */
  imageUrl: string | null;
  /** Soni; oylik sovrin uchun — bir oydagi soni. */
  quantity: number;
  kind: PrizeKind;
  /** Kerakli tasdiqlangan ko'rishlar: quyi chegara (null — chegara yo'q). */
  minViews: number | null;
  /** Yuqori chegara (null — "va undan ortiq"). */
  maxViews: number | null;
  /** Ilova va botda ko'rsatish tartibi (kichigi yuqorida). */
  sortOrder: number;
  updatedAt: string | null;
  updatedBy: string | null;
}

// ---------------------------------------------------------------------------
// Random tanlov — oylik voucher g'oliblari (Aksiya qoidalari: tasodifiy tanlov)
// ---------------------------------------------------------------------------

/** Oylik bosqich; ikkala chegara ham kiradi (Asia/Tashkent). */
export interface DrawStage {
  /** 1 dan boshlanadi. */
  index: number;
  startsOn: IsoDate;
  endsOn: IsoDate;
  /** Bosqich tugaganmi (bugun `endsOn` dan keyin). */
  finished: boolean;
}

/** Reel qaysi sana bo'yicha davrga tegishli deb olinadi. */
export type DrawDateBasis = "POSTED" | "SUBMITTED";

export interface DrawSettings {
  /** Oylik (MONTHLY) sovg'a. */
  prizeId: string;
  /** Bosqich raqami; null — qo'lda kiritilgan davr. */
  stage: number | null;
  periodFrom: IsoDate;
  periodTo: IsoDate;
  /** POSTED — Instagram'da joylangan sana; SUBMITTED — ilovaga yuborilgan sana. */
  dateBasis: DrawDateBasis;
  /** Tasdiqlangan ko'rishlar oralig'i (ikkala chegara ham kiradi). */
  minViews: number;
  maxViews: number;
  winnersCount: number;
  /** Zaxira: g'olib chetlatilsa, navbatdagi zaxira g'olib bo'ladi. */
  reservesCount: number;
  /** Ogohlantirilgan (WARNED) ishtirokchilar qatnashmaydi. */
  excludeWarned: boolean;
  /** Target (pullik reklama) aniqlanganlar qatnashmaydi. */
  excludeTargets: boolean;
  /**
   * Voucher olganlar (bekor qilinmagan istalgan tanlovning faol g'oliblari) qatnashmaydi.
   * Har doim `true`: voucher bir kishiga aksiya davomida bir marta — backend ham shunday majburlaydi.
   */
  excludePreviousWinners: boolean;
  /** G'oliblarga bot xabari; `{ism}`, `{sovrin}` kabi o'rinbosarlar bilan. */
  messageTemplate: string;
}

/**
 * Doimiy tanlov sozlamalari: bir marta tasdiqlanadi, keyin tahrirlanadi. Har bir tanlovda
 * faqat bosqich yoki davr tanlanadi, qolgani shu yerdan olinadi.
 */
export interface SavedDrawSettings {
  dateBasis: DrawDateBasis;
  minViews: number;
  maxViews: number;
  winnersCount: number;
  reservesCount: number;
  excludeWarned: boolean;
  excludeTargets: boolean;
  /**
   * Oylik voucherda — false: oferta 6.1.5 bo'yicha voucherni bir necha oy yutish mumkin, oldingi
   * bosqichlar g'oliblari chetlatilmaydi.
   */
  excludePreviousWinners: boolean;
  messageTemplate: string;
  updatedAt: string;
  /** Saqlagan xodimning to'liq ismi. */
  updatedBy: string;
}

/** `PUT /admin/draws/settings` tanasi. */
export type DrawSettingsInput = Omit<SavedDrawSettings, "excludePreviousWinners" | "updatedAt" | "updatedBy">

export interface DrawPlaceholder {
  /** Masalan "{ism}". */
  token: string;
  label: string;
}

/** Admin kalendardan yaratgan davr — bosqichlar yonida tanlanadi (masalan, bayram bonusi). */
export interface DrawPeriod {
  id: string;
  title: string;
  startsOn: IsoDate;
  /** Shu kun ham kiradi. */
  endsOn: IsoDate;
  createdAt: string;
  createdBy: string;
  updatedAt: string | null;
  updatedBy: string | null;
}

export type DrawPeriodInput = Pick<DrawPeriod, "title" | "startsOn" | "endsOn">;

export interface DrawSetup {
  today: IsoDate;
  stages: DrawStage[];
  /** Admin yaratgan davrlar, boshlanish sanasi bo'yicha. */
  periods: DrawPeriod[];
  /** Admin o'chirgan bosqichlar (tiklash mumkin). Raqamlari o'zgarmaydi. */
  removedStages: DrawStage[];
  /**
   * Random tanlov o'tkaziladigan sovg'alar: oylik voucher (`monthly`, `kind: null`) va asosiy sovrinlar
   * (`main-car`, `main-travel`, `main-phone`, `main-tablet`). `maxViews: null` — yuqori chegara yo'q.
   */
  prizes: Array<{
    id: string;
    title: string;
    kind: RatingPrizeKind | null;
    quantity: number;
    minViews: number;
    maxViews: number | null;
  }>;
  /**
   * Asosiy sovrinlar tanlovi sozlamalari (oferta 6.2): davr — butun aksiya, oraliq va g'oliblar soni —
   * ofertadagi; zaxira, filtrlar va xabar — shu standartlar.
   */
  mainDefaults: DrawSettings[];
  /** Tasdiqlangan doimiy sozlamalar; null — hali tasdiqlanmagan. */
  saved: SavedDrawSettings | null;
  /**
   * Joriy (yoki eng oxirgi tugagan) bosqich va birinchi oylik sovg'a bo'yicha boshlang'ich sozlamalar.
   * `saved` bo'lsa — uning qiymatlari bilan; `excludePreviousWinners` har doim `true`.
   */
  defaults: DrawSettings;
  placeholders: DrawPlaceholder[];
}

/** Nomzod nega tanlovga kirmadi — birinchi to'g'ri kelgan sabab bo'yicha sanaladi. */
export type DrawExclusion =
  | "NOT_ACCEPTED"
  | "OUT_OF_PERIOD"
  | "VIEWS_LOW"
  | "VIEWS_HIGH"
  | "STATUS"
  | "WARNED"
  | "TARGET"
  | "PREVIOUS_WINNER";

export interface DrawCandidate {
  participantId: string;
  firstName: string;
  lastName: string;
  phone: string;
  instagramUsername: string | null;
  /** Davrdagi eng ko'p ko'rilgan qabul qilingan videosi (tekshirish uchun). */
  reelUrl: string;
  /**
   * Davrga kirgan barcha qabul qilingan videolari ko'rishlarining `viewsAsOf` kunidagi yig'indisi
   * (oferta 7.1–7.3); ko'rishlar chegarasi ham shunga qo'llanadi.
   */
  views: number;
  postedOn: IsoDate;
  submittedOn: IsoDate;
}

export interface DrawPreview {
  /** Ko'rishlar qaysi kun holatida olinadi: davr oxiri (tugamagan bo'lsa — bugun). */
  viewsAsOf: IsoDate;
  /** Tekshirilgan Reellar soni. */
  totalReels: number;
  eligibleCount: number;
  excluded: Record<DrawExclusion, number>;
  /** Nomzodlar ro'yxatining xeshi — natijani keyin qayta tekshirish uchun. */
  poolHash: string;
  /** Eng ko'p ko'rishli nomzodlar (namuna). */
  sample: DrawCandidate[];
  /** Ogohlantirishlar (bosqich tugamagan, nomzod kam va h.k.). */
  warnings: string[];
}

/** DRAFT → CONFIRMED → SENT; DRAFT yoki CONFIRMED bekor qilinishi mumkin. */
export type DrawStatus = "DRAFT" | "CONFIRMED" | "SENT" | "CANCELLED";

/** G'olib: ACTIVE yoki REPLACED (chetlatilgan). Zaxira: ACTIVE yoki PROMOTED (g'olib bo'lgan). */
export type DrawEntryState = "ACTIVE" | "REPLACED" | "PROMOTED";

export type DrawNotifyStatus = "NOT_SENT" | "SENT" | "FAILED";

export interface DrawEntry {
  /** G'oliblar va zaxira ichidagi tartib raqami (1 dan). */
  position: number;
  state: DrawEntryState;
  candidate: DrawCandidate;
  /** Chetlatilgan g'olib: kim, qachon, nega va o'rniga kim. */
  replaced: { at: string; by: string; reason: string; replacementId: string } | null;
  /** Zaxiradan ko'tarilgan g'olib — kimning o'rniga. */
  promotedFor: string | null;
  notify: { status: DrawNotifyStatus; at: string | null; error: string | null };
}

export interface DrawDelivery {
  sent: number;
  failed: number;
  notSent: number;
}

export interface VoucherDrawSummary {
  id: string;
  /** Tartib raqami (#1, #2…). */
  number: number;
  /** `monthly` — oylik voucher; `main-*` — asosiy sovrin (oferta 6.2). */
  prizeId: string;
  prizeTitle: string;
  stage: number | null;
  periodFrom: IsoDate;
  periodTo: IsoDate;
  status: DrawStatus;
  /** Faol g'oliblar soni. */
  winners: number;
  /** Ishlatilmagan zaxira soni. */
  reserves: number;
  poolSize: number;
  createdAt: string;
  createdBy: string;
  delivery: DrawDelivery;
}

export interface VoucherDraw extends VoucherDrawSummary {
  settings: DrawSettings;
  viewsAsOf: IsoDate;
  /** Tasodifiy kalit: nomzodlar ro'yxati va shu kalit bilan natijani qayta hisoblash mumkin. */
  seed: string;
  poolHash: string;
  winnerEntries: DrawEntry[];
  reserveEntries: DrawEntry[];
  confirmed: { at: string; by: string } | null;
  sent: { at: string; by: string } | null;
  cancelled: { at: string; by: string; reason: string } | null;
}

/** Bosqichdagi voucherlar: bosqich kvotasi va tanlovlar bo'yicha holati. */
export interface DrawStockStage extends DrawStage {
  /** Shu bosqichga ajratilgan voucherlar (oylik soni). */
  quantity: number;
  sent: number;
  confirmed: number;
  draft: number;
}

/** Oylik sovg'a qoldig'i: aksiya davomida jami, berilgani va qolgani. Bekor qilingan tanlovlar kirmaydi. */
export interface DrawStock {
  prizeId: string;
  title: string;
  /** Aksiya davomida jami (oylik soni × bosqichlar). */
  total: number;
  /** G'oliblarga bot orqali yuborilgan tanlovlardagi faol g'oliblar. */
  sent: number;
  /** Tasdiqlangan, hali yuborilmagan. */
  confirmed: number;
  /** Qoralamada (hali tasdiqlanmagan) — qoldiqdan ayrilmaydi. */
  draft: number;
  /** Hali taqsimlanmagan: jami − yuborilgan − tasdiqlangan. */
  remaining: number;
  stages: DrawStockStage[];
}

export interface DrawReplaceRequest {
  participantId: string;
  /** Audit logga yoziladi. */
  reason: string;
}

export interface DrawCancelRequest {
  reason: string;
}

// ---------------------------------------------------------------------------
// Audit log (TZ 2-bo'lim: barcha Admin va Support harakatlari — kim, nima, qachon)
// ---------------------------------------------------------------------------

export type AuditEntity =
  | "participant"
  | "reel"
  | "support_ticket"
  | "target_case"
  | "telegram_message"
  | "winner"
  | "settings"
  | "prize"
  | "voucher_draw"
  /** Istoriyalar bo'limi olib tashlangan — eski yozuvlar (`story.remove`) uchun qoldi. */
  | "story"
  | "auth";

export interface AuditLogQuery {
  /** Xodim, amal, obyekt yoki sabab bo'yicha. */
  search?: string;
  entity?: AuditEntity;
  actorRole?: AdminRole;
  page?: number;
  pageSize?: number;
}

export interface AuditLogEntry {
  id: string;
  at: string;
  actor: { id: string; name: string; role: AdminRole };
  /** Masalan "participant.block", "support.reply". */
  action: string;
  entity: AuditEntity;
  entityId: string;
  /** Obyektning odam o'qiy oladigan nomi (ishtirokchi ismi, murojaat mavzusi...). */
  entityLabel: string;
  before: string;
  after: string;
  /** Sabab yoki izoh (bo'lmasa — bo'sh). */
  reason: string;
}

export type AuditLogResponse = Paginated<AuditLogEntry>;

// ---------------------------------------------------------------------------
// G'olib (TZ 5.3, 6-bo'lim)
// ---------------------------------------------------------------------------

/**
 * NOT_STARTED — tanlov hali tugamagan (joriy yetakchi faqat oldindan ko'rish uchun);
 * CANDIDATE — nomzod tekshirilmoqda; CONFIRMED — Admin tasdiqlagan; ANNOUNCED — e'lon qilingan.
 */
export type WinnerStage = "NOT_STARTED" | "CANDIDATE" | "CONFIRMED" | "ANNOUNCED";

/** TZ 5.3 tekshiruv ro'yxati. */
export type WinnerCheckKey =
  | "NO_TARGET"
  | "REEL_AVAILABLE"
  | "NO_FAKE_VIEWS"
  | "AD_TOOLS_REVIEWED";

/**
 * Admin qo'lda belgilaydigan band: g'olib bilan yuzma-yuz uchrashuvda Instagram'dagi "Reklama
 * vositalari" (reklama tarixi) bo'limini ko'rish. Mahsulot xaridi tekshirilmaydi — oferta 2.7:
 * xarid ishtirok etish uchun majburiy emas.
 */
export type WinnerManualCheckKey = "AD_TOOLS_REVIEWED";

/** PENDING — Admin qo'lda tekshirishi kerak. */
export type WinnerCheckStatus = "PASSED" | "FAILED" | "PENDING";

export interface WinnerCheck {
  key: WinnerCheckKey;
  status: WinnerCheckStatus;
  /** Natija izohi, masalan "Target aniqlanmagan" yoki "Chek №123 tekshirildi". */
  detail: string;
  /** Admin qo'lda belgilaydigan band (mahsulot xaridi, reklama tarixi). */
  manual: boolean;
}

export interface WinnerCandidate {
  participant: {
    id: string;
    firstName: string;
    lastName: string;
    age: number;
    phone: string;
    instagramUsername: string | null;
  };
  /**
   * Avtomobil random tanlovidagi navbati (oferta 6.2, 10.3): 1 — g'olib, keyingilari — zaxira g'oliblar;
   * nomzod rad etilsa — navbatdagi zaxira.
   */
  rank: number;
  /** Umumiy tasdiqlangan ko'rishlari — barcha qabul qilingan videolari yig'indisi. */
  views: number;
  /** Eng ko'p ko'rilgan videosi (tekshirish uchun). */
  reelUrl: string;
  checks: WinnerCheck[];
}

export interface WinnerOverview {
  contest: {
    startsOn: IsoDate;
    endsOn: IsoDate;
    ended: boolean;
    /** Tugashiga qolgan kunlar (tugagan bo'lsa — 0). */
    daysLeft: number;
    /** G'olib qaysi kunning reytingi bo'yicha aniqlanadi. */
    ratingDate: IsoDate;
  };
  stage: WinnerStage;
  /** Nomzod: avtomobil random tanlovi g'olibi (rad etilsa — navbatdagi zaxira); tanlov bo'lmasa — null. */
  candidate: WinnerCandidate | null;
  /** Zaxira g'oliblar — tanlovdagi navbat tartibida. */
  runnersUp: Array<{
    /** Tanlovdagi navbati. */
    rank: number;
    participantId: string;
    name: string;
    views: number;
    /** Tekshiruvdan o'tmaydigan avtomatik belgilar. */
    issues: string[];
  }>;
  /** Rad etilgan nomzodlar. */
  skipped: Array<{ participantId: string; name: string; reason: string; at: string; by: string }>;
  confirmed: { at: string; by: string } | null;
  announced: { at: string; by: string } | null;
}

export interface WinnerManualCheckRequest {
  participantId: string;
  check: WinnerManualCheckKey;
  passed: boolean;
  /** Masalan: chek raqami yoki "Reklama vositalari bo'sh, 2 ta xodim ko'rdi". */
  note: string;
}

export interface WinnerSkipRequest {
  participantId: string;
  reason: string;
}

// ---------------------------------------------------------------------------
// Asosiy sovrinlar — oraliqlar ichida random tanlov (oferta 6.2, 9.1)
// ---------------------------------------------------------------------------

/** Asosiy sovrin turi; eng qimmatidan: avtomobil, sayohat, iPhone, planshet. */
export type RatingPrizeKind = "car" | "travel" | "phone" | "tablet";

export interface RatingPrizeEntry {
  /** Tanlovdagi g'olib yoki zaxira raqami; tanlov bo'lmasa — oraliqdagi tartib raqami. */
  place: number;
  /** Ishtirokchilar reytingidagi o'rni (faqat ma'lumot); reytingda bo'lmasa — 0. */
  rank: number;
  participant: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string;
    instagramUsername: string | null;
  };
  /** Umumiy tasdiqlangan ko'rishlari (yig'indi). */
  views: number;
  /** Eng ko'p ko'rilgan videosi. */
  reelUrl: string;
  /** Ochiq (ro'yxatdan chiqarilmagan) target holati bor. */
  hasTarget: boolean;
  /** Videolaridan birida nakrutka (soxta ko'rish) belgilari bor. */
  flagged: boolean;
}

export interface RatingPrizeTier {
  kind: RatingPrizeKind;
  title: string;
  quantity: number;
  /** Masalan "yo'llanma"; bo'lmasa — null. */
  unit: string | null;
  minViews: number;
  /** null — yuqori chegara yo'q. */
  maxViews: number | null;
  /** Umumiy ko'rishlari shu oraliqdagi ishtirokchilar soni (joriy holat). */
  eligibleCount: number;
  /** Shu sovrin bo'yicha amaldagi random tanlov; hali o'tkazilmagan — null. */
  draw: { id: string; number: number; status: DrawStatus; viewsAsOf: IsoDate; poolSize: number } | null;
  /** Tanlov g'oliblari (tanlov bo'lmasa — bo'sh). */
  winners: RatingPrizeEntry[];
  /** Zaxira g'oliblar — navbat tartibida (tanlov bo'lmasa — bo'sh). */
  next: RatingPrizeEntry[];
  /** Tanlov hali o'tkazilmagan bo'lsa — oraliqdagi ishtirokchilar (ko'rishlar kamayishi, 30 tagacha). */
  eligible: RatingPrizeEntry[];
}

export interface RatingPrizes {
  /** Ko'rishlar oxirgi marta muvaffaqiyatli yig'ilgan vaqt (ISO); hali yig'ilmagan bo'lsa — null. */
  updatedAt: string | null;
  /** Tartib: avtomobil, sayohat, iPhone, planshet. */
  tiers: RatingPrizeTier[];
}

// ---------------------------------------------------------------------------
// Telegram (TZ 6-bo'lim: yuborildi, yetkazildi, o'qildi, o'qilmadi)
// ---------------------------------------------------------------------------

/**
 * SENT — yuborildi, Telegram hali tasdiqlamagan; DELIVERED — yetkazildi;
 * READ — o'qildi ("✅ O'qidim" tugmasi bosilgan, PLAN.md Q11);
 * UNREAD — yetkazilganiga 24 soatdan oshdi, lekin o'qilmadi; FAILED — yuborilmadi.
 */
export type TelegramDeliveryStatus = "SENT" | "DELIVERED" | "READ" | "UNREAD" | "FAILED";

/**
 * Telegram orqali boradigan xabarnomalar (TZ 3.5).
 * REEL_REVIEW — video qo'lda tekshiruvga o'tdi yoki tiklandi; VOUCHER_WIN — random tanlov
 * (oylik voucher) g'olibi xabari; WINNER — asosiy g'olib xabari; OTHER — boshqa xabarlar.
 */
export type TelegramMessageKind =
  | "REEL_ACCEPTED"
  | "REEL_REJECTED"
  | "REEL_REVIEW"
  | "RANK_CHANGED"
  | "WARNING"
  | "SUPPORT_REPLY"
  | "VOUCHER_WIN"
  | "WINNER"
  | "OTHER";

/** BOT_BLOCKED — ishtirokchi botni bloklagan; NETWORK — vaqtinchalik xato. */
export type TelegramFailureReason = "BOT_BLOCKED" | "NETWORK";

export interface TelegramMessageListQuery {
  status?: TelegramDeliveryStatus;
  kind?: TelegramMessageKind;
  /** Ism, telefon yoki @telegram bo'yicha. */
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface TelegramMessageListItem {
  id: string;
  kind: TelegramMessageKind;
  text: string;
  participant: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string;
    telegramUsername: string | null;
  };
  /** Birinchi yuborilgan vaqt. */
  firstSentAt: string;
  /** Oxirgi (qayta) yuborilgan vaqt. */
  lastSentAt: string;
  attempts: number;
  status: TelegramDeliveryStatus;
  deliveredAt: string | null;
  readAt: string | null;
  failureReason: TelegramFailureReason | null;
  /** Qayta yuborish mumkinmi (o'qilmagan yoki vaqtinchalik xato). */
  canResend: boolean;
}

export interface TelegramMessageListResponse extends Paginated<TelegramMessageListItem> {
  /** Holat bo'yicha sonlar (qidiruv va tur filtri hisobga olingan, holat filtri — yo'q). */
  statusCounts: Record<TelegramDeliveryStatus | "ALL", number>;
  summary: {
    totalParticipants: number;
    /** Botni ochib, Telegramni ulaganlar (PLAN.md Q12). */
    linkedParticipants: number;
    /** Botni bloklaganlar. */
    blockedBot: number;
  };
}

/** O'qilmaganlarga ommaviy qayta yuborish — joriy tur va qidiruv filtri bo'yicha. */
export interface TelegramResendUnreadRequest {
  kind?: TelegramMessageKind;
  search?: string;
}

// ---------------------------------------------------------------------------
// Support
// ---------------------------------------------------------------------------

/** "OPEN" — yangi va ko'rilmoqda holatidagilar birga. */
export type SupportStatusFilter = SupportTicketStatus | "OPEN";

export interface SupportTicketListQuery {
  status?: SupportStatusFilter;
  /** Mavzu, ishtirokchi ismi, telefon yoki murojaat raqami bo'yicha. */
  search?: string;
  page?: number;
  pageSize?: number;
}

export type SupportMessageAuthor = "PARTICIPANT" | "STAFF";

export interface SupportTicketParticipant {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
}

export interface SupportTicketListItem {
  id: string;
  subject: string;
  status: SupportTicketStatus;
  participant: SupportTicketParticipant;
  lastMessage: { text: string; author: SupportMessageAuthor; at: string };
  messageCount: number;
  createdAt: string;
  /** Oxirgi xabar yoki holat o'zgarishi vaqti. */
  updatedAt: string;
  /** Oxirgi xabar ishtirokchidan va murojaat ochiq — javob kutilmoqda. */
  awaitingReply: boolean;
}

export interface SupportTicketListResponse extends Paginated<SupportTicketListItem> {
  /** Holat bo'yicha sonlar (qidiruv hisobga olingan, holat filtri — yo'q). */
  statusCounts: Record<SupportStatusFilter | "ALL", number>;
}

export interface SupportAttachment {
  id: string;
  fileName: string;
  sizeBytes: number;
  /**
   * Faylni ochish manzili — backend nisbiy yo'l bilan beradi (masalan,
   * `/api/v1/admin/support/tickets/:id/attachments/:attachmentId`), sessiya cookie'si bilan
   * ochiladi. Mock rejimda — null.
   */
  url: string | null;
}

export interface SupportMessage {
  id: string;
  author: SupportMessageAuthor;
  authorName: string;
  text: string;
  at: string;
  attachments: SupportAttachment[];
}

export interface SupportTicketDetail {
  id: string;
  subject: string;
  status: SupportTicketStatus;
  createdAt: string;
  updatedAt: string;
  participant: SupportTicketParticipant & {
    instagramUsername: string | null;
    status: ParticipantStatus;
  };
  messages: SupportMessage[];
}

export interface SupportReplyRequest {
  text: string;
}

export interface SupportStatusRequest {
  status: SupportTicketStatus;
}

// ---------------------------------------------------------------------------
// Reyting
// ---------------------------------------------------------------------------

export interface DailyRatingQuery {
  /** Reyting kuni; berilmasa — bugun. Backend tanlov muddatiga qisadi. */
  date?: IsoDate;
  page?: number;
  pageSize?: number;
}

/**
 * Reyting qatori — bitta video. Reytingda faol ishtirokchilarning barcha qabul qilingan videolari
 * alohida qator bo'ladi, shuning uchun bir ishtirokchi bir necha marta uchrashi mumkin.
 * Tartib: ko'rishlar kamayishi bo'yicha; teng bo'lsa — oldinroq yuborilgan video, keyin
 * ishtirokchi id, keyin shortcode.
 */
export interface RatingEntry {
  /** Shu videoning o'rni (1..N, takrorlanmaydi). */
  rank: number;
  /** Video shortcode'i — qatorning kaliti (takrorlanmaydi; `participantId` takrorlanishi mumkin). */
  shortcode: string;
  participantId: string;
  firstName: string;
  lastName: string;
  /** Shu videoning Instagram akkaunti. */
  instagramUsername: string | null;
  /** Shu video. */
  reelUrl: string;
  /** Shu videoning shu kungacha yig'ilgan ko'rishlari. */
  views: number;
  /**
   * Shu videoning shu kungi ko'rishlari minus oldingi kungisi; oldingi kungacha ko'rishlari
   * yig'ilmagan bo'lsa — hammasi.
   */
  viewsGrowth: number;
  /** Shu videoning oldingi kundagi o'rni; oldingi kuni reytingda bo'lmagan bo'lsa — null. */
  previousRank: number | null;
  /** Ishtirokchida shu kungacha target aniqlanganmi (ishtirokchi bo'yicha — barcha videolarida bir xil). */
  hasTarget: boolean;
}

/** Kunlik reyting xulosasi — barcha qatorlar (videolar) bo'yicha, sahifalashdan qat'i nazar. */
export interface RatingSummary {
  /** Reytingdagi turli ishtirokchilar soni (bir nechta videosi bo'lsa ham bir marta sanaladi). */
  participants: number;
  /** Reytingdagi videolar (qatorlar) soni. */
  videos: number;
  /** Qatorlar ko'rishlari yig'indisi. */
  totalViews: number;
  /** Qatorlar kunlik o'sishi yig'indisi. */
  totalGrowth: number;
  /** Oldingi kuni reytingda bo'lmagan videolar (`previousRank === null`). */
  newEntries: number;
}

export interface DailyRatingResponse extends Paginated<RatingEntry> {
  /** Amalda ko'rsatilgan kun (tanlov muddatiga qisilgan). */
  date: IsoDate;
  /** Tanlash mumkin bo'lgan kunlar oralig'i. */
  availableRange: { from: IsoDate; to: IsoDate };
  /** Reyting qachon tuzilgan (ISO vaqt). */
  generatedAt: string;
  summary: RatingSummary;
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

/**
 * Dashboard davri. Ikkala chegara ham kiradi. `from` berilmasa — tanlov
 * boshidan, `to` berilmasa — bugungacha. Backend davrni tanlov muddatiga qisadi.
 */
export interface DashboardQuery {
  from?: IsoDate;
  to?: IsoDate;
}

/** Bir kunlik ko'rsatkichlar (grafik uchun). */
export interface DailyStat {
  date: IsoDate;
  /** Shu kuni yig'ilgan yangi ko'rishlar. */
  viewsGrowth: number;
  /** Shu kuni ro'yxatdan o'tganlar. */
  newParticipants: number;
}

/**
 * Dashboard ko'rsatkichlari. Asosiy qiymatlar — davr oxiridagi holat,
 * `...InRange` qiymatlar — davr ichidagi o'zgarish.
 */
export interface DashboardStats {
  /** Amalda qo'llangan (tanlov muddatiga qisilgan) davr. */
  range: { from: IsoDate; to: IsoDate };
  contest: { startsOn: IsoDate; endsOn: IsoDate };
  /** Ko'rishlar oxirgi marta qachon yig'ilgan (ISO vaqt). */
  dataUpdatedAt: string;
  views: {
    /**
     * Davr oxirigacha yig'ilgan jami ko'rishlar. Keyin o'chirilgan Reellarning
     * oldin yig'ilgan ko'rishlari ham kiradi.
     */
    total: number;
    growthInRange: number;
  };
  /** Davrning oxirgi kunidagi o'sish ("bugungi o'sish"). */
  lastDay: {
    date: IsoDate;
    growth: number;
    /** Oldingi kundagi o'sish; tanlovning birinchi kuni bo'lsa — null. */
    previousGrowth: number | null;
  };
  participants: {
    total: number;
    newInRange: number;
  };
  reels: {
    total: number;
    accepted: number;
    pending: number;
    rejected: number;
    removed: number;
    newInRange: number;
  };
  support: {
    /** Ochiq murojaatlar: yangi + ko'rilmoqda. */
    open: number;
    new: number;
    inProgress: number;
    createdInRange: number;
  };
  targets: {
    total: number;
    detectedInRange: number;
  };
  daily: DailyStat[];
}

// ---------------------------------------------------------------------------
// AI tekshiruvi (videolarni Claude bilan tekshirish — moderatsiyaga yordam)
// ---------------------------------------------------------------------------

/**
 * Namuna rasm turi: `MUST` — videoda ko'rinishi shart; `MUST_NOT` — videoda bo'lmasligi kerak;
 * `INFO` — AI uchun qo'shimcha ma'lumot (masalan, mahsulotning boshqa rangdagi ko'rinishi).
 */
export type AiRefKind = "MUST" | "MUST_NOT" | "INFO";

/** Namuna rasm (rasmning o'zi — `aiReferenceImageUrl(id)`). */
export interface AiReferenceImage {
  id: string;
  kind: AiRefKind;
  /** Admin izohi (0–500 belgi). */
  note: string;
  /** `image/jpeg` | `image/png` | `image/webp`. */
  mime: string;
  sizeBytes: number;
  createdAt: string;
}

export type AiConfigStatus = "DRAFT" | "APPROVED";

/**
 * AI sozlamalari versiyasi: namuna rasmlar va umumiy mezonlar. Tasdiqlangan (`APPROVED`) versiya
 * qulflanadi — o'zgartirish uchun undan nusxa olib yangi qoralama (`DRAFT`) yaratiladi.
 */
export interface AiConfigVersion {
  /** 1, 2, …; qoralama keyingi raqamni oladi. */
  version: number;
  status: AiConfigStatus;
  criteria: string;
  references: AiReferenceImage[];
  createdAt: string;
  updatedAt: string;
  approvedAt: string | null;
  /** Tasdiqlagan xodimning ismi. */
  approvedBy: string | null;
}

/** Joriy ishga tushirish (`run.version`) bo'yicha sonlar; ishga tushirilmagan bo'lsa — nollar. */
export interface AiProgress {
  total: number;
  queued: number;
  processing: number;
  done: number;
  failed: number;
  /** Yakuniy xulosalar (qo'lda qaror bo'lsa — o'sha). */
  approved: number;
  rejected: number;
  uncertain: number;
  /** Qo'lda qaror qabul qilingan videolar. */
  manual: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  costUsd: number;
}

/** `TRIAL` — faqat tanlangan videolar (sinov); `FULL` — barcha qabul qilingan videolar. */
export type AiRunMode = "TRIAL" | "FULL";

export interface AiRun {
  version: number;
  mode: AiRunMode;
  startedAt: string;
  /** Ishga tushirgan xodimning ismi. */
  startedBy: string;
}

export interface AiWorkerStatus {
  lastSeenAt: string | null;
  /** Oxirgi 3 daqiqa ichida signal bergan. */
  online: boolean;
}

/** Backend sozlamalari (faqat o'qish). */
export interface AiSettings {
  model: string;
  /** Kadrlar oralig'i, soniya. */
  frameIntervalSec: number;
  /** Kadr balandligi, px (720 — 720p). */
  frameHeight: number;
  /** Bundan past ishonchli xulosa "Shubhali" bo'ladi (0..1). */
  confidenceMin: number;
  /** Sinovda tekshiriladigan videolar soni. */
  trialSize: number;
}

export interface AiState {
  /**
   * Yangi videolar qabul qilinishidan oldin AI'dan o'tadimi (backend `AI_ACCEPTANCE_GATE`). Standart —
   * false: AI hech narsaga ulanmagan, xulosasi faqat yordam.
   */
  acceptanceGate: boolean;
  /** Tahrirlanadigan qoralama; yo'q bo'lsa — null. */
  draft: AiConfigVersion | null;
  /** Oxirgi tasdiqlangan versiya. */
  active: AiConfigVersion | null;
  run: AiRun | null;
  progress: AiProgress;
  worker: AiWorkerStatus;
  settings: AiSettings;
}

export type AiVerdict = "APPROVED" | "REJECTED" | "UNCERTAIN";

export type AiReviewState = "QUEUED" | "PROCESSING" | "DONE" | "FAILED";

/** Adminning qo'lda qarori. */
export type AiManualDecision = "APPROVED" | "REJECTED";

/** AI ko'rsatgan dalil: videoning shu soniyasidagi kadr. */
export interface AiEvidence {
  second: number;
  description: string;
  /** Kadr saqlangan — `aiFrameUrl(reviewId, second)` ochiladi. */
  hasFrame: boolean;
}

export interface AiTokens {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
}

export interface AiReviewItem {
  id: string;
  version: number;
  participant: { id: string; fullName: string; phone: string };
  reel: { shortcode: string; url: string; views: number };
  state: AiReviewState;
  /** AI xulosasi (ishonch qoidasi qo'llangan: past ishonch — `UNCERTAIN`). */
  verdict: AiVerdict | null;
  /** Qo'lda qaror bo'lsa — o'sha, aks holda `verdict`. */
  finalVerdict: AiVerdict | null;
  /** 0..1 */
  confidence: number | null;
  reason: string | null;
  evidence: AiEvidence[];
  manual: { decision: AiManualDecision; note: string; by: string; at: string } | null;
  attempts: number;
  error: string | null;
  tokens: AiTokens | null;
  costUsd: number | null;
  updatedAt: string;
}

export interface AiReviewListQuery {
  /** Yakuniy xulosa bo'yicha. */
  verdict?: AiVerdict;
  state?: AiReviewState;
  /** Ism, telefon yoki shortcode. */
  search?: string;
  page?: number;
  pageSize?: number;
}

export type AiReviewListResponse = Paginated<AiReviewItem>;

/** Sinov uchun tanlanadigan video (qabul qilingan, eng ko'p ko'rilganlar birinchi). */
export interface AiCandidate {
  shortcode: string;
  url: string;
  fullName: string;
  views: number;
}

export interface AiDraftUpdate {
  criteria: string;
}

export interface AiReferenceInput {
  /** `data:image/(jpeg|png|webp);base64,…` — ko'pi bilan 2 MB (base64 ochilgandagi hajm). */
  dataUrl: string;
  kind: AiRefKind;
  note: string;
}

export interface AiReferenceUpdate {
  kind?: AiRefKind;
  note?: string;
}

export interface AiApproveRequest {
  mode: AiRunMode;
  /** Faqat `TRIAL` da, ko'pi bilan 20 ta; bo'sh yoki yo'q — eng ko'p ko'rilgan 20 ta video. */
  trialShortcodes?: string[];
}

export interface AiDecisionRequest {
  decision: AiManualDecision;
  /** 3–500 belgi, audit logga yoziladi. */
  note: string;
}

/** Backend bilan bir xil cheklovlar (AI tekshiruvi kontrakti). */
export const AI_LIMITS = {
  criteriaMax: 5000,
  /** Tasdiqlash uchun: mezonlar kamida shuncha belgi yoki kamida bitta namuna rasm. */
  criteriaMinToApprove: 10,
  noteMax: 500,
  /** Amalda cheklanmaydi — Claude chegarasi: bitta so'rovda 600 tagacha rasm (video kadrlari bilan). */
  maxReferences: 400,
  /** Namuna rasm (base64 ochilgandagi) hajmi, bayt — 2 MB. */
  maxReferenceBytes: 2 * 1024 * 1024,
  referenceMimeTypes: ["image/jpeg", "image/png", "image/webp"],
  trialMax: 20,
  decisionNoteMin: 3,
  decisionNoteMax: 500,
} as const;
