import { Body, Controller, Get, HttpCode, Post, Query, UseGuards } from "@nestjs/common";

import { AuditService } from "../audit/audit.service";
import { ParticipantsService } from "../participants/participants.service";
import { effectiveRange, refreshCandidates, type RefreshRange } from "../reports/views-refresh";
import { StatsService } from "../stats/stats.service";
import type { AdminUser } from "./auth/admin-accounts";
import { AdminAuthGuard, CurrentAdmin } from "./auth/admin-auth.guard";
import { actorOf } from "./auth/admin-auth.service";
import { adminError, objectBody } from "./admin-http";

const MAX_VIEWS = 1_000_000_000_000;

/** Ko'rishlar chegarasi: null yoki manfiy bo'lmagan butun son. */
function viewsBound(value: unknown, name: string): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "string" ? Number(value) : value;
  if (typeof n !== "number" || !Number.isInteger(n) || n < 0 || n > MAX_VIEWS) {
    throw adminError(400, `${name} manfiy bo'lmagan butun son bo'lishi kerak.`);
  }
  return n;
}

function parseRange(minViews: unknown, maxViews: unknown, includeNear: unknown): RefreshRange {
  const range: RefreshRange = {
    minViews: viewsBound(minViews, "Ko'rishlar (dan)"),
    maxViews: viewsBound(maxViews, "Ko'rishlar (gacha)"),
    includeNear: includeNear === true || includeNear === "true" || includeNear === "1",
  };
  if (range.minViews !== null && range.maxViews !== null && range.minViews > range.maxViews) {
    throw adminError(400, "Ko'rishlar oralig'i noto'g'ri: «dan» «gacha»dan katta.");
  }
  return range;
}

const rangeLabel = ({ minViews, maxViews }: RefreshRange) =>
  `${minViews ?? 0} – ${maxViews === null ? "∞" : maxViews} ko'rish`;

/**
 * Ko'rishlar va videolar (admin panel → Videolar / Reyting).
 *
 * Ko'rishlarni qo'lda o'zgartiruvchi endpoint YO'Q (CLAUDE.md) — admin faqat
 * yig'ishni navbatdan tashqari ishga tushira oladi.
 */
@Controller("admin")
@UseGuards(AdminAuthGuard)
export class AdminStatsController {
  constructor(
    private readonly participants: ParticipantsService,
    private readonly stats: StatsService,
    private readonly audit: AuditService,
  ) {}

  /** Yig'ish jadvali, oxirgi natija va videolar soni holatlar bo'yicha. */
  @Get("stats")
  status() {
    return this.stats.status();
  }

  /** Ko'rishlarni hoziroq yig'ish. Fon rejimida ishlaydi; natija — `GET /admin/stats`. */
  @Post("stats/sync")
  @HttpCode(202)
  sync(@CurrentAdmin() admin: AdminUser) {
    const alreadyRunning = this.stats.isSyncing;
    if (!alreadyRunning) {
      this.audit.record({
        actor: actorOf(admin),
        action: "stats.sync",
        entity: "reel",
        entityId: "all",
        entityLabel: "Ko'rishlarni yig'ish",
        before: "",
        after: "Qo'lda boshlandi",
        reason: "",
      });
    }
    void this.stats.syncAll("admin");
    return { started: !alreadyRunning, running: true };
  }

  /**
   * "Ko'rishlarni yangilash" oynasi: oraliq bo'yicha nechta video yangilanadi, oxirgi umumiy yig'ish
   * va oxirgi yangilash natijasi. `GET /admin/stats/refresh?minViews=&maxViews=&includeNear=true`
   */
  @Get("stats/refresh")
  refreshPreview(
    @Query("minViews") minViews?: string,
    @Query("maxViews") maxViews?: string,
    @Query("includeNear") includeNear?: string,
  ) {
    const range = parseRange(minViews, maxViews, includeNear);
    const report = this.stats.lastRefreshReport;
    return {
      count: refreshCandidates(this.participants.all(), range).length,
      range: effectiveRange(range),
      lastSyncAt: this.stats.status().lastSuccessAt,
      running: this.stats.isRefreshing || this.stats.isSyncing,
      lastReport: report && {
        startedAt: report.startedAt.toISOString(),
        finishedAt: report.finishedAt?.toISOString() ?? null,
        requested: report.requested,
        updated: report.updated,
        missing: report.missing,
        error: report.error,
      },
    };
  }

  /**
   * Oraliqdagi videolarni hoziroq qayta o'qish (Apify — pullik). Fonda ishlaydi; natija —
   * `GET /admin/stats/refresh` dagi `lastReport`. Body: `{ minViews, maxViews, includeNear }`.
   */
  @Post("stats/refresh")
  @HttpCode(202)
  refresh(@Body() body: unknown, @CurrentAdmin() admin: AdminUser) {
    const b = objectBody(body, ["minViews", "maxViews", "includeNear"]);
    if (b.includeNear !== undefined && typeof b.includeNear !== "boolean") throw adminError(400, "includeNear — true yoki false.");
    const range = parseRange(b.minViews, b.maxViews, b.includeNear);
    const ids = refreshCandidates(this.participants.all(), range);
    if (ids.length === 0) throw adminError(422, "Bu oraliqda yangilanadigan video yo'q.");
    const job = this.stats.refreshReels(ids, `${admin.fullName}: ${rangeLabel(range)}`);
    if (!job) throw adminError(409, "Ko'rishlar hozir yig'ilmoqda — tugashini kuting.");
    void job.catch(() => undefined);
    const { from, to } = effectiveRange(range);
    this.audit.record({
      actor: actorOf(admin),
      action: "stats.refresh",
      entity: "reel",
      entityId: "range",
      entityLabel: "Ko'rishlarni yangilash",
      before: "",
      after: `${ids.length} ta video: ${from ?? 0} – ${to === null ? "∞" : to} ko'rish${range.includeNear ? " (yaqinlar bilan)" : ""}`,
      reason: "",
    });
    return { started: true, count: ids.length };
  }

  /** Barcha videolar: holat, egasi, ko'rishlar tarixi, nakrutka belgilari. Avval reytingdagilar. */
  @Get("reels")
  reels() {
    const ranked = new Map(this.stats.ranking().map((e) => [e.participant.telegramId, e]));
    return this.participants
      .all()
      .flatMap((p) => {
        const reel = p.reel;
        if (!reel) return [];
        const last = reel.history.at(-1);
        const entry = ranked.get(p.telegramId);
        return [
          {
            telegramId: p.telegramId,
            fullName: p.firstName ? `${p.firstName} ${p.lastName}` : null,
            phone: p.phone,
            participantStatus: p.status,
            rank: entry?.rank ?? null,
            rankDelta: entry?.rankDelta ?? 0,
            url: reel.url,
            shortcode: reel.shortcode,
            status: reel.status,
            rejectReason: reel.rejectReason,
            owner: reel.owner,
            postedAt: reel.postedAt?.toISOString() ?? null,
            submittedAt: reel.submittedAt.toISOString(),
            views: last?.views ?? null,
            likes: last?.likes ?? null,
            comments: last?.comments ?? null,
            lastSyncedAt: last?.at.toISOString() ?? null,
            flags: reel.flags,
            history: reel.history.map((s) => ({
              date: s.date,
              views: s.views,
              likes: s.likes,
              comments: s.comments,
            })),
          },
        ];
      })
      .sort(
        (a, b) =>
          (a.rank ?? Number.MAX_SAFE_INTEGER) - (b.rank ?? Number.MAX_SAFE_INTEGER) ||
          b.submittedAt.localeCompare(a.submittedAt),
      );
  }
}
