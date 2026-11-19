import { Controller, Get, Query, UseGuards } from "@nestjs/common";

import { contestDay } from "../common/time";
import { ContestSettingsService } from "../contest/contest-settings.service";
import { ParticipantsService } from "../participants/participants.service";
import { buildDailyRating, type RatingEntry, type RatingSummary } from "../reports/daily-rating";
import { buildDashboard, type DashboardStats } from "../reports/dashboard";
import { StatsService } from "../stats/stats.service";
import { SupportService } from "../support/support.service";
import { TargetsService } from "../targets/targets.service";
import { adminError, optionalDay, paginate, type Page } from "./admin-http";
import { AdminAuthGuard } from "./auth/admin-auth.guard";

const RATING_PAGE_SIZE = 50;

/** Query qiymati — faqat bitta matn (`?a=1&a=2` yoki `?a[b]=1` rad etiladi). */
function queryText(value: unknown): string | undefined {
  if (value === undefined || typeof value === "string") return value;
  throw adminError(400, "So'rov parametrlari noto'g'ri.");
}

export interface DailyRatingResponse extends Page<RatingEntry> {
  date: string;
  availableRange: { from: string; to: string };
  generatedAt: string;
  summary: RatingSummary;
}

/**
 * Dashboard va kunlik reyting (admin panel → Dashboard, Reyting). Kontrakt —
 * `apps/admin/src/lib/api.ts` dagi `getDashboardStats` va `getDailyRating`. Faqat ADMIN.
 * Hisob-kitob `src/reports/` dagi sof funksiyalarda; bu yerda — query tekshiruvi va ma'lumot yig'ish.
 */
@Controller("admin")
@UseGuards(AdminAuthGuard)
export class AdminDashboardController {
  constructor(
    private readonly participants: ParticipantsService,
    private readonly stats: StatsService,
    private readonly targets: TargetsService,
    private readonly support: SupportService,
    private readonly contest: ContestSettingsService,
  ) {}

  /** `GET /admin/dashboard?from=YYYY-MM-DD&to=YYYY-MM-DD` — davr tanlov muddatiga qisiladi. */
  @Get("dashboard")
  dashboard(@Query("from") fromRaw?: unknown, @Query("to") toRaw?: unknown): DashboardStats {
    const from = optionalDay(queryText(fromRaw), "Davr boshi");
    const to = optionalDay(queryText(toRaw), "Davr oxiri");
    if (from && to && from > to) throw adminError(400, "Davr boshi oxiridan keyin bo'lishi mumkin emas.");
    const now = new Date();
    const { startsOn, endsOn } = this.contest.get();
    return buildDashboard({
      participants: this.participants.all(),
      // Murojaat ochilgan vaqt — birinchi xabar.
      tickets: this.support.list().map((t) => ({ status: t.status, createdAt: t.messages[0]?.createdAt ?? t.updatedAt })),
      cases: this.targets.allCases(),
      startsOn,
      endsOn,
      today: contestDay(now),
      from,
      to,
      dataUpdatedAt: this.lastSyncAt(now),
    });
  }

  /** `GET /admin/ratings/daily?date=YYYY-MM-DD&page=&pageSize=` — kun tanlov muddatiga qisiladi. */
  @Get("ratings/daily")
  daily(
    @Query("date") dateRaw?: unknown,
    @Query("page") page?: unknown,
    @Query("pageSize") pageSize?: unknown,
  ): DailyRatingResponse {
    const date = optionalDay(queryText(dateRaw), "Sana");
    const now = new Date();
    const { startsOn, endsOn } = this.contest.get();
    const rating = buildDailyRating({
      participants: this.participants.all(),
      cases: this.targets.allCases(),
      startsOn,
      endsOn,
      today: contestDay(now),
      date,
    });
    return {
      ...paginate(rating.entries, queryText(page), queryText(pageSize), RATING_PAGE_SIZE),
      date: rating.date,
      availableRange: rating.availableRange,
      generatedAt: this.lastSyncAt(now),
      summary: rating.summary,
    };
  }

  /** Oxirgi muvaffaqiyatli yig'ish vaqti; hali yig'ilmagan bo'lsa — hozir. */
  private lastSyncAt(now: Date): string {
    return this.stats.status().lastSuccessAt ?? now.toISOString();
  }
}
