import { Body, Controller, Delete, Get, HttpCode, HttpException, Param, Post, Put, UseGuards } from "@nestjs/common";

import { AuditService, type AuditInput } from "../audit/audit.service";
import type { DrawPeriodInput, DrawSettings } from "../draws/draw-rules";
import { DrawsService } from "../draws/draws.service";
import type { AdminUser } from "./auth/admin-accounts";
import { AdminAuthGuard, CurrentAdmin } from "./auth/admin-auth.guard";
import { actorOf } from "./auth/admin-auth.service";

const SETTINGS_FIELDS: Record<keyof DrawSettings, "string" | "number" | "boolean" | "stage" | "basis"> = {
  prizeId: "string",
  stage: "stage",
  periodFrom: "string",
  periodTo: "string",
  dateBasis: "basis",
  minViews: "number",
  maxViews: "number",
  winnersCount: "number",
  reservesCount: "number",
  excludeWarned: "boolean",
  excludeTargets: "boolean",
  excludePreviousWinners: "boolean",
  messageTemplate: "string",
};

const bad = (message: string) => new HttpException({ message }, 400);

function objectOf(body: unknown, allowed: string[]): Record<string, unknown> {
  if (typeof body !== "object" || body === null || Array.isArray(body)) throw bad("So'rov tanasi noto'g'ri.");
  const extra = Object.keys(body).find((k) => !allowed.includes(k));
  if (extra) throw bad(`Noma'lum maydon: ${extra}`);
  return body as Record<string, unknown>;
}

/** Barcha maydonlar majburiy, turi tekshiriladi, noma'lum maydon rad etiladi (CLAUDE.md). */
function parseSettings(body: unknown): DrawSettings {
  const b = objectOf(body, Object.keys(SETTINGS_FIELDS));
  for (const [key, kind] of Object.entries(SETTINGS_FIELDS)) {
    const v = b[key];
    const ok =
      kind === "stage"
        ? v === null || (typeof v === "number" && Number.isInteger(v))
        : kind === "basis"
          ? v === "POSTED" || v === "SUBMITTED"
          : typeof v === kind;
    if (!ok) throw bad(`Maydon noto'g'ri: ${key}`);
  }
  return b as unknown as DrawSettings;
}

/** Davr: faqat `title`, `startsOn`, `endsOn` — hammasi matn. */
function parsePeriod(body: unknown): DrawPeriodInput {
  const b = objectOf(body, ["title", "startsOn", "endsOn"]);
  for (const key of ["title", "startsOn", "endsOn"]) {
    if (typeof b[key] !== "string") throw bad(`Maydon noto'g'ri: ${key}`);
  }
  return b as unknown as DrawPeriodInput;
}

function stageIndex(raw: string): number {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > 100) throw bad("Bosqich raqami noto'g'ri.");
  return n;
}

function parseReason(body: unknown, extra: string[] = []): Record<string, unknown> & { reason: string } {
  const b = objectOf(body, ["reason", ...extra]);
  if (typeof b.reason !== "string") throw bad("Sabab yozilmagan.");
  return b as Record<string, unknown> & { reason: string };
}

/**
 * Oylik voucherlar uchun random tanlov (admin panel → Random tanlov).
 * Kontrakt `apps/admin/src/lib/api.ts` dagi `getDrawSetup` … `sendDraw` bilan bir xil.
 */
@Controller("admin/draws")
@UseGuards(AdminAuthGuard)
export class AdminDrawsController {
  constructor(
    private readonly draws: DrawsService,
    private readonly audit: AuditService,
  ) {}

  @Get("setup")
  setup() {
    return this.draws.setup();
  }

  @Post("preview")
  @HttpCode(200)
  preview(@Body() body: unknown) {
    return this.draws.preview(parseSettings(body));
  }

  @Post()
  run(@Body() body: unknown, @CurrentAdmin() admin: AdminUser) {
    const draw = this.draws.run(parseSettings(body), admin.fullName);
    this.log(admin, "draw.run", draw.id, `#${draw.number} ${draw.prizeTitle}`, {
      after: `${draw.periodFrom} – ${draw.periodTo}: ${draw.winners} g'olib, ${draw.reserves} zaxira`,
    });
    return draw;
  }

  @Get()
  list() {
    return this.draws.list();
  }

  /** Admin yaratgan davrlar (bosqichlardan tashqari). `setup` javobida ham bor. */
  @Get("periods")
  periods() {
    return this.draws.listPeriods();
  }

  @Post("periods")
  createPeriod(@Body() body: unknown, @CurrentAdmin() admin: AdminUser) {
    const period = this.draws.createPeriod(parsePeriod(body), admin.fullName);
    this.log(admin, "draw.period.create", period.id, period.title, {
      after: `${period.startsOn} – ${period.endsOn}`,
    });
    return period;
  }

  @Put("periods/:periodId")
  updatePeriod(@Param("periodId") periodId: string, @Body() body: unknown, @CurrentAdmin() admin: AdminUser) {
    const before = this.draws.listPeriods().find((p) => p.id === periodId);
    const period = this.draws.updatePeriod(periodId, parsePeriod(body), admin.fullName);
    this.log(admin, "draw.period.update", period.id, period.title, {
      before: before ? `${before.title}: ${before.startsOn} – ${before.endsOn}` : "",
      after: `${period.title}: ${period.startsOn} – ${period.endsOn}`,
    });
    return period;
  }

  @Delete("periods/:periodId")
  @HttpCode(204)
  deletePeriod(@Param("periodId") periodId: string, @CurrentAdmin() admin: AdminUser) {
    const before = this.draws.listPeriods().find((p) => p.id === periodId);
    this.draws.deletePeriod(periodId, admin.fullName);
    this.log(admin, "draw.period.delete", periodId, before?.title ?? periodId, {
      before: before ? `${before.startsOn} – ${before.endsOn}` : "",
    });
  }

  /** Bosqichni o'chirish: random tanlovda va Mini App'da ko'rinmaydi, voucherlar jami kamayadi. */
  @Delete("stages/:index")
  @HttpCode(204)
  deleteStage(@Param("index") index: string, @CurrentAdmin() admin: AdminUser) {
    const n = stageIndex(index);
    const stage = this.draws.deleteStage(n, admin.fullName);
    this.log(admin, "draw.stage.delete", `stage-${n}`, `${n}-bosqich`, {
      before: `${stage.startsOn} – ${stage.endsOn}`,
      after: "O'chirildi",
    });
  }

  @Post("stages/:index/restore")
  @HttpCode(204)
  restoreStage(@Param("index") index: string, @CurrentAdmin() admin: AdminUser) {
    const n = stageIndex(index);
    const stage = this.draws.restoreStage(n, admin.fullName);
    this.log(admin, "draw.stage.restore", `stage-${n}`, `${n}-bosqich`, {
      before: "O'chirilgan",
      after: `${stage.startsOn} – ${stage.endsOn}`,
    });
  }

  /** Voucherlar qoldig'i (jami / yuborilgan / tasdiqlangan / qoralamada / qolgan). `:id` dan oldin turishi shart. */
  @Get("stock")
  stock() {
    return this.draws.stock();
  }

  @Get(":id")
  get(@Param("id") id: string) {
    return this.draws.get(id);
  }

  @Post(":id/replace")
  @HttpCode(200)
  replace(@Param("id") id: string, @Body() body: unknown, @CurrentAdmin() admin: AdminUser) {
    const b = parseReason(body, ["participantId"]);
    if (typeof b.participantId !== "string") throw bad("Ishtirokchi ko'rsatilmagan.");
    const draw = this.draws.replace(id, b.participantId, b.reason, admin.fullName);
    this.log(admin, "draw.replace", draw.id, `#${draw.number} ${draw.prizeTitle}`, {
      before: `G'olib: ${b.participantId}`,
      after: "Zaxiradan almashtirildi",
      reason: b.reason,
    });
    return draw;
  }

  @Post(":id/confirm")
  @HttpCode(200)
  confirm(@Param("id") id: string, @CurrentAdmin() admin: AdminUser) {
    const draw = this.draws.confirm(id, admin.fullName);
    this.log(admin, "draw.confirm", draw.id, `#${draw.number} ${draw.prizeTitle}`, {
      before: "Qoralama",
      after: "Tasdiqlandi",
    });
    return draw;
  }

  @Post(":id/cancel")
  @HttpCode(200)
  cancel(@Param("id") id: string, @Body() body: unknown, @CurrentAdmin() admin: AdminUser) {
    const { reason } = parseReason(body);
    const draw = this.draws.cancel(id, reason, admin.fullName);
    this.log(admin, "draw.cancel", draw.id, `#${draw.number} ${draw.prizeTitle}`, { after: "Bekor qilindi", reason });
    return draw;
  }

  /** G'oliblarga Telegram bot orqali (ketma-ket, ~25 xabar/soniya). */
  @Post(":id/send")
  @HttpCode(200)
  async send(@Param("id") id: string, @CurrentAdmin() admin: AdminUser) {
    const draw = await this.draws.send(id, admin.fullName);
    this.log(admin, "draw.send", draw.id, `#${draw.number} ${draw.prizeTitle}`, {
      after: `${draw.delivery.sent} ta yuborildi, ${draw.delivery.failed} ta xato`,
    });
    return draw;
  }

  private log(
    admin: AdminUser,
    action: string,
    entityId: string,
    entityLabel: string,
    details: Partial<Pick<AuditInput, "before" | "after" | "reason">>,
  ): void {
    this.audit.record({
      actor: actorOf(admin),
      action,
      entity: "voucher_draw",
      entityId,
      entityLabel,
      before: details.before ?? "",
      after: details.after ?? "",
      reason: details.reason ?? "",
    });
  }
}
