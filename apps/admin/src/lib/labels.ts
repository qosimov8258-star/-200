import type {
  AuditEntity,
  ParticipantStatus,
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
  INSTAGRAM_API: "Instagram API",
  GROWTH_ANALYSIS: "AI: o'sish tahlili",
  SCREENSHOT: "Skrinshot",
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
  RANK_CHANGED: "Reyting o'zgardi",
  WARNING: "Ogohlantirish",
  SUPPORT_REPLY: "Support javobi",
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
  auth: "Kirish",
};

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  "auth.login": "Tizimga kirdi",
  "auth.logout": "Tizimdan chiqdi",
  "reel.accept": "Reelni qabul qildi",
  "reel.reject": "Reelni rad etdi",
  "participant.block": "Bloklandi",
  "participant.unblock": "Blokdan chiqarildi",
  "participant.disqualify": "Diskvalifikatsiya qilindi",
  "participant.warn": "Ogohlantirildi",
  "support.reply": "Murojaatga javob yozdi",
  "support.status": "Murojaat holatini o'zgartirdi",
  "target.warn": "Target: ogohlantirish",
  "target.disqualify": "Target: diskvalifikatsiya",
  "target.dismiss": "Target: ro'yxatdan chiqarildi",
  "telegram.resend": "Telegram: qayta yuborildi",
  "telegram.resend_unread": "Telegram: o'qilmaganlarga qayta yuborildi",
  "winner.purchase_check": "G'olib: xarid tekshiruvi",
  "winner.skip": "G'olib: nomzod rad etildi",
  "winner.confirm": "G'olib tasdiqlandi",
  "winner.unconfirm": "G'olib tasdig'i bekor qilindi",
  "winner.announce": "G'olib e'lon qilindi",
  "settings.update": "Sozlamalarni o'zgartirdi",
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
};

/** Audit yozuvidagi holat kodini o'qiladigan matnga ("ACTIVE" -> "Faol"). */
export function auditValueLabel(entity: AuditEntity, value: string): string {
  return AUDIT_VALUE_LABELS[entity]?.[value] ?? value;
}
