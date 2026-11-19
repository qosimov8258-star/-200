import {
  createParamDecorator,
  Injectable,
  SetMetadata,
  type CanActivate,
  type ExecutionContext,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";

import { ApiException } from "../common/api-exception";
import { config } from "../config/config";
import { verifyInitData, type TelegramIdentity } from "../telegram/init-data";
import { readCookie, SESSION_COOKIE, verifySessionToken } from "../web/web-session";

type AuthedRequest = Request & { telegram?: TelegramIdentity };

const PUBLIC_ROUTE = "miniapp:public-route";

/**
 * Ochiq yo'l: kirmagan mehmon ham ko'ra oladi (veb-saytda — tanlov, sovg'alar, reyting, qoidalar).
 * Foydalanuvchi kirgan bo'lsa — baribir taniladi (`TgUserOptional`).
 */
export const Public = () => SetMetadata(PUBLIC_ROUTE, true);

/**
 * Ishtirokchini taniydi — ikki yo'l, ikkalasi ham bitta telegramId ga olib keladi:
 * 1) Telegram Mini App: `X-Telegram-Init-Data` sarlavhasi (bot tokeni bilan HMAC);
 * 2) veb-sayt: Telegram Login Widget orqali kirgandan keyingi `reels_session` cookie.
 * Bot tokeni sozlanmagan bo'lsa yoki foydalanuvchi tanilmasa — rad etiladi
 * (`@Public()` yo'llardan tashqari: ular mehmonga ham ochiq).
 */
@Injectable()
export class TelegramAuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthedRequest>();
    const isPublic =
      this.reflector.getAllAndOverride<boolean | undefined>(PUBLIC_ROUTE, [
        context.getHandler(),
        context.getClass(),
      ]) === true;

    const identity = identify(request);
    if (identity) {
      request.telegram = identity;
      return true;
    }
    if (isPublic) return true;
    throw new ApiException(401, "UNAUTHORIZED");
  }
}

function identify(request: AuthedRequest): TelegramIdentity | null {
  const token = config.telegram.botToken;
  if (!token) return null;

  const header = request.header("x-telegram-init-data") ?? "";
  if (header) return verifyInitData(header, token, config.telegram.initDataMaxAgeSeconds);

  const session = readCookie(request.header("cookie"), SESSION_COOKIE);
  const telegramId = session ? verifySessionToken(session, token) : null;
  return telegramId !== null ? { telegramId, firstName: "", username: null } : null;
}

/** Tekshirilgan Telegram foydalanuvchisi (faqat `TelegramAuthGuard` dan keyin, ochiq bo'lmagan yo'lda). */
export const TgUser = createParamDecorator(
  (_: unknown, context: ExecutionContext): TelegramIdentity =>
    context.switchToHttp().getRequest<AuthedRequest>().telegram!,
);

/** `@Public()` yo'llarda: kirgan bo'lsa — foydalanuvchi, mehmon bo'lsa — null. */
export const TgUserOptional = createParamDecorator(
  (_: unknown, context: ExecutionContext): TelegramIdentity | null =>
    context.switchToHttp().getRequest<AuthedRequest>().telegram ?? null,
);
