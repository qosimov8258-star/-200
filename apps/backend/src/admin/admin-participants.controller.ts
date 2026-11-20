import { Body, Controller, Get, HttpCode, Param, Post, Query, UseGuards } from "@nestjs/common";

import { AuditService } from "../audit/audit.service";
import { ParticipantsService, type Participant } from "../participants/participants.service";
import {
  ACTION_ALLOWED_FROM,
  PARTICIPANT_SORTS,
  PARTICIPANT_STATUSES,
  REEL_FILTERS,
  SORT_ORDERS,
  adminStatus,
  isListed,
  listParticipants,
  participantContext,
  toParticipantItem,
  toParticipantReels,
  type ParticipantAction,
  type ParticipantContext,
  type ParticipantListItem,
  type ParticipantReels,
  type StatusCounts,
} from "../reports/participants";
import { StatsService } from "../stats/stats.service";
import { TargetsService } from "../targets/targets.service";
import { adminError, objectBody, oneOf, paginate, requiredText, searchTerm, type Page } from "./admin-http";
import type { AdminUser } from "./auth/admin-accounts";
import { AdminAuthGuard, CurrentAdmin } from "./auth/admin-auth.guard";
import { actorOf } from "./auth/admin-auth.service";

const DEFAULT_PAGE_SIZE = 20;
const REASON_MIN = 5;
const REASON_MAX = 500;
const TELEGRAM_ID = /^\d{1,16}$/;

const MAX_VIEWS_FILTER = 1_000_000_000_000;

/** Ko'rishlar oralig'i: manfiy bo'lmagan butun sonlar, "dan" "gacha"dan katta emas. */
function viewsRange(min: string | undefined, max: string | undefined): { minViews?: number; maxViews?: number } {
  const parse = (raw: string | undefined, name: string): number | undefined => {
    if (raw === undefined || raw.trim() === "") return undefined;
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 0 || n > MAX_VIEWS_FILTER) throw adminError(400, `${name} manfiy bo'lmagan butun son bo'lishi kerak.`);
    return n;
  };
  const minViews = parse(min, "Ko'rishlar (dan)");
  const maxViews = parse(max, "Ko'rishlar (gacha)");
  if (minViews !== undefined && maxViews !== undefined && minViews > maxViews) {
    throw adminError(400, "Ko'rishlar oralig'i noto'g'ri: «dan» «gacha»dan katta.");
  }
  return { minViews, maxViews };
}

/** Query qiymati — faqat bitta matn (`?a=1&a=2` yoki `?a[b]=1` rad etiladi). */
function queryText(value: unknown): string | undefined {
  if (value === undefined || typeof value === "string") return value;
  throw adminError(400, "So'rov parametrlari noto'g'ri.");
}

/**
 * Ishtirokchilar (admin panel → Foydalanuvchilar): ro'yxat, ishtirokchining barcha videolari,
 * bloklash, blokdan chiqarish, diskvalifikatsiya. Kontrakt — `apps/admin/src/lib/api.ts` dagi
 * `getParticipants`, `getParticipantReels`, `blockParticipant`, `unblockParticipant`,
 * `disqualifyParticipant`. Faqat ADMIN.
 *
 * Har bir amal audit logga yoziladi (sabab majburiy). Ishtirokchiga bot orqali xabar
 * hozircha yuborilmaydi. Ism, familiya va yoshni o'zgartiruvchi endpoint yo'q (CLAUDE.md).
 */
@Controller("admin/participants")
@UseGuards(AdminAuthGuard)
export class AdminParticipantsController {
  constructor(
    private readonly participants: ParticipantsService,
    private readonly stats: StatsService,
    private readonly targets: TargetsService,
    private readonly audit: AuditService,
  ) {}

  /** `GET /admin/participants?search=&status=&reel=&minViews=&maxViews=&sort=&order=&page=&pageSize=` */
  @Get()
  list(
    @Query("search") search?: unknown,
    @Query("status") status?: unknown,
    @Query("reel") reel?: unknown,
    @Query("minViews") minViews?: unknown,
    @Query("maxViews") maxViews?: unknown,
    @Query("sort") sort?: unknown,
    @Query("order") order?: unknown,
    @Query("page") page?: unknown,
    @Query("pageSize") pageSize?: unknown,
  ): Page<ParticipantListItem> & { statusCounts: StatusCounts } {
    const result = listParticipants(this.participants.all(), this.context(), {
      search: searchTerm(queryText(search)),
      status: oneOf(queryText(status), PARTICIPANT_STATUSES, "Holat"),
      reel: oneOf(queryText(reel), REEL_FILTERS, "Video holati"),
      ...viewsRange(queryText(minViews), queryText(maxViews)),
      sort: oneOf(queryText(sort), PARTICIPANT_SORTS, "Saralash"),
      order: oneOf(queryText(order), SORT_ORDERS, "Tartib"),
    });
    return {
      ...paginate(result.items, queryText(page), queryText(pageSize), DEFAULT_PAGE_SIZE),
      statusCounts: result.statusCounts,
    };
  }

  /** `GET /admin/participants/:id/reels` — ishtirokchi yuborgan barcha videolar (eng yangisi birinchi). */
  @Get(":id/reels")
  reels(@Param("id") id: string): ParticipantReels {
    return toParticipantReels(this.find(id));
  }

  /** Bloklash: ilovaga kira olmaydi, reytingdan chiqadi. Body: `{ reason }`. */
  @Post(":id/block")
  @HttpCode(200)
  block(@Param("id") id: string, @Body() body: unknown, @CurrentAdmin() admin: AdminUser): ParticipantListItem {
    return this.act(id, "block", body, admin);
  }

  /** Blokdan chiqarish. Body: `{ reason }`. */
  @Post(":id/unblock")
  @HttpCode(200)
  unblock(@Param("id") id: string, @Body() body: unknown, @CurrentAdmin() admin: AdminUser): ParticipantListItem {
    return this.act(id, "unblock", body, admin);
  }

  /** Diskvalifikatsiya (tanlovdan chetlatish) — qaytarib bo'lmaydi. Body: `{ reason }`. */
  @Post(":id/disqualify")
  @HttpCode(200)
  disqualify(@Param("id") id: string, @Body() body: unknown, @CurrentAdmin() admin: AdminUser): ParticipantListItem {
    return this.act(id, "disqualify", body, admin);
  }

  /** Tekshiruv tartibi (mock bilan bir xil): sabab → ishtirokchi bormi → holat mosmi. */
  private act(id: string, action: ParticipantAction, body: unknown, admin: AdminUser): ParticipantListItem {
    const reason = requiredText(objectBody(body, ["reason"]).reason, "Sabab", REASON_MIN, REASON_MAX);
    const p = this.find(id);
    const before = adminStatus(p, this.context().warned);
    if (!ACTION_ALLOWED_FROM[action].includes(p.status)) {
      throw adminError(409, "Bu amalni ishtirokchining hozirgi holatida bajarib bo'lmaydi.");
    }

    if (action === "block") this.participants.block(p.telegramId);
    else if (action === "unblock") this.participants.unblock(p.telegramId);
    else this.participants.disqualify(p.telegramId);

    // Bloklash/chetlatishdan keyin reyting o'zgaradi — kontekst qaytadan hisoblanadi.
    const item = toParticipantItem(p, this.context());
    this.audit.record({
      actor: actorOf(admin),
      action: `participant.${action}`,
      entity: "participant",
      entityId: item.id,
      entityLabel: `${item.firstName} ${item.lastName}`.trim(),
      before,
      after: item.status,
      reason,
    });
    return item;
  }

  /** `:id` — Telegram ID. Profilini to'ldirmaganlar ro'yxatda yo'q — ular ham "topilmadi". */
  private find(id: string): Participant {
    const telegramId = TELEGRAM_ID.test(id) ? Number(id) : Number.NaN;
    const p = Number.isSafeInteger(telegramId) ? this.participants.get(telegramId) : null;
    if (!p || !isListed(p)) throw adminError(404, "Ishtirokchi topilmadi.", "NOT_FOUND");
    return p;
  }

  private context(): ParticipantContext {
    return participantContext(this.stats.ranking(), this.targets.allCases());
  }
}
