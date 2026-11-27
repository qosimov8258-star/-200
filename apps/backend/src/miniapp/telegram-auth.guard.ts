import {
  createParamDecorator,
  Inject,
  Injectable,
  Optional,
  SetMetadata,
  type CanActivate,
  type ExecutionContext,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";

import { ApiException } from "../common/api-exception";
import { config } from "../config/config";
import { ParticipantsService } from "../participants/participants.service";
import { verifyInitData, type TelegramIdentity } from "../telegram/init-data";
import { readCookie, readSessionToken, SESSION_COOKIE } from "../web/web-session";

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
 * 2) veb-sayt: Telegram Login Widget orqali kirgandan yoki saytda ro'yxatdan o'tgandan keyingi
 *    `reels_session` cookie.
 * Telegram foydalanuvchisi saytdagi hisobga ulangan bo'lsa — o'sha hisob (`ParticipantsService.resolve`);
 * hisob ulangandan oldin berilgan sayt sessiyalari qabul qilinmaydi.
 * Bot tokeni sozlanmagan bo'lsa yoki foydalanuvchi tanilmasa — rad etiladi
 * (`@Public()` yo'llardan tashqari: ular mehmonga ham ochiq).
 */
@Injectable()
export class TelegramAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    // Testlarda ulanmasligi mumkin — shunda ID o'zgarmaydi. `@Inject` shart (`| null` turi).
    @Optional() @Inject(ParticipantsService) private readonly participants: ParticipantsService | null = null,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthedRequest>();
    const isPublic =
      this.reflector.getAllAndOverride<boolean | undefined>(PUBLIC_ROUTE, [
        context.getHandler(),
        context.getClass(),
      ]) === true;

    const identity = identify(request, this.participants);
    if (identity) {
      request.telegram = identity;
      return true;
    }
    if (isPublic) return true;
    throw new ApiException(401, "UNAUTHORIZED");
  }
}

function identify(request: AuthedRequest, participants: ParticipantsService | null): TelegramIdentity | null {
  const token = config.telegram.botToken;
  if (!token) return null;
  const resolve = (id: number) => participants?.resolve(id) ?? id;

  const header = request.header("x-telegram-init-data") ?? "";
  if (header) {
    const identity = verifyInitData(header, token, config.telegram.initDataMaxAgeSeconds);
    return identity ? { ...identity, telegramId: resolve(identity.telegramId) } : null;
  }

  const cookie = readCookie(request.header("cookie"), SESSION_COOKIE);
  const session = cookie ? readSessionToken(cookie, token) : null;
  if (!session) return null;
  // Hisob Telegram'ga ulangan yoki saytga qayta (admin ruxsati bilan) kirilgan: undan oldingi sayt
  // sessiyalari bekor — hisobga bir vaqtda faqat bitta qurilmadan kiriladi.
  const accountId = resolve(session.id);
  const sessionsFrom = participants?.get(accountId)?.sessionsFrom;
  if (sessionsFrom && session.issuedAt * 1000 < sessionsFrom.getTime()) return null;
  return { telegramId: accountId, firstName: "", username: null };
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
