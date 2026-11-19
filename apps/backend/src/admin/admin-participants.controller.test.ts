import assert from "node:assert/strict";
import { test } from "node:test";

import { HttpException } from "@nestjs/common";

import { AuditService } from "../audit/audit.service";
import { ParticipantsService } from "../participants/participants.service";
import { RulesService } from "../rules/rules.service";
import type { StatsService } from "../stats/stats.service";
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
  // Reyting va target holatlari — faqat kerakli qismi (bu testda video yo'q, reyting bo'sh).
  const stats: Pick<StatsService, "ranking"> = { ranking: () => [] };
  const targets = { allCases: () => cases } as Pick<TargetsService, "allCases">;
  const audit = new AuditService();
  const controller = new AdminParticipantsController(
    participants,
    stats as StatsService,
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

  const page = controller.list(undefined, undefined, undefined, "name", "desc", "2", "1");
  assert.deepEqual([page.items.map((i) => i.id), page.page, page.pageSize], [["2"], 2, 1]);

  const warned = controller.list("ism", "WARNED");
  assert.deepEqual(warned.items.map((i) => i.id), ["2"]);
  assert.equal(warned.statusCounts.ALL, 3);

  const bad = failure(() => controller.list(undefined, "UNKNOWN"));
  assert.equal(bad !== "NONE" && bad.status, 400);
  const array = failure(() => controller.list(["a", "b"]));
  assert.equal(array !== "NONE" && array.status, 400);
});
