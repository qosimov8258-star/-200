import { Body, Controller, Get, HttpCode, Param, Post, Query, UseGuards } from "@nestjs/common";

import { oneOf, searchTerm } from "../admin/admin-http";
import type { OwnerUser } from "./auth/owner-accounts";
import { CurrentOwner, OwnerAuthGuard } from "./auth/owner-auth.guard";
import { RISK_LEVELS, type RiskAccount, type RiskListResponse } from "./owner-types";
import { parseIncludeSafe, parseRiskReview, queryText } from "./owner-validation";
import { OwnerService } from "./owner.service";

/**
 * Ega → Xavfga yaqin hisoblar. Ball qoidalari — `src/owner/risk.ts` (kontrakt:
 * `apps/admin/src/lib/owner-types.ts`). Ega belgisi (SAFE / WATCH) diskda saqlanadi, audit
 * log'ga yozilmaydi.
 */
@Controller("owner/risk")
@UseGuards(OwnerAuthGuard)
export class OwnerRiskController {
  constructor(private readonly owner: OwnerService) {}

  /** `GET /owner/risk?level=&includeSafe=&search=&page=&pageSize=` */
  @Get()
  list(
    @Query("level") level?: unknown,
    @Query("includeSafe") includeSafe?: unknown,
    @Query("search") search?: unknown,
    @Query("page") page?: unknown,
    @Query("pageSize") pageSize?: unknown,
  ): RiskListResponse {
    return this.owner.listRisk({
      level: oneOf(queryText(level), RISK_LEVELS, "Daraja"),
      includeSafe: parseIncludeSafe(queryText(includeSafe)),
      search: searchTerm(queryText(search)),
      page: queryText(page),
      pageSize: queryText(pageSize),
    });
  }

  /** Body: `{ verdict: "SAFE" | "WATCH" | null }` → RiskAccount. */
  @Post(":id/review")
  @HttpCode(200)
  review(@Param("id") id: string, @Body() body: unknown, @CurrentOwner() owner: OwnerUser): RiskAccount {
    return this.owner.review(id, parseRiskReview(body), owner);
  }
}
