import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { HttpException } from "@nestjs/common";

import { AuditService, type AuditActor } from "../audit/audit.service";
import { ContestSettingsService } from "../contest/contest-settings.service";
import { MockAdLibraryProvider } from "../instagram/ad-library";
import { MockReelStatsProvider } from "../instagram/mock.provider";
import { ParticipantsService } from "../participants/participants.service";
import { StateStore } from "../persistence/state-store";
import { RulesService } from "../rules/rules.service";
import { StatsService } from "../stats/stats.service";
import { TargetsService } from "../targets/targets.service";
import type { ParticipantNotifier } from "../telegram/notifier";
import { parseConfirm, parseManualCheck, parseSkip, WinnerService } from "./winner.service";

const at = (day: string, time = "10:00") => new Date(`${day}T${time}:00+05:00`);
const ADMIN: AuditActor = { id: "adm_boss", name: "Bosh Admin", role: "ADMIN" };

/** Tanlov: 01.12–31.12.2026 (tugashi — 01.01.2027 00:00, Toshkent); "bugun" — 20.12.2026. */
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
  const make = (store: StateStore | null = null) =>
    new WinnerService(participants, stats, targets, contest, audit, notifier, { clock }, store);

  // Reyting: 1 — user1 (30 000), 2 — user2 (20 000), 3 — user3 (10 000), 4 — user4 (5 000).
  for (const [id, views] of [
    [1, 30_000],
    [2, 20_000],
    [3, 10_000],
    [4, 5_000],
  ] as const) {
    participants.setPhone(id, id, `+99890000000${id}`);
    participants.register(id, `Ism${id}`, `Familiya${id}`, 25);
    participants.acceptRules(id, 1);
    participants.submitReel(id, `https://www.instagram.com/reel/CODE${id}x/`, `CODE${id}x`);
    provider.set(`CODE${id}x`, { owner: `user${id}`, views, likes: views / 20 });
    stats.queueVerification(id);
  }
  await stats.flushVerification();
  sent.length = 0;

  return {
    winner: make(),
    make,
    participants,
    provider,
    stats,
    ads,
    targets,
    audit,
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

const passAllManual = (winner: WinnerService, participantId: string) => {
  winner.setManualCheck(
    { participantId, check: "PURCHASE_CONFIRMED", passed: true, note: "Chek №123 tekshirildi" },
    ADMIN,
  );
  winner.setManualCheck(
    { participantId, check: "AD_TOOLS_REVIEWED", passed: true, note: "Reklama vositalari bo'sh, 2 xodim ko'rdi" },
    ADMIN,
  );
};

test("before the end the leader is only a preview: manual checks work, actions are 409", async () => {
  const { winner, audit } = await setup();
  const o = winner.overview();
  assert.equal(o.stage, "NOT_STARTED");
  assert.deepEqual(o.contest, {
    startsOn: "2026-12-01",
    endsOn: "2026-12-31",
    ended: false,
    daysLeft: 12,
    ratingDate: "2026-12-20",
  });
  assert.equal(o.candidate?.participant.id, "1");
  assert.equal(o.candidate?.rank, 1);
  assert.equal(o.candidate?.views, 30_000);
  assert.equal(o.candidate?.participant.instagramUsername, "user1");
  assert.deepEqual(
    o.runnersUp.map((r) => r.participantId),
    ["2", "3", "4"],
  );

  assert.equal(status(() => winner.confirm("1", ADMIN)), 409);
  assert.equal(status(() => winner.skip({ participantId: "1", reason: "Chek yo'q" }, ADMIN)), 409);
  assert.equal(status(() => winner.announce(ADMIN)), 409);

  // Yetakchini oldindan tekshirish mumkin (xarid hujjati).
  const after = winner.setManualCheck(
    { participantId: "1", check: "PURCHASE_CONFIRMED", passed: true, note: "Chek №123 tekshirildi" },
    ADMIN,
  );
  const purchase = after.candidate?.checks.find((c) => c.key === "PURCHASE_CONFIRMED");
  assert.equal(purchase?.status, "PASSED");
  assert.equal(purchase?.manual, true);
  assert.match(purchase?.detail ?? "", /Chek №123 tekshirildi — Bosh Admin/);
  const [entry] = audit.list({ entity: "winner" }).items;
  assert.equal(entry?.action, "winner.purchase_check");
  assert.equal(entry?.entityId, "1");
  assert.equal(entry?.entityLabel, "Ism1 Familiya1");
  assert.equal(entry?.before, "PENDING");
  assert.equal(entry?.after, "PASSED");
  assert.equal(entry?.reason, "Chek №123 tekshirildi");

  // Oxirgi kun ham tanlov ichida.
  const { winner: late, setNow } = await setup();
  setNow("2026-12-31", "23:00");
  assert.equal(late.overview().stage, "NOT_STARTED");
  assert.equal(late.overview().contest.daysLeft, 1);
});

test("after the end the first place is the candidate; automatic checks see targets, reel and flags", async () => {
  const { winner, participants, ads, targets, finish } = await setup();
  await finish();
  ads.set("user2", [{ adId: "111", startedOn: "2026-12-10", platforms: ["INSTAGRAM"], url: "https://example.test/ad/111" }]);
  await targets.checkAds("admin");
  participants.get(3)?.reel?.flags.push({ type: "VIEW_SPIKE", date: "2026-12-15", detail: "kuniga +1 000 → +60 000" });

  const o = winner.overview();
  assert.equal(o.stage, "CANDIDATE");
  assert.equal(o.contest.ended, true);
  assert.equal(o.contest.daysLeft, 0);
  assert.equal(o.contest.ratingDate, "2026-12-31");
  assert.deepEqual(
    o.candidate?.checks.map((c) => [c.key, c.status, c.manual]),
    [
      ["NO_TARGET", "PASSED", false],
      ["REEL_AVAILABLE", "PASSED", false],
      ["NO_FAKE_VIEWS", "PASSED", false],
      ["PURCHASE_CONFIRMED", "PENDING", true],
      ["AD_TOOLS_REVIEWED", "PENDING", true],
    ],
  );
  const [second, third, fourth] = o.runnersUp;
  assert.equal(second?.name, "Ism2 Familiya2");
  assert.match(second?.issues[0] ?? "", /Target aniqlangan: 2027-01-01 \(Meta reklama kutubxonasi, ko'rib chiqilmagan\)/);
  assert.match(third?.issues[0] ?? "", /Ko'rishlar keskin oshgan \(2026-12-15\)/);
  assert.deepEqual(fourth?.issues, []);

  // Ro'yxatdan chiqarilgan target — to'siq emas.
  const caseId = targets.casesOf(2)[0]?.id ?? "";
  targets.act(caseId, "dismiss", "Reklama boshqa akkauntniki", "Bosh Admin");
  assert.deepEqual(winner.overview().runnersUp[0]?.issues, []);

  // Reel oxirgi tekshiruvda topilmagan — REEL_AVAILABLE o'tmaydi.
  const reel = participants.get(1)?.reel;
  if (reel) reel.misses = 1;
  const check = winner.overview().candidate?.checks.find((c) => c.key === "REEL_AVAILABLE");
  assert.equal(check?.status, "FAILED");
  assert.match(check?.detail ?? "", /topilmadi \(1 marta/);
});

test("confirm needs the final sync, the current candidate and every check passed", async () => {
  const { winner, audit, setNow, stats } = await setup();
  setNow("2027-01-01", "00:01");
  passAllManual(winner, "1");
  assert.equal(winner.overview().stage, "CANDIDATE");
  assert.match(message(() => winner.confirm("1", ADMIN)), /Yakuniy ko'rishlar hali yig'ilmagan/);

  setNow("2027-01-01", "00:05");
  await stats.syncAll("final");
  assert.equal(status(() => winner.confirm("2", ADMIN)), 409, "nomzod emas");
  assert.equal(status(() => winner.confirm("999", ADMIN)), 404);

  // Qo'lda band o'tmagan — 422.
  winner.setManualCheck({ participantId: "1", check: "AD_TOOLS_REVIEWED", passed: false, note: "Reklama tarixi bor" }, ADMIN);
  assert.equal(status(() => winner.confirm("1", ADMIN)), 422);
  assert.match(message(() => winner.confirm("1", ADMIN)), /O'tmagan: Reklama tarixi yuzma-yuz ko'rilgan/);

  passAllManual(winner, "1");
  const confirmed = winner.confirm("1", ADMIN);
  assert.equal(confirmed.stage, "CONFIRMED");
  assert.equal(confirmed.confirmed?.by, "Bosh Admin");
  assert.equal(confirmed.candidate?.participant.id, "1");
  assert.equal(audit.list({ entity: "winner" }).items[0]?.action, "winner.confirm");

  assert.equal(status(() => winner.confirm("1", ADMIN)), 409, "ikkinchi marta");
  assert.equal(status(() => winner.skip({ participantId: "1", reason: "Fikr o'zgardi" }, ADMIN)), 409);
  assert.equal(
    status(() =>
      winner.setManualCheck({ participantId: "1", check: "PURCHASE_CONFIRMED", passed: false, note: "Chek soxta" }, ADMIN),
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

test("skip moves the next place up and keeps the reason; only the current candidate can be skipped", async () => {
  const { winner, audit, finish } = await setup();
  await finish();
  assert.equal(status(() => winner.skip({ participantId: "2", reason: "Chek yo'q" }, ADMIN)), 409);
  assert.equal(status(() => winner.skip({ participantId: "77", reason: "Chek yo'q" }, ADMIN)), 404);

  const o = winner.skip({ participantId: "1", reason: "Xarid cheki taqdim etilmadi" }, ADMIN);
  assert.equal(o.stage, "CANDIDATE");
  assert.equal(o.candidate?.participant.id, "2");
  assert.equal(o.candidate?.rank, 2, "asl o'rni saqlanadi");
  assert.deepEqual(
    o.runnersUp.map((r) => r.participantId),
    ["3", "4"],
  );
  assert.equal(o.skipped.length, 1);
  assert.equal(o.skipped[0]?.name, "Ism1 Familiya1");
  assert.equal(o.skipped[0]?.reason, "Xarid cheki taqdim etilmadi");
  assert.equal(o.skipped[0]?.by, "Bosh Admin");
  assert.equal(o.skipped[0]?.at, "2027-01-01T05:00:00.000Z");
  const [entry] = audit.list({ entity: "winner" }).items;
  assert.deepEqual(
    [entry?.action, entry?.entityId, entry?.before, entry?.after, entry?.reason],
    ["winner.skip", "1", "CANDIDATE", "SKIPPED", "Xarid cheki taqdim etilmadi"],
  );

  // Rad etilgan ishtirokchini qayta tasdiqlab bo'lmaydi.
  assert.equal(status(() => winner.confirm("1", ADMIN)), 409);
  // Hamma rad etilsa — nomzod yo'q.
  for (const id of ["2", "3", "4"]) winner.skip({ participantId: id, reason: "Tekshiruvdan o'tmadi" }, ADMIN);
  assert.equal(winner.overview().candidate, null);
});

test("announce: only from CONFIRMED, once, re-checks targets, notifies the winner; Mini App sees no phone", async () => {
  const { winner, ads, targets, provider, stats, sent, delivery, setNow, finish } = await setup();
  await finish();
  assert.equal(winner.publicWinner(), null);
  assert.match(message(() => winner.announce(ADMIN)), /Avval g'olibni tasdiqlang/);

  passAllManual(winner, "1");
  winner.confirm("1", ADMIN);

  // Tasdiqdan keyin target aniqlandi — e'lon qilinmaydi.
  ads.set("user1", [{ adId: "9", startedOn: "2026-12-20", platforms: ["INSTAGRAM"], url: "https://example.test/ad/9" }]);
  await targets.checkAds("admin");
  assert.equal(status(() => winner.announce(ADMIN)), 422);
  assert.equal(winner.overview().candidate?.checks[0]?.status, "FAILED", "tasdiqlangan nomzodda bandlar joriy");
  targets.act(targets.casesOf(1)[0]?.id ?? "", "dismiss", "Boshqa akkaunt reklamasi", "Bosh Admin");

  delivery.fail = true; // Xabar yetmasa ham e'lon bekor bo'lmaydi.
  setNow("2027-01-02");
  const o = winner.announce(ADMIN);
  assert.equal(o.stage, "ANNOUNCED");
  assert.equal(o.announced?.by, "Bosh Admin");
  assert.equal(o.announced?.at, "2027-01-02T05:00:00.000Z");
  assert.equal(sent.length, 0);

  const pub = winner.publicWinner();
  assert.deepEqual(pub, { fullName: "Ism1 Familiya1", finalViews: 30_000, announcedAt: "2027-01-02T05:00:00.000Z" });
  assert.ok(!JSON.stringify(pub).includes("+998"), "telefon chiqmaydi");

  // E'lon — bir marta; keyin hech narsa o'zgarmaydi, ko'rishlar muzlatilgan.
  assert.equal(status(() => winner.announce(ADMIN)), 409);
  assert.equal(status(() => winner.unconfirm(ADMIN)), 409);
  assert.equal(
    status(() => winner.setManualCheck({ participantId: "2", check: "PURCHASE_CONFIRMED", passed: true, note: "Chek bor" }, ADMIN)),
    409,
  );
  provider.set("CODE1x", { owner: "user1", views: 99_000, likes: 5_000 });
  await stats.syncAll("admin");
  assert.equal(winner.publicWinner()?.finalViews, 30_000);
  assert.equal(winner.overview().candidate?.views, 30_000);
});

test("the winner gets a congratulation message with name, views and prize", async () => {
  const { winner, sent, finish } = await setup();
  await finish();
  passAllManual(winner, "1");
  winner.confirm("1", ADMIN);
  winner.announce(ADMIN);
  assert.equal(sent.length, 1);
  assert.equal(sent[0]?.chatId, 1);
  assert.match(sent[0]?.text ?? "", /Tabriklaymiz, Ism1!/);
  assert.match(sent[0]?.text ?? "", /30 000 ko'rish/);
  assert.doesNotMatch(sent[0]?.text ?? "", /\{|\}/, "o'rinbosar qolmagan");
});

test("a disqualified confirmed winner cannot be announced", async () => {
  const { winner, participants, finish } = await setup();
  await finish();
  passAllManual(winner, "1");
  winner.confirm("1", ADMIN);
  participants.disqualify(1);
  assert.match(message(() => winner.announce(ADMIN)), /chetlatilgan/);
  // Tasdiqlangan nomzod reytingdan chiqsa ham o'zgarmaydi — admin tasdiqni bekor qiladi.
  assert.equal(winner.overview().candidate?.participant.id, "1");
  assert.equal(winner.unconfirm(ADMIN).candidate?.participant.id, "2");
});

test("winner state survives a restart (StateStore)", async () => {
  const { make, finish } = await setup();
  const dir = mkdtempSync(join(tmpdir(), "winner-state-"));
  const storeAt = () => new StateStore({ dir, saveEveryMs: 60_000, keepBackups: 3, clock: () => at("2027-01-02") });

  const first = storeAt();
  const winner = make(first);
  await finish();
  winner.skip({ participantId: "1", reason: "Xarid cheki taqdim etilmadi" }, ADMIN);
  passAllManual(winner, "2");
  winner.confirm("2", ADMIN);
  winner.announce(ADMIN);
  const before = winner.overview();
  first.flush();

  const restored = make(storeAt());
  assert.deepEqual(restored.overview(), before);
  assert.deepEqual(restored.publicWinner(), winner.publicWinner());
  assert.equal(restored.overview().stage, "ANNOUNCED");
  assert.equal(restored.overview().skipped[0]?.at, "2027-01-01T05:00:00.000Z");
});

test("request bodies: unknown fields, wrong check and short texts are rejected", () => {
  const ok = parseManualCheck({ participantId: "1", check: "PURCHASE_CONFIRMED", passed: true, note: "  Chek №5  " });
  assert.deepEqual(ok, { participantId: "1", check: "PURCHASE_CONFIRMED", passed: true, note: "Chek №5" });
  assert.equal(status(() => parseManualCheck({ participantId: "1", check: "NO_TARGET", passed: true, note: "Chek №5" })), 400);
  assert.equal(status(() => parseManualCheck({ participantId: "1", check: "PURCHASE_CONFIRMED", passed: "ha", note: "Chek №5" })), 400);
  assert.equal(status(() => parseManualCheck({ participantId: "1", check: "PURCHASE_CONFIRMED", passed: true, note: "ok" })), 422);
  assert.equal(status(() => parseManualCheck({ participantId: "1", check: "PURCHASE_CONFIRMED", passed: true })), 400);
  assert.equal(
    status(() => parseManualCheck({ participantId: "1", check: "PURCHASE_CONFIRMED", passed: true, note: "Chek №5", x: 1 })),
    400,
  );
  assert.deepEqual(parseSkip({ participantId: "12", reason: "Chek yo'q edi" }), { participantId: "12", reason: "Chek yo'q edi" });
  assert.equal(status(() => parseSkip({ participantId: "12", reason: "yo'q" })), 422);
  assert.equal(status(() => parseSkip({ participantId: 12, reason: "Chek yo'q edi" })), 400);
  assert.equal(parseConfirm({ participantId: "7" }), "7");
  assert.equal(status(() => parseConfirm({ participantId: "abc" })), 400);
  assert.equal(status(() => parseConfirm(null)), 400);
});
