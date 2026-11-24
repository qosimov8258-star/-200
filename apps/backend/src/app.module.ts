import { Module } from "@nestjs/common";

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
    OwnerAuthService,
    OwnerService,
  ],
})
export class AppModule {}
