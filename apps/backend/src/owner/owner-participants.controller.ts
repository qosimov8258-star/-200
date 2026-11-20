import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Query, UseGuards } from "@nestjs/common";

import { oneOf, searchTerm } from "../admin/admin-http";
import { OwnerAuthGuard } from "./auth/owner-auth.guard";
import {
  OWNER_PARTICIPANT_FILTERS,
  type OwnerParticipant,
  type OwnerParticipantListResponse,
} from "./owner-types";
import { parseParticipantUpdate, queryText } from "./owner-validation";
import { OwnerService } from "./owner.service";

/**
 * Ega → Ishtirokchilar. Kontrakt — `apps/admin/src/lib/owner-types.ts` (Ishtirokchilar).
 * Audit log'ga yozilmaydi; ishtirokchiga bot xabari yuborilmaydi.
 */
@Controller("owner/participants")
@UseGuards(OwnerAuthGuard)
export class OwnerParticipantsController {
  constructor(private readonly owner: OwnerService) {}

  /** `GET /owner/participants?search=&status=&page=&pageSize=` — `status`: holat yoki INCOMPLETE. */
  @Get()
  list(
    @Query("search") search?: unknown,
    @Query("status") status?: unknown,
    @Query("page") page?: unknown,
    @Query("pageSize") pageSize?: unknown,
  ): OwnerParticipantListResponse {
    return this.owner.listParticipants({
      search: searchTerm(queryText(search)),
      status: oneOf(queryText(status), OWNER_PARTICIPANT_FILTERS, "Holat"),
      page: queryText(page),
      pageSize: queryText(pageSize),
    });
  }

  /** Body: `OwnerParticipantUpdate`. 400 — noma'lum maydon / bo'sh body; 404; 409 — telefon band; 422. */
  @Patch(":id")
  update(@Param("id") id: string, @Body() body: unknown): OwnerParticipant {
    return this.owner.updateParticipant(id, parseParticipantUpdate(body));
  }

  /** Ishtirokchi va uning videosi butunlay o'chadi. */
  @Delete(":id")
  @HttpCode(204)
  remove(@Param("id") id: string): void {
    this.owner.deleteParticipant(id);
  }
}
