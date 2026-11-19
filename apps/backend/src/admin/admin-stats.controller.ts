import { Controller, Get, HttpCode, Logger, Post, UseGuards } from "@nestjs/common";

import { ParticipantsService } from "../participants/participants.service";
import { StatsService } from "../stats/stats.service";
import { AdminTokenGuard } from "./admin-token.guard";

/**
 * Ko'rishlar va videolar (admin panel → Videolar / Reyting).
 *
 * Ko'rishlarni qo'lda o'zgartiruvchi endpoint YO'Q (CLAUDE.md) — admin faqat
 * yig'ishni navbatdan tashqari ishga tushira oladi.
 */
@Controller("admin")
@UseGuards(AdminTokenGuard)
export class AdminStatsController {
  private readonly logger = new Logger(AdminStatsController.name);

  constructor(
    private readonly participants: ParticipantsService,
    private readonly stats: StatsService,
  ) {}

  /** Yig'ish jadvali, oxirgi natija va videolar soni holatlar bo'yicha. */
  @Get("stats")
  status() {
    return this.stats.status();
  }

  /** Ko'rishlarni hoziroq yig'ish. Fon rejimida ishlaydi; natija — `GET /admin/stats`. */
  @Post("stats/sync")
  @HttpCode(202)
  sync() {
    const alreadyRunning = this.stats.isSyncing;
    // Admin login qurilgach — xodim nomi bilan audit log yozuvi.
    if (!alreadyRunning) this.logger.log("Admin: ko'rishlarni yig'ish qo'lda boshlandi.");
    void this.stats.syncAll("admin");
    return { started: !alreadyRunning, running: true };
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
