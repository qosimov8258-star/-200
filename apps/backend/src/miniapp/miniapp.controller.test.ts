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
import { dailyGrowth, MiniappController } from "./miniapp.controller";

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
        bestViews: 0,
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

test("POST /miniapp/reels adds any number of videos; the most viewed is on top; duplicates are refused", async () => {
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
  // Ko'rishlar qo'shilmaydi: natija — eng ko'p ko'rilgan bitta video.
  assert.equal(mine.bestViews, 2_500);
  assert.equal(mine.rank, 1);
  assert.deepEqual(
    mine.reels.map((r) => [r.shortcode, r.status, r.rejectReason, r.views, r.best]),
    [
      ["BBBBB2", "ACCEPTED", null, 2_500, true],
      ["AAAAA1", "ACCEPTED", null, 1_000, false],
      ["PHOTO3", "REJECTED", "NOT_A_VIDEO", 0, false],
    ],
  );
  assert.equal(mine.lastSyncedAt, tashkent("2026-12-01 07:00").toISOString());
  assert.ok(mine.reels.every((r) => typeof r.submittedAt === "string"));
});

test("daily growth and today are the most viewed video's; the best video can change", async () => {
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
  assert.equal(mine.bestViews, 1_350);
  assert.deepEqual(mine.daily, [
    { date: "2026-12-02", views: 300 },
    { date: "2026-12-03", views: 50 },
  ]);
  assert.equal(mine.todayViews, 50);
  assert.equal(mine.lastSyncedAt, tashkent("2026-12-03 06:01").toISOString());

  // Ikkinchi video o'zib ketdi — natija, grafik va ro'yxat tepasi endi uniki.
  setNow("2026-12-04 06:01");
  provider.set("AAAAA1", { owner: "ali", views: 1_400 });
  provider.set("BBBBB2", { owner: "ali", views: 5_000 });
  await stats.syncAll("schedule");
  const after = controller.reels(user(1));
  assert.equal(after.bestViews, 5_000);
  assert.deepEqual(after.daily.map((d) => d.views), [400, 0, 4_200]);
  assert.equal(after.todayViews, 4_200);
  assert.deepEqual(after.reels.map((r) => [r.shortcode, r.best]), [["BBBBB2", true], ["AAAAA1", false]]);
});

test("dailyGrowth ignores the first snapshot and shows a drop as 0", () => {
  const snap = (date: string, views: number) => ({ date, at: new Date(), views, likes: null, comments: null });
  assert.deepEqual(dailyGrowth({ history: [] }), []);
  assert.deepEqual(
    dailyGrowth({ history: [snap("2026-12-01", 10), snap("2026-12-05", 30), snap("2026-12-07", 25), snap("2026-12-08", 40)] }),
    [
      { date: "2026-12-05", views: 20 },
      { date: "2026-12-07", views: 0 },
      { date: "2026-12-08", views: 15 },
    ],
  );
});

test("GET /miniapp/rating lists every accepted video separately; my place is my best video's", async () => {
  const { controller, provider, stats, submit } = setup();
  provider.set("AAAAA1", { owner: "ali", views: 5_000 });
  provider.set("BBBBB2", { owner: "ali", views: 2_000 });
  provider.set("CCCCC3", { owner: "vali", views: 7_000 });
  provider.set("DDDDD4", { owner: "vali", views: 9_000 });
  provider.set("PHOTO5", { owner: "ali", isVideo: false });
  submit(1, "https://www.instagram.com/reel/AAAAA1/");
  submit(1, "https://www.instagram.com/reel/BBBBB2/");
  submit(1, "https://www.instagram.com/p/PHOTO5/");
  submit(2, "https://www.instagram.com/reel/CCCCC3/");
  submit(2, "https://www.instagram.com/reel/DDDDD4/");
  await stats.flushVerification();

  // Har bir qabul qilingan video — alohida qator; rad etilgani yo'q; linklar berilmaydi.
  assert.deepEqual(controller.rating(user(1)), [
    { rank: 1, fullName: "Ism2 Familiya2", views: 9_000, rankDelta: 0, isMe: false },
    { rank: 2, fullName: "Ism2 Familiya2", views: 7_000, rankDelta: 0, isMe: false },
    { rank: 3, fullName: "Ism1 Familiya1", views: 5_000, rankDelta: 0, isMe: true },
    { rank: 4, fullName: "Ism1 Familiya1", views: 2_000, rankDelta: 0, isMe: true },
  ]);
  assert.ok(controller.rating(null).every((e) => !e.isMe));

  // O'rnim — eng ko'p ko'rilgan videomniki (3-o'rin, 2-o'rin emas); har bir videoda o'z o'rni.
  const mine = controller.reels(user(1));
  assert.equal(mine.rank, 3);
  assert.deepEqual(
    mine.reels.map((r) => [r.shortcode, r.rank]),
    [
      ["AAAAA1", 3],
      ["BBBBB2", 4],
      ["PHOTO5", null],
    ],
  );
});
