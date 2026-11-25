import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";

import { ApiException } from "../common/api-exception";
import type { ManualReview, Participant, Reel, ReelRejectReason } from "../participants/participants.service";
import { AuditService } from "../audit/audit.service";
import { StatsService, type ManualDecision } from "../stats/stats.service";
import type { AdminUser } from "./auth/admin-accounts";
import { AdminAuthGuard, CurrentAdmin } from "./auth/admin-auth.guard";
import { actorOf } from "./auth/admin-auth.service";

type ReviewStatus = "OPEN" | "APPROVED" | "REJECTED";

const STATUSES: ReviewStatus[] = ["OPEN", "APPROVED", "REJECTED"];
const REJECT_REASONS: ReelRejectReason[] = ["NOT_FOUND", "NOT_A_VIDEO", "OWNER_TAKEN"];
const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;
const MAX_NOTE_LENGTH = 500;

/**
 * Qo'lda tekshiruv (admin panel → "Qo'lda tekshiruv"). Apify videoni ketma-ket 3 marta
 * topa olmaganda video shu ro'yxatga tushadi; admin linkni ochib tasdiqlaydi yoki rad etadi.
 * Kontrakt `apps/admin/src/lib/types.ts` → ManualReview* tiplari bilan bir xil.
 */
@Controller("admin/manual-reviews")
@UseGuards(AdminAuthGuard)
export class AdminManualReviewController {
  constructor(
    private readonly stats: StatsService,
    private readonly audit: AuditService,
  ) {}

  /** `GET /admin/manual-reviews?status=OPEN|APPROVED|REJECTED&search=&page=&pageSize=` */
  @Get()
  list(
    @Query("status") status?: string,
    @Query("search") search?: string,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
  ) {
    const statusFilter = status ? STATUSES.find((s) => s === status) : undefined;
    if (status && !statusFilter) throw new ApiException(400, "SERVER");
    const term = (search ?? "").trim().toLowerCase().slice(0, 100);

    const all = this.stats
      .manualReviews()
      .map(({ participant, reel, review }) => toItem(participant, reel, review))
      .filter((item) => !term || matches(item, term));

    const statusCounts = {
      ALL: all.length,
      OPEN: all.filter((i) => i.status === "OPEN").length,
      APPROVED: all.filter((i) => i.status === "APPROVED").length,
      REJECTED: all.filter((i) => i.status === "REJECTED").length,
    };

    // Ochiqlar — eng eskisi yuqorida (navbat); qaror qilinganlar — eng yangisi yuqorida.
    const items = all
      .filter((i) => !statusFilter || i.status === statusFilter)
      .sort((a, b) =>
        a.status === "OPEN" && b.status === "OPEN"
          ? a.requestedAt.localeCompare(b.requestedAt)
          : a.status === "OPEN"
            ? -1
            : b.status === "OPEN"
              ? 1
              : (b.decision?.at ?? "").localeCompare(a.decision?.at ?? ""),
      );

    const size = clampInt(pageSize, DEFAULT_PAGE_SIZE, 1, MAX_PAGE_SIZE);
    const lastPage = Math.max(1, Math.ceil(items.length / size));
    const current = clampInt(page, 1, 1, lastPage);
    return {
      items: items.slice((current - 1) * size, current * size),
      total: items.length,
      page: current,
      pageSize: size,
      statusCounts,
    };
  }

  /**
   * `POST /admin/manual-reviews/:id/decision`, `:id` — Reel shortcode.
   * Body: `{ decision: "approve", note? }` yoki `{ decision: "reject", reason, note? }`.
   */
  @Post(":id/decision")
  decide(@Param("id") id: string, @Body() body: unknown, @CurrentAdmin() admin: AdminUser) {
    const decision = parseDecision(body);
    const reel = this.stats.decideManualReview(id, decision, admin.fullName);
    const found = this.stats.manualReviews().find((r) => r.reel === reel);
    if (!found) throw new ApiException(500, "SERVER");
    const item = toItem(found.participant, found.reel, found.review);
    this.audit.record({
      actor: actorOf(admin),
      action: decision.approve ? "reel.approve" : "reel.reject",
      entity: "reel",
      entityId: reel.shortcode,
      entityLabel: `${item.participant.firstName} ${item.participant.lastName} — ${reel.shortcode}`.trim(),
      before: "Qo'lda tekshiruvda",
      after: decision.approve ? "Tasdiqlandi" : `Rad etildi (${decision.reason})`,
      reason: decision.note,
    });
    return item;
  }
}

function toItem(p: Participant, reel: Reel, review: ManualReview) {
  const decision = review.decision;
  return {
    id: reel.shortcode,
    participant: {
      id: String(p.telegramId),
      firstName: p.firstName ?? "",
      lastName: p.lastName ?? "",
      phone: p.phone ?? "",
      status: p.status,
    },
    reelUrl: reel.url,
    shortcode: reel.shortcode,
    kind: review.kind,
    attempts: review.attempts,
    requestedAt: review.requestedAt.toISOString(),
    submittedAt: reel.submittedAt.toISOString(),
    /** Oxirgi o'qilgan ko'rishlar (tasdiqlangandan keyin — joriy ko'rishlar); hali o'qilmagan — null. */
    lastViews: reel.history.at(-1)?.views ?? null,
    /** Ko'rishlar oxirgi marta o'qilgan vaqt; hali o'qilmagan — null. */
    lastSyncedAt: reel.history.at(-1)?.at.toISOString() ?? null,
    owner: reel.owner,
    status: (decision === null ? "OPEN" : decision.approved ? "APPROVED" : "REJECTED") as ReviewStatus,
    decision:
      decision === null
        ? null
        : {
            at: decision.at.toISOString(),
            by: decision.by,
            reason: decision.reason,
            note: decision.note,
          },
  };
}

type Item = ReturnType<typeof toItem>;

function matches(item: Item, term: string): boolean {
  const name = `${item.participant.firstName} ${item.participant.lastName}`.toLowerCase();
  return (
    name.includes(term) ||
    item.participant.phone.includes(term) ||
    item.shortcode.toLowerCase().includes(term) ||
    (item.owner ?? "").includes(term.replace(/^@/, ""))
  );
}

function clampInt(raw: string | undefined, fallback: number, min: number, max: number): number {
  const n = Number.parseInt(raw ?? "", 10);
  return Math.min(max, Math.max(min, Number.isFinite(n) ? n : fallback));
}

/** Noma'lum maydonlar rad etiladi (CLAUDE.md). */
function parseDecision(body: unknown): ManualDecision {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new ApiException(400, "SERVER");
  }
  const { decision, reason, note, ...rest } = body as Record<string, unknown>;
  if (Object.keys(rest).length > 0) throw new ApiException(400, "SERVER");
  if (note !== undefined && (typeof note !== "string" || note.length > MAX_NOTE_LENGTH)) {
    throw new ApiException(400, "SERVER");
  }
  const text = typeof note === "string" ? note.trim() : "";
  if (decision === "approve" && reason === undefined) return { approve: true, note: text };
  if (decision === "reject") {
    const r = REJECT_REASONS.find((x) => x === reason);
    if (r) return { approve: false, reason: r, note: text };
  }
  throw new ApiException(400, "SERVER");
}
