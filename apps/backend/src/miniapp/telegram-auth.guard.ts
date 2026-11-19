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

type AuthedRequest = Request & { telegram?: TelegramIdentity };

/**
 * Mini App so'rovlarini tekshiradi: `X-Telegram-Init-Data` sarlavhasi bot tokeni
 * bilan imzolangan bo'lishi shart. Bot tokeni sozlanmagan bo'lsa — hamma so'rov rad etiladi.
 */
@Injectable()
export class TelegramAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthedRequest>();
    const header = request.header("x-telegram-init-data") ?? "";
    const identity = config.telegram.botToken
      ? verifyInitData(header, config.telegram.botToken, config.telegram.initDataMaxAgeSeconds)
      : null;
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
