import { Controller, Get, Query, UseGuards } from "@nestjs/common";

import { AUDIT_ENTITIES, AuditService } from "../audit/audit.service";
import { oneOf } from "./admin-http";
import { AdminAuthGuard } from "./auth/admin-auth.guard";

const ROLES = ["ADMIN", "SUPPORT"] as const;

/** Audit log (admin panel → Audit log). Faqat o'qish. */
@Controller("admin/audit-log")
@UseGuards(AdminAuthGuard)
export class AdminAuditController {
  constructor(private readonly audit: AuditService) {}

  /** `GET /admin/audit-log?search=&entity=&actorRole=&page=&pageSize=` */
  @Get()
  list(
    @Query("search") search?: string,
    @Query("entity") entity?: string,
    @Query("actorRole") actorRole?: string,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
  ) {
    const toInt = (v: string | undefined) => (v ? Number.parseInt(v, 10) || undefined : undefined);
    return this.audit.list({
      search: search?.slice(0, 100),
      entity: oneOf(entity, AUDIT_ENTITIES, "Obyekt turi"),
      actorRole: oneOf(actorRole, ROLES, "Rol"),
      page: toInt(page),
      pageSize: toInt(pageSize),
    });
  }
}
