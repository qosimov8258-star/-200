import { Body, Controller, Get, Put, UseGuards } from "@nestjs/common";

import { ApiException } from "../common/api-exception";
import { RulesService } from "../rules/rules.service";
import { AdminTokenGuard } from "./admin-token.guard";

/**
 * Tanlov qoidalarini boshqarish (admin panel → Sozlamalar → Tanlov qoidalari).
 * Kontrakt `apps/admin/src/lib/api.ts` dagi `getContestRules` / `updateContestRules` bilan bir xil.
 */
@Controller("admin/rules")
@UseGuards(AdminTokenGuard)
export class AdminRulesController {
  constructor(private readonly rules: RulesService) {}

  @Get()
  get() {
    return this.rules.get();
  }

  /** Body: `{ sections: [{ title, body }], requireReconsent: boolean }`. */
  @Put()
  update(@Body() body: unknown) {
    if (typeof body !== "object" || body === null) throw new ApiException(400, "SERVER");
    const { sections, requireReconsent, ...rest } = body as Record<string, unknown>;
    if (Object.keys(rest).length > 0 || typeof requireReconsent !== "boolean") {
      throw new ApiException(400, "SERVER");
    }
    // Admin login qurilgach — haqiqiy xodim ismi va audit log yozuvi.
    return this.rules.update(sections, requireReconsent, "Admin");
  }
}
