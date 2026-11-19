import { Body, Controller, Get, HttpCode, HttpException, Post, Req, Res, UseGuards } from "@nestjs/common";
import type { Request, Response } from "express";

import { config } from "../../config/config";
import { readCookie } from "../../web/web-session";
import type { AdminUser } from "./admin-accounts";
import { AdminAuthGuard, AdminRoles, CurrentAdmin } from "./admin-auth.guard";
import { AdminAuthService } from "./admin-auth.service";
import { ADMIN_COOKIE, adminCookie } from "./admin-session";

const MAX_FIELD = 200;

/** Admin panelga kirish va chiqish. Kontrakt — `apps/admin/src/lib/api.ts` (login/logout/getMe). */
@Controller("admin/auth")
export class AdminAuthController {
  constructor(private readonly auth: AdminAuthService) {}

  /** Body: `{ login, password }` → xodim; sessiya `HttpOnly` cookie'da. */
  @Post("login")
  @HttpCode(200)
  login(@Body() body: unknown, @Res({ passthrough: true }) res: Response): AdminUser {
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
    res.setHeader("Set-Cookie", adminCookie(token, this.auth.ttlSeconds, config.admin.cookieSecure));
    res.setHeader("Cache-Control", "no-store");
    return user;
  }

  /** Sessiya muddati o'tgan bo'lsa ham cookie o'chiriladi (shuning uchun guard'siz). */
  @Post("logout")
  @HttpCode(204)
  logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): void {
    const token = readCookie(req.header("cookie"), ADMIN_COOKIE);
    const admin = token ? this.auth.fromToken(token) : null;
    if (admin) this.auth.logout(admin);
    res.setHeader("Set-Cookie", adminCookie("", 0, config.admin.cookieSecure));
  }

  @Get("me")
  @UseGuards(AdminAuthGuard)
  @AdminRoles("ADMIN", "SUPPORT")
  me(@CurrentAdmin() admin: AdminUser): AdminUser {
    return admin;
  }
}
