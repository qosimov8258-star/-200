import { Body, Controller, Get, HttpCode, Param, Post, Query, UseGuards } from "@nestjs/common";

import { AuditService } from "../audit/audit.service";
import {
  MessageLogService,
  type TelegramDeliveryStatus,
  type TelegramMessageListItem,
} from "../telegram/message-log.service";
import { TELEGRAM_MESSAGE_KINDS, type TelegramMessageKind } from "../telegram/notifier";
import { adminError, objectBody, oneOf, paginate } from "./admin-http";
import type { AdminUser } from "./auth/admin-accounts";
import { AdminAuthGuard, CurrentAdmin } from "./auth/admin-auth.guard";
import { actorOf } from "./auth/admin-auth.service";

const STATUSES: readonly TelegramDeliveryStatus[] = ["SENT", "DELIVERED", "READ", "UNREAD", "FAILED"];
const MAX_SEARCH = 100;

/** Audit log yozuvi uchun turlar nomi. */
const KIND_LABELS: Record<TelegramMessageKind, string> = {
  REEL_ACCEPTED: "Video qabul qilindi",
  REEL_REJECTED: "Video rad etildi",
  RANK_CHANGED: "Reytingdagi o'rin",
  WARNING: "Ogohlantirish",
  SUPPORT_REPLY: "Support javobi",
  REEL_REVIEW: "Qo'lda tekshiruv",
  VOUCHER_WIN: "Voucher g'olibi",
  WINNER: "G'olib",
  OTHER: "Boshqa",
};

const personName = (item: TelegramMessageListItem): string =>
  `${item.participant.firstName} ${item.participant.lastName}`.trim() || `ID ${item.participant.id}`;

/**
 * Telegram xabarnomalari jurnali (admin panel → "Telegram"), faqat ADMIN.
 * Kontrakt `apps/admin/src/lib/api.ts` dagi `getTelegramMessages` / `resendTelegramMessage` /
 * `resendUnreadTelegram` bilan bir xil.
 */
@Controller("admin/telegram/messages")
@UseGuards(AdminAuthGuard)
export class AdminTelegramController {
  constructor(
    private readonly log: MessageLogService,
    private readonly audit: AuditService,
  ) {}

  /** `GET /admin/telegram/messages?status=&kind=&search=&page=&pageSize=` */
  @Get()
  list(
    @Query("status") status?: string,
    @Query("kind") kind?: string,
    @Query("search") search?: string,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
  ) {
    const { rows, statusCounts, summary } = this.log.list({
      status: oneOf(status, STATUSES, "Holat"),
      kind: oneOf(kind, TELEGRAM_MESSAGE_KINDS, "Tur"),
      search: search?.slice(0, MAX_SEARCH),
    });
    return { ...paginate(rows, page, pageSize), statusCounts, summary };
  }

  /**
   * Body: `{ kind?, search? }` — joriy filtr bo'yicha barcha o'qilmaganlarga qayta yuborish
   * (ketma-ket, ~40 ms oraliq bilan). Javob: `{ resent }` — muvaffaqiyatli yuborilganlar soni.
   */
  @Post("resend-unread")
  @HttpCode(200)
  async resendUnread(@Body() body: unknown, @CurrentAdmin() admin: AdminUser): Promise<{ resent: number }> {
    const b = objectBody(body ?? {}, ["kind", "search"]);
    const rawKind = b.kind;
    const rawSearch = b.search;
    if (rawKind !== undefined && typeof rawKind !== "string") throw adminError(400, "Tur noto'g'ri.");
    if (rawSearch !== undefined && typeof rawSearch !== "string") throw adminError(400, "Qidiruv matni noto'g'ri.");
    const kind = oneOf(rawKind, TELEGRAM_MESSAGE_KINDS, "Tur");
    const search = rawSearch?.trim().slice(0, MAX_SEARCH) || undefined;

    const { resent, failed } = await this.log.resendUnread({ kind, search });
    if (resent + failed > 0) {
      const filters = [kind ? `tur: ${KIND_LABELS[kind]}` : "", search ? `qidiruv: "${search}"` : ""].filter(Boolean);
      this.audit.record({
        actor: actorOf(admin),
        action: "telegram.resend_unread",
        entity: "telegram_message",
        entityId: "*",
        entityLabel: filters.length > 0 ? `O'qilmaganlar (${filters.join(", ")})` : "O'qilmaganlar",
        before: "UNREAD",
        after: failed > 0 ? `${resent} ta qayta yuborildi, ${failed} ta yuborilmadi` : `${resent} ta qayta yuborildi`,
        reason: "",
      });
    }
    return { resent };
  }

  /** Bitta xabarni qayta yuborish: 404; 409 — kerak emas yoki bot bloklangan; 502 — Telegram rad etdi. */
  @Post(":id/resend")
  @HttpCode(200)
  async resend(@Param("id") id: string, @CurrentAdmin() admin: AdminUser): Promise<TelegramMessageListItem> {
    const { item, before, ok } = await this.log.resend(id);
    this.audit.record({
      actor: actorOf(admin),
      action: "telegram.resend",
      entity: "telegram_message",
      entityId: item.id,
      entityLabel: `${personName(item)} — ${KIND_LABELS[item.kind]}`,
      before,
      after: item.status,
      reason: "",
    });
    if (!ok) {
      throw adminError(
        502,
        item.failureReason === "BOT_BLOCKED"
          ? "Yuborilmadi: ishtirokchi botni bloklagan."
          : "Telegram'ga yuborib bo'lmadi. Keyinroq qayta urinib ko'ring.",
      );
    }
    return item;
  }
}
