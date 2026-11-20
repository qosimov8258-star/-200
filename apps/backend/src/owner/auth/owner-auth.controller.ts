import { Body, Controller, Get, HttpCode, HttpException, Post, Res, UseGuards } from "@nestjs/common";
import type { Response } from "express";

import { config } from "../../config/config";
import type { OwnerUser } from "./owner-accounts";
import { CurrentOwner, OwnerAuthGuard } from "./owner-auth.guard";
import { OwnerAuthService } from "./owner-auth.service";
import { ownerCookie } from "./owner-session";

const MAX_FIELD = 200;

/**
 * Ega bo'limiga kirish va chiqish. Kontrakt — `apps/admin/src/lib/owner-types.ts` (Kirish).
 * Admin kirishidan butunlay alohida: boshqa hisoblar, boshqa cookie, boshqa imzo kaliti.
 */
@Controller("owner/auth")
export class OwnerAuthController {
  constructor(private readonly auth: OwnerAuthService) {}

  /** Body: `{ login, password }` → ega; sessiya `HttpOnly` cookie'da. 401 — xato, 429 — qulflangan. */
  @Post("login")
  @HttpCode(200)
  login(@Body() body: unknown, @Res({ passthrough: true }) res: Response): OwnerUser {
    res.setHeader("Cache-Control", "no-store");
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      throw new HttpException({ message: "So'rov noto'g'ri." }, 400);
    }
    const { login, password, ...rest } = body as Record<string, unknown>;
    if (
      Object.keys(rest).length > 0 ||
      typeof login !== "string" ||
      typeof password !== "string" ||
      login.length > MAX_FIELD ||
      password.length > MAX_FIELD
    ) {
      throw new HttpException({ message: "Login va parolni kiriting." }, 400);
    }
    const { user, token } = this.auth.login(login, password);
    res.setHeader("Set-Cookie", ownerCookie(token, this.auth.ttlSeconds, config.admin.cookieSecure));
    return user;
  }

  /** Sessiya bo'lmasa yoki muddati o'tgan bo'lsa ham cookie o'chiriladi (shuning uchun guard'siz). */
  @Post("logout")
  @HttpCode(204)
  logout(@Res({ passthrough: true }) res: Response): void {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Set-Cookie", ownerCookie("", 0, config.admin.cookieSecure));
  }

  @Get("me")
  @UseGuards(OwnerAuthGuard)
  me(@CurrentOwner() owner: OwnerUser): OwnerUser {
    return owner;
  }
}
