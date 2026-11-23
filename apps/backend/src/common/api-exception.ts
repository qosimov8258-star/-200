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
  /** Support: xabar bo'sh yoki juda uzun. */
  | "SUPPORT_INVALID"
  /** Support: qisqa vaqtda juda ko'p xabar. */
  | "SUPPORT_LIMIT"
  /** Istoriya: video 50 MB dan katta. */
  | "STORY_TOO_LARGE"
  /** Istoriya: video emas (MP4, MOV, WebM), buzilgan yoki bo'sh fayl. */
  | "STORY_INVALID_FILE"
  /** Istoriya: bir vaqtda 10 tadan ortiq faol istoriya bo'lmaydi. */
  | "STORY_LIMIT"
  /** So'ralgan narsa (masalan, istoriya) topilmadi yoki muddati o'tgan. */
  | "NOT_FOUND"
  | "UNAUTHORIZED"
  | "SERVER";

/** Javob tanasi: `{ code }` — Mini App shu kod bo'yicha matn ko'rsatadi. */
export class ApiException extends HttpException {
  constructor(status: number, code: ApiErrorCode) {
    super({ code }, status);
  }
}
