import { createParamDecorator, HttpException, Injectable, type CanActivate, type ExecutionContext } from "@nestjs/common";
import type { Request, Response } from "express";

import { readCookie } from "../../web/web-session";
import type { OwnerUser } from "./owner-accounts";
import { OwnerAuthService } from "./owner-auth.service";
import { OWNER_COOKIE } from "./owner-session";

type OwnerRequest = Request & { owner?: OwnerUser };

const unauthorized = () => new HttpException({ message: "Sessiya tugadi. Qaytadan kiring." }, 401);

/**
 * Ega API himoyasi: faqat `reels_owner` sessiya cookie'si. Admin sessiyasi (`reels_admin`) va
 * `Authorization: Bearer <ADMIN_API_TOKEN>` bu yerda qabul QILINMAYDI. Sessiya yo'q — 401.
 * Javoblar keshlanmaydi (`Cache-Control: no-store`). Ega `@CurrentOwner()` orqali olinadi.
 */
@Injectable()
export class OwnerAuthGuard implements CanActivate {
  constructor(private readonly auth: OwnerAuthService) {}

  canActivate(context: ExecutionContext): boolean {
    const http = context.switchToHttp();
    http.getResponse<Response>().setHeader("Cache-Control", "no-store");
    const req = http.getRequest<OwnerRequest>();
    const token = readCookie(req.header("cookie"), OWNER_COOKIE);
    const owner = token ? this.auth.fromToken(token) : null;
    if (!owner) throw unauthorized();
    req.owner = owner;
    return true;
  }
}

/** Guard tekshirgan ega. */
export const CurrentOwner = createParamDecorator((_data: unknown, context: ExecutionContext): OwnerUser => {
  const owner = context.switchToHttp().getRequest<OwnerRequest>().owner;
  if (!owner) throw unauthorized();
  return owner;
});
