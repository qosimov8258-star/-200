import { Body, Controller, Get, Put, UseGuards } from "@nestjs/common";

import { AuditService } from "../audit/audit.service";
import { ApiException } from "../common/api-exception";
import { RulesService } from "../rules/rules.service";
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
    private readonly audit: AuditService,
  ) {}

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
