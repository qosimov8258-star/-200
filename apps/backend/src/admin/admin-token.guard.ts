import { timingSafeEqual } from "node:crypto";

import { Injectable, type CanActivate, type ExecutionContext } from "@nestjs/common";
import type { Request } from "express";

import { ApiException } from "../common/api-exception";
import { config } from "../config/config";

/**
 * VAQTINCHA admin himoyasi: `Authorization: Bearer <ADMIN_API_TOKEN>`.
 *
 * Admin login/parol + 2FA (PLAN.md 3-bo'lim) qurilganda shu guard sessiya va rol
 * (ADMIN / SUPPORT) tekshiruviga almashtiriladi. Token sozlanmagan bo'lsa — admin
 * API butunlay yopiq.
 */
@Injectable()
export class AdminTokenGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const expected = config.adminApiToken;
    const header = context.switchToHttp().getRequest<Request>().header("authorization") ?? "";
    const given = header.startsWith("Bearer ") ? header.slice(7) : "";
    if (!expected || !safeEqual(given, expected)) throw new ApiException(401, "UNAUTHORIZED");
    return true;
  }
}

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
