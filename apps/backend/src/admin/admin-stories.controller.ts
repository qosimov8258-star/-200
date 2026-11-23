import { Body, Controller, Get, HttpCode, Param, Post, Query, UseGuards } from "@nestjs/common";

import { AuditService } from "../audit/audit.service";
import { StoriesService, type AdminStoryItem } from "../stories/stories.service";
import { adminError, objectBody, paginate, requiredText, type Page } from "./admin-http";
import type { AdminUser } from "./auth/admin-accounts";
import { AdminAuthGuard, CurrentAdmin } from "./auth/admin-auth.guard";
import { actorOf } from "./auth/admin-auth.service";

const DEFAULT_PAGE_SIZE = 24;
const REASON_MIN = 5;
const REASON_MAX = 500;

/** Query qiymati — faqat bitta matn (`?a=1&a=2` yoki `?a[b]=1` rad etiladi). */
function queryText(value: unknown): string | undefined {
  if (value === undefined || typeof value === "string") return value;
  throw adminError(400, "So'rov parametrlari noto'g'ri.");
}

/**
 * Admin panel → Istoriyalar: ishtirokchilar joylagan faol istoriyalar va ularni o'chirish
 * (nomaqbul video). Faqat ADMIN. O'chirish audit logga yoziladi (sabab majburiy).
 * Videoni ko'rish — ochiq `GET /miniapp/stories/:id/video` orqali.
 */
@Controller("admin/stories")
@UseGuards(AdminAuthGuard)
export class AdminStoriesController {
  constructor(
    private readonly stories: StoriesService,
    private readonly audit: AuditService,
  ) {}

  /** `GET /admin/stories?page=&pageSize=` — faol istoriyalar, eng yangisi birinchi. */
  @Get()
  list(@Query("page") page?: unknown, @Query("pageSize") pageSize?: unknown): Page<AdminStoryItem> {
    return paginate(this.stories.adminList(), queryText(page), queryText(pageSize), DEFAULT_PAGE_SIZE);
  }

  /** `POST /admin/stories/:id/remove` — body `{ reason }`. */
  @Post(":id/remove")
  @HttpCode(204)
  remove(@Param("id") id: string, @Body() body: unknown, @CurrentAdmin() admin: AdminUser): void {
    const reason = requiredText(objectBody(body, ["reason"]).reason, "Sabab", REASON_MIN, REASON_MAX);
    const removed = this.stories.adminRemove(id);
    if (!removed) throw adminError(404, "Istoriya topilmadi yoki muddati o'tgan.", "NOT_FOUND");
    this.audit.record({
      actor: actorOf(admin),
      action: "story.remove",
      entity: "story",
      entityId: id,
      entityLabel: removed.fullName,
      before: "Faol",
      after: "O'chirilgan",
      reason,
    });
  }
}
