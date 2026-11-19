import assert from "node:assert/strict";
import { test } from "node:test";

import type { Participant, Reel, ReelStatus } from "../participants/participants.service";
import { buildDashboard, type DashboardInput } from "./dashboard";

const at = (day: string, time = "12:00") => new Date(`${day}T${time}:00+05:00`);

function reel(views: Record<string, number>, o: { status?: ReelStatus; submittedOn?: string } = {}): Reel {
  return {
    url: "https://www.instagram.com/reel/X/",
    shortcode: "X",
    status: o.status ?? "ACCEPTED",
    submittedAt: at(o.submittedOn ?? "2026-11-26"),
    owner: null,
    postedAt: null,
    rejectReason: null,
    history: Object.entries(views).map(([date, v]) => ({ date, at: at(date), views: v, likes: null, comments: null })),
    flags: [],
    misses: 0,
    lastFoundAt: null,
    review: null,
  };
}

function person(
  telegramId: number,
  o: { registeredOn?: string; reel?: Reel | null; status?: Participant["status"]; firstName?: string | null } = {},
): Participant {
  return {
    telegramId,
    chatId: telegramId,
    phone: `+99890000000${telegramId}`,
    firstName: o.firstName === undefined ? `Ism${telegramId}` : o.firstName,
    lastName: `Familiya${telegramId}`,
    age: 25,
    consentVersion: 1,
    reel: o.reel ?? null,
    status: o.status ?? "ACTIVE",
    createdAt: at(o.registeredOn ?? "2026-11-25"),
  };
}

const input = (o: Partial<DashboardInput> = {}): DashboardInput => ({
  participants: [],
  tickets: [],
  cases: [],
  startsOn: "2026-11-25",
  endsOn: "2027-02-25",
  today: "2026-12-10",
  dataUpdatedAt: "2026-12-10T01:00:00.000Z",
  ...o,
});

test("an empty contest that has not started yet gives zeros for the start day", () => {
  const s = buildDashboard(input({ today: "2026-11-20", from: "2026-11-01", to: "2026-11-30" }));
  assert.deepEqual(s.range, { from: "2026-11-25", to: "2026-11-25" });
  assert.deepEqual(s.contest, { startsOn: "2026-11-25", endsOn: "2027-02-25" });
  assert.deepEqual(s.views, { total: 0, growthInRange: 0 });
  assert.deepEqual(s.lastDay, { date: "2026-11-25", growth: 0, previousGrowth: null });
  assert.deepEqual(s.daily, [{ date: "2026-11-25", viewsGrowth: 0, newParticipants: 0 }]);
  assert.equal(s.dataUpdatedAt, "2026-12-10T01:00:00.000Z");
});

test("the period defaults to the whole contest so far and is clamped to the contest dates", () => {
  assert.deepEqual(buildDashboard(input()).range, { from: "2026-11-25", to: "2026-12-10" });
  assert.deepEqual(buildDashboard(input({ from: "2026-11-01", to: "2027-05-01" })).range, {
    from: "2026-11-25",
    to: "2026-12-10",
  });
  assert.deepEqual(buildDashboard(input({ from: "2026-12-03" })).range, { from: "2026-12-03", to: "2026-12-10" });
  assert.deepEqual(buildDashboard(input({ to: "2026-12-01" })).range, { from: "2026-11-25", to: "2026-12-01" });
  // Ikkala chegara ham kelajakda — bitta oxirgi kun.
  assert.deepEqual(buildDashboard(input({ from: "2026-12-20", to: "2026-12-25" })).range, {
    from: "2026-12-10",
    to: "2026-12-10",
  });
  // Tanlov tugagan — oxirgi kungacha.
  assert.deepEqual(buildDashboard(input({ today: "2027-03-15" })).range, { from: "2026-11-25", to: "2027-02-25" });
});

test("views: total at the end of the period, growth inside it, per day and for the last day", () => {
  const participants = [
    person(1, { reel: reel({ "2026-11-30": 1_000, "2026-12-05": 3_000 }) }),
    // Bloklangan va rad etilgan videolarning oldin yig'ilgan ko'rishlari ham jami'da qoladi.
    person(2, { status: "BLOCKED", reel: reel({ "2026-11-30": 500, "2026-12-04": 700 }) }),
    person(3, { reel: reel({ "2026-12-05": 200, "2026-12-09": 100 }, { status: "REJECTED" }) }),
  ];
  const s = buildDashboard(input({ participants, from: "2026-12-04", to: "2026-12-05" }));
  assert.deepEqual(s.views, { total: 3_000 + 700 + 200, growthInRange: 200 + 2_000 + 200 });
  assert.deepEqual(s.daily.map((d) => [d.date, d.viewsGrowth]), [
    ["2026-12-04", 200],
    ["2026-12-05", 2_200],
  ]);
  assert.deepEqual(s.lastDay, { date: "2026-12-05", growth: 2_200, previousGrowth: 200 });

  // jami = davr boshigacha bo'lgan jami + davr ichidagi o'sish
  const before = buildDashboard(input({ participants, to: "2026-12-03" }));
  assert.equal(before.views.total + s.views.growthInRange, s.views.total);

  // Ko'rishlar kamaygan kun — manfiy o'sish.
  assert.equal(buildDashboard(input({ participants, from: "2026-12-09", to: "2026-12-09" })).lastDay.growth, -100);
});

test("on the first contest day there is no previous growth", () => {
  const participants = [person(1, { reel: reel({ "2026-11-25": 50 }) })];
  const s = buildDashboard(input({ participants, to: "2026-11-25" }));
  assert.deepEqual(s.lastDay, { date: "2026-11-25", growth: 50, previousGrowth: null });
});

test("participants: registered by the end of the period and new inside it; daily new count", () => {
  const participants = [
    person(1, { registeredOn: "2026-11-20" }),
    person(2, { registeredOn: "2026-12-02" }),
    person(3, { registeredOn: "2026-12-02" }),
    person(4, { registeredOn: "2026-12-07" }),
    person(5, { registeredOn: "2026-12-02", firstName: null }), // profil to'ldirilmagan
  ];
  const s = buildDashboard(input({ participants, from: "2026-12-01", to: "2026-12-03" }));
  assert.deepEqual(s.participants, { total: 3, newInRange: 2 });
  assert.deepEqual(s.daily.map((d) => d.newParticipants), [0, 2, 0]);
});

test("reels, support tickets and target cases are counted up to the end of the period", () => {
  const participants = [
    person(1, { reel: reel({}, { status: "ACCEPTED", submittedOn: "2026-11-26" }) }),
    person(2, { reel: reel({}, { status: "PENDING", submittedOn: "2026-12-02" }) }),
    person(3, { reel: reel({}, { status: "MANUAL_REVIEW", submittedOn: "2026-12-03" }) }),
    person(4, { reel: reel({}, { status: "REJECTED", submittedOn: "2026-12-02" }) }),
    person(5, { reel: reel({}, { status: "ACCEPTED", submittedOn: "2026-12-08" }) }),
  ];
  const tickets: DashboardInput["tickets"] = [
    { status: "NEW", createdAt: at("2026-11-28") },
    { status: "IN_PROGRESS", createdAt: at("2026-12-02") },
    { status: "CLOSED", createdAt: at("2026-12-03") },
    { status: "NEW", createdAt: at("2026-12-09") },
  ];
  const cases: DashboardInput["cases"] = [
    { status: "NEW", detectedOn: "2026-11-29" },
    { status: "WARNED", detectedOn: "2026-12-02" },
    { status: "DISMISSED", detectedOn: "2026-12-02" },
    { status: "DISQUALIFIED", detectedOn: "2026-12-03" },
    { status: "NEW", detectedOn: "2026-12-09" },
  ];
  const s = buildDashboard(input({ participants, tickets, cases, from: "2026-12-01", to: "2026-12-05" }));
  assert.deepEqual(s.reels, { total: 4, accepted: 1, pending: 2, rejected: 1, removed: 0, newInRange: 3 });
  assert.deepEqual(s.support, { open: 2, new: 1, inProgress: 1, createdInRange: 2 });
  assert.deepEqual(s.targets, { total: 3, detectedInRange: 2 });
});
