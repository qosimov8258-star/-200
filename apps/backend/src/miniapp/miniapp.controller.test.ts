import assert from "node:assert/strict";
import { test } from "node:test";

import { ApiException } from "../common/api-exception";
import type { ContestSettingsService } from "../contest/contest-settings.service";
import { MockReelStatsProvider } from "../instagram/mock.provider";
import { ParticipantsService } from "../participants/participants.service";
import { RulesService } from "../rules/rules.service";
import { StatsService } from "../stats/stats.service";
import type { SupportRelay } from "../support/support-relay";
import type { SupportService } from "../support/support.service";
import type { TargetsService } from "../targets/targets.service";
import type { TelegramIdentity } from "../telegram/init-data";
import type { ParticipantNotifier } from "../telegram/notifier";
import type { WinnerService } from "../winner/winner.service";
import { MiniappController, summedDailyGrowth } from "./miniapp.controller";

/** Toshkent vaqti bo'yicha soat (UTC+5): "2026-12-01 07:00" → Date. */
const tashkent = (s: string) => new Date(`${s.replace(" ", "T")}:00+05:00`);
const user = (telegramId: number): TelegramIdentity => ({ telegramId, firstName: "Ali", username: null });

function setup() {
  let now = tashkent("2026-12-01 07:00");
  const participants = new ParticipantsService(new RulesService());
  const provider = new MockReelStatsProvider();
  const notifier: ParticipantNotifier = { notify: () => Promise.resolve() };
  const stats = new StatsService(participants, provider, notifier, {
    syncTime: "06:00",
    everyDays: 1,
    verifyDelayMs: 0,
    contestStartsOn: "2026-11-30",
    contestEndsAt: tashkent("2027-01-01 12:00"),
    clock: () => now,
  });
  // Bu testlarga kerak bo'lmagan servislar — ularning metodlari chaqirilmaydi.
  const unused = {} as unknown;
  const controller = new MiniappController(
    participants,
    new RulesService(),
    stats,
    unused as TargetsService,
    unused as SupportService,
    unused as SupportRelay,
    unused as ContestSettingsService,
    unused as WinnerService,
  );
  for (const id of [1, 2]) {
    participants.setPhone(id, id, `+99890000000${id}`);
    participants.register(id, `Ism${id}`, `Familiya${id}`, 25);
    participants.acceptRules(id, 1);
  }
  const submit = (id: number, url: string) => controller.submitReel(user(id), { url });
  const setNow = (s: string) => {
    now = tashkent(s);
  };
  return { controller, participants, provider, stats, submit, setNow };
}

const errorCode = (fn: () => unknown): string => {
  try {
    fn();
  } catch (e) {
    return e instanceof ApiException ? (e.getResponse() as { code: string }).code : "OTHER";
  }
  return "NONE";
};

test("GET /miniapp/reels always returns an object; without videos the list is empty", () => {
  const { controller } = setup();
  for (const id of [1, 999]) {
    const mine = controller.reels(user(id));
    assert.deepEqual(
      { ...mine, nextSyncAt: null },
      {
        totalViews: 0,
        todayViews: 0,
        rank: null,
        rankDelta: 0,
        daily: [],
        lastSyncedAt: null,
        nextSyncAt: null,
        syncEveryDays: 1,
        reels: [],
      },
    );
  }
});

test("POST /miniapp/reels adds any number of videos, newest first; duplicates are refused", async () => {
  const { controller, provider, stats, submit } = setup();
  provider.set("AAAAA1", { owner: "ali", views: 1_000 });
  provider.set("BBBBB2", { owner: "ali.ikki", views: 2_500 });
  provider.set("PHOTO3", { owner: "ali", isVideo: false });

  const afterFirst = submit(1, "https://www.instagram.com/reel/AAAAA1/?igsh=abc");
  assert.deepEqual(
    afterFirst.reels.map((r) => [r.shortcode, r.status, r.url]),
    [["AAAAA1", "PENDING", "https://www.instagram.com/reel/AAAAA1/"]],
  );
  submit(1, "https://www.instagram.com/reel/BBBBB2/");
  const afterThird = submit(1, "https://www.instagram.com/p/PHOTO3/");
  assert.deepEqual(afterThird.reels.map((r) => r.shortcode), ["PHOTO3", "BBBBB2", "AAAAA1"]);

  assert.equal(errorCode(() => submit(1, "https://www.instagram.com/reel/AAAAA1/")), "REEL_ALREADY_SUBMITTED");
  assert.equal(errorCode(() => submit(2, "https://www.instagram.com/reel/BBBBB2/")), "REEL_TAKEN");
  assert.equal(errorCode(() => submit(1, "https://example.com/video")), "INVALID_LINK");
  assert.equal(errorCode(() => submit(999, "https://www.instagram.com/reel/CCCCC3/")), "UNAUTHORIZED");

  await stats.flushVerification();
  const mine = controller.reels(user(1));
  assert.equal(mine.totalViews, 3_500);
  assert.equal(mine.rank, 1);
  assert.deepEqual(
    mine.reels.map((r) => [r.shortcode, r.status, r.rejectReason, r.views]),
    [
      ["PHOTO3", "REJECTED", "NOT_A_VIDEO", 0],
      ["BBBBB2", "ACCEPTED", null, 2_500],
      ["AAAAA1", "ACCEPTED", null, 1_000],
    ],
  );
  assert.equal(mine.lastSyncedAt, tashkent("2026-12-01 07:00").toISOString());
  assert.ok(mine.reels.every((r) => typeof r.submittedAt === "string"));
});

test("daily growth is summed across accepted videos; today is the last day's sum", async () => {
  const { controller, provider, stats, submit, setNow } = setup();
  provider.set("AAAAA1", { owner: "ali", views: 1_000 });
  provider.set("BBBBB2", { owner: "ali", views: 500 });
  submit(1, "https://www.instagram.com/reel/AAAAA1/");
  submit(1, "https://www.instagram.com/reel/BBBBB2/");
  await stats.flushVerification();

  setNow("2026-12-02 06:01");
  provider.set("AAAAA1", { owner: "ali", views: 1_300 });
  provider.set("BBBBB2", { owner: "ali", views: 900 });
  await stats.syncAll("schedule");
  setNow("2026-12-03 06:01");
  provider.set("AAAAA1", { owner: "ali", views: 1_350 });
  provider.set("BBBBB2", { owner: "ali", views: 800 }); // kamaygan — 0 deb ko'rsatiladi
  await stats.syncAll("schedule");

  const mine = controller.reels(user(1));
  assert.equal(mine.totalViews, 2_150);
  assert.deepEqual(mine.daily, [
    { date: "2026-12-02", views: 700 },
    { date: "2026-12-03", views: 50 },
  ]);
  assert.equal(mine.todayViews, 50);
  assert.equal(mine.lastSyncedAt, tashkent("2026-12-03 06:01").toISOString());
});

test("summedDailyGrowth ignores the first snapshot of each video and sorts by date", () => {
  const snap = (date: string, views: number) => ({ date, at: new Date(), views, likes: null, comments: null });
  const reel = (history: ReturnType<typeof snap>[]) => ({ history }) as Parameters<typeof summedDailyGrowth>[0][number];
  assert.deepEqual(
    summedDailyGrowth([
      reel([snap("2026-12-05", 100), snap("2026-12-07", 400)]),
      reel([snap("2026-12-01", 10), snap("2026-12-05", 30), snap("2026-12-07", 35)]),
    ]),
    [
      { date: "2026-12-05", views: 20 },
      { date: "2026-12-07", views: 305 },
    ],
  );
});
