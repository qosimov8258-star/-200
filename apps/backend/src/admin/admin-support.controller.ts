import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  StreamableFile,
  UseGuards,
} from "@nestjs/common";

import { AuditService } from "../audit/audit.service";
import { ParticipantsService, type Participant } from "../participants/participants.service";
import {
  SUPPORT_STATUS_FILTERS,
  SupportService,
  TICKET_STATUSES,
  type SupportTicket,
  type SupportTicketDetail,
  type TicketStatus,
} from "../support/support.service";
import { failureReasonOf } from "../telegram/message-log.service";
import { ParticipantNotifier } from "../telegram/notifier";
import { TelegramService } from "../telegram/telegram.service";
import { texts } from "../telegram/texts";
import { adminError, objectBody, oneOf, paginate } from "./admin-http";
import type { AdminUser } from "./auth/admin-accounts";
import { AdminAuthGuard, AdminRoles, CurrentAdmin } from "./auth/admin-auth.guard";
import { actorOf } from "./auth/admin-auth.service";

/** Javob uzunligi (Telegram xabari 4096 belgigacha — "Support javobi" sarlavhasi bilan sig'adi). */
const MAX_REPLY_LENGTH = 4000;
const MAX_SEARCH = 100;

/**
 * Support murojaatlari (admin panel → "Support"): ADMIN va SUPPORT. Javob bot orqali
 * ishtirokchiga yuboriladi (Telegram jurnalida — SUPPORT_REPLY) va yozishmada (ilova/sayt)
 * ko'rinadi. Kontrakt `apps/admin/src/lib/api.ts` dagi `getSupportTickets` … `updateSupportTicketStatus`.
 */
@Controller("admin/support/tickets")
@UseGuards(AdminAuthGuard)
@AdminRoles("ADMIN", "SUPPORT")
export class AdminSupportController {
  constructor(
    private readonly support: SupportService,
    private readonly participants: ParticipantsService,
    private readonly notifier: ParticipantNotifier,
    private readonly telegram: TelegramService,
    private readonly audit: AuditService,
  ) {}

  /** `GET /admin/support/tickets?status=NEW|IN_PROGRESS|CLOSED|OPEN&search=&page=&pageSize=` */
  @Get()
  list(
    @Query("status") status?: string,
    @Query("search") search?: string,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
  ) {
    const { rows, statusCounts } = this.support.adminList(
      { status: oneOf(status, SUPPORT_STATUS_FILTERS, "Holat"), search: search?.slice(0, MAX_SEARCH) },
      this.lookup,
    );
    return { ...paginate(rows, page, pageSize), statusCounts };
  }

  @Get(":id")
  get(@Param("id") id: string): SupportTicketDetail {
    return this.support.adminDetail(id, this.lookup);
  }

  /** Ishtirokchi yuborgan rasm — bot orqali Telegram'dan olinadi (saqlanmaydi, keshlanmaydi). */
  @Get(":id/attachments/:attachmentId")
  @Header("X-Content-Type-Options", "nosniff")
  @Header("Cache-Control", "private, no-store")
  async attachment(@Param("id") id: string, @Param("attachmentId") attachmentId: string): Promise<StreamableFile> {
    const fileId = this.support.attachmentFileId(id, attachmentId);
    const file = await this.telegram.downloadFile(fileId);
    if (!file) throw adminError(502, "Rasmni Telegram'dan olib bo'lmadi. Keyinroq qayta urinib ko'ring.");
    return new StreamableFile(file.data, {
      type: file.mime,
      length: file.data.length,
      disposition: file.mime.startsWith("image/") ? "inline" : "attachment",
    });
  }

  /**
   * Body: `{ text }` (1–4000 belgi). Avval bot orqali yuboriladi; yetkazilmasa — 409/502 va
   * javob saqlanmaydi. Yopilgan murojaatga — 409.
   */
  @Post(":id/messages")
  @HttpCode(200)
  async reply(@Param("id") id: string, @Body() body: unknown, @CurrentAdmin() admin: AdminUser): Promise<SupportTicketDetail> {
    const raw = objectBody(body, ["text"]).text;
    if (typeof raw !== "string" || !raw.trim()) throw adminError(400, "Javob matnini yozing.");
    const text = raw.trim();
    if (text.length > MAX_REPLY_LENGTH) throw adminError(400, `Javob ${MAX_REPLY_LENGTH} belgidan oshmasligi kerak.`);

    const { ticket, before } = await this.support.replyAsStaff(id, text, admin.fullName, (t) => this.deliver(t, text));
    this.record(admin, "support.reply", ticket, before, ticket.status, text.slice(0, 200));
    return this.support.adminDetail(ticket.id, this.lookup);
  }

  /** Body: `{ status: "NEW" | "IN_PROGRESS" | "CLOSED" }`. */
  @Patch(":id/status")
  setStatus(@Param("id") id: string, @Body() body: unknown, @CurrentAdmin() admin: AdminUser): SupportTicketDetail {
    const raw = objectBody(body, ["status"]).status;
    const status = TICKET_STATUSES.find((s) => s === raw);
    if (!status) throw adminError(400, "Holat noto'g'ri.");
    const { ticket, before } = this.support.setStatus(id, status);
    if (before !== status) this.record(admin, "support.status", ticket, before, status, "");
    return this.support.adminDetail(ticket.id, this.lookup);
  }

  // -------------------------------------------------------------------------

  private readonly lookup = (telegramId: number): Participant | null => this.participants.get(telegramId);

  private async deliver(ticket: SupportTicket, text: string): Promise<void> {
    const p = this.participants.get(ticket.telegramId);
    if (!p?.chatId) throw adminError(409, "Ishtirokchi bot bilan chat ochmagan — javobni yuborib bo'lmaydi.");
    try {
      await this.notifier.notify(p.chatId, texts.operatorPrefix + text, "SUPPORT_REPLY");
    } catch (err) {
      if (failureReasonOf(err) === "BOT_BLOCKED") {
        throw adminError(409, "Ishtirokchi botni bloklagan — javob yetkazilmadi.");
      }
      throw adminError(502, "Javobni Telegram orqali yuborib bo'lmadi. Keyinroq qayta urinib ko'ring.");
    }
  }

  private record(
    admin: AdminUser,
    action: "support.reply" | "support.status",
    ticket: SupportTicket,
    before: TicketStatus,
    after: TicketStatus,
    reason: string,
  ): void {
    const p = this.participants.get(ticket.telegramId);
    const name = p ? `${p.firstName ?? ""} ${p.lastName ?? ""}`.trim() : "";
    this.audit.record({
      actor: actorOf(admin),
      action,
      entity: "support_ticket",
      entityId: String(ticket.id),
      entityLabel: `#${ticket.id} — ${name || `ID ${ticket.telegramId}`}`,
      before,
      after,
      reason,
    });
  }
}
