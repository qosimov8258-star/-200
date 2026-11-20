/**
 * Ega (tashkilot egasi) bo'limidagi holat va signal nomlari. Admin bo'limlari `./labels.ts`
 * dan foydalanadi; bu yerda — faqat `/owner` sahifasi uchun ("Chetlatilgan" va h.k.).
 */
import type {
  OwnerParticipantFilter,
  OwnerParticipantStatus,
  OwnerReelStatus,
  RiskLevel,
  RiskSignalKind,
  RiskVerdict,
} from "./owner-types";
import type { TargetCaseStatus } from "./types";

type BadgeTone = "neutral" | "brand" | "success" | "warning" | "danger";

export const OWNER_STATUS_LABELS: Record<OwnerParticipantStatus, string> = {
  ACTIVE: "Faol",
  BLOCKED: "Bloklangan",
  DISQUALIFIED: "Chetlatilgan",
};

export const OWNER_STATUS_TONES: Record<OwnerParticipantStatus, BadgeTone> = {
  ACTIVE: "success",
  BLOCKED: "neutral",
  DISQUALIFIED: "danger",
};

export const OWNER_FILTER_LABELS: Record<OwnerParticipantFilter | "ALL", string> = {
  ALL: "Hammasi",
  ACTIVE: "Faol",
  BLOCKED: "Bloklangan",
  DISQUALIFIED: "Chetlatilgan",
  INCOMPLETE: "To'liq o'tmagan",
};

export const OWNER_REEL_LABELS: Record<OwnerReelStatus, string> = {
  PENDING: "Kutilmoqda",
  ACCEPTED: "Qabul qilingan",
  MANUAL_REVIEW: "Qo'lda tekshiruvda",
  REJECTED: "Rad etilgan",
};

export const OWNER_REEL_TONES: Record<OwnerReelStatus, BadgeTone> = {
  PENDING: "warning",
  ACCEPTED: "success",
  MANUAL_REVIEW: "brand",
  REJECTED: "danger",
};

export const OWNER_TARGET_LABELS: Record<TargetCaseStatus, string> = {
  NEW: "Ko'rib chiqilmagan",
  WARNED: "Ogohlantirilgan",
  DISQUALIFIED: "Chetlatilgan",
  DISMISSED: "Ro'yxatdan chiqarilgan",
};

export const OWNER_TARGET_TONES: Record<TargetCaseStatus, BadgeTone> = {
  NEW: "brand",
  WARNED: "warning",
  DISQUALIFIED: "danger",
  DISMISSED: "neutral",
};

export const RISK_LEVEL_LABELS: Record<RiskLevel, string> = {
  HIGH: "Yuqori xavf",
  MEDIUM: "O'rta xavf",
  LOW: "Past xavf",
};

export const RISK_LEVEL_SHORT: Record<RiskLevel, string> = {
  HIGH: "Yuqori",
  MEDIUM: "O'rta",
  LOW: "Past",
};

export const RISK_LEVEL_TONES: Record<RiskLevel, BadgeTone> = {
  HIGH: "danger",
  MEDIUM: "warning",
  LOW: "brand",
};

export const RISK_SIGNAL_LABELS: Record<RiskSignalKind, string> = {
  ENGAGEMENT_GAP: "Ko'rish oshgan, layk yo'q",
  VIEW_SPIKE: "Ko'rishlar keskin sakragan",
  LOW_ENGAGEMENT: "Faollik juda past",
  VIEW_DROP: "Ko'rishlar kamaygan",
  TARGET: "Target (pullik reklama)",
  REPORTS: "Shikoyatlar",
  MANUAL_REVIEW: "Qo'lda tekshiruvda",
  NOT_FOUND: "Video topilmagan",
};

/** Ball qoidalari (kontrakt: `owner-types.ts`) — sahifadagi izoh uchun. */
export const RISK_POINTS_HINT: Array<{ kind: RiskSignalKind; points: string }> = [
  { kind: "ENGAGEMENT_GAP", points: "40" },
  { kind: "TARGET", points: "40 (+10 ogohlantirilgan)" },
  { kind: "VIEW_SPIKE", points: "35" },
  { kind: "REPORTS", points: "10 × soni, ko'pi bilan 30" },
  { kind: "LOW_ENGAGEMENT", points: "25" },
  { kind: "VIEW_DROP", points: "20" },
  { kind: "MANUAL_REVIEW", points: "15" },
  { kind: "NOT_FOUND", points: "10" },
];

export const RISK_VERDICT_LABELS: Record<RiskVerdict, string> = {
  SAFE: "Xavfsiz",
  WATCH: "Kuzatuvda",
};
