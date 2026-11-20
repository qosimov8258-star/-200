import { Body, Controller, Get, Param, Patch, Query, UseGuards } from "@nestjs/common";

import { oneOf, searchTerm } from "../admin/admin-http";
import type { TargetStatusFilter } from "../targets/targets.service";
import { OwnerAuthGuard } from "./auth/owner-auth.guard";
import { TARGET_CASE_STATUSES } from "./owner-types";
import { parseTargetUpdate, queryText } from "./owner-validation";
import { OwnerService } from "./owner.service";

const STATUS_FILTERS: readonly TargetStatusFilter[] = [...TARGET_CASE_STATUSES, "OPEN"];

/** Sahifa raqami: musbat butun son; aks holda — standart (xizmat o'zi chegaralaydi). */
function pageNumber(value: string | undefined): number | undefined {
  const n = Number.parseInt(value ?? "", 10);
  return Number.isFinite(n) && n >= 1 ? n : undefined;
}

/**
 * Ega → Target holatlari: istalgan holatga (admin bo'limidagi cheklovlarsiz, qaytarish ham).
 * Kontrakt — `apps/admin/src/lib/owner-types.ts` (Target holatlari). Audit log'ga yozilmaydi,
 * bot xabari yuborilmaydi.
 */
@Controller("owner/targets")
@UseGuards(OwnerAuthGuard)
export class OwnerTargetsController {
  constructor(private readonly owner: OwnerService) {}

  /** `GET /owner/targets?status=&search=&page=&pageSize=` — `status` berilmasa, hammasi. */
  @Get()
  list(
    @Query("status") status?: unknown,
    @Query("search") search?: unknown,
    @Query("page") page?: unknown,
    @Query("pageSize") pageSize?: unknown,
  ) {
    return this.owner.listTargets({
      status: oneOf(queryText(status), STATUS_FILTERS, "Holat"),
      search: searchTerm(queryText(search)),
      page: pageNumber(queryText(page)),
      pageSize: pageNumber(queryText(pageSize)),
    });
  }

  /** Body: `{ status, note? }` → TargetCaseListItem. */
  @Patch(":id")
  update(@Param("id") id: string, @Body() body: unknown) {
    return this.owner.updateTarget(id, parseTargetUpdate(body));
  }
}
