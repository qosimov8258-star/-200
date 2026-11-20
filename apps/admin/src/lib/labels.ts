import type {
  AuditEntity,
  DrawDateBasis,
  DrawExclusion,
  DrawNotifyStatus,
  DrawStatus,
  ManualReviewKind,
  ManualReviewRejectReason,
  ManualReviewStatus,
  ParticipantStatus,
  ReelFlagType,
  ReelRejectReason,
  ReelStatus,
  SupportTicketStatus,
  TargetCaseStatus,
  TargetDetectionMethod,
  TargetState,
  TelegramDeliveryStatus,
  TelegramFailureReason,
  TelegramMessageKind,
  WinnerCheckKey,
} from "./types";

type BadgeTone = "neutral" | "brand" | "success" | "warning" | "danger";

export const PARTICIPANT_STATUS_LABELS: Record<ParticipantStatus, string> = {
  ACTIVE: "Faol",
  WARNED: "Ogohlantirilgan",
  BLOCKED: "Bloklangan",
  DISQUALIFIED: "Diskvalifikatsiya qilingan",
};

export const PARTICIPANT_STATUS_TONES: Record<ParticipantStatus, BadgeTone> = {
  ACTIVE: "success",
  WARNED: "warning",
  BLOCKED: "neutral",
  DISQUALIFIED: "danger",
};

export const REEL_STATUS_LABELS: Record<ReelStatus, string> = {
  PENDING: "Kutilmoqda",
  ACCEPTED: "Qabul qilingan",
  REJECTED: "Rad etilgan",
  REMOVED: "O'chirilgan",
};

export const REEL_STATUS_TONES: Record<ReelStatus, BadgeTone> = {
  PENDING: "warning",
  ACCEPTED: "success",
  REJECTED: "danger",
  REMOVED: "neutral",
};

/** Qo'lda tekshiruvdagi video (`AdminReelItem.manualReview`) holati o'rniga ko'rsatiladi. */
export const MANUAL_REVIEW_REEL_LABEL = "Qo'lda tekshiruvda";

/** Reytingda hisoblanadigan (eng ko'p ko'rilgan qabul qilingan) video — `AdminReelItem.best`. */
export const BEST_REEL_LABEL = "Reytingda hisoblanadi";

/** Foydalanuvchilar bo'limidagi video filtri: "shu holatdagi videosi bor" / "video yo'q". */
export const REEL_FILTER_LABELS: Record<ReelStatus | "NONE", string> = {
  ACCEPTED: "Qabul qilingan videosi bor",
  PENDING: "Kutilayotgan videosi bor",
  REJECTED: "Rad etilgan videosi bor",
  REMOVED: "O'chirilgan videosi bor",
  NONE: "Video yo'q",
};

/** Video nega rad etilgani — ishtirokchiga bot orqali shunga mos xabar boradi. */
export const REEL_REJECT_REASON_LABELS: Record<ReelRejectReason, string> = {
  NOT_FOUND: "Video topilmadi yoki akkaunt yopiq",
  NOT_A_VIDEO: "Reel (video) emas",
  OWNER_TAKEN: "Bu Instagram akkaunt boshqa ishtirokchida",
};

/** Nakrutka shubhasi belgilari (backend `ReelFlagType`). */
export const REEL_FLAG_LABELS: Record<ReelFlagType, string> = {
  LOW_ENGAGEMENT: "Ko'rishlarga nisbatan layklar juda kam",
  VIEW_SPIKE: "Ko'rishlar keskin oshgan",
  ENGAGEMENT_GAP: "Ko'rishlar oshgan, layklar o'smagan",
  VIEW_DROP: "Ko'rishlar kamaygan",
};

/** Belgi nomi; backend yangi tur qo'shgan bo'lsa — kodning o'zi. */
export function reelFlagLabel(flag: string): string {
  return (REEL_FLAG_LABELS as Record<string, string>)[flag] ?? flag;
}

export const MANUAL_REVIEW_STATUS_LABELS: Record<ManualReviewStatus, string> = {
  OPEN: "Tekshiruv kutilmoqda",
  APPROVED: "Tasdiqlangan",
  REJECTED: "Rad etilgan",
};

export const MANUAL_REVIEW_STATUS_TONES: Record<ManualReviewStatus, BadgeTone> = {
  OPEN: "warning",
  APPROVED: "success",
  REJECTED: "danger",
};

export const MANUAL_REVIEW_KIND_LABELS: Record<ManualReviewKind, string> = {
  NEW_REEL: "Yangi video",
  LOST_REEL: "Reytingdagi video yo'qoldi",
};

/** Rad etish sabablari — ishtirokchiga bot orqali shunga mos xabar boradi. */
export const MANUAL_REVIEW_REJECT_LABELS: Record<ManualReviewRejectReason, string> =
  REEL_REJECT_REASON_LABELS;

export const TARGET_CASE_STATUS_LABELS: Record<TargetCaseStatus, string> = {
  NEW: "Ko'rib chiqilmagan",
  WARNED: "Ogohlantirilgan",
  DISQUALIFIED: "Diskvalifikatsiya qilingan",
  DISMISSED: "Ro'yxatdan chiqarilgan",
};

export const TARGET_CASE_STATUS_TONES: Record<TargetCaseStatus, BadgeTone> = {
  NEW: "brand",
  WARNED: "warning",
  DISQUALIFIED: "danger",
  DISMISSED: "neutral",
};

export const TARGET_METHOD_LABELS: Record<TargetDetectionMethod, string> = {
  AD_LIBRARY: "Meta reklama kutubxonasi",
  GROWTH_ANALYSIS: "AI: o'sish tahlili",
  REPORT: "Ishtirokchi shikoyati",
};

export const TARGET_STATE_LABELS: Record<TargetState, string> = {
  ON: "Yoqilgan",
  OFF: "Yoqilmagan",
  UNKNOWN: "Aniqlanmadi",
};

export const TARGET_STATE_TONES: Record<TargetState, BadgeTone> = {
  ON: "danger",
  OFF: "success",
  UNKNOWN: "neutral",
};

/** TZ 5.3: g'olib nomzodining tekshiruv ro'yxati. */
export const WINNER_CHECK_LABELS: Record<WinnerCheckKey, string> = {
  NO_TARGET: "Target yoqilmagan",
  REEL_AVAILABLE: "Reel o'chirilmagan",
  NO_FAKE_VIEWS: "Soxta ko'rish belgisi yo'q",
  PURCHASE_CONFIRMED: "Mahsulot sotib olingan",
  AD_TOOLS_REVIEWED: "Reklama tarixi yuzma-yuz ko'rilgan",
};

/** TZ 6: yuborildi, yetkazildi, o'qildi, o'qilmadi. */
export const TELEGRAM_STATUS_LABELS: Record<TelegramDeliveryStatus, string> = {
  SENT: "Yuborildi",
  DELIVERED: "Yetkazildi",
  READ: "O'qildi",
  UNREAD: "O'qilmadi",
  FAILED: "Yuborilmadi",
};

export const TELEGRAM_STATUS_TONES: Record<TelegramDeliveryStatus, BadgeTone> = {
  SENT: "neutral",
  DELIVERED: "brand",
  READ: "success",
  UNREAD: "warning",
  FAILED: "danger",
};

export const TELEGRAM_KIND_LABELS: Record<TelegramMessageKind, string> = {
  REEL_ACCEPTED: "Reel qabul qilindi",
  REEL_REJECTED: "Reel rad etildi",
  REEL_REVIEW: "Reel qo'lda tekshiruvda",
  RANK_CHANGED: "Reyting o'zgardi",
  WARNING: "Ogohlantirish",
  SUPPORT_REPLY: "Support javobi",
  VOUCHER_WIN: "Random tanlov g'olibi",
  WINNER: "Asosiy g'olib",
  OTHER: "Boshqa",
};

/** Xabar turi belgisi rangi: g'oliblik xabarlari va ogohlantirish ajralib turadi. */
export const TELEGRAM_KIND_TONES: Record<TelegramMessageKind, BadgeTone> = {
  REEL_ACCEPTED: "neutral",
  REEL_REJECTED: "neutral",
  REEL_REVIEW: "neutral",
  RANK_CHANGED: "neutral",
  WARNING: "warning",
  SUPPORT_REPLY: "neutral",
  VOUCHER_WIN: "brand",
  WINNER: "success",
  OTHER: "neutral",
};

export const TELEGRAM_FAILURE_LABELS: Record<TelegramFailureReason, string> = {
  BOT_BLOCKED: "Ishtirokchi botni bloklagan",
  NETWORK: "Tarmoq xatosi",
};

/** TZ 3.4: yangi, ko'rilmoqda, yopildi. */
export const SUPPORT_STATUS_LABELS: Record<SupportTicketStatus, string> = {
  NEW: "Yangi",
  IN_PROGRESS: "Ko'rilmoqda",
  CLOSED: "Yopildi",
};

export const SUPPORT_STATUS_TONES: Record<SupportTicketStatus, BadgeTone> = {
  NEW: "brand",
  IN_PROGRESS: "warning",
  CLOSED: "neutral",
};

// ---------------------------------------------------------------------------
// Sovg'alar
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Random tanlov
// ---------------------------------------------------------------------------

export const DRAW_STATUS_LABELS: Record<DrawStatus, string> = {
  DRAFT: "Qoralama",
  CONFIRMED: "Tasdiqlangan",
  SENT: "Botga yuborilgan",
  CANCELLED: "Bekor qilingan",
};

export const DRAW_STATUS_TONES: Record<DrawStatus, BadgeTone> = {
  DRAFT: "warning",
  CONFIRMED: "brand",
  SENT: "success",
  CANCELLED: "neutral",
};

export const DRAW_DATE_BASIS_LABELS: Record<DrawDateBasis, string> = {
  POSTED: "Instagram'da joylangan sana",
  SUBMITTED: "Ilovaga yuborilgan sana",
};

export const DRAW_EXCLUSION_LABELS: Record<DrawExclusion, string> = {
  NOT_ACCEPTED: "Reel tasdiqlanmagan yoki o'chirilgan",
  OUT_OF_PERIOD: "Reel boshqa davrda joylangan",
  VIEWS_LOW: "Ko'rishlar kam",
  VIEWS_HIGH: "Ko'rishlar chegaradan ko'p",
  STATUS: "Bloklangan yoki diskvalifikatsiya",
  WARNED: "Ogohlantirilgan",
  TARGET: "Target aniqlangan",
  PREVIOUS_WINNER: "Oldingi bosqich g'olibi",
};

export const DRAW_NOTIFY_LABELS: Record<DrawNotifyStatus, string> = {
  NOT_SENT: "Yuborilmagan",
  SENT: "Yuborildi",
  FAILED: "Xato",
};

export const DRAW_NOTIFY_TONES: Record<DrawNotifyStatus, BadgeTone> = {
  NOT_SENT: "neutral",
  SENT: "success",
  FAILED: "danger",
};

// ---------------------------------------------------------------------------
// Audit log
// ---------------------------------------------------------------------------

export const AUDIT_ENTITY_LABELS: Record<AuditEntity, string> = {
  participant: "Ishtirokchi",
  reel: "Reel",
  support_ticket: "Support",
  target_case: "Target",
  telegram_message: "Telegram",
  winner: "G'olib",
  settings: "Sozlamalar",
  prize: "Sovg'alar",
  voucher_draw: "Random tanlov",
  auth: "Kirish",
};

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  "auth.login": "Tizimga kirdi",
  "auth.logout": "Tizimdan chiqdi",
  "reel.accept": "Reelni qabul qildi",
  "reel.reject": "Reelni rad etdi",
  "manual_review.approve": "Qo'lda tekshiruv: tasdiqladi",
  "manual_review.reject": "Qo'lda tekshiruv: rad etdi",
  "participant.block": "Bloklandi",
  "participant.unblock": "Blokdan chiqarildi",
  "participant.disqualify": "Diskvalifikatsiya qilindi",
  "participant.warn": "Ogohlantirildi",
  "support.reply": "Murojaatga javob yozdi",
  "support.status": "Murojaat holatini o'zgartirdi",
  "target.warn": "Target: ogohlantirish",
  "target.disqualify": "Target: diskvalifikatsiya",
  "target.dismiss": "Target: ro'yxatdan chiqarildi",
  "target.check": "Target: reklama kutubxonasi tekshirildi",
  "telegram.resend": "Telegram: qayta yuborildi",
  "telegram.resend_unread": "Telegram: o'qilmaganlarga qayta yuborildi",
  "winner.purchase_check": "G'olib: xarid tekshiruvi",
  "winner.ad_tools_check": "G'olib: reklama tarixi tekshiruvi",
  "winner.skip": "G'olib: nomzod rad etildi",
  "winner.confirm": "G'olib tasdiqlandi",
  "winner.unconfirm": "G'olib tasdig'i bekor qilindi",
  "winner.announce": "G'olib e'lon qilindi",
  "settings.update": "Sozlamalarni o'zgartirdi",
  "rules.update": "Tanlov qoidalarini o'zgartirdi",
  "prize.create": "Sovg'a qo'shdi",
  "prize.update": "Sovg'ani o'zgartirdi",
  "prize.delete": "Sovg'ani o'chirdi",
  "prize.move": "Sovg'alar tartibini o'zgartirdi",
  "draw.run": "Random tanlov o'tkazdi",
  "draw.replace": "G'olibni zaxira bilan almashtirdi",
  "draw.confirm": "Random tanlov natijasini tasdiqladi",
  "draw.cancel": "Random tanlovni bekor qildi",
  "draw.send": "G'oliblarga bot orqali xabar yubordi",
  "draw.period.create": "Random tanlov uchun davr yaratdi",
  "draw.period.update": "Random tanlov davrini o'zgartirdi",
  "draw.period.delete": "Random tanlov davrini o'chirdi",
  "draw.stage.delete": "Random tanlov bosqichini o'chirdi",
  "draw.stage.restore": "Random tanlov bosqichini tikladi",
};

const WINNER_VALUE_LABELS: Record<string, string> = {
  CANDIDATE: "Nomzod",
  SKIPPED: "Rad etilgan",
  CONFIRMED: "Tasdiqlangan",
  ANNOUNCED: "E'lon qilingan",
  PENDING: "Tekshirilmagan",
  PASSED: "O'tdi",
  FAILED: "O'tmadi",
};

const AUDIT_VALUE_LABELS: Partial<Record<AuditEntity, Record<string, string>>> = {
  participant: PARTICIPANT_STATUS_LABELS,
  reel: REEL_STATUS_LABELS,
  support_ticket: SUPPORT_STATUS_LABELS,
  target_case: TARGET_CASE_STATUS_LABELS,
  telegram_message: TELEGRAM_STATUS_LABELS,
  winner: WINNER_VALUE_LABELS,
  voucher_draw: DRAW_STATUS_LABELS,
};

/** Audit yozuvidagi holat kodini o'qiladigan matnga ("ACTIVE" -> "Faol"). */
export function auditValueLabel(entity: AuditEntity, value: string): string {
  return AUDIT_VALUE_LABELS[entity]?.[value] ?? value;
}
