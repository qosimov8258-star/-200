import { HttpException } from "@nestjs/common";

/** Mini App tushunadigan xato kodlari (`apps/miniapp/src/lib/types.ts` → ApiErrorCode). */
export type ApiErrorCode =
  | "INVALID_LINK"
  | "REEL_ALREADY_SUBMITTED"
  | "REEL_TAKEN"
  | "UNDER_AGE"
  | "INVALID_PROFILE"
  | "PROFILE_LOCKED"
  /** Rozilik eski versiyaga berilmoqda — qoidalar shu orada yangilangan. */
  | "RULES_OUTDATED"
  /** Shikoyat: Reel linki yoki @username noto'g'ri yozilgan. */
  | "REPORT_TARGET_INVALID"
  /** Shikoyat: bu Reel yoki akkaunt tanlov ishtirokchisi emas. */
  | "REPORT_NOT_FOUND"
  /** Shikoyat: o'zingiz haqingizda. */
  | "REPORT_SELF"
  /** Shikoyat: bugun shu ishtirokchi haqida allaqachon yuborgansiz. */
  | "REPORT_DUPLICATE"
  /** Shikoyat: kunlik chegara tugadi. */
  | "REPORT_LIMIT"
  /** Skrinshot yaroqsiz (rasm emas yoki juda katta). */
  | "INVALID_IMAGE"
  | "UNAUTHORIZED"
  | "SERVER";

/** Javob tanasi: `{ code }` — Mini App shu kod bo'yicha matn ko'rsatadi. */
export class ApiException extends HttpException {
  constructor(status: number, code: ApiErrorCode) {
    super({ code }, status);
  }
}
