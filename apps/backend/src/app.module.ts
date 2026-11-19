import { Module } from "@nestjs/common";

import { AdminDrawsController } from "./admin/admin-draws.controller";
import { AdminManualReviewController } from "./admin/admin-manual-review.controller";
import { AdminRulesController } from "./admin/admin-rules.controller";
import { AdminStatsController } from "./admin/admin-stats.controller";
import { AdminTargetsController } from "./admin/admin-targets.controller";
import { config } from "./config/config";
import { AdLibraryProvider } from "./instagram/ad-library";
import { createAdLibraryProvider, createReelStatsProvider } from "./instagram/provider.factory";
import { ReelStatsProvider } from "./instagram/reel-stats";
import { DrawsService } from "./draws/draws.service";
import { contestSettings } from "./miniapp/contest";
import { MiniappController } from "./miniapp/miniapp.controller";
import { ParticipantsService } from "./participants/participants.service";
import { RulesService } from "./rules/rules.service";
import { STATS_OPTIONS, StatsService, type StatsOptions } from "./stats/stats.service";
import { SupportService } from "./support/support.service";
import { TARGETS_OPTIONS, TargetsService } from "./targets/targets.service";
import { ParticipantNotifier } from "./telegram/notifier";
import { TelegramService } from "./telegram/telegram.service";
import { AuthController } from "./web/auth.controller";

function statsOptions(): StatsOptions {
  const { syncTime, syncEveryDays, verifyDelayMs } = config.stats;
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(syncTime)) {
    throw new Error(`STATS_SYNC_TIME "HH:MM" ko'rinishida bo'lishi kerak, berilgan: "${syncTime}"`);
  }
  if (!Number.isInteger(syncEveryDays) || syncEveryDays < 0) {
    throw new Error("STATS_SYNC_EVERY_DAYS 0 yoki musbat butun son bo'lishi kerak");
  }
  if (!Number.isFinite(verifyDelayMs) || verifyDelayMs < 0) {
    throw new Error("STATS_VERIFY_DELAY_MS 0 yoki musbat son bo'lishi kerak");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(contestSettings.startsOn)) {
    throw new Error(`contest.ts: startsOn "YYYY-MM-DD" bo'lishi kerak, berilgan: "${contestSettings.startsOn}"`);
  }
  return {
    syncTime,
    everyDays: syncEveryDays,
    verifyDelayMs,
    contestStartsOn: contestSettings.startsOn,
    contestEndsAt: new Date(contestSettings.endsAt),
  };
}

@Module({
  controllers: [
    AuthController,
    MiniappController,
    AdminRulesController,
    AdminStatsController,
    AdminManualReviewController,
    AdminDrawsController,
    AdminTargetsController,
  ],
  providers: [
    RulesService,
    ParticipantsService,
    SupportService,
    TelegramService,
    { provide: ParticipantNotifier, useExisting: TelegramService },
    { provide: ReelStatsProvider, useFactory: createReelStatsProvider },
    { provide: STATS_OPTIONS, useFactory: statsOptions },
    StatsService,
    DrawsService,
    { provide: AdLibraryProvider, useFactory: createAdLibraryProvider },
    {
      provide: TARGETS_OPTIONS,
      useFactory: () => {
        const { checkTop, everyDays } = config.targets;
        if (!Number.isInteger(checkTop) || checkTop < 0) throw new Error("TARGET_CHECK_TOP 0 yoki musbat butun son");
        if (!Number.isInteger(everyDays) || everyDays < 0) throw new Error("TARGET_CHECK_EVERY_DAYS 0 yoki musbat butun son");
        return { checkTop, everyDays };
      },
    },
    TargetsService,
  ],
})
export class AppModule {}
