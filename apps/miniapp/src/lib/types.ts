/**
 * Mini App va backend o'rtasidagi ma'lumot tiplari (ishtirokchi tomoni).
 *
 * Holat nomlari admin panel tiplari (`apps/admin/src/lib/types.ts`) bilan bir xil.
 * Backend tayyor bo'lganda OpenAPI dan generatsiya qilingan tiplarga almashtiriladi.
 */

/** Sana "YYYY-MM-DD" — tanlov kuni (Asia/Tashkent). */
export type IsoDate = string;

export type ReelStatus = "PENDING" | "ACCEPTED" | "REJECTED" | "REMOVED";

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

export interface MyReel {
  url: string;
  shortcode: string;
  /**
   * PENDING — server Instagram'da tekshirmoqda (odatda bir necha daqiqa);
   * REJECTED bo'lsa, boshqa link yuborish mumkin.
   */
  status: ReelStatus;
  /** Rad etilgan bo'lsa — sababi. */
  rejectReason: ReelRejectReason | null;
  totalViews: number;
  todayViews: number;
  rank: number | null;
  rankDelta: number;
  /** So'nggi kunlar, eskidan yangiga. */
  daily: DailyViews[];
  lastSyncedAt: string | null;
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
  | "UNAUTHORIZED"
  | "SERVER";
