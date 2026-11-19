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
  /** Reel holati; "NONE" — Reel yubormaganlar. */
  reel?: ReelStatus | "NONE";
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
  /** Ulangan Instagram akkaunt; ulanmagan bo'lsa — null. */
  instagramUsername: string | null;
  status: ParticipantStatus;
  registeredOn: IsoDate;
  reel: {
    url: string;
    status: ReelStatus;
  } | null;
  /** Reelning oxirgi yig'ilgan ko'rishlari. */
  views: number;
  /** Bugungi reytingdagi o'rni; reytingda bo'lmasa — null. */
  rank: number | null;
  /** Target (pullik reklama) aniqlanganmi. */
  hasTarget: boolean;
}

export interface ParticipantListResponse extends Paginated<ParticipantListItem> {
  /** Holat bo'yicha sonlar (qidiruv va Reel filtri hisobga olingan, holat filtri — yo'q). */
  statusCounts: Record<ParticipantStatus | "ALL", number>;
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
  /** Bugungi reytingdagi o'rni; reytingda bo'lmasa — null. */
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
 * `GET /api/v1/admin/targets/:id/attachments/:attachmentId` (Bearer token bilan, rasm qaytadi).
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
// Qo'lda tekshiruv — Apify videoni ketma-ket 3 marta topa olmaganda
// (backend: `apps/backend/src/admin/admin-manual-review.controller.ts`)
// ---------------------------------------------------------------------------

/**
 * NEW_REEL — yangi yuborilgan video hali qabul qilinmagan;
 * LOST_REEL — avval qabul qilingan video endi topilmayapti (reytingdan vaqtincha chiqqan).
 */
export type ManualReviewKind = "NEW_REEL" | "LOST_REEL";

/** OPEN — admin qarorini kutmoqda. */
export type ManualReviewStatus = "OPEN" | "APPROVED" | "REJECTED";

/** Rad etish sababi — ishtirokchiga bot orqali shunga mos matn yuboriladi. */
export type ManualReviewRejectReason = "NOT_FOUND" | "NOT_A_VIDEO" | "OWNER_TAKEN";

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
  /** Qo'lda tekshiruvga o'tgunga qadar avtomatik urinishlar soni. */
  attempts: number;
  /** Qo'lda tekshiruvga o'tgan vaqt (UTC ISO). */
  requestedAt: string;
  /** Video yuborilgan vaqt (UTC ISO). */
  submittedAt: string;
  /** Avval qabul qilingan videoning oxirgi ma'lum ko'rishlari; yangi videoda — null. */
  lastViews: number | null;
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

export type ContestSettingsUpdate = Pick<ContestSettings, "startsOn" | "endsOn" | "syncTime" | "minAge">;

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
  /** Shu sovg'ani oldingi bosqichlarda yutganlar qatnashmaydi. */
  excludePreviousWinners: boolean;
  /** G'oliblarga bot xabari; `{ism}`, `{sovrin}` kabi o'rinbosarlar bilan. */
  messageTemplate: string;
}

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
  /** Oylik sovg'alar (random tanlov faqat ular uchun). */
  prizes: Array<Pick<Prize, "id" | "title" | "quantity" | "minViews" | "maxViews">>;
  /** Joriy (yoki eng oxirgi tugagan) bosqich va birinchi oylik sovg'a bo'yicha boshlang'ich sozlamalar. */
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
  reelUrl: string;
  /** `viewsAsOf` kunidagi tasdiqlangan ko'rishlar. */
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
  | "PURCHASE_CONFIRMED"
  | "AD_TOOLS_REVIEWED";

/**
 * Admin qo'lda belgilaydigan bandlar: mahsulot xaridi va g'olib bilan yuzma-yuz uchrashuvda
 * Instagram'dagi "Reklama vositalari" (reklama tarixi) bo'limini ko'rish.
 */
export type WinnerManualCheckKey = "PURCHASE_CONFIRMED" | "AD_TOOLS_REVIEWED";

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
  rank: number;
  views: number;
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
  /** Nomzod: tanlov tugagan bo'lsa — yakuniy 1-o'rin, aks holda joriy yetakchi. */
  candidate: WinnerCandidate | null;
  /** Keyingi o'rinlar (zaxira nomzodlar). */
  runnersUp: Array<{
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
// Telegram (TZ 6-bo'lim: yuborildi, yetkazildi, o'qildi, o'qilmadi)
// ---------------------------------------------------------------------------

/**
 * SENT — yuborildi, Telegram hali tasdiqlamagan; DELIVERED — yetkazildi;
 * READ — o'qildi ("✅ O'qidim" tugmasi bosilgan, PLAN.md Q11);
 * UNREAD — yetkazilganiga 24 soatdan oshdi, lekin o'qilmadi; FAILED — yuborilmadi.
 */
export type TelegramDeliveryStatus = "SENT" | "DELIVERED" | "READ" | "UNREAD" | "FAILED";

/** Telegram orqali boradigan xabarnomalar (TZ 3.5). */
export type TelegramMessageKind =
  | "REEL_ACCEPTED"
  | "REEL_REJECTED"
  | "RANK_CHANGED"
  | "WARNING"
  | "SUPPORT_REPLY";

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
  /** Faylni ochish manzili; mock rejimda — null. */
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

export interface RatingEntry {
  rank: number;
  participantId: string;
  firstName: string;
  lastName: string;
  instagramUsername: string | null;
  reelUrl: string;
  /** Shu kungacha yig'ilgan ko'rishlar. */
  views: number;
  /** Shu kuni yig'ilgan yangi ko'rishlar. */
  viewsGrowth: number;
  /** Oldingi kundagi o'rin; oldingi kuni reytingda bo'lmagan bo'lsa — null. */
  previousRank: number | null;
  /** Shu kungacha target aniqlanganmi. */
  hasTarget: boolean;
}

export interface DailyRatingResponse extends Paginated<RatingEntry> {
  /** Amalda ko'rsatilgan kun (tanlov muddatiga qisilgan). */
  date: IsoDate;
  /** Tanlash mumkin bo'lgan kunlar oralig'i. */
  availableRange: { from: IsoDate; to: IsoDate };
  /** Reyting qachon tuzilgan (ISO vaqt). */
  generatedAt: string;
  summary: {
    participants: number;
    totalViews: number;
    totalGrowth: number;
    /** Oldingi kuni reytingda bo'lmaganlar. */
    newEntries: number;
  };
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
