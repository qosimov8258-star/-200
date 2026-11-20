import assert from "node:assert/strict";
import { test } from "node:test";

import type { Participant, Reel, ReelStatus } from "../participants/participants.service";
import {
  ACTION_ALLOWED_FROM,
  listParticipants,
  participantContext,
  toParticipantItem,
  type CaseInfo,
  type ParticipantFilter,
} from "./participants";

const at = (day: string) => new Date(`${day}T12:00:00+05:00`);

function reel(shortcode: string, o: { status?: ReelStatus; owner?: string | null; views?: number[] } = {}): Reel {
  return {
    url: `https://www.instagram.com/reel/${shortcode}/`,
    shortcode,
    status: o.status ?? "ACCEPTED",
    submittedAt: at("2026-12-01"),
    owner: o.owner ?? null,
    postedAt: null,
    rejectReason: null,
    history: (o.views ?? []).map((views, i) => ({
      date: `2026-12-${String(i + 1).padStart(2, "0")}`,
      at: at("2026-12-01"),
      views,
      likes: null,
      comments: null,
    })),
    flags: [],
    misses: 0,
    lastFoundAt: null,
    review: null,
  };
}

function person(
  telegramId: number,
  o: Partial<Pick<Participant, "status" | "firstName" | "lastName" | "phone" | "age" | "reel" | "createdAt">> = {},
): Participant {
  return {
    telegramId,
    chatId: telegramId,
    phone: o.phone ?? `+99890000${String(telegramId).padStart(4, "0")}`,
    firstName: o.firstName === undefined ? `Ism${telegramId}` : o.firstName,
    lastName: o.lastName ?? `Familiya${telegramId}`,
    age: o.age ?? 25,
    consentVersion: 1,
    reel: o.reel ?? null,
    status: o.status ?? "ACTIVE",
    createdAt: o.createdAt ?? at("2026-11-26"),
  };
}

const ranked = (...ids: number[]) => ids.map((telegramId, i) => ({ participant: { telegramId }, rank: i + 1 }));
const list = (people: Participant[], ranking = ranked(), cases: CaseInfo[] = [], filter: Partial<ParticipantFilter> = {}) =>
  listParticipants(people, participantContext(ranking, cases), { search: "", ...filter });
const ids = (items: { id: string }[]) => items.map((i) => i.id);

test("a list item maps the backend participant to the admin contract", () => {
  const p = person(7, {
    firstName: "Ali",
    lastName: "Valiyev",
    age: 31,
    createdAt: new Date("2026-11-25T20:30:00Z"), // Toshkentda 26-noyabr 01:30
    reel: reel("AAA", { owner: "ali.v", views: [100, 2_500] }),
  });
  assert.deepEqual(toParticipantItem(p, participantContext(ranked(9, 7), [])), {
    id: "7",
    firstName: "Ali",
    lastName: "Valiyev",
    age: 31,
    phone: "+998900000007",
    instagramUsername: "ali.v",
    status: "ACTIVE",
    registeredOn: "2026-11-26",
    reel: { url: "https://www.instagram.com/reel/AAA/", status: "ACCEPTED" },
    views: 2_500,
    rank: 2,
    hasTarget: false,
  });
  const empty = toParticipantItem(person(8), participantContext([], []));
  assert.equal(empty.reel, null);
  assert.equal(empty.views, 0);
  assert.equal(empty.rank, null);
});

test("only participants who filled the profile are listed", () => {
  const { items, statusCounts } = list([person(1), person(2, { firstName: null }), person(3)]);
  assert.deepEqual(ids(items), ["1", "3"]);
  assert.equal(statusCounts.ALL, 2);
});

test("status: blocked/disqualified come from the participant, WARNED from an open warned target case", () => {
  const people = [
    person(1, { status: "BLOCKED" }),
    person(2, { status: "DISQUALIFIED" }),
    person(3),
    person(4),
    person(5),
    person(6, { status: "BLOCKED" }),
  ];
  const cases: CaseInfo[] = [
    { telegramId: 3, status: "WARNED", detectedOn: "2026-12-01" },
    { telegramId: 4, status: "NEW", detectedOn: "2026-12-01" },
    { telegramId: 5, status: "DISMISSED", detectedOn: "2026-12-01" },
    { telegramId: 6, status: "WARNED", detectedOn: "2026-12-01" },
  ];
  const { items } = list(people, ranked(), cases, { sort: "name" });
  const byId = new Map(items.map((i) => [i.id, i]));
  assert.deepEqual(
    [1, 2, 3, 4, 5, 6].map((id) => [byId.get(String(id))?.status, byId.get(String(id))?.hasTarget]),
    [
      ["BLOCKED", false],
      ["DISQUALIFIED", false],
      ["WARNED", true],
      ["ACTIVE", true],
      ["ACTIVE", false], // ro'yxatdan chiqarilgan holat — target emas
      ["BLOCKED", true],
    ],
  );
});

test("reel status: MANUAL_REVIEW shows as PENDING; the NONE filter keeps those without a Reel", () => {
  const people = [
    person(1, { reel: reel("A", { status: "MANUAL_REVIEW" }) }),
    person(2, { reel: reel("B", { status: "PENDING" }) }),
    person(3, { reel: reel("C", { status: "REJECTED" }) }),
    person(4),
  ];
  assert.equal(list(people).items.find((i) => i.id === "1")?.reel?.status, "PENDING");
  assert.deepEqual(ids(list(people, ranked(), [], { reel: "PENDING" }).items), ["1", "2"]);
  assert.deepEqual(ids(list(people, ranked(), [], { reel: "REJECTED" }).items), ["3"]);
  assert.deepEqual(ids(list(people, ranked(), [], { reel: "NONE" }).items), ["4"]);
  assert.deepEqual(ids(list(people, ranked(), [], { reel: "REMOVED" }).items), []);
});

test("status counts follow search and Reel filter but ignore the status filter", () => {
  const people = [
    person(1, { reel: reel("A") }),
    person(2, { status: "BLOCKED", reel: reel("B") }),
    person(3, { status: "BLOCKED" }),
    person(4, { status: "DISQUALIFIED", reel: reel("D") }),
  ];
  const { items, statusCounts } = list(people, ranked(), [], { reel: "ACCEPTED", status: "BLOCKED" });
  assert.deepEqual(ids(items), ["2"]);
  assert.deepEqual(statusCounts, { ALL: 3, ACTIVE: 1, WARNED: 0, BLOCKED: 1, DISQUALIFIED: 1 });
});

test("search by name (any order, apostrophe variants), @instagram and at least 3 phone digits", () => {
  const people = [
    person(1, { firstName: "Oʻlmas", lastName: "Karimov", phone: "+998901112233" }),
    person(2, { firstName: "Jasur", lastName: "Toshev", reel: reel("B", { owner: "jasur_t" }) }),
    person(3, { firstName: "Dilnoza", lastName: "Aliyeva", phone: "+998935556677" }),
  ];
  const find = (search: string) => ids(list(people, ranked(), [], { search }).items);
  assert.deepEqual(find("o'lmas"), ["1"]);
  assert.deepEqual(find("karimov o'l"), ["1"]);
  assert.deepEqual(find("@jasur_"), ["2"]);
  assert.deepEqual(find("555 66"), ["3"]);
  assert.deepEqual(find("90"), []); // 3 tadan kam raqam — telefon bo'yicha qidirilmaydi
  assert.deepEqual(find("yo'q"), []);
});

test("sorting: rank puts unranked last, views default to descending, name by last name", () => {
  const people = [
    person(1, { lastName: "Boboyev", reel: reel("A", { views: [300] }) }),
    person(2, { lastName: "Aliyev", reel: reel("B", { views: [900] }) }),
    person(3, { lastName: "Valiyev" }),
    person(4, { lastName: "Aliyev", firstName: "Bekzod", reel: reel("D", { views: [500] }) }),
  ];
  const ranking = ranked(2, 4, 1);
  assert.deepEqual(ids(list(people, ranking).items), ["2", "4", "1", "3"]);
  assert.deepEqual(ids(list(people, ranking, [], { order: "desc" }).items), ["1", "4", "2", "3"]);
  assert.deepEqual(ids(list(people, ranking, [], { sort: "views" }).items), ["2", "4", "1", "3"]);
  assert.deepEqual(ids(list(people, ranking, [], { sort: "views", order: "asc" }).items), ["3", "1", "4", "2"]);
  // Aliyev Bekzod, Aliyev Ism2 → Boboyev → Valiyev
  assert.deepEqual(ids(list(people, ranking, [], { sort: "name" }).items), ["4", "2", "1", "3"]);
});

test("allowed transitions: block only active, unblock only blocked, disqualify active or blocked", () => {
  assert.deepEqual(ACTION_ALLOWED_FROM.block, ["ACTIVE"]);
  assert.deepEqual(ACTION_ALLOWED_FROM.unblock, ["BLOCKED"]);
  assert.deepEqual(ACTION_ALLOWED_FROM.disqualify, ["ACTIVE", "BLOCKED"]);
});

test("views range keeps both bounds inclusive and also narrows the status counts", () => {
  const people = [
    person(1, { reel: reel("A", { views: [50_000] }) }),
    person(2, { reel: reel("B", { views: [100_000] }) }),
    person(3, { status: "BLOCKED", reel: reel("C", { views: [640_000] }) }),
    person(4, { reel: reel("D", { views: [1_000_000] }) }),
    person(5, { reel: reel("E", { views: [1_000_001] }) }),
    person(6),
  ];
  const range = list(people, ranked(), [], { minViews: 100_000, maxViews: 1_000_000, sort: "views" });
  assert.deepEqual(ids(range.items), ["4", "3", "2"]);
  assert.deepEqual(range.statusCounts, { ALL: 3, ACTIVE: 2, WARNED: 0, BLOCKED: 1, DISQUALIFIED: 0 });
  assert.deepEqual(ids(list(people, ranked(), [], { minViews: 1_000_001 }).items), ["5"]);
  // Faqat "gacha": Reel yubormaganlar (0 ko'rish) ham kiradi.
  assert.deepEqual(ids(list(people, ranked(), [], { maxViews: 60_000, sort: "name" }).items).sort(), ["1", "6"]);
});
