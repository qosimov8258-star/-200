import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { HttpException } from "@nestjs/common";

import { MockAdLibraryProvider } from "../instagram/ad-library";
import { MockReelStatsProvider } from "../instagram/mock.provider";
import { ParticipantsService } from "../participants/participants.service";
import { StateStore } from "../persistence/state-store";
import { RulesService } from "../rules/rules.service";
import { StatsService } from "../stats/stats.service";
import { TargetsService } from "../targets/targets.service";
import type { ParticipantNotifier } from "../telegram/notifier";
import type { OwnerUser } from "./auth/owner-accounts";
import { OwnerParticipantsController } from "./owner-participants.controller";
import { OwnerRiskController } from "./owner-risk.controller";
import { OwnerTargetsController } from "./owner-targets.controller";
import { OwnerService } from "./owner.service";

const OWNER: OwnerUser = { id: "own_ega", login: "ega", fullName: "Bosh Ega" };
const at = (day: string) => new Date(`${day}T07:00:00+05:00`);

/**
 * 1–3: ro'yxatdan o'tgan, videosi qabul qilingan (1-o'rin: 1, 2: 2, 3: 3);
 * 4: faqat raqam ulashgan; 5: botga kirgan, raqam ham yo'q.
 */
async function setup(store: StateStore | null = null) {
  let now = at("2026-12-01");
  const clock = () => now;
  const rules = new RulesService();
  const participants = new ParticipantsService(rules);
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
  const targets = new TargetsService(participants, stats, new MockAdLibraryProvider(), notifier, {
    checkTop: 3,
    everyDays: 0,
    contestStartsOn: "2026-11-30",
    contestEndsAt: at("2027-02-25"),
    clock,
  });
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
  participants.setPhone(4, 4, "+998900000004");
  participants.getOrCreate(5);
  sent.length = 0;

  const service = new OwnerService(participants, rules, stats, targets, store, { clock });
  return {
    participants,
    targets,
    sent,
    service,
    people: new OwnerParticipantsController(service),
    cases: new OwnerTargetsController(service),
    risk: new OwnerRiskController(service),
    setNow: (day: string) => (now = at(day)),
  };
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
const statusOf = (fn: () => unknown) => {
  const f = failure(fn);
  return f === "NONE" ? 0 : f.status;
};

test("participant list shows everyone, incomplete registrations included, with exclusive tab counts", async () => {
  const { people, participants } = await setup();
  participants.block(3);

  const all = people.list();
  assert.equal(all.total, 5);
  assert.equal(all.pageSize, 25);
  assert.deepEqual(all.counts, { ALL: 5, ACTIVE: 2, BLOCKED: 1, DISQUALIFIED: 0, INCOMPLETE: 2 });
  // Reytingdagilar o'rni bo'yicha, qolganlari keyin.
  assert.deepEqual(all.items.slice(0, 2).map((p) => [p.id, p.rank]), [["1", 1], ["2", 2]]);
  const first = all.items[0];
  assert.equal(first?.firstName, "Ism1");
  assert.equal(first?.profileComplete, true);
  assert.equal(first?.instagramUsername, "user1");
  assert.equal(first?.reel?.status, "ACCEPTED");
  assert.equal(first?.views, 30_000);
  assert.equal(first?.openTargetCases, 0);
  assert.equal(first?.riskLevel, null);

  const incomplete = people.list(undefined, "INCOMPLETE");
  assert.deepEqual(incomplete.items.map((p) => p.id).sort(), ["4", "5"]);
  assert.equal(incomplete.items.find((p) => p.id === "4")?.phone, "+998900000004");
  assert.equal(incomplete.items.find((p) => p.id === "5")?.phone, null);
  assert.equal(incomplete.items.every((p) => !p.profileComplete && p.firstName === null), true);
  assert.deepEqual(people.list(undefined, "BLOCKED").items.map((p) => p.id), ["3"]);

  // Qidiruv: ism, telefon, @instagram, Telegram ID; counts qidiruvni hisobga oladi.
  assert.deepEqual(people.list("ism2").items.map((p) => p.id), ["2"]);
  assert.deepEqual(people.list("90 000 0004").items.map((p) => p.id), ["4"]);
  assert.deepEqual(people.list("@USER3").items.map((p) => p.id), ["3"]);
  assert.deepEqual(people.list("5").items.map((p) => p.id), ["5"]);
  assert.deepEqual(people.list("user").counts, { ALL: 3, ACTIVE: 2, BLOCKED: 1, DISQUALIFIED: 0, INCOMPLETE: 0 });

  assert.equal(people.list(undefined, undefined, "1", "2").items.length, 2);
  assert.equal(statusOf(() => people.list(undefined, "WARNED")), 400);
  assert.equal(statusOf(() => people.list(["a", "b"])), 400);
});

test("PATCH validates the body: unknown field / empty body — 400, bad values — 422, missing — 404", async () => {
  const { people } = await setup();
  assert.deepEqual(failure(() => people.update("1", { firstName: "Ali", views: 1 })), {
    status: 400,
    message: "Noma'lum maydon: views",
  });
  assert.equal(statusOf(() => people.update("1", {})), 400);
  assert.equal(statusOf(() => people.update("1", null)), 400);
  assert.equal(statusOf(() => people.update("1", [])), 400);

  for (const body of [
    { firstName: "A" },
    { firstName: "A".repeat(41) },
    { lastName: "Ali2" },
    { firstName: 5 },
    { age: 13 },
    { age: 101 },
    { age: 25.5 },
    { age: "25" },
    { phone: "12345" },
    { phone: "+7 900 123 45 67" },
    { phone: "abc+998901234567" },
    { phone: null },
    { status: "WARNED" },
    { status: "active" },
  ]) {
    assert.equal(statusOf(() => people.update("1", body)), 422, JSON.stringify(body));
  }
  assert.equal(statusOf(() => people.update("999", { age: 30 })), 404);
  assert.equal(statusOf(() => people.update("abc", { age: 30 })), 404);
});

test("owner can change name, age, phone and status (also undo a disqualification); phones stay unique", async () => {
  const { people, participants, sent } = await setup();

  const updated = people.update("2", { firstName: "  Oʻtkir ", lastName: "Karimov-Zoda", age: 14, phone: "998 (91) 234-56-78" });
  assert.equal(updated.firstName, "Oʻtkir");
  assert.equal(updated.lastName, "Karimov-Zoda");
  assert.equal(updated.age, 14);
  assert.equal(updated.phone, "+998912345678");
  assert.equal(participants.get(2)?.phone, "+998912345678");
  assert.equal(updated.views, 20_000, "ko'rishlar o'zgarmaydi");

  // Telefon boshqa ishtirokchida — 409 (yozilish shaklidan qat'i nazar), hech narsa o'zgarmaydi.
  assert.deepEqual(failure(() => people.update("3", { firstName: "Yangi", phone: "+998 90 000 00 01" })), {
    status: 409,
    message: "Bu telefon raqami boshqa ishtirokchida.",
  });
  assert.equal(participants.get(3)?.firstName, "Ism3");
  // O'z raqamini qayta yozish — mumkin.
  assert.equal(people.update("3", { phone: "+998900000003" }).phone, "+998900000003");

  assert.equal(people.update("1", { status: "DISQUALIFIED" }).status, "DISQUALIFIED");
  assert.equal(people.update("1", { status: "BLOCKED" }).status, "BLOCKED");
  const back = people.update("1", { status: "ACTIVE" });
  assert.equal(back.status, "ACTIVE");
  assert.equal(back.rank, 1, "yana reytingda");

  // Ro'yxatdan o'tmagan ishtirokchiga faqat ism ham yoziladi — familiya va yosh ixtiyoriy.
  const completed = people.update("4", { firstName: "Bekzod" });
  assert.equal(completed.firstName, "Bekzod");
  assert.equal(completed.lastName, "");
  assert.equal(completed.age, null);
  assert.equal(completed.profileComplete, false, "qoidalarga rozilik hali yo'q");

  assert.equal(sent.length, 0, "bot xabari yuborilmaydi");
});

test("DELETE removes the participant together with the video", async () => {
  const { people, participants } = await setup();
  people.remove("2");
  assert.equal(participants.get(2), null);
  assert.equal(people.list().total, 4);
  assert.equal(statusOf(() => people.remove("2")), 404);
  assert.equal(statusOf(() => people.remove("-1")), 404);
});

test("owner moves a target case to any status; participant status follows DISQUALIFIED in both directions", async () => {
  const { participants, targets, cases, sent } = await setup();
  const reel1 = participants.get(1)?.reels[0];
  const reel2 = participants.get(2)?.reels[0];
  assert.ok(reel1 && reel2);
  reel1.flags.push({ type: "VIEW_SPIKE", date: "2026-12-01", detail: "kuniga +1 000 → +60 000" });
  reel1.flags.push({ type: "ENGAGEMENT_GAP", date: "2026-12-02", detail: "+40 000 ko'rish, +5 layk" });
  reel2.flags.push({ type: "VIEW_SPIKE", date: "2026-12-01", detail: "kuniga +500 → +55 000" });
  assert.equal(targets.scanGrowth(), 3);
  const [a, b] = targets.allCases().filter((c) => c.telegramId === 1);
  assert.ok(a && b);

  // Ro'yxat: status berilmasa — hammasi (yopilganlari ham).
  targets.act(a.id, "dismiss", "Tekshirildi, reklama yo'q", "Admin");
  assert.equal(cases.list().total, 3);
  assert.equal(cases.list("OPEN").total, 2);
  assert.equal(cases.list(undefined, "ism2").total, 1);
  assert.equal(statusOf(() => cases.list("CLOSED")), 400);
  sent.length = 0;

  // DISMISSED → NEW (qaytarish) — admin bo'limida mumkin emas, egada mumkin.
  const reopened = cases.update(a.id, { status: "NEW", note: "  Qayta ko'rib chiqilsin " });
  assert.equal(reopened.status, "NEW");
  assert.equal(a.history.at(-1)?.note, "Holat o'zgartirildi: Ro'yxatdan chiqarilgan → Yangi. Qayta ko'rib chiqilsin");

  // Ikkala holat DISQUALIFIED → ishtirokchi chetlatilgan.
  const dq = cases.update(a.id, { status: "DISQUALIFIED" });
  assert.equal(dq.participant.status, "DISQUALIFIED");
  assert.equal(a.history.at(-1)?.note, "Holat o'zgartirildi: Yangi → Diskvalifikatsiya qilingan");
  cases.update(b.id, { status: "DISQUALIFIED" });

  // Bittasi qaytarildi — boshqasi hali DISQUALIFIED: ishtirokchi chetlatilganligicha.
  assert.equal(cases.update(a.id, { status: "DISMISSED" }).participant.status, "DISQUALIFIED");
  // Oxirgisi ham qaytarildi — ishtirokchi ACTIVE.
  const restored = cases.update(b.id, { status: "WARNED" });
  assert.equal(restored.participant.status, "ACTIVE");
  assert.equal(participants.get(1)?.status, "ACTIVE");
  assert.equal(restored.rank, 1);

  // Holat o'zi — o'zgarish ham, tarix yozuvi ham yo'q.
  const historyLength = b.history.length;
  assert.equal(cases.update(b.id, { status: "WARNED", note: "takror" }).status, "WARNED");
  assert.equal(b.history.length, historyLength);

  // Chetlatish target'dan emas (masalan, ega o'zi bloklagan) — qaytarishda tegilmaydi.
  cases.update(a.id, { status: "DISQUALIFIED" });
  participants.ownerUpdate(1, { status: "BLOCKED" });
  cases.update(a.id, { status: "NEW" });
  assert.equal(participants.get(1)?.status, "BLOCKED");

  assert.equal(sent.length, 0, "bot xabari yuborilmaydi");

  assert.equal(statusOf(() => cases.update(a.id, { note: "holatsiz" })), 400);
  assert.equal(statusOf(() => cases.update(a.id, { status: "NEW", reason: "x" })), 400);
  assert.equal(statusOf(() => cases.update(a.id, { status: "OPEN" })), 422);
  assert.equal(statusOf(() => cases.update(a.id, { status: "NEW", note: "x".repeat(301) })), 422);
  assert.equal(statusOf(() => cases.update(a.id, { status: "NEW", note: 5 })), 422);
  assert.equal(statusOf(() => cases.update("tgt_9999", { status: "NEW" })), 404);
});

test("risk list: scores, levels, DISQUALIFIED excluded, SAFE hidden until a newer signal", async () => {
  const { participants, targets, risk, setNow } = await setup();
  const reel1 = participants.get(1)?.reels[0];
  const reel2 = participants.get(2)?.reels[0];
  const reel3 = participants.get(3)?.reels[0];
  assert.ok(reel1 && reel2 && reel3);
  // 1: ENGAGEMENT_GAP 40 + VIEW_SPIKE 35 + TARGET 40 (o'sish tahlili holati) = 115 → HIGH.
  reel1.flags.push({ type: "VIEW_SPIKE", date: "2026-12-01", detail: "kuniga +1 000 → +60 000" });
  reel1.flags.push({ type: "ENGAGEMENT_GAP", date: "2026-12-01", detail: "+40 000 ko'rish, +5 layk" });
  targets.scanGrowth();
  // 2: LOW_ENGAGEMENT 25 + NOT_FOUND 10 = 35 → MEDIUM.
  reel2.flags.push({ type: "LOW_ENGAGEMENT", date: "2026-12-01", detail: "10 layk / 20 000 ko'rish (0.05%)" });
  reel2.misses = 1;
  // 3: VIEW_DROP 20 → LOW.
  reel3.flags.push({ type: "VIEW_DROP", date: "2026-12-01", detail: "12 000 → 10 000" });

  const list = risk.list();
  assert.deepEqual(
    list.items.map((r) => [r.participant.id, r.score, r.level]),
    [
      ["1", 115, "HIGH"],
      ["2", 35, "MEDIUM"],
      ["3", 20, "LOW"],
    ],
  );
  assert.deepEqual(list.counts, { ALL: 3, HIGH: 1, MEDIUM: 1, LOW: 1, SAFE: 0 });
  assert.equal(list.items[0]?.participant.riskLevel, "HIGH");
  assert.equal(list.items[0]?.participant.openTargetCases, 1);
  assert.deepEqual(risk.list("MEDIUM").items.map((r) => r.participant.id), ["2"]);
  assert.deepEqual(risk.list(undefined, undefined, "ism3").counts, { ALL: 1, HIGH: 0, MEDIUM: 0, LOW: 1, SAFE: 0 });
  assert.equal(statusOf(() => risk.list("CRITICAL")), 400);
  assert.equal(statusOf(() => risk.list(undefined, "yes")), 400);

  // Teng ballda — ko'rishlar bo'yicha.
  reel3.flags.push({ type: "LOW_ENGAGEMENT", date: "2026-12-01", detail: "x" });
  reel3.flags.splice(0, 1);
  reel3.misses = 1;
  assert.deepEqual(risk.list("MEDIUM").items.map((r) => r.participant.id), ["2", "3"]);

  // Chetlatilgan — ko'rsatilmaydi.
  participants.disqualify(3);
  assert.deepEqual(risk.list().items.map((r) => r.participant.id), ["1", "2"]);
  assert.equal(statusOf(() => risk.review("3", { verdict: "SAFE" }, OWNER)), 404);
  assert.equal(statusOf(() => risk.review("4", { verdict: "SAFE" }, OWNER)), 404, "ball 0");
  assert.equal(statusOf(() => risk.review("999", { verdict: "SAFE" }, OWNER)), 404);

  // SAFE: yashiriladi, includeSafe bilan ko'rinadi.
  setNow("2026-12-02");
  const marked = risk.review("2", { verdict: "SAFE" }, OWNER);
  assert.deepEqual(marked.review, { verdict: "SAFE", at: at("2026-12-02").toISOString(), by: "Bosh Ega" });
  assert.deepEqual(risk.list().items.map((r) => r.participant.id), ["1"]);
  assert.deepEqual(risk.list().counts, { ALL: 1, HIGH: 1, MEDIUM: 0, LOW: 0, SAFE: 1 });
  assert.deepEqual(risk.list(undefined, "true").items.map((r) => r.participant.id), ["1", "2"]);
  assert.equal(risk.list(undefined, "true").counts.SAFE, 1);

  // WATCH — yashirmaydi; null — belgini olib tashlaydi.
  assert.equal(risk.review("1", { verdict: "WATCH" }, OWNER).review?.verdict, "WATCH");
  assert.deepEqual(risk.list().items.map((r) => r.participant.id), ["1"]);
  assert.equal(risk.review("1", { verdict: null }, OWNER).review, null);
  assert.equal(statusOf(() => risk.review("1", {}, OWNER)), 400);
  assert.equal(statusOf(() => risk.review("1", { verdict: "SAFE", note: "x" }, OWNER)), 400);
  assert.equal(statusOf(() => risk.review("1", { verdict: "OK" }, OWNER)), 422);

  // SAFE dan keyin yangi signal (keyingi kun) — yana ro'yxatda, belgi saqlangan.
  reel2.flags.push({ type: "VIEW_DROP", date: "2026-12-03", detail: "20 000 → 15 000" });
  const again = risk.list();
  assert.deepEqual(again.items.map((r) => [r.participant.id, r.score]), [["1", 115], ["2", 55]]);
  assert.equal(again.counts.SAFE, 0);
  assert.equal(again.items.find((r) => r.participant.id === "2")?.review?.verdict, "SAFE");
});

test("owner marks survive a restart (StateStore) and deleting a participant drops the mark", async () => {
  const dir = mkdtempSync(join(tmpdir(), "owner-"));
  const storeAt = () => new StateStore({ dir, saveEveryMs: 60_000, keepBackups: 3 });

  const first = storeAt();
  const one = await setup(first);
  const reel2 = one.participants.get(2)?.reels[0];
  assert.ok(reel2);
  reel2.flags.push({ type: "VIEW_DROP", date: "2026-12-01", detail: "20 000 → 15 000" });
  one.risk.review("2", { verdict: "WATCH" }, OWNER);
  first.flush();

  const second = storeAt();
  const two = await setup(second);
  const reel2b = two.participants.get(2)?.reels[0];
  assert.ok(reel2b);
  reel2b.flags.push({ type: "VIEW_DROP", date: "2026-12-01", detail: "20 000 → 15 000" });
  assert.equal(two.risk.list().items[0]?.review?.verdict, "WATCH");
  assert.equal(two.risk.list().items[0]?.review?.by, "Bosh Ega");

  two.people.remove("2");
  second.flush();
  const third = storeAt();
  const saved = third.attach<{ reviews: [number, unknown][] }>("owner", () => ({ reviews: [] }));
  assert.deepEqual(saved?.reviews, []);
});
