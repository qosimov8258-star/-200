import { Body, Controller, Get, Put, UseGuards } from "@nestjs/common";

import { AuditService } from "../audit/audit.service";
import { contestDay } from "../common/time";
import { ContestSettingsService, type ContestSettings } from "../contest/contest-settings.service";
import { adminError, objectBody } from "./admin-http";
import type { AdminUser } from "./auth/admin-accounts";
import { AdminAuthGuard, CurrentAdmin } from "./auth/admin-auth.guard";
import { actorOf } from "./auth/admin-auth.service";

const FIELDS = ["startsOn", "endsOn", "syncTime", "syncEveryDays", "minAge"] as const;

const period = (days: number) => (days === 1 ? "har kuni" : days === 7 ? "haftada bir" : `har ${days} kunda`);
const describe = (s: ContestSettings) =>
  `${s.startsOn} – ${s.endsOn}, yig'ish ${period(s.syncEveryDays)} ${s.syncTime}, ${s.minAge}+ yosh`;

/**
 * Tanlov sozlamalari (admin panel → Sozlamalar): muddat, ko'rishlar yig'iladigan vaqt va davri,
 * minimal yosh.
 * Kontrakt — `apps/admin/src/lib/api.ts` (`getContestSettings`, `updateContestSettings`).
 */
@Controller("admin/settings")
@UseGuards(AdminAuthGuard)
export class AdminSettingsController {
  constructor(
    private readonly contest: ContestSettingsService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  get() {
    return this.response();
  }

  /** Body: `{ startsOn, endsOn, syncTime, syncEveryDays, minAge }` — hammasi majburiy. */
  @Put()
  update(@Body() body: unknown, @CurrentAdmin() admin: AdminUser) {
    const b = objectBody(body, FIELDS);
    const { startsOn, endsOn, syncTime, syncEveryDays, minAge } = b;
    if (
      typeof startsOn !== "string" ||
      typeof endsOn !== "string" ||
      typeof syncTime !== "string" ||
      typeof syncEveryDays !== "number" ||
      typeof minAge !== "number"
    ) {
      throw adminError(400, "Barcha maydonlarni to'ldiring.");
    }
    const before = this.contest.get();
    const after = this.contest.update({ startsOn, endsOn, syncTime, syncEveryDays, minAge }, admin.fullName);
    if (describe(before) !== describe(after)) {
      this.audit.record({
        actor: actorOf(admin),
        action: "settings.update",
        entity: "settings",
        entityId: "contest",
        entityLabel: "Tanlov sozlamalari",
        before: describe(before),
        after: describe(after),
        reason: "",
      });
    }
    return this.response();
  }

  private response() {
    const now = new Date();
    return { settings: this.contest.get(), contestStarted: this.contest.started(now), today: contestDay(now) };
  }
}
