import { Body, Controller, Delete, Get, Headers, HttpCode, Put, UseGuards } from "@nestjs/common";

import { AuditService } from "../audit/audit.service";
import { ApiException } from "../common/api-exception";
import { MAX_RULES_VIDEO_BYTES, RulesVideoService, type RulesVideo } from "../rules/rules-video.service";
import { RulesService } from "../rules/rules.service";
import { adminError } from "./admin-http";
import type { AdminUser } from "./auth/admin-accounts";
import { AdminAuthGuard, CurrentAdmin } from "./auth/admin-auth.guard";
import { actorOf } from "./auth/admin-auth.service";

/**
 * Tanlov qoidalarini boshqarish (admin panel → Sozlamalar → Tanlov qoidalari).
 * Kontrakt `apps/admin/src/lib/api.ts` dagi `getContestRules` / `updateContestRules` bilan bir xil.
 */
@Controller("admin/rules")
@UseGuards(AdminAuthGuard)
export class AdminRulesController {
  constructor(
    private readonly rules: RulesService,
    private readonly video: RulesVideoService,
    private readonly audit: AuditService,
  ) {}

  /** `GET /admin/rules/video` — qoida videosi (yo'q bo'lsa — null). */
  @Get("video")
  getVideo(): RulesVideo | null {
    return this.video.get();
  }

  /**
   * `PUT /admin/rules/video` — so'rov tanasi videoning o'zi (raw), turi `Content-Type` da
   * (`main.ts` dagi raw body parser). Eskisi almashtiriladi. Mini App'da qoidalar tepasida chiqadi.
   */
  @Put("video")
  uploadVideo(
    @Headers("content-type") contentType: string | undefined,
    @Body() body: unknown,
    @CurrentAdmin() admin: AdminUser,
  ): RulesVideo {
    const file = this.video.check(contentType, body);
    if (file === "TOO_LARGE") {
      throw adminError(413, `Video ${MAX_RULES_VIDEO_BYTES / 1024 / 1024} MB dan katta bo'lmasin.`, "RULES_VIDEO_TOO_LARGE");
    }
    if (file === "INVALID") {
      throw adminError(422, "Faqat video yuklash mumkin: MP4, MOV yoki WebM.", "RULES_VIDEO_INVALID");
    }
    const before = this.video.get();
    const after = this.video.set(file, admin.fullName);
    this.audit.record({
      actor: actorOf(admin),
      action: "settings.rules_video",
      entity: "settings",
      entityId: "rules-video",
      entityLabel: "Qoida videosi",
      before: before ? `${before.mime}, ${before.sizeBytes} bayt` : "",
      after: `${after.mime}, ${after.sizeBytes} bayt`,
      reason: "",
    });
    return after;
  }

  /** `DELETE /admin/rules/video` — videoni o'chirish (bo'lmasa ham 204). */
  @Delete("video")
  @HttpCode(204)
  deleteVideo(@CurrentAdmin() admin: AdminUser): void {
    const removed = this.video.remove();
    if (!removed) return;
    this.audit.record({
      actor: actorOf(admin),
      action: "settings.rules_video_delete",
      entity: "settings",
      entityId: "rules-video",
      entityLabel: "Qoida videosi",
      before: `${removed.mime}, ${removed.sizeBytes} bayt`,
      after: "",
      reason: "",
    });
  }

  @Get()
  get() {
    return this.rules.get();
  }

  /** Body: `{ sections: [{ title, body }], requireReconsent: boolean }`. */
  @Put()
  update(@Body() body: unknown, @CurrentAdmin() admin: AdminUser) {
    if (typeof body !== "object" || body === null) throw new ApiException(400, "SERVER");
    const { sections, requireReconsent, ...rest } = body as Record<string, unknown>;
    if (Object.keys(rest).length > 0 || typeof requireReconsent !== "boolean") {
      throw new ApiException(400, "SERVER");
    }
    const before = this.rules.get();
    const after = this.rules.update(sections, requireReconsent, admin.fullName);
    if (after !== before) {
      this.audit.record({
        actor: actorOf(admin),
        action: "settings.rules",
        entity: "settings",
        entityId: "rules",
        entityLabel: "Tanlov qoidalari",
        before: `v${before.version}, ${before.sections.length} bo'lim`,
        after: `v${after.version}, ${after.sections.length} bo'lim${requireReconsent ? " (qayta rozilik so'raladi)" : ""}`,
        reason: "",
      });
    }
    return after;
  }
}
