import assert from "node:assert/strict";
import { test } from "node:test";

import { HttpException } from "@nestjs/common";

import { AdLibraryProvider, MockAdLibraryProvider, type AdHit } from "../instagram/ad-library";
import { MockReelStatsProvider } from "../instagram/mock.provider";
import { ParticipantsService } from "../participants/participants.service";
import { RulesService } from "../rules/rules.service";
import { StatsService } from "../stats/stats.service";
import type { ParticipantNotifier } from "../telegram/notifier";
import type { Screenshot } from "./screenshot";
import { TargetsService } from "./targets.service";

const at = (day: string) => new Date(`${day}T07:00:00+05:00`);

async function setup(checkTop = 2) {
  let now = at("2026-12-01");
  const clock = () => now;
  const participants = new ParticipantsService(new RulesService());
  const reels = new MockReelStatsProvider();
  const sent: { chatId: number; text: string }[] = [];
  const notifier: ParticipantNotifier = {
    notify: (chatId, text) => {
      sent.push({ chatId, text });
      return Promise.resolve();
    },
  };
  const stats = new StatsService(participants, reels, notifier, {
    syncTime: "06:00",
    everyDays: 1,
    verifyDelayMs: 0,
    contestStartsOn: "2026-11-30",
    contestEndsAt: at("2027-02-25"),
    clock,
  });
  const ads = new MockAdLibraryProvider();
  const targets = new TargetsService(participants, stats, ads, notifier, {
    checkTop,
    everyDays: 1,
    contestStartsOn: "2026-11-30",
    contestEndsAt: at("2027-02-25"),
    clock,
  });

  // 1-o'rin: user1 (30 000), 2: user2 (20 000), 3: user3 (10 000).
  for (const [id, views] of [
    [1, 30_000],
    [2, 20_000],
    [3, 10_000],
  ] as const) {
    participants.setPhone(id, id, `+99890000000${id}`);
    participants.register(id, `Ism${id}`, `Familiya${id}`, 25);
    participants.acceptRules(id, 1);
    participants.submitReel(id, `https://www.instagram.com/reel/CODE${id}x/`, `CODE${id}x`);
    reels.set(`CODE${id}x`, { owner: `user${id}`, views, likes: views / 20 });
    stats.queueVerification(id);
  }
  await stats.flushVerification();
  sent.length = 0;
  /** Mavjud ishtirokchining yana bir videosi (qabul qilinadi). */
  const addReel = async (id: number, shortcode: string, owner: string, views: number) => {
    participants.submitReel(id, `https://www.instagram.com/reel/${shortcode}/`, shortcode);
    reels.set(shortcode, { owner, views, likes: views / 20 });
    stats.queueVerification(id, shortcode);
    await stats.flushVerification();
    sent.length = 0;
  };
  return { participants, stats, ads, targets, sent, addReel, setNow: (day: string) => (now = at(day)) };
}

const ad = (id: string, startedOn = "2026-11-28") => ({
  adId: id,
  startedOn,
  platforms: ["INSTAGRAM"],
  url: `https://www.facebook.com/ads/library/?id=${id}`,
});

const status = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    return e instanceof HttpException ? e.getStatus() : -1;
  }
  return 0;
};

test("only the rating leaders are checked in the ad library; active ads open a case", async () => {
  const { ads, targets } = await setup(2);
  ads.set("user2", [ad("111")]);
  ads.set("user3", [ad("333")]); // 3-o'rin — top-2 ga kirmaydi

  const report = await targets.checkAds("admin");
  assert.deepEqual(ads.requests, [["user1", "user2"]]);
  assert.equal(report.checked, 2);
  assert.equal(report.found, 1);

  const list = targets.list({});
  assert.equal(list.total, 1);
  const item = list.items[0];
  assert.equal(item.method, "AD_LIBRARY");
  assert.equal(item.participant.instagramUsername, "user2");
  assert.equal(item.status, "NEW");
  assert.equal(item.rank, 2);
  assert.match(item.evidence, /1 ta faol reklama \(28\.11\.2026 dan\)/);
  assert.equal(targets.get(item.id).evidenceUrl, "https://www.facebook.com/ads/library/?id=111");
});

test("a stopped ad is marked OFF in history and switching back ON reuses the same case", async () => {
  const { ads, targets, setNow } = await setup();
  ads.set("user1", [ad("1")]);
  await targets.checkAds("schedule");
  const id = targets.list({}).items[0].id;

  setNow("2026-12-02");
  ads.set("user1", []);
  await targets.checkAds("schedule");
  assert.equal(targets.get(id).currentState, "OFF");

  setNow("2026-12-03");
  ads.set("user1", [ad("2")]);
  await targets.checkAds("schedule");
  const detail = targets.get(id);
  assert.equal(detail.currentState, "ON");
  assert.deepEqual(
    detail.history.map((h) => h.state),
    ["ON", "OFF", "ON"],
  );
  assert.equal(targets.list({}).total, 1);
});

test("view spikes from growth analysis become cases once", async () => {
  const { participants, targets } = await setup();
  const reel = participants.get(3)!.reels[0]!;
  reel.flags.push({ type: "VIEW_SPIKE", date: "2026-12-01", detail: "kuniga +500 → +60 000" });
  reel.flags.push({ type: "LOW_ENGAGEMENT", date: "2026-12-01", detail: "test" });

  assert.equal(targets.scanGrowth(), 1);
  assert.equal(targets.scanGrowth(), 0);
  const item = targets.list({}).items[0];
  assert.equal(item.method, "GROWTH_ANALYSIS");
  assert.match(item.evidence, /\+60 000/);
});

test("admin decisions: warn notifies, disqualify removes from the rating, closed cases stay closed", async () => {
  const { ads, targets, stats, sent } = await setup();
  ads.set("user1", [ad("1")]);
  ads.set("user2", [ad("2")]);
  await targets.checkAds("admin");
  const [b, a] = targets.list({}).items.sort((x, y) => (x.rank ?? 0) - (y.rank ?? 0)).reverse();

  assert.equal(status(() => targets.act(a.id, "warn", "qisqa", "Admin")), 0);
  assert.equal(targets.get(a.id).status, "WARNED");
  assert.match(sent.at(-1)?.text ?? "", /Ogohlantirish/);
  assert.equal(status(() => targets.act(a.id, "warn", "Yana bir bor", "Admin")), 409);
  assert.equal(status(() => targets.act(a.id, "dismiss", "yo'q", "Admin")), 400);

  targets.act(b.id, "disqualify", "Reklama tasdiqlandi", "Admin");
  assert.equal(targets.get(b.id).participant.status, "DISQUALIFIED");
  assert.ok(!stats.ranking().some((e) => String(e.participant.telegramId) === b.participant.id));
  assert.match(sent.at(-1)?.text ?? "", /chetlashtirildingiz/);

  const open = targets.list({ status: "OPEN" });
  assert.equal(open.total, 1);
  assert.equal(open.statusCounts.ALL, 2);
  assert.equal(open.statusCounts.DISQUALIFIED, 1);
  assert.equal(targets.list({ search: "user1" }).total, 1);
});

test("ad library is checked daily even between view syncs; growth is scanned after each sync", async () => {
  const { ads, participants, stats, targets, setNow } = await setup();
  const settle = () => new Promise((r) => setTimeout(r, 0));

  targets.tick();
  await settle();
  targets.tick(); // o'sha kun — qayta tekshirilmaydi
  await settle();
  assert.equal(ads.requests.length, 1);

  // Ertasi kuni ko'rishlar yig'ilmagan bo'lsa ham reklama kutubxonasi tekshiriladi.
  setNow("2026-12-02");
  targets.tick();
  await settle();
  assert.equal(ads.requests.length, 2);

  // O'sish tahlili esa yangi yig'ishdan keyin.
  participants.get(2)!.reels[0]!.flags.push({ type: "VIEW_SPIKE", date: "2026-12-02", detail: "+1 → +90 000" });
  targets.tick();
  assert.equal(targets.list({}).total, 0);
  await stats.syncAll("schedule");
  targets.tick();
  assert.equal(targets.list({}).items[0]?.method, "GROWTH_ANALYSIS");
});

test("a failed ad library check is retried after an hour, not every minute", async () => {
  const { participants, stats } = await setup();
  let calls = 0;
  class FailingAds extends AdLibraryProvider {
    readonly name = "failing";
    check(): Promise<Map<string, AdHit[]>> {
      calls += 1;
      return Promise.reject(new Error("Apify ishlamayapti"));
    }
  }
  let now = at("2026-12-01");
  const notifier: ParticipantNotifier = { notify: () => Promise.resolve() };
  const targets = new TargetsService(participants, stats, new FailingAds(), notifier, {
    checkTop: 2,
    everyDays: 1,
    contestStartsOn: "2026-11-30",
    contestEndsAt: at("2027-02-25"),
    clock: () => now,
  });
  const settle = () => new Promise((r) => setTimeout(r, 0));

  targets.tick();
  await settle();
  assert.match(targets.lastCheck?.error ?? "", /Apify ishlamayapti/);
  now = new Date(now.getTime() + 30 * 60_000);
  targets.tick();
  await settle();
  assert.equal(calls, 1);
  now = new Date(now.getTime() + 31 * 60_000);
  targets.tick();
  await settle();
  assert.equal(calls, 2);
});

test("monthly schedule: days 30, 60, 90 from the contest start, nothing after the end", async () => {
  const { participants, stats } = await setup();
  const ads = new MockAdLibraryProvider();
  let now = at("2026-12-01");
  const notifier: ParticipantNotifier = { notify: () => Promise.resolve() };
  const targets = new TargetsService(participants, stats, ads, notifier, {
    checkTop: 2,
    everyDays: 30,
    contestStartsOn: "2026-11-25",
    contestEndsAt: new Date("2027-02-25T19:00:00Z"),
    clock: () => now,
  });
  const settle = () => new Promise((r) => setTimeout(r, 0));
  const tickOn = async (day: string) => {
    now = at(day);
    targets.tick();
    await settle();
    return ads.requests.length;
  };

  assert.equal(targets.nextCheckOn(), "2026-12-25");
  assert.equal(await tickOn("2026-12-24"), 0);
  assert.equal(await tickOn("2026-12-25"), 1);
  assert.equal(await tickOn("2026-12-26"), 1);
  assert.equal(targets.nextCheckOn(), "2027-01-24");
  assert.equal(await tickOn("2027-01-24"), 2);
  assert.equal(await tickOn("2027-02-23"), 3);
  // Keyingisi (2027-03-25) tanlov tugagandan keyin — rejada yo'q.
  assert.equal(targets.nextCheckOn(), null);
  assert.equal(await tickOn("2027-03-25"), 3);

  // Admin istalgan vaqtda qo'lda tekshira oladi.
  await targets.checkAds("admin");
  assert.equal(ads.requests.length, 4);
});

const jpeg = (size = 2_000): Screenshot => ({
  mime: "image/jpeg",
  data: Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(size)]),
});

const code = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    if (e instanceof HttpException) return (e.getResponse() as { code?: string }).code ?? e.getStatus();
    throw e;
  }
  return "OK";
};

test("participants report ads with a screenshot; reports on one person gather in one case", async () => {
  const { targets } = await setup();
  const report = (from: number, target: string) => () =>
    targets.report(from, { target, screenshot: jpeg(), comment: "Lentamda reklama chiqdi" });

  assert.equal(code(report(2, "https://www.instagram.com/reel/CODE1x/")), "OK");
  assert.equal(code(report(3, "@User1")), "OK");

  const list = targets.list({});
  assert.equal(list.total, 1);
  const item = list.items[0];
  assert.equal(item.method, "REPORT");
  assert.equal(item.participant.instagramUsername, "user1");
  assert.match(item.evidence, /2 ta skrinshot \(2 kishidan\)/);

  const detail = targets.get(item.id);
  assert.equal(detail.attachments.length, 2);
  assert.equal(detail.reports[0].reporter.fullName, "Ism2 Familiya2");
  assert.equal(detail.reports[0].comment, "Lentamda reklama chiqdi");
  const image = targets.attachment(item.id, detail.attachments[0].id);
  assert.equal(image.mime, "image/jpeg");
  assert.equal(code(() => targets.attachment(item.id, "att_x")), 404);
});

test("reports are validated: unknown account, self, duplicates and the daily limit", async () => {
  const { targets, setNow } = await setup();
  const report = (from: number, target: string) => () => targets.report(from, { target, screenshot: jpeg(), comment: null });

  assert.equal(code(report(2, "begona_akkaunt")), "REPORT_NOT_FOUND");
  assert.equal(code(report(2, "bu link emas!")), "REPORT_TARGET_INVALID");
  assert.equal(code(report(1, "user1")), "REPORT_SELF");
  assert.equal(code(report(2, "user1")), "OK");
  assert.equal(code(report(2, "https://instagram.com/user1/")), "REPORT_DUPLICATE");
  assert.equal(code(report(99, "user1")), "UNAUTHORIZED");

  // Ertasi kuni — yana yuborish mumkin, lekin kuniga 5 tadan ko'p emas.
  setNow("2026-12-02");
  assert.equal(code(report(2, "user1")), "OK");
  assert.equal(code(report(2, "user3")), "OK");
  for (const t of ["https://www.instagram.com/reel/CODE3x/", "@user1"]) assert.equal(code(report(2, t)), "REPORT_DUPLICATE");
  assert.equal(targets.list({}).total, 2);
});

test("growth analysis: a spike without new likes becomes one case with both signals", async () => {
  const { participants, targets } = await setup();
  const reel = participants.get(2)!.reels[0]!;
  reel.flags.push({ type: "VIEW_SPIKE", date: "2026-12-01", detail: "kuniga +2 000 → +80 000" });
  reel.flags.push({ type: "ENGAGEMENT_GAP", date: "2026-12-01", detail: "+80 000 ko'rish, +40 layk" });
  reel.flags.push({ type: "ENGAGEMENT_GAP", date: "2026-12-03", detail: "+30 000 ko'rish, +10 layk" });

  assert.equal(targets.scanGrowth(), 2);
  const evidence = targets
    .list({})
    .items.map((i) => i.evidence)
    .sort();
  assert.match(evidence[0], /^Keskin o'sish .*layklar esa o'smagan/);
  assert.match(evidence[1], /^Ko'rishlar oshgan, layklar o'smagan/);
});

test("several accounts: every live account of a leader is checked; one case per participant", async () => {
  const { ads, targets, addReel } = await setup(1);
  await addReel(1, "SECOND1", "user1.food", 5_000);
  ads.set("user1.food", [ad("901"), ad("902", "2026-11-20")]);
  ads.set("user1", [ad("903")]);

  const report = await targets.checkAds("admin");
  assert.deepEqual(ads.requests, [["user1", "user1.food"]]);
  assert.deepEqual([report.checked, report.found], [2, 2]);
  const list = targets.list({});
  assert.equal(list.total, 1);
  assert.match(list.items[0].evidence, /3 ta faol reklama \(20\.11\.2026 dan\) — @user1, @user1\.food/);
  assert.equal(list.items[0].views, 30_000, "reytingdagi eng ko'p ko'rilgan video (ko'rishlar qo'shilmaydi)");
  assert.equal(targets.list({ search: "user1.food" }).total, 1);
});

test("growth analysis and reports point at the exact Reel; a warning names that video", async () => {
  const { participants, targets, sent, addReel } = await setup();
  await addReel(3, "SPIKE3", "user3", 40_000);
  const spiky = participants.get(3)!.reels.find((r) => r.shortcode === "SPIKE3")!;
  spiky.flags.push({ type: "VIEW_SPIKE", date: "2026-12-01", detail: "kuniga +500 → +60 000" });
  // Boshqa videoning shu kungi belgisi — alohida holat.
  participants.get(3)!.reels[0]!.flags.push({ type: "VIEW_SPIKE", date: "2026-12-01", detail: "kuniga +1 → +50 000" });
  assert.equal(targets.scanGrowth(), 2);
  assert.equal(targets.scanGrowth(), 0);

  const spikeCase = targets.list({}).items.find((i) => i.reelUrl.includes("SPIKE3"));
  assert.ok(spikeCase);
  assert.equal(spikeCase.participant.instagramUsername, "user3");
  targets.act(spikeCase.id, "warn", "Reklama aniqlandi", "Admin");
  assert.match(sent.at(-1)?.text ?? "", /Ogohlantirish[\s\S]*instagram\.com\/reel\/SPIKE3\//);

  // Shikoyat ikkinchi video linki orqali — holat shu video bilan ochiladi.
  const reported = targets.list({}).total;
  targets.report(1, { target: "https://www.instagram.com/reel/SPIKE3/", screenshot: jpeg(), comment: null });
  const report = targets.list({}).items.find((i) => i.method === "REPORT");
  assert.equal(targets.list({}).total, reported + 1);
  assert.equal(report?.reelUrl, "https://www.instagram.com/reel/SPIKE3/");
});
