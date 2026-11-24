import { Module } from "@nestjs/common";

import { AdminAiController } from "./admin/admin-ai.controller";
import { AdminAuditController } from "./admin/admin-audit.controller";
import { AdminDashboardController } from "./admin/admin-dashboard.controller";
import { AdminDrawsController } from "./admin/admin-draws.controller";
import { AdminManualReviewController } from "./admin/admin-manual-review.controller";
import { AdminParticipantsController } from "./admin/admin-participants.controller";
import { AdminRulesController } from "./admin/admin-rules.controller";
import { AdminSettingsController } from "./admin/admin-settings.controller";
import { AdminSupportController } from "./admin/admin-support.controller";
import { AdminStatsController } from "./admin/admin-stats.controller";
import { AdminStoriesController } from "./admin/admin-stories.controller";
import { AdminTargetsController } from "./admin/admin-targets.controller";
import { AdminTelegramController } from "./admin/admin-telegram.controller";
import { AdminWinnerController } from "./admin/admin-winner.controller";
import { AdminAuthController } from "./admin/auth/admin-auth.controller";
import { AdminAuthService } from "./admin/auth/admin-auth.service";
import { AI_REVIEW_OPTIONS, AiReviewService, type AiReviewOptions } from "./ai-review/ai-review.service";
import { AiWorkerController, AiWorkerGuard, aiWorkerTokenProvider } from "./ai-review/ai-worker.controller";
import { AuditService } from "./audit/audit.service";
import { config } from "./config/config";
import { ContestSettingsService } from "./contest/contest-settings.service";
import { AdLibraryProvider } from "./instagram/ad-library";
import { createAdLibraryProvider, createReelStatsProvider } from "./instagram/provider.factory";
import { ReelStatsProvider } from "./instagram/reel-stats";
import { DrawsService } from "./draws/draws.service";
import { MiniappController } from "./miniapp/miniapp.controller";
import { OwnerAuthController } from "./owner/auth/owner-auth.controller";
import { OwnerAuthService } from "./owner/auth/owner-auth.service";
import { OwnerParticipantsController } from "./owner/owner-participants.controller";
import { OwnerRiskController } from "./owner/owner-risk.controller";
import { OwnerTargetsController } from "./owner/owner-targets.controller";
import { OwnerService } from "./owner/owner.service";
import { ParticipantsService } from "./participants/participants.service";
import { STATE_STORE_OPTIONS, StateStore } from "./persistence/state-store";
import { RulesVideoService } from "./rules/rules-video.service";
import { RulesService } from "./rules/rules.service";
import { STATS_OPTIONS, StatsService, type StatsOptions } from "./stats/stats.service";
import { MiniappStoriesController } from "./stories/miniapp-stories.controller";
import { StoriesService } from "./stories/stories.service";
import { SupportRelay } from "./support/support-relay";
import { SupportService } from "./support/support.service";
import { TARGETS_OPTIONS, TargetsService, type TargetsOptions } from "./targets/targets.service";
import { ParticipantNotifier } from "./telegram/notifier";
import { MessageLogService } from "./telegram/message-log.service";
import { TelegramService } from "./telegram/telegram.service";
import { AuthController } from "./web/auth.controller";
import { WinnerService } from "./winner/winner.service";

/**
 * Ko'rishlar yig'ish jadvali. Tanlov sanalari va yig'ish vaqti admin paneldan o'zgarishi mumkin —
 * shuning uchun ular getter: StatsService har safar joriy qiymatni o'qiydi.
 */
function statsOptions(contest: ContestSettingsService): StatsOptions {
  const { syncEveryDays, verifyDelayMs } = config.stats;
  if (!Number.isInteger(syncEveryDays) || syncEveryDays < 0) {
    throw new Error("STATS_SYNC_EVERY_DAYS 0 yoki musbat butun son bo'lishi kerak");
  }
  if (!Number.isFinite(verifyDelayMs) || verifyDelayMs < 0) {
    throw new Error("STATS_VERIFY_DELAY_MS 0 yoki musbat son bo'lishi kerak");
  }
  return {
    get syncTime() {
      return contest.get().syncTime;
    },
    everyDays: syncEveryDays,
    verifyDelayMs,
    get contestStartsOn() {
      return contest.get().startsOn;
    },
    get contestEndsAt() {
      return contest.endsAt;
    },
  };
}

function targetsOptions(contest: ContestSettingsService): TargetsOptions {
  const { checkTop, everyDays } = config.targets;
  if (!Number.isInteger(checkTop) || checkTop < 0) throw new Error("TARGET_CHECK_TOP 0 yoki musbat butun son");
  if (!Number.isInteger(everyDays) || everyDays < 0) throw new Error("TARGET_CHECK_EVERY_DAYS 0 yoki musbat butun son");
  return {
    checkTop,
    everyDays,
    get contestStartsOn() {
      return contest.get().startsOn;
    },
    get contestEndsAt() {
      return contest.endsAt;
    },
  };
}

/** AI tekshiruvi sozlamalari (env) — noto'g'ri qiymat bilan server ishga tushmaydi. */
function aiReviewOptions(): AiReviewOptions {
  const { model, frameIntervalSec, frameHeight, confidenceMin } = config.ai;
  if (!Number.isFinite(frameIntervalSec) || frameIntervalSec < 0.5 || frameIntervalSec > 60) {
    throw new Error("AI_FRAME_INTERVAL_SEC 0.5–60 soniya bo'lishi kerak");
  }
  if (!Number.isInteger(frameHeight) || frameHeight < 240 || frameHeight > 1440) {
    throw new Error("AI_FRAME_HEIGHT 240–1440 px bo'lishi kerak");
  }
  if (!Number.isFinite(confidenceMin) || confidenceMin < 0 || confidenceMin > 1) {
    throw new Error("AI_CONFIDENCE_MIN 0–1 oralig'ida bo'lishi kerak");
  }
  return { settings: { model, frameIntervalSec, frameHeight, confidenceMin, trialSize: 20 } };
}

@Module({
  controllers: [
    AuthController,
    MiniappController,
    MiniappStoriesController,
    AdminAuthController,
    AdminSettingsController,
    AdminAuditController,
    AdminWinnerController,
    AdminParticipantsController,
    AdminDashboardController,
    AdminTelegramController,
    AdminSupportController,
    AdminRulesController,
    AdminStatsController,
    AdminManualReviewController,
    AdminDrawsController,
    AdminTargetsController,
    AdminStoriesController,
    AdminAiController,
    // AI worker (alohida jarayon) — ichki API, `X-Worker-Token` bilan.
    AiWorkerController,
    // Tashkilot egalari — yashirin bo'lim (alohida kirish, audit log'siz).
    OwnerAuthController,
    OwnerParticipantsController,
    OwnerTargetsController,
    OwnerRiskController,
  ],
  providers: [
    {
      provide: STATE_STORE_OPTIONS,
      useFactory: () => ({ dir: config.dataDir, saveEveryMs: 5_000, keepBackups: 30 }),
    },
    StateStore,
    AuditService,
    AdminAuthService,
    ContestSettingsService,
    RulesService,
    ParticipantsService,
    StoriesService,
    RulesVideoService,
    SupportService,
    MessageLogService,
    TelegramService,
    { provide: ParticipantNotifier, useExisting: TelegramService },
    { provide: SupportRelay, useExisting: TelegramService },
    { provide: ReelStatsProvider, useFactory: createReelStatsProvider },
    { provide: STATS_OPTIONS, useFactory: statsOptions, inject: [ContestSettingsService] },
    StatsService,
    DrawsService,
    { provide: AdLibraryProvider, useFactory: createAdLibraryProvider },
    { provide: TARGETS_OPTIONS, useFactory: targetsOptions, inject: [ContestSettingsService] },
    TargetsService,
    WinnerService,
    { provide: AI_REVIEW_OPTIONS, useFactory: aiReviewOptions },
    AiReviewService,
    aiWorkerTokenProvider,
    AiWorkerGuard,
    OwnerAuthService,
    OwnerService,
  ],
})
export class AppModule {}
