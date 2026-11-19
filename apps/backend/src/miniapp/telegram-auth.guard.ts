import {
  createParamDecorator,
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from "@nestjs/common";
import type { Request } from "express";

import { ApiException } from "../common/api-exception";
import { config } from "../config/config";
import { verifyInitData, type TelegramIdentity } from "../telegram/init-data";
import { readCookie, SESSION_COOKIE, verifySessionToken } from "../web/web-session";

type AuthedRequest = Request & { telegram?: TelegramIdentity };

/**
 * Ishtirokchini taniydi — ikki yo'l, ikkalasi ham bitta telegramId ga olib keladi:
 * 1) Telegram Mini App: `X-Telegram-Init-Data` sarlavhasi (bot tokeni bilan HMAC);
 * 2) veb-sayt: Telegram Login Widget orqali kirgandan keyingi `reels_session` cookie.
 * Bot tokeni sozlanmagan bo'lsa — hamma so'rov rad etiladi.
 */
@Injectable()
export class TelegramAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthedRequest>();
    const token = config.telegram.botToken;
    if (!token) throw new ApiException(401, "UNAUTHORIZED");

    const header = request.header("x-telegram-init-data") ?? "";
    let identity = header
      ? verifyInitData(header, token, config.telegram.initDataMaxAgeSeconds)
      : null;

    if (!identity && !header) {
      const session = readCookie(request.header("cookie"), SESSION_COOKIE);
      const telegramId = session ? verifySessionToken(session, token) : null;
      if (telegramId !== null) identity = { telegramId, firstName: "", username: null };
    }

    if (!identity) throw new ApiException(401, "UNAUTHORIZED");
    request.telegram = identity;
    return true;
  }
}

/** Tekshirilgan Telegram foydalanuvchisi (faqat `TelegramAuthGuard` dan keyin). */
export const TgUser = createParamDecorator(
  (_: unknown, context: ExecutionContext): TelegramIdentity =>
    context.switchToHttp().getRequest<AuthedRequest>().telegram!,
);
