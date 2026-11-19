import { Body, Controller, Delete, Get, HttpCode, Post, Put, UseGuards } from "@nestjs/common";

import { parseConfirm, parseManualCheck, parseSkip, WinnerService, type WinnerOverview } from "../winner/winner.service";
import type { AdminUser } from "./auth/admin-accounts";
import { AdminAuthGuard, CurrentAdmin } from "./auth/admin-auth.guard";
import { actorOf } from "./auth/admin-auth.service";

/**
 * G'olib bo'limi (TZ 5.3) — faqat ADMIN. Kontrakt `apps/admin/src/lib/api.ts` dagi
 * `getWinnerOverview` … `announceWinner` bilan bir xil: hammasi `WinnerOverview` qaytaradi.
 * Audit log yozuvlarini `WinnerService` o'zi qiladi (holat o'zgargan joyda).
 */
@Controller("admin/winner")
@UseGuards(AdminAuthGuard)
export class AdminWinnerController {
  constructor(private readonly winner: WinnerService) {}

  @Get()
  overview(): WinnerOverview {
    return this.winner.overview();
  }

  /** Qo'lda tekshiriladigan band: mahsulot xaridi yoki "Reklama vositalari". Izoh majburiy. */
  @Put("manual-check")
  manualCheck(@Body() body: unknown, @CurrentAdmin() admin: AdminUser): WinnerOverview {
    return this.winner.setManualCheck(parseManualCheck(body), actorOf(admin));
  }

  /** Nomzodni rad etish — keyingi o'rindagi ishtirokchi nomzod bo'ladi. */
  @Post("skip")
  @HttpCode(200)
  skip(@Body() body: unknown, @CurrentAdmin() admin: AdminUser): WinnerOverview {
    return this.winner.skip(parseSkip(body), actorOf(admin));
  }

  @Post("confirm")
  @HttpCode(200)
  confirm(@Body() body: unknown, @CurrentAdmin() admin: AdminUser): WinnerOverview {
    return this.winner.confirm(parseConfirm(body), actorOf(admin));
  }

  @Delete("confirm")
  unconfirm(@CurrentAdmin() admin: AdminUser): WinnerOverview {
    return this.winner.unconfirm(actorOf(admin));
  }

  /** E'lon — bir marta, qaytarilmaydi. Mini App'da "G'olib e'loni" ochiladi, g'olibga bot xabari boradi. */
  @Post("announce")
  @HttpCode(200)
  announce(@CurrentAdmin() admin: AdminUser): WinnerOverview {
    return this.winner.announce(actorOf(admin));
  }
}
