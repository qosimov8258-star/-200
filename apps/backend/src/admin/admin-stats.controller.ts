import { Controller, Get, HttpCode, Post, UseGuards } from "@nestjs/common";

import { AuditService } from "../audit/audit.service";
import { ParticipantsService } from "../participants/participants.service";
import { StatsService } from "../stats/stats.service";
import type { AdminUser } from "./auth/admin-accounts";
import { AdminAuthGuard, CurrentAdmin } from "./auth/admin-auth.guard";
import { actorOf } from "./auth/admin-auth.service";

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
   * Barcha videolar (har bir ishtirokchining hammasi): holat, egasi, ko'rishlar tarixi, nakrutka
   * belgilari. Avval reytingdagilar (o'rin — ishtirokchiniki), so'ng yangilari.
   */
  @Get("reels")
  reels() {
    const ranked = new Map(this.stats.ranking().map((e) => [e.participant.telegramId, e]));
    return this.participants
      .all()
      .flatMap((p) => {
        const entry = ranked.get(p.telegramId);
        return p.reels.map((reel) => {
          const last = reel.history.at(-1);
          return {
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
          };
        });
      })
      .sort(
        (a, b) =>
          (a.rank ?? Number.MAX_SAFE_INTEGER) - (b.rank ?? Number.MAX_SAFE_INTEGER) ||
          b.submittedAt.localeCompare(a.submittedAt),
      );
  }
}
