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
  | "UNAUTHORIZED"
  | "SERVER";

/** Javob tanasi: `{ code }` — Mini App shu kod bo'yicha matn ko'rsatadi. */
export class ApiException extends HttpException {
  constructor(status: number, code: ApiErrorCode) {
    super({ code }, status);
  }
}
