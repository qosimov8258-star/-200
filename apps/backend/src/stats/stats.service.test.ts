import assert from "node:assert/strict";
import { test } from "node:test";

import { MockReelStatsProvider } from "../instagram/mock.provider";
import { ParticipantsService } from "../participants/participants.service";
import { RulesService } from "../rules/rules.service";
import type { ParticipantNotifier } from "../telegram/notifier";
import { StatsService } from "./stats.service";

/** Toshkent vaqti bo'yicha soat (UTC+5): "2026-12-01 07:00" → Date. */
const tashkent = (s: string) => new Date(`${s.replace(" ", "T")}:00+05:00`);

function setup(opts: { everyDays?: number; endsAt?: string } = {}) {
  let now = tashkent("2026-12-01 07:00");
  const participants = new ParticipantsService(new RulesService());
  const provider = new MockReelStatsProvider();
  const sent: { chatId: number; text: string }[] = [];
  const notifier: ParticipantNotifier = {
    notify: (chatId, text) => {
      sent.push({ chatId, text });
      return Promise.resolve();
    },
  };
  const stats = new StatsService(participants, provider, notifier, {
    syncTime: "06:00",
    everyDays: opts.everyDays ?? 1,
    verifyDelayMs: 0,
    contestEndsAt: tashkent(opts.endsAt ?? "2027-01-01 12:00"),
    clock: () => now,
  });

  /** Faol ishtirokchi + yuborilgan video (PENDING). */
  const join = (id: number, shortcode: string) => {
    participants.setPhone(id, id, `+99890000000${id}`);
    participants.register(id, `Ism${id}`, `Familiya${id}`, 25);
    participants.acceptRules(id, 1);
    participants.submitReel(id, `https://www.instagram.com/reel/${shortcode}/`, shortcode);
    stats.queueVerification(id);
  };
  const reel = (id: number) => participants.get(id)?.reel ?? null;
  const setNow = (s: string) => {
    now = tashkent(s);
  };
  return { participants, provider, stats, sent, join, reel, setNow };
}

test("a found Reel is accepted with its first snapshot and the bot notifies", async () => {
  const { provider, stats, sent, join, reel } = setup();
  provider.set("AAAAA1", { owner: "ali", views: 156_745, likes: 17_800, comments: 100 });
  join(1, "AAAAA1");
  await stats.flushVerification();

  assert.equal(reel(1)?.status, "ACCEPTED");
  assert.equal(reel(1)?.owner, "ali");
  assert.deepEqual(
    reel(1)?.history.map((h) => [h.date, h.views]),
    [["2026-12-01", 156_745]],
  );
  assert.equal(sent.length, 1);
  assert.match(sent[0].text, /156 745/);
});

test("new Reels arriving together are checked in one request", async () => {
  const { provider, stats, join } = setup();
  join(1, "AAAAA1");
  join(2, "BBBBB2");
  join(3, "CCCCC3");
  await stats.flushVerification();
  assert.deepEqual(provider.requests, [["AAAAA1", "BBBBB2", "CCCCC3"]]);
});

test("a Reel that is not found twice is rejected (one glitch is forgiven)", async () => {
  const { provider, stats, sent, join, reel } = setup();
  provider.set("GONE01", null);
  join(1, "GONE01");
  await stats.flushVerification();
  assert.equal(reel(1)?.status, "PENDING");
  assert.equal(sent.length, 0);

  stats.queueVerification(1);
  await stats.flushVerification();
  assert.equal(reel(1)?.status, "REJECTED");
  assert.equal(reel(1)?.rejectReason, "NOT_FOUND");
  assert.equal(sent.length, 1);
});

test("photos are rejected and one Instagram account can join only once", async () => {
  const { provider, stats, join, reel } = setup();
  provider.set("PHOTO1", { isVideo: false });
  provider.set("AAAAA1", { owner: "ali" });
  provider.set("AAAAA2", { owner: "ali" });
  join(1, "PHOTO1");
  join(2, "AAAAA1");
  join(3, "AAAAA2");
  await stats.flushVerification();
  assert.equal(reel(1)?.rejectReason, "NOT_A_VIDEO");
  assert.equal(reel(2)?.status, "ACCEPTED");
  assert.equal(reel(3)?.rejectReason, "OWNER_TAKEN");
});

test("Reels stay pending while the provider is down", async () => {
  const { provider, stats, join, reel } = setup();
  provider.failing = true;
  join(1, "AAAAA1");
  await stats.flushVerification();
  assert.equal(reel(1)?.status, "PENDING");
});

test("daily sync records history, ranks by views and reports rank changes", async () => {
  const { provider, stats, join, reel, setNow } = setup();
  provider.set("AAAAA1", { owner: "a", views: 1_000 });
  provider.set("BBBBB2", { owner: "b", views: 5_000 });
  join(1, "AAAAA1");
  join(2, "BBBBB2");
  await stats.flushVerification();
  assert.deepEqual(stats.ranking().map((e) => [e.participant.telegramId, e.rank, e.rankDelta]), [
    [2, 1, 0],
    [1, 2, 0],
  ]);

  setNow("2026-12-02 06:01");
  provider.set("AAAAA1", { owner: "a", views: 9_000 });
  provider.set("BBBBB2", { owner: "b", views: 6_000 });
  const report = await stats.syncAll("schedule");
  assert.equal(report.error, null);
  assert.equal(report.updated, 2);
  assert.deepEqual(reel(1)?.history.map((h) => [h.date, h.views]), [
    ["2026-12-01", 1_000],
    ["2026-12-02", 9_000],
  ]);
  assert.deepEqual(stats.ranking().map((e) => [e.participant.telegramId, e.rank, e.rankDelta]), [
    [1, 1, 1],
    [2, 2, -1],
  ]);

  // Shu kuni qayta yig'ilsa — kunlik yozuv almashtiriladi, yangisi qo'shilmaydi.
  provider.set("AAAAA1", { owner: "a", views: 9_500 });
  await stats.syncAll("admin");
  assert.equal(reel(1)?.history.length, 2);
  assert.equal(reel(1)?.history.at(-1)?.views, 9_500);
});

test("a Reel missing twice leaves the rating and returns when found again", async () => {
  const { provider, stats, sent, join, reel, setNow } = setup();
  provider.set("AAAAA1", { owner: "a", views: 1_000 });
  join(1, "AAAAA1");
  await stats.flushVerification();

  provider.set("AAAAA1", null);
  setNow("2026-12-02 06:01");
  await stats.syncAll("schedule");
  assert.equal(reel(1)?.status, "ACCEPTED");
  setNow("2026-12-03 06:01");
  await stats.syncAll("schedule");
  assert.equal(reel(1)?.status, "REMOVED");
  assert.equal(stats.ranking().length, 0);

  provider.set("AAAAA1", { owner: "a", views: 1_200 });
  setNow("2026-12-04 06:01");
  const report = await stats.syncAll("schedule");
  assert.equal(report.restored, 1);
  assert.equal(reel(1)?.status, "ACCEPTED");
  assert.equal(stats.ranking().length, 1);
  assert.equal(sent.length, 3); // qabul, chiqarildi, qaytdi
});

test("suspicious numbers are flagged for the admin, not punished automatically", async () => {
  const { provider, stats, join, reel, setNow } = setup();
  provider.set("AAAAA1", { owner: "a", views: 20_000, likes: 800 });
  join(1, "AAAAA1");
  await stats.flushVerification();

  setNow("2026-12-02 06:01");
  provider.set("AAAAA1", { owner: "a", views: 25_000, likes: 1_000 });
  await stats.syncAll("schedule");
  assert.deepEqual(reel(1)?.flags, []);

  // Bir kunda +5 000 o'rniga +400 000, layklar deyarli o'smagan.
  setNow("2026-12-03 06:01");
  provider.set("AAAAA1", { owner: "a", views: 425_000, likes: 1_100 });
  await stats.syncAll("schedule");
  assert.deepEqual(reel(1)?.flags.map((f) => f.type).sort(), ["LOW_ENGAGEMENT", "VIEW_SPIKE"]);

  // Instagram sun'iy ko'rishlarni tozaladi.
  setNow("2026-12-04 06:01");
  provider.set("AAAAA1", { owner: "a", views: 30_000, likes: 1_100 });
  await stats.syncAll("schedule");
  assert.ok(reel(1)?.flags.some((f) => f.type === "VIEW_DROP"));
  assert.equal(reel(1)?.status, "ACCEPTED");
  assert.equal(reel(1)?.flags.filter((f) => f.type === "LOW_ENGAGEMENT").length, 1);
});

test("schedule: daily after sync time, every N days, and one final sync after the end", async () => {
  const daily = setup();
  daily.setNow("2026-12-01 05:59");
  assert.equal(daily.stats.dueReason(), null);
  daily.setNow("2026-12-01 06:00");
  assert.equal(daily.stats.dueReason(), "schedule");
  await daily.stats.syncAll("schedule");
  daily.setNow("2026-12-01 23:00");
  assert.equal(daily.stats.dueReason(), null);
  daily.setNow("2026-12-02 06:30");
  assert.equal(daily.stats.dueReason(), "schedule");

  const biweekly = setup({ everyDays: 14 });
  biweekly.setNow("2026-12-01 06:00");
  await biweekly.stats.syncAll("schedule");
  biweekly.setNow("2026-12-14 06:00");
  assert.equal(biweekly.stats.dueReason(), null);
  biweekly.setNow("2026-12-15 06:00");
  assert.equal(biweekly.stats.dueReason(), "schedule");

  const ending = setup({ endsAt: "2026-12-20 12:00" });
  ending.setNow("2026-12-20 12:00");
  assert.equal(ending.stats.dueReason(), "final");
  await ending.stats.syncAll("final");
  ending.setNow("2026-12-21 06:00");
  assert.equal(ending.stats.dueReason(), null);
});

test("a failed sync is not retried immediately", async () => {
  const { provider, stats, join, setNow } = setup();
  join(1, "AAAAA1");
  provider.failing = true;
  setNow("2026-12-01 06:00");
  const report = await stats.syncAll("schedule");
  assert.match(report.error ?? "", /ishlamayapti/);
  setNow("2026-12-01 06:10");
  assert.equal(stats.dueReason(), null);
  setNow("2026-12-01 06:31");
  assert.equal(stats.dueReason(), "schedule");
});
