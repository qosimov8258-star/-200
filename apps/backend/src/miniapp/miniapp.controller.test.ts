import assert from "node:assert/strict";
import { test } from "node:test";

import { ApiException } from "../common/api-exception";
import type { ContestSettingsService } from "../contest/contest-settings.service";
import type { DrawsService } from "../draws/draws.service";
import { MockReelStatsProvider } from "../instagram/mock.provider";
import { ParticipantsService } from "../participants/participants.service";
import { RulesService } from "../rules/rules.service";
import { StatsService } from "../stats/stats.service";
import type { SupportRelay } from "../support/support-relay";
import type { SupportService } from "../support/support.service";
import type { TargetsService } from "../targets/targets.service";
import type { TelegramIdentity } from "../telegram/init-data";
import { OFFER_RU, OFFER_UZ } from "../rules/offer-text";
import { contestPrizes, localizePrizes } from "./prizes";
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
    unused as DrawsService,
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

test("POST /miniapp/reels adds any number of videos; the most viewed is on top; views add up; duplicates are refused", async () => {
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
  // Oferta 7.1: natija — qabul qilingan videolar ko'rishlarining yig'indisi (rad etilgani kirmaydi).
  assert.equal(mine.totalViews, 1_000 + 2_500);
  assert.equal(mine.rank, 1);
  assert.deepEqual(
    mine.reels.map((r) => [r.shortcode, r.status, r.rejectReason, r.views]),
    [
      ["BBBBB2", "ACCEPTED", null, 2_500],
      ["AAAAA1", "ACCEPTED", null, 1_000],
      ["PHOTO3", "REJECTED", "NOT_A_VIDEO", 0],
    ],
  );
  assert.equal(mine.lastSyncedAt, tashkent("2026-12-01 07:00").toISOString());
  assert.ok(mine.reels.every((r) => typeof r.submittedAt === "string"));
});

test("daily growth and today are summed over accepted videos; a drop counts as 0; the list follows views", async () => {
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
  assert.equal(mine.totalViews, 1_350 + 800);
  assert.deepEqual(mine.daily, [
    { date: "2026-12-02", views: 300 + 400 },
    { date: "2026-12-03", views: 50 + 0 },
  ]);
  assert.equal(mine.todayViews, 50);
  assert.equal(mine.lastSyncedAt, tashkent("2026-12-03 06:01").toISOString());

  // Ikkinchi video o'zib ketdi — ro'yxat tepasi endi uniki; natija va o'sish — ikkalasining yig'indisi.
  setNow("2026-12-04 06:01");
  provider.set("AAAAA1", { owner: "ali", views: 1_400 });
  provider.set("BBBBB2", { owner: "ali", views: 5_000 });
  await stats.syncAll("schedule");
  const after = controller.reels(user(1));
  assert.equal(after.totalViews, 1_400 + 5_000);
  assert.deepEqual(after.daily.map((d) => d.views), [700, 50, 50 + 4_200]);
  assert.equal(after.todayViews, 4_250);
  assert.deepEqual(after.reels.map((r) => [r.shortcode, r.views]), [["BBBBB2", 5_000], ["AAAAA1", 1_400]]);
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

test("GET /miniapp/rating lists one row per participant by the sum of accepted videos; my place is that row's", async () => {
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

  // Bitta ishtirokchi — bitta qator, ko'rishlari — qabul qilingan videolari yig'indisi (rad etilgani
  // kirmaydi); linklar berilmaydi.
  assert.deepEqual(controller.rating(user(1)), [
    { rank: 1, fullName: "Ism2 Familiya2", views: 7_000 + 9_000, rankDelta: 0, isMe: false },
    { rank: 2, fullName: "Ism1 Familiya1", views: 5_000 + 2_000, rankDelta: 0, isMe: true },
  ]);
  assert.ok(controller.rating(null).every((e) => !e.isMe));

  // O'rnim — reytingdagi o'sha qator; videolar ro'yxati ko'rishlar bo'yicha.
  const mine = controller.reels(user(1));
  assert.equal(mine.rank, 2);
  assert.equal(mine.totalViews, 7_000);
  assert.deepEqual(
    mine.reels.map((r) => [r.shortcode, r.views]),
    [
      ["AAAAA1", 5_000],
      ["BBBBB2", 2_000],
      ["PHOTO5", 0],
    ],
  );
});

test("language: POST /miniapp/lang saves the choice (me.lang); only uz/ru; the offer comes in the chosen language", () => {
  const { controller, participants } = setup();
  assert.equal(controller.me(user(1)).lang, null, "hali tanlanmagan");
  controller.setLang(user(1), { lang: "ru" });
  assert.equal(controller.me(user(1)).lang, "ru");
  assert.equal(participants.get(1)?.lang, "ru");
  assert.equal(errorCode(() => controller.setLang(user(1), { lang: "en" })), "SERVER");
  assert.equal(errorCode(() => controller.setLang(user(1), { lang: "ru", extra: 1 })), "SERVER");

  const ru = controller.rules("ru");
  const uz = controller.rules("uz");
  assert.deepEqual(ru.sections, OFFER_RU);
  assert.deepEqual(uz.sections, OFFER_UZ);
  assert.deepEqual(controller.rules(undefined).sections, OFFER_UZ, "sarlavhasiz — o'zbekcha");
  assert.equal(ru.version, uz.version, "rozilik versiyasi ikki tilda bir xil");
});

test("prizes are localized: titles and notes in Russian, numbers and dates unchanged", () => {
  const uz = contestPrizes;
  const ru = localizePrizes(contestPrizes, "ru");
  assert.equal(localizePrizes(contestPrizes, "uz"), uz);
  assert.equal(ru.monthly.title, "Подарочный ваучер Korzinka");
  assert.deepEqual(
    ru.tiers.map((t) => [t.kind, t.title, t.quantity, t.minViews, t.maxViews]),
    [
      ["tablet", "Планшет", 25, 100_001, 500_000],
      ["phone", "Смартфон iPhone 18 Pro", 15, 500_001, 1_500_000],
      ["travel", "Туристическая путёвка в Таиланд на 2 человек", 3, 1_500_001, 4_000_000],
      ["car", "Автомобиль BYD Chazor", 1, 4_000_001, null],
    ],
  );
  assert.deepEqual([ru.monthly.perMonth, ru.monthly.total, ru.stages], [200, 600, uz.stages]);
  assert.equal(ru.notes.length, uz.notes.length);
});
