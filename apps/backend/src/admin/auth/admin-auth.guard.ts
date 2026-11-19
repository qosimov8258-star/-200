import {
  createParamDecorator,
  HttpException,
  Injectable,
  SetMetadata,
  type CanActivate,
  type ExecutionContext,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";

import { readCookie } from "../../web/web-session";
import type { AdminRole, AdminUser } from "./admin-accounts";
import { AdminAuthService } from "./admin-auth.service";
import { ADMIN_COOKIE } from "./admin-session";

const ROLES_KEY = "adminRoles";

/** Qaysi rollar kira oladi. Belgilanmagan bo'lsa — faqat ADMIN. */
export const AdminRoles = (...roles: AdminRole[]) => SetMetadata(ROLES_KEY, roles);

type AdminRequest = Request & { admin?: AdminUser };

/**
 * Admin API himoyasi: sessiya cookie'si (admin panel) yoki `Authorization: Bearer <ADMIN_API_TOKEN>`
 * (skriptlar). Sessiya yo'q — 401, rol mos kelmaydi — 403. Xodim `@CurrentAdmin()` orqali olinadi.
 */
@Injectable()
export class AdminAuthGuard implements CanActivate {
  constructor(
    private readonly auth: AdminAuthService,
    private readonly reflector: Reflector,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<AdminRequest>();
    const header = req.header("authorization") ?? "";
    const token = readCookie(req.header("cookie"), ADMIN_COOKIE);
    const user =
      (header.startsWith("Bearer ") ? this.auth.fromApiKey(header.slice(7)) : null) ??
      (token ? this.auth.fromToken(token) : null);
    if (!user) throw new HttpException({ message: "Sessiya tugadi. Qaytadan kiring." }, 401);

    const roles = this.reflector.getAllAndOverride<AdminRole[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]) ?? ["ADMIN"];
    if (!roles.includes(user.role)) throw new HttpException({ message: "Bu amal uchun ruxsatingiz yo'q." }, 403);
    req.admin = user;
    return true;
  }
}

/** Guard tekshirgan xodim. */
export const CurrentAdmin = createParamDecorator((_data: unknown, context: ExecutionContext): AdminUser => {
  const admin = context.switchToHttp().getRequest<AdminRequest>().admin;
  if (!admin) throw new HttpException({ message: "Sessiya tugadi. Qaytadan kiring." }, 401);
  return admin;
});
