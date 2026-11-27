import assert from "node:assert/strict";
import { test } from "node:test";

import { HttpException } from "@nestjs/common";

import { AuditService } from "../audit/audit.service";
import { MockReelStatsProvider } from "../instagram/mock.provider";
import { ParticipantsService } from "../participants/participants.service";
import { RulesService } from "../rules/rules.service";
import { StatsService } from "../stats/stats.service";
import type { TargetCase, TargetsService } from "../targets/targets.service";
import { AdminParticipantsController } from "./admin-participants.controller";
import type { AdminUser } from "./auth/admin-accounts";

const ADMIN: AdminUser = { id: "adm_1", login: "admin", fullName: "Bosh Admin", role: "ADMIN" };
const REASON = { reason: "Qoidabuzarlik aniqlandi" };

function setup() {
  const participants = new ParticipantsService(new RulesService());
  for (const id of [1, 2, 3]) {
    participants.setPhone(id, id, `+99890000000${id}`);
    participants.register(id, `Ism${id}`, `Familiya${id}`, 25);
    participants.acceptRules(id, 1);
  }
  participants.setPhone(4, 4, "+998900000004"); // profil to'ldirilmagan
  const cases: Pick<TargetCase, "telegramId" | "status" | "detectedOn">[] = [
    { telegramId: 2, status: "WARNED", detectedOn: "2026-12-01" },
  ];
  // Reyting — haqiqiy servis (videolar test ichida qo'lda qabul qilinadi); target holatlari — faqat kerakli qismi.
  const stats = new StatsService(participants, new MockReelStatsProvider(), { notify: () => Promise.resolve() }, {
    syncTime: "06:00",
    everyDays: 1,
    verifyDelayMs: 0,
    contestStartsOn: "2026-11-30",
    contestEndsAt: new Date("2027-01-01T07:00:00Z"),
  });
  const targets = { allCases: () => cases } as Pick<TargetsService, "allCases">;
  const audit = new AuditService();
  const controller = new AdminParticipantsController(
    participants,
    stats,
    targets as TargetsService,
    audit,
  );
  return { participants, audit, controller };
}

/** Xato statusi va `{ message }` (bo'lmasa — "NONE"). */
function failure(fn: () => unknown): { status: number; message: string } | "NONE" {
  try {
    fn();
  } catch (e) {
    if (e instanceof HttpException) return { status: e.getStatus(), message: (e.getResponse() as { message: string }).message };
    throw e;
  }
  return "NONE";
}

test("block → unblock → disqualify follow the allowed transitions and are audited", () => {
  const { participants, audit, controller } = setup();

  const blocked = controller.block("1", REASON, ADMIN);
  assert.equal(blocked.status, "BLOCKED");
  assert.equal(participants.get(1)?.status, "BLOCKED");
  const p1 = participants.get(1);
  assert.ok(p1);
  assert.equal(participants.stage(p1), "BLOCKED");
  const blockTwice = failure(() => controller.block("1", REASON, ADMIN));
  assert.deepEqual(blockTwice, { status: 409, message: "Bu amalni ishtirokchining hozirgi holatida bajarib bo'lmaydi." });

  assert.equal(controller.unblock("1", REASON, ADMIN).status, "ACTIVE");
  assert.equal(participants.get(1)?.status, "ACTIVE");

  controller.block("1", REASON, ADMIN);
  assert.equal(controller.disqualify("1", { reason: "  Target aniqlandi  " }, ADMIN).status, "DISQUALIFIED");
  const again = failure(() => controller.disqualify("1", REASON, ADMIN));
  assert.equal(again !== "NONE" && again.status, 409);
  const unblockDisqualified = failure(() => controller.unblock("1", REASON, ADMIN));
  assert.equal(unblockDisqualified !== "NONE" && unblockDisqualified.status, 409);

  const log = audit.list({ entity: "participant", pageSize: 100 });
  assert.deepEqual(
    log.items.reverse().map((e) => [e.action, e.before, e.after, e.reason, e.actor.name, e.entityId, e.entityLabel]),
    [
      ["participant.block", "ACTIVE", "BLOCKED", "Qoidabuzarlik aniqlandi", "Bosh Admin", "1", "Ism1 Familiya1"],
      ["participant.unblock", "BLOCKED", "ACTIVE", "Qoidabuzarlik aniqlandi", "Bosh Admin", "1", "Ism1 Familiya1"],
      ["participant.block", "ACTIVE", "BLOCKED", "Qoidabuzarlik aniqlandi", "Bosh Admin", "1", "Ism1 Familiya1"],
      ["participant.disqualify", "BLOCKED", "DISQUALIFIED", "Target aniqlandi", "Bosh Admin", "1", "Ism1 Familiya1"],
    ],
  );
});

test("a warned participant can be blocked and comes back as WARNED after unblocking", () => {
  const { audit, controller } = setup();
  assert.equal(controller.block("2", REASON, ADMIN).status, "BLOCKED");
  assert.equal(controller.unblock("2", REASON, ADMIN).status, "WARNED");
  const [last] = audit.list({ entity: "participant" }).items;
  assert.deepEqual([last.before, last.after], ["BLOCKED", "WARNED"]);
});

test("an active participant can be disqualified directly, but not unblocked", () => {
  const { controller } = setup();
  const unblock = failure(() => controller.unblock("3", REASON, ADMIN));
  assert.equal(unblock !== "NONE" && unblock.status, 409);
  assert.equal(controller.disqualify("3", REASON, ADMIN).status, "DISQUALIFIED");
});

test("reason is required, unknown fields and unknown participants are rejected; nothing is audited", () => {
  const { participants, audit, controller } = setup();
  const statusOf = (fn: () => unknown) => {
    const f = failure(fn);
    return f === "NONE" ? 0 : f.status;
  };
  assert.equal(statusOf(() => controller.block("1", {}, ADMIN)), 400);
  assert.equal(statusOf(() => controller.block("1", null, ADMIN)), 400);
  assert.equal(statusOf(() => controller.block("1", { reason: "  abc  " }, ADMIN)), 422);
  assert.equal(statusOf(() => controller.block("1", { ...REASON, status: "ACTIVE" }, ADMIN)), 400);
  assert.equal(statusOf(() => controller.block("999", REASON, ADMIN)), 404);
  assert.equal(statusOf(() => controller.block("abc", REASON, ADMIN)), 404);
  assert.equal(statusOf(() => controller.block("4", REASON, ADMIN)), 404); // profil to'ldirilmagan
  assert.equal(participants.get(1)?.status, "ACTIVE");
  assert.equal(audit.list({}).total, 0);
});

test("the list validates query values, paginates and counts statuses", () => {
  const { controller } = setup();
  controller.block("3", REASON, ADMIN);

  const all = controller.list();
  assert.deepEqual(all.items.map((i) => i.id), ["1", "2", "3"]);
  assert.deepEqual([all.total, all.page, all.pageSize], [3, 1, 20]);
  assert.deepEqual(all.statusCounts, { ALL: 3, ACTIVE: 1, WARNED: 1, BLOCKED: 1, DISQUALIFIED: 0 });

  const page = controller.list(undefined, undefined, undefined, undefined, undefined, "name", "desc", "2", "1");
  assert.deepEqual([page.items.map((i) => i.id), page.page, page.pageSize], [["2"], 2, 1]);

  const warned = controller.list("ism", "WARNED");
  assert.deepEqual(warned.items.map((i) => i.id), ["2"]);
  assert.equal(warned.statusCounts.ALL, 3);

  const bad = failure(() => controller.list(undefined, "UNKNOWN"));
  assert.equal(bad !== "NONE" && bad.status, 400);
  const array = failure(() => controller.list(["a", "b"]));
  assert.equal(array !== "NONE" && array.status, 400);

  // Ko'rishlar oralig'i: butun son, manfiy emas, "dan" ≤ "gacha".
  for (const [min, max] of [["-1", undefined], ["1.5", undefined], ["ko'p", undefined], ["500", "100"]]) {
    const wrong = failure(() => controller.list(undefined, undefined, undefined, min, max));
    assert.equal(wrong !== "NONE" && wrong.status, 400, `${min}–${max}`);
  }
  assert.equal(controller.list(undefined, undefined, undefined, "0", "").total, 3);
});

test("GET /admin/participants/:id/reels lists every video, the most viewed on top, total of accepted ones; unknown → 404 NOT_FOUND", () => {
  const { participants, controller } = setup();
  const first = participants.submitReel(1, "https://www.instagram.com/reel/AAAAA1/", "AAAAA1");
  first.status = "ACCEPTED";
  first.owner = "ism1";
  first.history.push({ date: "2026-12-01", at: new Date("2026-12-01T01:00:00Z"), views: 1_200, likes: 30, comments: 1 });
  const second = participants.submitReel(1, "https://www.instagram.com/reel/BBBBB2/", "BBBBB2");
  second.submittedAt = new Date(first.submittedAt.getTime() + 1_000);
  second.status = "MANUAL_REVIEW";
  const third = participants.submitReel(1, "https://www.instagram.com/reel/CCCCC3/", "CCCCC3");
  third.submittedAt = new Date(first.submittedAt.getTime() + 2_000);
  third.status = "ACCEPTED";
  third.owner = "ism1";
  third.history.push({ date: "2026-12-01", at: new Date("2026-12-01T01:00:00Z"), views: 800, likes: 10, comments: 0 });

  const result = controller.reels("1");
  const { registeredOn, ...profile } = result.participant;
  assert.deepEqual(profile, {
    id: "1",
    fullName: "Ism1 Familiya1",
    instagramUsernames: ["ism1"],
    phone: "+998900000001",
    age: 25,
    status: "ACTIVE",
  });
  assert.match(registeredOn, /^\d{4}-\d{2}-\d{2}$/);
  // 2-ishtirokchida ochiq target ogohlantirishi bor — oynada ham WARNED.
  assert.equal(controller.reels("2").participant.status, "WARNED");
  // Oferta 7.1: qabul qilingan videolar ko'rishlari qo'shiladi — 1 200 + 800 (qo'lda tekshiruvdagisi kirmaydi).
  assert.equal(result.totalViews, 2_000);
  assert.deepEqual(
    result.reels.map((r) => [r.shortcode, r.status, r.manualReview, r.views, r.likes, r.lastSyncedAt]),
    [
      ["AAAAA1", "ACCEPTED", false, 1_200, 30, "2026-12-01T01:00:00.000Z"],
      ["CCCCC3", "ACCEPTED", false, 800, 10, "2026-12-01T01:00:00.000Z"],
      ["BBBBB2", "PENDING", true, 0, null, null],
    ],
  );
  assert.deepEqual(controller.reels("2").reels, []);
  const item = controller.list().items.find((i) => i.id === "1");
  assert.deepEqual(item?.reels, { total: 3, accepted: 2, pending: 1, rejected: 0 });
  assert.equal(item?.views, 2_000, "ro'yxatda ham — yig'indi");

  for (const id of ["999", "abc", "4"]) {
    try {
      controller.reels(id);
      assert.fail("404 kutilgan edi");
    } catch (e) {
      assert.ok(e instanceof HttpException);
      assert.equal(e.getStatus(), 404);
      assert.deepEqual(e.getResponse(), { message: "Ishtirokchi topilmadi.", code: "NOT_FOUND" });
    }
  }
});
