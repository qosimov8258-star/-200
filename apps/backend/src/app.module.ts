import { Module } from "@nestjs/common";

import { AdminRulesController } from "./admin/admin-rules.controller";
import { AdminStatsController } from "./admin/admin-stats.controller";
import { config } from "./config/config";
import { createReelStatsProvider } from "./instagram/provider.factory";
import { ReelStatsProvider } from "./instagram/reel-stats";
import { contestSettings } from "./miniapp/contest";
import { MiniappController } from "./miniapp/miniapp.controller";
import { ParticipantsService } from "./participants/participants.service";
import { RulesService } from "./rules/rules.service";
import { STATS_OPTIONS, StatsService, type StatsOptions } from "./stats/stats.service";
import { SupportService } from "./support/support.service";
import { ParticipantNotifier } from "./telegram/notifier";
import { TelegramService } from "./telegram/telegram.service";

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
  return {
    syncTime,
    everyDays: syncEveryDays,
    verifyDelayMs,
    contestEndsAt: new Date(contestSettings.endsAt),
  };
}

@Module({
  controllers: [MiniappController, AdminRulesController, AdminStatsController],
  providers: [
    RulesService,
    ParticipantsService,
    SupportService,
    TelegramService,
    { provide: ParticipantNotifier, useExisting: TelegramService },
    { provide: ReelStatsProvider, useFactory: createReelStatsProvider },
    { provide: STATS_OPTIONS, useFactory: statsOptions },
    StatsService,
  ],
})
export class AppModule {}
