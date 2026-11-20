import assert from "node:assert/strict";
import { test } from "node:test";

import { MockReelStatsProvider } from "../instagram/mock.provider";
import { ParticipantsService } from "../participants/participants.service";
import { RulesService } from "../rules/rules.service";
import type { ParticipantNotifier } from "../telegram/notifier";
import { StatsService } from "./stats.service";

/** Toshkent vaqti bo'yicha soat (UTC+5): "2026-12-01 07:00" → Date. */
const tashkent = (s: string) => new Date(`${s.replace(" ", "T")}:00+05:00`);

function setup(opts: { everyDays?: number; startsOn?: string; endsAt?: string } = {}) {
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
    contestStartsOn: opts.startsOn ?? "2026-11-30",
    contestEndsAt: tashkent(opts.endsAt ?? "2027-01-01 12:00"),
    clock: () => now,
  });

  /** Faol ishtirokchi + yuborilgan video (PENDING). */
  const join = (id: number, shortcode: string) => {
    participants.setPhone(id, id, `+99890000000${id}`);
    participants.register(id, `Ism${id}`, `Familiya${id}`, 25);
    participants.acceptRules(id, 1);
    submit(id, shortcode);
  };
  /** Mavjud ishtirokchining yana bir videosi (Mini App'dagi kabi navbatga shu video qo'yiladi). */
  const submit = (id: number, shortcode: string) => {
    participants.submitReel(id, `https://www.instagram.com/reel/${shortcode}/`, shortcode);
    stats.queueVerification(id, shortcode);
  };
  /** Ishtirokchining eng oxirgi yuborgan videosi. */
  const reel = (id: number) => participants.get(id)?.reels.at(-1) ?? null;
  /** Ishtirokchining shortcode bo'yicha videosi. */
  const reelOf = (id: number, shortcode: string) =>
    participants.get(id)?.reels.find((r) => r.shortcode === shortcode) ?? null;
  const setNow = (s: string) => {
    now = tashkent(s);
  };
  return { participants, provider, stats, sent, join, submit, reel, reelOf, setNow };
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
  assert.match(sent[0].text, /instagram\.com\/reel\/AAAAA1\//, "qaysi video haqida ekani");
});

test("new Reels arriving together are checked in one request", async () => {
  const { provider, stats, join } = setup();
  join(1, "AAAAA1");
  join(2, "BBBBB2");
  join(3, "CCCCC3");
  await stats.flushVerification();
  assert.deepEqual(provider.requests, [["AAAAA1", "BBBBB2", "CCCCC3"]]);
});

/** Yangi videoni 3 marta tekshiradi (2- va 3-urinishlar haqiqatda taymer bilan keladi). */
async function threeAttempts(stats: StatsService, id: number) {
  await stats.flushVerification();
  for (let i = 0; i < 2; i++) {
    stats.queueVerification(id);
    await stats.flushVerification();
  }
}

test("a Reel not found 3 times goes to manual review — the participant is told first", async () => {
  const { provider, stats, sent, join, reel } = setup();
  provider.set("GONE01", null);
  join(1, "GONE01");
  await stats.flushVerification();
  stats.queueVerification(1);
  await stats.flushVerification();
  assert.equal(reel(1)?.status, "PENDING");
  assert.equal(sent.length, 0);

  stats.queueVerification(1);
  await stats.flushVerification();
  assert.equal(reel(1)?.status, "MANUAL_REVIEW");
  assert.equal(reel(1)?.rejectReason, null);
  assert.equal(reel(1)?.review?.kind, "NEW_REEL");
  assert.equal(reel(1)?.review?.attempts, 3);
  assert.equal(sent.length, 1);
  assert.match(sent[0].text, /qo'lda tekshiradi/);
  assert.equal(provider.requests.length, 3);
  assert.equal(stats.manualReviews().length, 1);
  assert.equal(stats.ranking().length, 0);
});

test("admin approves a manual review: the Reel joins the rating and is not sent back while unreadable", async () => {
  const { provider, stats, sent, join, reel, setNow } = setup();
  provider.set("GONE01", null);
  join(1, "GONE01");
  await threeAttempts(stats, 1);

  stats.decideManualReview("GONE01", { approve: true, note: "Video ochiq, mahsulot ko'rinadi" }, "Admin");
  assert.equal(reel(1)?.status, "ACCEPTED");
  assert.equal(reel(1)?.review?.decision?.approved, true);
  assert.equal(reel(1)?.review?.decision?.by, "Admin");
  assert.match(sent.at(-1)?.text ?? "", /administrator tomonidan tekshirildi/);
  assert.deepEqual(stats.ranking().map((e) => [e.participant.telegramId, e.views]), [[1, 0]]);

  // Apify hamon topa olmaydi — admin ko'rgan video qayta-qayta tekshiruvga tushmaydi.
  for (const day of ["2026-12-02", "2026-12-03", "2026-12-04"]) {
    setNow(`${day} 06:01`);
    await stats.syncAll("schedule");
  }
  assert.equal(reel(1)?.status, "ACCEPTED");

  // Apify topdi — ko'rishlar yoziladi.
  provider.set("GONE01", { owner: "ali", views: 4_200 });
  setNow("2026-12-05 06:01");
  await stats.syncAll("schedule");
  assert.equal(reel(1)?.history.at(-1)?.views, 4_200);
  assert.equal(stats.ranking()[0]?.views, 4_200);
});

test("admin rejects a manual review: the reason is sent and a new link can be submitted", async () => {
  const { participants, provider, stats, sent, join, reel } = setup();
  provider.set("GONE01", null);
  join(1, "GONE01");
  await threeAttempts(stats, 1);

  stats.decideManualReview("GONE01", { approve: false, reason: "NOT_FOUND", note: "Akkaunt yopiq" }, "Admin");
  assert.equal(reel(1)?.status, "REJECTED");
  assert.equal(reel(1)?.rejectReason, "NOT_FOUND");
  assert.match(sent.at(-1)?.text ?? "", /topilmadi/);
  assert.throws(
    () => stats.decideManualReview("GONE01", { approve: true, note: "" }, "Admin"),
    /qo'lda tekshiruvda emas/,
  );

  participants.submitReel(1, "https://www.instagram.com/reel/NEWONE1/", "NEWONE1");
  assert.equal(reel(1)?.status, "PENDING");
});

test("a manual review closes itself when a later sync finds the Reel", async () => {
  const { provider, stats, join, reel, setNow } = setup();
  provider.set("LATE01", null);
  join(1, "LATE01");
  await threeAttempts(stats, 1);
  assert.equal(reel(1)?.status, "MANUAL_REVIEW");

  provider.set("LATE01", { owner: "vali", views: 7_000 });
  setNow("2026-12-02 06:01");
  const report = await stats.syncAll("schedule");
  assert.equal(report.resolved, 1);
  assert.equal(reel(1)?.status, "ACCEPTED");
  assert.equal(reel(1)?.review?.decision?.by, "Avtomatik");
  assert.equal(stats.ranking()[0]?.views, 7_000);
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

test("a one-off miss is forgiven when the quick re-check finds the Reel", async () => {
  const { provider, stats, join, reel, setNow } = setup();
  provider.set("AAAAA1", { owner: "a", views: 1_000 });
  join(1, "AAAAA1");
  await stats.flushVerification();

  provider.set("AAAAA1", null);
  setNow("2026-12-02 06:01");
  await stats.syncAll("schedule");
  provider.set("AAAAA1", { owner: "a", views: 1_500 });
  stats.queueVerification(1);
  await stats.flushVerification();
  assert.equal(reel(1)?.status, "ACCEPTED");
  assert.equal(reel(1)?.misses, 0);
  assert.equal(reel(1)?.history.at(-1)?.views, 1_500);
});

test("an accepted Reel missing in a sync is re-checked within minutes; 3 misses → manual review", async () => {
  const { provider, stats, sent, join, reel, setNow } = setup();
  provider.set("AAAAA1", { owner: "a", views: 1_000 });
  join(1, "AAAAA1");
  await stats.flushVerification();

  // Yig'ishda topilmadi — keyingi yig'ishni (10 kun) kutmasdan, 2 va 10 daqiqadan keyin qayta tekshiriladi.
  provider.set("AAAAA1", null);
  setNow("2026-12-02 06:01");
  const sync = await stats.syncAll("schedule");
  assert.equal(sync.missing, 1);
  assert.equal(reel(1)?.status, "ACCEPTED");
  stats.queueVerification(1); // 2 daqiqalik taymer o'rniga
  await stats.flushVerification();
  assert.equal(reel(1)?.status, "ACCEPTED");
  assert.equal(reel(1)?.misses, 2);
  stats.queueVerification(1); // 10 daqiqalik taymer o'rniga
  await stats.flushVerification();
  assert.equal(reel(1)?.status, "MANUAL_REVIEW");
  assert.equal(reel(1)?.review?.kind, "LOST_REEL");
  assert.equal(stats.ranking().length, 0);
  assert.match(sent.at(-1)?.text ?? "", /reytingda vaqtincha hisobga olinmaydi/);

  provider.set("AAAAA1", { owner: "a", views: 1_200 });
  setNow("2026-12-05 06:01");
  const report = await stats.syncAll("schedule");
  assert.equal(report.resolved, 1);
  assert.equal(reel(1)?.status, "ACCEPTED");
  assert.equal(stats.ranking()[0]?.views, 1_200);
  assert.equal(sent.length, 3); // qabul, qo'lda tekshiruv, qaytdi
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
  assert.deepEqual(reel(1)?.flags.map((f) => f.type).sort(), ["ENGAGEMENT_GAP", "LOW_ENGAGEMENT", "VIEW_SPIKE"]);

  // Instagram sun'iy ko'rishlarni tozaladi.
  setNow("2026-12-04 06:01");
  provider.set("AAAAA1", { owner: "a", views: 30_000, likes: 1_100 });
  await stats.syncAll("schedule");
  assert.ok(reel(1)?.flags.some((f) => f.type === "VIEW_DROP"));
  assert.equal(reel(1)?.status, "ACCEPTED");
  assert.equal(reel(1)?.flags.filter((f) => f.type === "LOW_ENGAGEMENT").length, 1);
});

test("views jumping while likes stay flat is flagged; organic growth with likes is not", async () => {
  const { provider, stats, join, reel, setNow } = setup();
  for (const code of ["AAAAA1", "BBBBB2"]) provider.set(code, { owner: code.toLowerCase(), views: 20_000, likes: 800 });
  join(1, "AAAAA1");
  join(2, "BBBBB2");
  await stats.flushVerification();

  setNow("2026-12-02 06:01");
  for (const code of ["AAAAA1", "BBBBB2"]) provider.set(code, { owner: code.toLowerCase(), views: 25_000, likes: 1_000 });
  await stats.syncAll("schedule");

  // Ikkalasi ham kuniga +5 000 dan +35 000 ga (7×, VIEW_SPIKE emas). Birinchisida layklar
  // deyarli o'smagan (reklama), ikkinchisida o'sish bilan birga oshgan (organik).
  setNow("2026-12-03 06:01");
  provider.set("AAAAA1", { owner: "aaaaa1", views: 60_000, likes: 1_050 });
  provider.set("BBBBB2", { owner: "bbbbb2", views: 60_000, likes: 2_400 });
  await stats.syncAll("schedule");

  assert.deepEqual(reel(1)?.flags.map((f) => f.type), ["ENGAGEMENT_GAP"]);
  assert.match(reel(1)?.flags[0].detail ?? "", /\+35 000 ko'rish, \+50 layk \(layk ulushi 4\.0% → 0\.14%\)/);
  assert.deepEqual(reel(2)?.flags, []);
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

  const ending = setup({ endsAt: "2026-12-20 12:00" });
  ending.setNow("2026-12-20 12:00");
  assert.equal(ending.stats.dueReason(), "final");
  await ending.stats.syncAll("final");
  ending.setNow("2026-12-21 06:00");
  assert.equal(ending.stats.dueReason(), null);
});

test("every 10 days from the contest start: 5 Dec, 15 Dec, 25 Dec, then the final sync", async () => {
  const s = setup({ everyDays: 10, startsOn: "2026-11-25", endsAt: "2027-01-01 12:00" });
  const next = () => s.stats.nextSyncAt()?.toISOString();

  // Tanlovdan oldin va boshlangan kuni — birinchi yangilanish 5-dekabr.
  s.setNow("2026-11-20 10:00");
  assert.equal(s.stats.dueReason(), null);
  assert.equal(next(), tashkent("2026-12-05 06:00").toISOString());
  s.setNow("2026-11-25 07:00");
  assert.equal(s.stats.dueReason(), null);

  s.setNow("2026-12-05 06:00");
  assert.equal(s.stats.dueReason(), "schedule");
  await s.stats.syncAll("schedule");
  assert.equal(s.stats.dueReason(), null);
  assert.equal(next(), tashkent("2026-12-15 06:00").toISOString());

  // 15-dekabrgacha yig'ilmaydi.
  s.setNow("2026-12-14 23:59");
  assert.equal(s.stats.dueReason(), null);

  // Server 15-dekabrda o'chiq turgan bo'lsa — yoqilganda yetib oladi.
  s.setNow("2026-12-17 09:00");
  assert.equal(s.stats.dueReason(), "schedule");
  await s.stats.syncAll("schedule");
  assert.equal(next(), tashkent("2026-12-25 06:00").toISOString());

  // 25-dekabrdan keyin navbatdagisi (4-yanvar) tanlovdan keyin — demak, yakuniy yig'ish.
  s.setNow("2026-12-25 06:00");
  await s.stats.syncAll("schedule");
  assert.equal(next(), tashkent("2027-01-01 12:00").toISOString());

  s.setNow("2027-01-01 12:00");
  assert.equal(s.stats.dueReason(), "final");
  await s.stats.syncAll("final");
  assert.equal(s.stats.dueReason(), null);
  assert.equal(next(), undefined);
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

test("the final sync after the end is recorded on the last contest day", async () => {
  const s = setup({ endsAt: "2026-12-21 00:00" });
  s.setNow("2026-12-10 10:00");
  s.provider.set("FINAL1", { owner: "ali", views: 1_000 });
  s.join(1, "FINAL1");
  await s.stats.flushVerification();
  s.provider.set("FINAL1", { owner: "ali", views: 9_000 });
  s.setNow("2026-12-21 06:00");
  assert.equal(s.stats.dueReason(), "final");
  await s.stats.syncAll("final");
  const last = s.reel(1)?.history.at(-1);
  assert.equal(last?.date, "2026-12-20", "oxirgi tanlov kuni");
  assert.equal(last?.views, 9_000);
});

test("every Reel of a participant is verified on its own; views add up in the rating", async () => {
  const { provider, stats, sent, join, submit, reelOf, setNow } = setup();
  provider.set("AAAAA1", { owner: "ali", views: 1_000 });
  provider.set("PHOTO2", { owner: "ali", isVideo: false });
  provider.set("BBBBB3", { owner: "ali_ikkinchi", views: 4_000 });
  provider.set("GONE04", null);
  join(1, "AAAAA1");
  submit(1, "PHOTO2");
  submit(1, "BBBBB3");
  submit(1, "GONE04");
  await stats.flushVerification();
  assert.deepEqual(provider.requests, [["AAAAA1", "PHOTO2", "BBBBB3", "GONE04"]], "bitta so'rovda");

  assert.equal(reelOf(1, "AAAAA1")?.status, "ACCEPTED");
  assert.equal(reelOf(1, "PHOTO2")?.rejectReason, "NOT_A_VIDEO");
  assert.equal(reelOf(1, "BBBBB3")?.status, "ACCEPTED", "o'zining ikkinchi akkaunti — OWNER_TAKEN emas");
  assert.equal(reelOf(1, "GONE04")?.status, "PENDING");
  assert.equal(reelOf(1, "GONE04")?.misses, 1);
  assert.deepEqual(stats.ranking().map((e) => [e.participant.telegramId, e.views, e.reels.length]), [[1, 5_000, 2]]);
  // Har bir natija — alohida xabar, qaysi video ekani bilan.
  assert.equal(sent.length, 3);
  assert.ok(sent.some((m) => m.text.includes("/reel/PHOTO2/") && /Reel \(video\) emas/.test(m.text)));

  // Qayta urinish faqat topilmagan videoga tegishli: boshqalar qayta so'ralmaydi.
  stats.queueVerification(1, "GONE04");
  await stats.flushVerification();
  assert.deepEqual(provider.requests.at(-1), ["GONE04"]);
  assert.equal(reelOf(1, "GONE04")?.misses, 2);

  // Muntazam yig'ish — rad etilmagan hamma videolar (qo'lda tekshiruvdagi va PENDING ham).
  setNow("2026-12-02 06:01");
  provider.set("AAAAA1", { owner: "ali", views: 3_000 });
  provider.set("BBBBB3", { owner: "ali_ikkinchi", views: 4_500 });
  provider.set("GONE04", { owner: "ali", views: 10_000 });
  const report = await stats.syncAll("schedule");
  assert.equal(report.total, 3);
  assert.deepEqual(provider.requests.at(-1)?.slice().sort(), ["AAAAA1", "BBBBB3", "GONE04"]);
  assert.equal(reelOf(1, "GONE04")?.status, "ACCEPTED");
  assert.equal(stats.ranking()[0]?.views, 17_500);
});

test("ranking: sums decide, ties go to the earlier first accepted submission, rank delta compares sums", async () => {
  const { provider, stats, join, submit, setNow } = setup();
  provider.set("ONE001", { owner: "a", views: 6_000 });
  provider.set("TWO001", { owner: "b", views: 4_000 });
  provider.set("TWO002", { owner: "b", views: 2_000 });
  join(1, "ONE001");
  join(2, "TWO001");
  submit(2, "TWO002");
  await stats.flushVerification();
  // 6 000 = 4 000 + 2 000 — teng: 1-ishtirokchi birinchi videosini oldinroq yuborgan.
  assert.deepEqual(stats.ranking().map((e) => [e.participant.telegramId, e.rank, e.views]), [
    [1, 1, 6_000],
    [2, 2, 6_000],
  ]);

  setNow("2026-12-02 06:01");
  provider.set("TWO002", { owner: "b", views: 2_500 });
  await stats.syncAll("schedule");
  assert.deepEqual(stats.ranking().map((e) => [e.participant.telegramId, e.rank, e.views, e.rankDelta]), [
    [2, 1, 6_500, 1],
    [1, 2, 6_000, -1],
  ]);
});

test("a lost Reel leaves the sum and goes to manual review on its own; the others stay", async () => {
  const { provider, stats, join, submit, reelOf, setNow } = setup();
  provider.set("KEEP01", { owner: "a", views: 1_000 });
  provider.set("LOST02", { owner: "a", views: 9_000 });
  join(1, "KEEP01");
  submit(1, "LOST02");
  await stats.flushVerification();
  assert.equal(stats.ranking()[0]?.views, 10_000);

  provider.set("LOST02", null);
  setNow("2026-12-02 06:01");
  await stats.syncAll("schedule");
  stats.queueVerification(1, "LOST02");
  await stats.flushVerification();
  stats.queueVerification(1, "LOST02");
  await stats.flushVerification();
  assert.equal(reelOf(1, "LOST02")?.status, "MANUAL_REVIEW");
  assert.equal(reelOf(1, "KEEP01")?.status, "ACCEPTED");
  assert.equal(reelOf(1, "KEEP01")?.misses, 0);
  assert.equal(stats.ranking()[0]?.views, 1_000);

  // Admin qarori shortcode bo'yicha aynan shu videoga.
  stats.decideManualReview("LOST02", { approve: false, reason: "NOT_FOUND", note: "O'chirilgan" }, "Admin");
  assert.equal(reelOf(1, "LOST02")?.status, "REJECTED");
  assert.equal(reelOf(1, "KEEP01")?.status, "ACCEPTED");
  assert.equal(stats.status().reels.rejected, 1);
  assert.equal(stats.status().reels.accepted, 1);
});
