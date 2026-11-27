import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { HttpException } from "@nestjs/common";

import { AuditService, type AuditActor } from "../audit/audit.service";
import { ContestSettingsService } from "../contest/contest-settings.service";
import { DrawsService, mainPrizeId } from "../draws/draws.service";
import { MockAdLibraryProvider } from "../instagram/ad-library";
import { MockReelStatsProvider } from "../instagram/mock.provider";
import { ParticipantsService } from "../participants/participants.service";
import { StateStore } from "../persistence/state-store";
import { RulesService } from "../rules/rules.service";
import { formatCount, StatsService } from "../stats/stats.service";
import { TargetsService } from "../targets/targets.service";
import type { ParticipantNotifier } from "../telegram/notifier";
import { parseConfirm, parseManualCheck, parseSkip, WinnerService } from "./winner.service";

const at = (day: string, time = "10:00") => new Date(`${day}T${time}:00+05:00`);
const ADMIN: AuditActor = { id: "adm_boss", name: "Bosh Admin", role: "ADMIN" };

/** Ishtirokchilar ko'rishlari: 1–4 — avtomobil oralig'ida (4 000 001+), 5 — iPhone oralig'ida. */
const VIEWS: Record<string, number> = { "1": 4_400_000, "2": 4_300_000, "3": 4_200_000, "4": 4_100_000, "5": 600_000 };
const nameOf = (id: string) => `Ism${id} Familiya${id}`;

/**
 * Tanlov: 01.12–31.12.2026 (tugashi — 01.01.2027 00:00, Toshkent); "bugun" — 20.12.2026.
 * Avtomobil g'olibi — random tanlov (oferta 6.2, 9.1): nomzodlar navbati `drawCar()` dan keyin paydo bo'ladi.
 */
async function setup() {
  let now = at("2026-12-20");
  const clock = () => now;
  const contest = new ContestSettingsService();
  contest.update({ startsOn: "2026-12-01", endsOn: "2026-12-31", syncTime: "06:00", minAge: 18 }, "Test", at("2026-01-01"));

  const participants = new ParticipantsService(new RulesService());
  const provider = new MockReelStatsProvider();
  const sent: { chatId: number; text: string }[] = [];
  const delivery = { fail: false };
  const notifier: ParticipantNotifier = {
    notify: (chatId, text) => {
      if (delivery.fail) return Promise.reject(new Error("Forbidden: bot was blocked by the user"));
      sent.push({ chatId, text });
      return Promise.resolve();
    },
  };
  const stats = new StatsService(participants, provider, notifier, {
    syncTime: "06:00",
    everyDays: 0,
    verifyDelayMs: 0,
    contestStartsOn: "2026-12-01",
    get contestEndsAt() {
      return contest.endsAt;
    },
    clock,
  });
  const ads = new MockAdLibraryProvider();
  const targets = new TargetsService(participants, stats, ads, notifier, {
    checkTop: 10,
    everyDays: 0,
    contestStartsOn: "2026-12-01",
    contestEndsAt: contest.endsAt,
    clock,
  });
  const audit = new AuditService();
  const draws = new DrawsService(participants, notifier, { clock, sendIntervalMs: 0 });
  const make = (store: StateStore | null = null) =>
    new WinnerService(participants, stats, targets, contest, audit, notifier, { clock }, store, draws);

  for (const [id, views] of Object.entries(VIEWS).map(([id, v]) => [Number(id), v] as const)) {
    participants.setPhone(id, id, `+99890000000${id}`);
    participants.register(id, `Ism${id}`, `Familiya${id}`, 25);
    participants.acceptRules(id, 1);
    const reel = participants.submitReel(id, `https://www.instagram.com/reel/CODE${id}x/`, `CODE${id}x`);
    reel.submittedAt = at("2026-12-05"); // aksiya davri ichida (asosiy sovrin tanlovi shunga qaraydi)
    provider.set(`CODE${id}x`, { owner: `user${id}`, views, likes: views / 20 });
    stats.queueVerification(id);
  }
  await stats.flushVerification();
  sent.length = 0;

  /** Avtomobil tanlovini o'tkazadi; nomzodlar navbati (g'olib, so'ng zaxiralar) — ishtirokchi ID lari. */
  const drawCar = (): string[] => {
    const settings = draws.setup().mainDefaults.find((d) => d.prizeId === mainPrizeId("car"));
    assert.ok(settings, "avtomobil tanlovi sozlamalari yo'q");
    // Asosiy sovrin tanlovi aksiya tugagach o'tkaziladi (oferta 6.2.1) — tanlov paytiga o'tib, qaytamiz.
    const before = now;
    now = at("2027-02-28");
    const draw = draws.run({ ...settings }, "Admin");
    now = before;
    return [...draw.winnerEntries, ...draw.reserveEntries].map((e) => e.candidate.participantId);
  };

  return {
    winner: make(),
    make,
    participants,
    provider,
    stats,
    ads,
    targets,
    audit,
    draws,
    drawCar,
    sent,
    delivery,
    setNow: (day: string, time?: string) => {
      now = at(day, time);
    },
    /** Tanlov tugadi va yakuniy ko'rishlar yig'ildi. */
    finish: async () => {
      now = at("2027-01-01", "00:05");
      await stats.syncAll("final");
      now = at("2027-01-01");
    },
  };
}

const status = (fn: () => unknown): number => {
  try {
    fn();
  } catch (e) {
    return e instanceof HttpException ? e.getStatus() : -1;
  }
  return 0;
};

const message = (fn: () => unknown): string => {
  try {
    fn();
  } catch (e) {
    if (e instanceof HttpException) return (e.getResponse() as { message: string }).message;
  }
  return "";
};

/** Yagona qo'lda tekshiriladigan band — "Reklama vositalari" (xarid shart emas, oferta 2.7). */
const passAllManual = (winner: WinnerService, participantId: string) => {
  winner.setManualCheck(
    { participantId, check: "AD_TOOLS_REVIEWED", passed: true, note: "Reklama vositalari bo'sh, 2 xodim ko'rdi" },
    ADMIN,
  );
};

test("the car draw's queue decides the candidate: the winner, then reserves in order — not the rating", async () => {
  const { winner, drawCar } = await setup();
  const queue = drawCar();
  assert.equal(queue.length, 4, "1 g'olib + 3 zaxira");
  assert.deepEqual([...queue].sort(), ["1", "2", "3", "4"], "faqat avtomobil oralig'idagilar");
  const o = winner.overview();
  assert.equal(o.candidate?.participant.id, queue[0]);
  assert.deepEqual(
    o.runnersUp.map((r) => [r.rank, r.participantId, r.name, r.views]),
    queue.slice(1).map((id, i) => [i + 2, id, nameOf(id), VIEWS[id]]),
  );
  assert.ok(!o.runnersUp.some((r) => r.participantId === "5"), "reytingda bor, lekin tanlovda yo'q");
});

test("no car draw — no candidate and no runners-up, even after the end; a cancelled draw counts as none", async () => {
  const { winner, draws, drawCar, finish } = await setup();
  assert.equal(winner.overview().candidate, null);
  assert.deepEqual(winner.overview().runnersUp, []);

  await finish();
  const o = winner.overview();
  assert.equal(o.stage, "CANDIDATE");
  assert.equal(o.candidate, null);
  assert.deepEqual(o.runnersUp, []);
  assert.equal(status(() => winner.confirm("1", ADMIN)), 409);
  assert.equal(status(() => winner.skip({ participantId: "1", reason: "Tekshiruvdan o'tmadi" }, ADMIN)), 409);

  drawCar();
  assert.notEqual(winner.overview().candidate, null);
  const car = draws.mainDraw("car");
  assert.ok(car);
  draws.cancel(car.id, "Qayta o'tkaziladi", "Admin");
  assert.equal(winner.overview().candidate, null);
  assert.deepEqual(winner.overview().runnersUp, []);
});

test("before the end the queue's first is only a preview: manual checks work, actions are 409", async () => {
  const { winner, audit, drawCar } = await setup();
  const before = winner.overview();
  assert.equal(before.stage, "NOT_STARTED");
  assert.equal(before.candidate, null, "tanlov o'tkazilmagan");
  assert.deepEqual(before.contest, {
    startsOn: "2026-12-01",
    endsOn: "2026-12-31",
    ended: false,
    daysLeft: 12,
    ratingDate: "2026-12-20",
  });

  const [first, ...rest] = drawCar();
  const o = winner.overview();
  assert.equal(o.stage, "NOT_STARTED");
  assert.equal(o.candidate?.participant.id, first);
  assert.equal(o.candidate?.rank, 1, "navbatdagi o'rni");
  assert.equal(o.candidate?.views, VIEWS[first]);
  assert.equal(o.candidate?.participant.instagramUsername, `user${first}`);
  assert.deepEqual(
    o.runnersUp.map((r) => r.participantId),
    rest,
  );

  assert.equal(status(() => winner.confirm(first, ADMIN)), 409);
  assert.equal(status(() => winner.skip({ participantId: first, reason: "Tekshiruvdan o'tmadi" }, ADMIN)), 409);
  assert.equal(status(() => winner.announce(ADMIN)), 409);

  // Nomzodni oldindan tekshirish mumkin ("Reklama vositalari").
  const after = winner.setManualCheck(
    { participantId: first, check: "AD_TOOLS_REVIEWED", passed: true, note: "Reklama vositalari bo'sh" },
    ADMIN,
  );
  const adTools = after.candidate?.checks.find((c) => c.key === "AD_TOOLS_REVIEWED");
  assert.equal(adTools?.status, "PASSED");
  assert.equal(adTools?.manual, true);
  assert.match(adTools?.detail ?? "", /Reklama vositalari bo'sh — Bosh Admin/);
  const [entry] = audit.list({ entity: "winner" }).items;
  assert.equal(entry?.action, "winner.ad_tools_check");
  assert.equal(entry?.entityId, first);
  assert.equal(entry?.entityLabel, nameOf(first));
  assert.equal(entry?.before, "PENDING");
  assert.equal(entry?.after, "PASSED");
  assert.equal(entry?.reason, "Reklama vositalari bo'sh");

  // Oxirgi kun ham tanlov ichida.
  const { winner: late, setNow } = await setup();
  setNow("2026-12-31", "23:00");
  assert.equal(late.overview().stage, "NOT_STARTED");
  assert.equal(late.overview().contest.daysLeft, 1);
});

test("after the end the car draw's winner is the candidate; automatic checks see targets, reel and flags", async () => {
  const { winner, participants, ads, targets, drawCar, finish } = await setup();
  await finish();
  const [first, second, third, fourth] = drawCar();
  ads.set(`user${second}`, [
    { adId: "111", startedOn: "2026-12-10", platforms: ["INSTAGRAM"], url: "https://example.test/ad/111" },
  ]);
  await targets.checkAds("admin");
  participants
    .get(Number(third))
    ?.reels[0]?.flags.push({ type: "VIEW_SPIKE", date: "2026-12-15", detail: "kuniga +1 000 → +60 000" });

  const o = winner.overview();
  assert.equal(o.stage, "CANDIDATE");
  assert.equal(o.contest.ended, true);
  assert.equal(o.contest.daysLeft, 0);
  assert.equal(o.contest.ratingDate, "2026-12-31");
  assert.equal(o.candidate?.participant.id, first);
  // Xarid tekshirilmaydi (oferta 2.7) — qo'lda faqat "Reklama vositalari".
  assert.deepEqual(
    o.candidate?.checks.map((c) => [c.key, c.status, c.manual]),
    [
      ["NO_TARGET", "PASSED", false],
      ["REEL_AVAILABLE", "PASSED", false],
      ["NO_FAKE_VIEWS", "PASSED", false],
      ["AD_TOOLS_REVIEWED", "PENDING", true],
    ],
  );
  const [r2, r3, r4] = o.runnersUp;
  assert.deepEqual(
    [r2?.participantId, r3?.participantId, r4?.participantId],
    [second, third, fourth],
  );
  assert.equal(r2?.name, nameOf(second));
  assert.match(r2?.issues[0] ?? "", /Target aniqlangan: 2027-01-01 \(Meta reklama kutubxonasi, ko'rib chiqilmagan\)/);
  assert.match(r3?.issues[0] ?? "", /Ko'rishlar keskin oshgan \(2026-12-15\)/);
  assert.deepEqual(r4?.issues, []);

  // Ro'yxatdan chiqarilgan target — to'siq emas.
  const caseId = targets.casesOf(Number(second))[0]?.id ?? "";
  targets.act(caseId, "dismiss", "Reklama boshqa akkauntniki", "Bosh Admin");
  assert.deepEqual(winner.overview().runnersUp[0]?.issues, []);

  // Reel oxirgi tekshiruvda topilmagan — REEL_AVAILABLE o'tmaydi.
  const reel = participants.get(Number(first))?.reels[0];
  if (reel) reel.misses = 1;
  const check = winner.overview().candidate?.checks.find((c) => c.key === "REEL_AVAILABLE");
  assert.equal(check?.status, "FAILED");
  assert.match(check?.detail ?? "", /topilmadi \(1 marta/);
});

test("several Reels: the candidate's views are the sum of accepted Reels; the shown Reel is the most viewed; any lost or flagged live Reel fails its check", async () => {
  const { winner, participants, provider, stats, drawCar, finish } = await setup();
  await finish();
  const [first] = drawCar();
  const id = Number(first);
  participants.submitReel(id, "https://www.instagram.com/reel/EXTRA1/", "EXTRA1");
  provider.set("EXTRA1", { owner: `user${first}.b`, views: 5_000_000, likes: 250_000 });
  stats.queueVerification(id, "EXTRA1");
  await stats.flushVerification();
  // Rad etilgan va hali tekshirilmagan videolar ko'rishlarga ham, tekshiruvga ham ta'sir qilmaydi.
  const rejected = participants.submitReel(id, "https://www.instagram.com/reel/REJ001/", "REJ001");
  rejected.status = "REJECTED";
  rejected.flags.push({ type: "VIEW_SPIKE", date: "2026-12-20", detail: "eski" });
  participants.submitReel(id, "https://www.instagram.com/reel/NEW001/", "NEW001");

  const checksOf = () => new Map(winner.overview().candidate?.checks.map((c) => [c.key, c]));
  let o = winner.overview();
  // Oferta 7.1: qabul qilingan videolar ko'rishlari qo'shiladi; ko'rsatiladigan video — eng ko'p ko'rilgani.
  assert.equal(o.candidate?.views, VIEWS[first] + 5_000_000);
  assert.equal(o.candidate?.reelUrl, "https://www.instagram.com/reel/EXTRA1/");
  assert.equal(o.candidate?.participant.instagramUsername, `user${first}.b`);
  assert.equal(checksOf().get("REEL_AVAILABLE")?.status, "PASSED");
  assert.equal(checksOf().get("NO_FAKE_VIEWS")?.status, "PASSED");

  // Asosiy bo'lmagan videoda nakrutka belgisi — band o'tmaydi, qaysi video ekani ko'rinadi.
  const firstReel = participants.get(id)!.reels[0]!;
  firstReel.flags.push({ type: "LOW_ENGAGEMENT", date: "2026-12-30", detail: "test" });
  assert.equal(checksOf().get("NO_FAKE_VIEWS")?.status, "FAILED");
  assert.match(checksOf().get("NO_FAKE_VIEWS")?.detail ?? "", new RegExp(`^CODE${first}x: `));
  firstReel.flags.length = 0;

  // Boshqa video Instagram'da yo'qoldi (qo'lda tekshiruvda) — band o'tmaydi; ko'rishlar — qolgan qabul qilinganlarniki.
  firstReel.status = "MANUAL_REVIEW";
  firstReel.review = { kind: "LOST_REEL", requestedAt: new Date(), attempts: 3, decision: null };
  o = winner.overview();
  assert.equal(o.candidate?.participant.id, first, "navbat tanlovdan — nomzod o'zgarmaydi");
  assert.equal(o.candidate?.views, 5_000_000);
  assert.equal(checksOf().get("REEL_AVAILABLE")?.status, "FAILED");
  assert.match(checksOf().get("REEL_AVAILABLE")?.detail ?? "", new RegExp(`^CODE${first}x: Reel Instagramda topilmayapti`));
});

test("confirm needs the final sync, the current candidate and every check passed", async () => {
  const { winner, audit, setNow, stats, drawCar } = await setup();
  setNow("2027-01-01", "00:01");
  const [first, second] = drawCar();
  passAllManual(winner, first);
  assert.equal(winner.overview().stage, "CANDIDATE");
  assert.match(message(() => winner.confirm(first, ADMIN)), /Yakuniy ko'rishlar hali yig'ilmagan/);

  setNow("2027-01-01", "00:05");
  await stats.syncAll("final");
  assert.equal(status(() => winner.confirm(second, ADMIN)), 409, "nomzod emas");
  assert.equal(status(() => winner.confirm("999", ADMIN)), 404);

  // Qo'lda band o'tmagan — 422.
  winner.setManualCheck({ participantId: first, check: "AD_TOOLS_REVIEWED", passed: false, note: "Reklama tarixi bor" }, ADMIN);
  assert.equal(status(() => winner.confirm(first, ADMIN)), 422);
  assert.match(message(() => winner.confirm(first, ADMIN)), /O'tmagan: Reklama tarixi yuzma-yuz ko'rilgan/);

  passAllManual(winner, first);
  const confirmed = winner.confirm(first, ADMIN);
  assert.equal(confirmed.stage, "CONFIRMED");
  assert.equal(confirmed.confirmed?.by, "Bosh Admin");
  assert.equal(confirmed.candidate?.participant.id, first);
  assert.equal(confirmed.candidate?.views, VIEWS[first]);
  assert.equal(audit.list({ entity: "winner" }).items[0]?.action, "winner.confirm");

  assert.equal(status(() => winner.confirm(first, ADMIN)), 409, "ikkinchi marta");
  assert.equal(status(() => winner.skip({ participantId: first, reason: "Fikr o'zgardi" }, ADMIN)), 409);
  assert.equal(
    status(() =>
      winner.setManualCheck({ participantId: first, check: "AD_TOOLS_REVIEWED", passed: false, note: "Reklama tarixi bor" }, ADMIN),
    ),
    409,
  );

  const back = winner.unconfirm(ADMIN);
  assert.equal(back.stage, "CANDIDATE");
  assert.equal(back.confirmed, null);
  const [entry] = audit.list({ entity: "winner" }).items;
  assert.deepEqual([entry?.action, entry?.before, entry?.after], ["winner.unconfirm", "CONFIRMED", "CANDIDATE"]);
  assert.equal(status(() => winner.unconfirm(ADMIN)), 409, "bekor qilinadigan tasdiq yo'q");
});

test("once the car winner is confirmed, the car draw cannot be cancelled or its winner replaced (until unconfirmed)", async () => {
  const { winner, draws, setNow, stats, drawCar } = await setup();
  setNow("2027-01-01", "00:01");
  const [first] = drawCar();
  setNow("2027-01-01", "00:05");
  await stats.syncAll("final");
  passAllManual(winner, first);
  winner.confirm(first, ADMIN);

  const carDraw = draws.mainDraw("car");
  assert.ok(carDraw);
  assert.equal(status(() => draws.cancel(carDraw.id, "Qayta o'tkazamiz", "Admin")), 409);
  assert.equal(status(() => draws.replace(carDraw.id, first, "Boshqasini qo'yamiz", "Admin")), 409);
  assert.match(message(() => draws.cancel(carDraw.id, "Qayta o'tkazamiz", "Admin")), /tasdiqni bekor qiling/);

  winner.unconfirm(ADMIN);
  assert.equal(draws.cancel(carDraw.id, "Qayta o'tkazamiz", "Admin").status, "CANCELLED", "tasdiq bekor qilingach — mumkin");
});

test("skip moves the next reserve of the car draw up and keeps the reason; only the current candidate can be skipped", async () => {
  const { winner, audit, drawCar, finish } = await setup();
  await finish();
  const [first, second, ...rest] = drawCar();
  assert.equal(status(() => winner.skip({ participantId: second, reason: "Tekshiruvdan o'tmadi" }, ADMIN)), 409);
  assert.equal(status(() => winner.skip({ participantId: "77", reason: "Tekshiruvdan o'tmadi" }, ADMIN)), 404);

  const o = winner.skip({ participantId: first, reason: "Reklama tarixi ko'rsatilmadi" }, ADMIN);
  assert.equal(o.stage, "CANDIDATE");
  assert.equal(o.candidate?.participant.id, second, "zaxira tartibida keyingisi (oferta 10.3)");
  assert.equal(o.candidate?.rank, 1, "rad etilgandan keyingi navbatdagi o'rni");
  assert.deepEqual(
    o.runnersUp.map((r) => [r.rank, r.participantId]),
    rest.map((id, i) => [i + 2, id]),
  );
  assert.equal(o.skipped.length, 1);
  assert.equal(o.skipped[0]?.name, nameOf(first));
  assert.equal(o.skipped[0]?.reason, "Reklama tarixi ko'rsatilmadi");
  assert.equal(o.skipped[0]?.by, "Bosh Admin");
  assert.equal(o.skipped[0]?.at, "2027-01-01T05:00:00.000Z");
  const [entry] = audit.list({ entity: "winner" }).items;
  assert.deepEqual(
    [entry?.action, entry?.entityId, entry?.before, entry?.after, entry?.reason],
    ["winner.skip", first, "CANDIDATE", "SKIPPED", "Reklama tarixi ko'rsatilmadi"],
  );

  // Rad etilgan ishtirokchini qayta tasdiqlab bo'lmaydi.
  assert.equal(status(() => winner.confirm(first, ADMIN)), 409);
  // Hamma rad etilsa — nomzod yo'q.
  for (const id of [second, ...rest]) winner.skip({ participantId: id, reason: "Tekshiruvdan o'tmadi" }, ADMIN);
  assert.equal(winner.overview().candidate, null);
});

test("announce: only from CONFIRMED, once, re-checks targets, notifies the winner; Mini App sees no phone", async () => {
  const { winner, ads, targets, provider, stats, sent, delivery, setNow, drawCar, finish } = await setup();
  await finish();
  const [first, second] = drawCar();
  assert.equal(winner.publicWinner(), null);
  assert.match(message(() => winner.announce(ADMIN)), /Avval g'olibni tasdiqlang/);

  passAllManual(winner, first);
  winner.confirm(first, ADMIN);

  // Tasdiqdan keyin target aniqlandi — e'lon qilinmaydi.
  ads.set(`user${first}`, [{ adId: "9", startedOn: "2026-12-20", platforms: ["INSTAGRAM"], url: "https://example.test/ad/9" }]);
  await targets.checkAds("admin");
  assert.equal(status(() => winner.announce(ADMIN)), 422);
  assert.equal(winner.overview().candidate?.checks[0]?.status, "FAILED", "tasdiqlangan nomzodda bandlar joriy");
  targets.act(targets.casesOf(Number(first))[0]?.id ?? "", "dismiss", "Boshqa akkaunt reklamasi", "Bosh Admin");

  delivery.fail = true; // Xabar yetmasa ham e'lon bekor bo'lmaydi.
  setNow("2027-01-02");
  const o = winner.announce(ADMIN);
  assert.equal(o.stage, "ANNOUNCED");
  assert.equal(o.announced?.by, "Bosh Admin");
  assert.equal(o.announced?.at, "2027-01-02T05:00:00.000Z");
  assert.equal(sent.length, 0);

  const pub = winner.publicWinner();
  assert.deepEqual(pub, { fullName: nameOf(first), finalViews: VIEWS[first], announcedAt: "2027-01-02T05:00:00.000Z" });
  assert.ok(!JSON.stringify(pub).includes("+998"), "telefon chiqmaydi");

  // E'lon — bir marta; keyin hech narsa o'zgarmaydi, ko'rishlar muzlatilgan.
  assert.equal(status(() => winner.announce(ADMIN)), 409);
  assert.equal(status(() => winner.unconfirm(ADMIN)), 409);
  assert.equal(
    status(() =>
      winner.setManualCheck({ participantId: second, check: "AD_TOOLS_REVIEWED", passed: true, note: "Reklama vositalari bo'sh" }, ADMIN),
    ),
    409,
  );
  provider.set(`CODE${first}x`, { owner: `user${first}`, views: 9_900_000, likes: 500_000 });
  await stats.syncAll("admin");
  assert.equal(winner.publicWinner()?.finalViews, VIEWS[first]);
  assert.equal(winner.overview().candidate?.views, VIEWS[first]);
});

test("the winner gets a congratulation message with name, total views of all videos and prize", async () => {
  const { winner, participants, provider, stats, sent, drawCar, finish } = await setup();
  await finish();
  const [first] = drawCar();
  // Ikkinchi qabul qilingan video — tabrikda jami (yig'indi) ko'rsatiladi.
  participants.submitReel(Number(first), "https://www.instagram.com/reel/EXTRA2/", "EXTRA2");
  provider.set("EXTRA2", { owner: `user${first}`, views: 100_000, likes: 5_000 });
  stats.queueVerification(Number(first), "EXTRA2");
  await stats.flushVerification();
  sent.length = 0;

  passAllManual(winner, first);
  winner.confirm(first, ADMIN);
  winner.announce(ADMIN);
  assert.equal(sent.length, 1);
  assert.equal(sent[0]?.chatId, Number(first));
  assert.match(sent[0]?.text ?? "", new RegExp(`Tabriklaymiz, Ism${first}!`));
  assert.ok(
    (sent[0]?.text ?? "").includes(`videolaringiz jami ${formatCount(VIEWS[first] + 100_000)} tasdiqlangan ko'rish`),
    sent[0]?.text,
  );
  assert.match(sent[0]?.text ?? "", /BYD Chazor/);
  assert.doesNotMatch(sent[0]?.text ?? "", /\{|\}/, "o'rinbosar qolmagan");
});

test("a disqualified confirmed winner cannot be announced", async () => {
  const { winner, participants, drawCar, finish } = await setup();
  await finish();
  const [first, second] = drawCar();
  passAllManual(winner, first);
  winner.confirm(first, ADMIN);
  participants.disqualify(Number(first));
  assert.match(message(() => winner.announce(ADMIN)), /chetlatilgan/);
  // Tasdiqlangan nomzod tanlovdan chiqsa ham o'zgarmaydi — admin tasdiqni bekor qiladi, keyin keyingi zaxira.
  assert.equal(winner.overview().candidate?.participant.id, first);
  assert.equal(winner.unconfirm(ADMIN).candidate?.participant.id, second);
});

test("winner state survives a restart (StateStore)", async () => {
  const { make, drawCar, finish } = await setup();
  const dir = mkdtempSync(join(tmpdir(), "winner-state-"));
  const storeAt = () => new StateStore({ dir, saveEveryMs: 60_000, keepBackups: 3, clock: () => at("2027-01-02") });

  const first = storeAt();
  const winner = make(first);
  await finish();
  const [skippedId, winnerId] = drawCar();
  winner.skip({ participantId: skippedId, reason: "Reklama tarixi ko'rsatilmadi" }, ADMIN);
  passAllManual(winner, winnerId);
  winner.confirm(winnerId, ADMIN);
  winner.announce(ADMIN);
  const before = winner.overview();
  first.flush();

  const restored = make(storeAt());
  assert.deepEqual(restored.overview(), before);
  assert.deepEqual(restored.publicWinner(), winner.publicWinner());
  assert.equal(restored.overview().stage, "ANNOUNCED");
  assert.equal(restored.overview().candidate?.participant.id, winnerId);
  assert.equal(restored.overview().skipped[0]?.at, "2027-01-01T05:00:00.000Z");
});

test("request bodies: unknown fields, wrong check and short texts are rejected", () => {
  const ok = parseManualCheck({ participantId: "1", check: "AD_TOOLS_REVIEWED", passed: true, note: "  Reklama vositalari bo'sh  " });
  assert.deepEqual(ok, { participantId: "1", check: "AD_TOOLS_REVIEWED", passed: true, note: "Reklama vositalari bo'sh" });
  // Xarid tekshiruvi olib tashlangan (oferta 2.7) — endi noma'lum band.
  assert.equal(status(() => parseManualCheck({ participantId: "1", check: "PURCHASE_CONFIRMED", passed: true, note: "Chek №5" })), 400);
  assert.equal(status(() => parseManualCheck({ participantId: "1", check: "NO_TARGET", passed: true, note: "Chek №5" })), 400);
  assert.equal(status(() => parseManualCheck({ participantId: "1", check: "AD_TOOLS_REVIEWED", passed: "ha", note: "Chek №5" })), 400);
  assert.equal(status(() => parseManualCheck({ participantId: "1", check: "AD_TOOLS_REVIEWED", passed: true, note: "ok" })), 422);
  assert.equal(status(() => parseManualCheck({ participantId: "1", check: "AD_TOOLS_REVIEWED", passed: true })), 400);
  assert.equal(
    status(() => parseManualCheck({ participantId: "1", check: "AD_TOOLS_REVIEWED", passed: true, note: "Chek №5", x: 1 })),
    400,
  );
  assert.deepEqual(parseSkip({ participantId: "12", reason: "Chek yo'q edi" }), { participantId: "12", reason: "Chek yo'q edi" });
  assert.equal(status(() => parseSkip({ participantId: "12", reason: "yo'q" })), 422);
  assert.equal(status(() => parseSkip({ participantId: 12, reason: "Chek yo'q edi" })), 400);
  assert.equal(parseConfirm({ participantId: "7" }), "7");
  assert.equal(status(() => parseConfirm({ participantId: "abc" })), 400);
  assert.equal(status(() => parseConfirm(null)), 400);
});
