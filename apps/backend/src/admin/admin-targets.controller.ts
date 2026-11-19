import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpException,
  Param,
  Post,
  Query,
  StreamableFile,
  UseGuards,
} from "@nestjs/common";

import { AuditService } from "../audit/audit.service";
import { TargetsService, type TargetAction, type TargetStatusFilter } from "../targets/targets.service";
import type { AdminUser } from "./auth/admin-accounts";
import { AdminAuthGuard, CurrentAdmin } from "./auth/admin-auth.guard";
import { actorOf } from "./auth/admin-auth.service";
/** Javobni shuncha kutamiz (proxy timeout'idan kamroq). */
const CHECK_WAIT_MS = 45_000;
const wait = (ms: number) => new Promise<null>((resolve) => setTimeout(() => resolve(null), ms).unref());

const STATUSES: TargetStatusFilter[] = ["NEW", "WARNED", "DISQUALIFIED", "DISMISSED", "OPEN"];
const ACTIONS: TargetAction[] = ["warn", "disqualify", "dismiss"];

const bad = (message: string) => new HttpException({ message }, 400);

function positiveInt(value: string | undefined, name: string): number | undefined {
  if (value === undefined || value === "") return undefined;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) throw bad(`${name} musbat butun son bo'lishi kerak`);
  return n;
}

/**
 * Target (pullik reklama) holatlari — admin panel "Target yoqqanlar" bo'limi.
 * Kontrakt `apps/admin/src/lib/api.ts` dagi `getTargetCases` / `getTargetCase` / `resolveTargetCase` bilan bir xil.
 */
@Controller("admin/targets")
@UseGuards(AdminAuthGuard)
export class AdminTargetsController {
  constructor(
    private readonly targets: TargetsService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  list(
    @Query("status") status?: string,
    @Query("search") search?: string,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
  ) {
    if (status !== undefined && status !== "" && !STATUSES.includes(status as TargetStatusFilter)) {
      throw bad("Holat noto'g'ri");
    }
    return this.targets.list({
      status: status ? (status as TargetStatusFilter) : undefined,
      search: search?.slice(0, 100),
      page: positiveInt(page, "page"),
      pageSize: positiveInt(pageSize, "pageSize"),
    });
  }

  /** Reklama kutubxonasi: oxirgi tekshiruv natijasi va keyingi rejadagi kun. */
  @Get("check")
  lastCheck() {
    return {
      running: this.targets.isChecking,
      lastCheck: this.targets.lastCheck,
      nextCheckOn: this.targets.nextCheckOn(),
    };
  }

  /** Reklama kutubxonasini hoziroq tekshirish (reyting yetakchilari). Tugashini kutadi. */
  @Post("check")
  @HttpCode(200)
  async check(@CurrentAdmin() admin: AdminUser) {
    const running = this.targets.checkAds("admin");
    // Proxy (Mezon nginx) 60 soniyada uzadi: tekshiruv cho'zilsa, u fonda davom etadi, javob esa
    // "davom etmoqda" bo'ladi — natija keyin "Oxirgi tekshiruv" (`GET /admin/targets/check`) da.
    const report = await Promise.race([running, wait(CHECK_WAIT_MS)]);
    if (report === null) {
      return {
        reason: "admin" as const,
        at: new Date().toISOString(),
        checked: 0,
        found: 0,
        error: "Tekshiruv davom etmoqda — natija bir necha daqiqadan keyin «Oxirgi tekshiruv» da ko'rinadi.",
      };
    }
    this.audit.record({
      actor: actorOf(admin),
      action: "target.check",
      entity: "target_case",
      entityId: "ads-library",
      entityLabel: "Meta reklama kutubxonasi tekshiruvi",
      before: "",
      after: report.error ? `Xato: ${report.error}` : `${report.checked} ta tekshirildi, ${report.found} ta topildi`,
      reason: "",
    });
    return report;
  }

  @Get(":id")
  get(@Param("id") id: string) {
    return this.targets.get(id);
  }

  /** Shikoyat skrinshoti (rasm). Admin panel uni sessiya cookie'si bilan `<img>` orqali ochadi. */
  @Get(":id/attachments/:attachmentId")
  @Header("X-Content-Type-Options", "nosniff")
  @Header("Cache-Control", "private, no-store")
  attachment(@Param("id") id: string, @Param("attachmentId") attachmentId: string) {
    const image = this.targets.attachment(id, attachmentId);
    return new StreamableFile(image.data, { type: image.mime, length: image.data.length, disposition: "inline" });
  }

  /** Body: `{ action: "warn" | "disqualify" | "dismiss", reason }`. Noma'lum maydon rad etiladi. */
  @Post(":id/resolve")
  @HttpCode(200)
  act(@Param("id") id: string, @Body() body: unknown, @CurrentAdmin() admin: AdminUser) {
    if (typeof body !== "object" || body === null || Array.isArray(body)) throw bad("So'rov tanasi noto'g'ri");
    const { action, reason, ...rest } = body as Record<string, unknown>;
    if (Object.keys(rest).length > 0) throw bad(`Noma'lum maydon: ${Object.keys(rest)[0]}`);
    if (!ACTIONS.includes(action as TargetAction)) throw bad("Amal noto'g'ri");
    if (typeof reason !== "string") throw bad("Sabab yozilmagan");
    const before = this.targets.get(id);
    const after = this.targets.act(id, action as TargetAction, reason, admin.fullName);
    this.audit.record({
      actor: actorOf(admin),
      action: `target.${action as TargetAction}`,
      entity: "target_case",
      entityId: id,
      entityLabel: `${after.participant.firstName} ${after.participant.lastName}`.trim(),
      before: before.status,
      after: after.status,
      reason: reason.trim(),
    });
    return after;
  }
}
