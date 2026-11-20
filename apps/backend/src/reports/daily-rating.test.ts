import assert from "node:assert/strict";
import { test } from "node:test";

import type { Participant, Reel, ReelStatus } from "../participants/participants.service";
import { buildDailyRating, rankReelsOn, type DailyRatingInput } from "./daily-rating";
import type { CaseInfo } from "./participants";

const at = (day: string, time = "12:00") => new Date(`${day}T${time}:00+05:00`);

function reel(
  shortcode: string,
  views: Record<string, number>,
  o: { status?: ReelStatus; submittedAt?: Date } = {},
): Reel {
  return {
    url: `https://www.instagram.com/reel/${shortcode}/`,
    shortcode,
    status: o.status ?? "ACCEPTED",
    submittedAt: o.submittedAt ?? at("2026-11-25"),
    owner: shortcode.toLowerCase(),
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
  r: Reel | Reel[] | null,
  o: Partial<Pick<Participant, "status" | "firstName">> = {},
): Participant {
  return {
    telegramId,
    chatId: telegramId,
    phone: `+99890000000${telegramId}`,
    firstName: o.firstName === undefined ? `Ism${telegramId}` : o.firstName,
    lastName: `Familiya${telegramId}`,
    age: 25,
    consentVersion: 1,
    reels: r === null ? [] : Array.isArray(r) ? r : [r],
    status: o.status ?? "ACTIVE",
    createdAt: at("2026-11-24"),
  };
}

const base = (participants: Participant[], o: Partial<DailyRatingInput> = {}): DailyRatingInput => ({
  participants,
  cases: [],
  startsOn: "2026-11-25",
  endsOn: "2027-02-25",
  today: "2026-12-10",
  ...o,
});

const rows = (r: ReturnType<typeof buildDailyRating>) =>
  r.entries.map((e) => [e.participantId, e.rank, e.views, e.viewsGrowth, e.previousRank]);

test("before the contest starts the response is empty, not an error", () => {
  const people = [person(1, reel("A", { "2026-11-20": 500 }))];
  const r = buildDailyRating(base(people, { today: "2026-11-20", date: "2026-11-22" }));
  assert.equal(r.date, "2026-11-25");
  assert.deepEqual(r.availableRange, { from: "2026-11-25", to: "2026-11-25" });
  assert.deepEqual(r.entries, []);
  assert.deepEqual(r.summary, { participants: 0, videos: 0, totalViews: 0, totalGrowth: 0, newEntries: 0 });
});

test("an empty contest gives an empty rating for today", () => {
  const r = buildDailyRating(base([]));
  assert.equal(r.date, "2026-12-10");
  assert.deepEqual(r.availableRange, { from: "2026-11-25", to: "2026-12-10" });
  assert.deepEqual(r.entries, []);
});

test("the requested day is clamped to the contest start, today and the last contest day", () => {
  assert.equal(buildDailyRating(base([], { date: "2026-11-01" })).date, "2026-11-25");
  assert.equal(buildDailyRating(base([], { date: "2026-12-31" })).date, "2026-12-10");
  assert.equal(buildDailyRating(base([], { date: "2026-12-03" })).date, "2026-12-03");
  const ended = buildDailyRating(base([], { today: "2027-03-10" }));
  assert.equal(ended.date, "2027-02-25");
  assert.deepEqual(ended.availableRange, { from: "2026-11-25", to: "2027-02-25" });
});

test("views carry forward between syncs; equal views — the earlier submitted Reel ranks higher", () => {
  const people = [
    person(1, reel("A", { "2026-12-01": 300 }, { submittedAt: at("2026-11-27") })),
    person(2, reel("B", { "2026-12-01": 300 }, { submittedAt: at("2026-11-26") })),
    person(3, reel("C", { "2026-12-01": 100, "2026-12-08": 900 })),
  ];
  assert.deepEqual(
    rankReelsOn(people, "2026-12-05").map((e) => [e.participant.telegramId, e.rank, e.views]),
    [
      [2, 1, 300],
      [1, 2, 300],
      [3, 3, 100],
    ],
  );
  assert.deepEqual(
    rankReelsOn(people, "2026-12-08").map((e) => e.participant.telegramId),
    [3, 2, 1],
  );
});

test("growth and previous rank compare with the day before; new entries are counted", () => {
  const people = [
    person(1, reel("A", { "2026-12-01": 1_000, "2026-12-08": 1_500 })),
    person(2, reel("B", { "2026-12-01": 800, "2026-12-08": 2_000 })),
    // 8-dekabrda birinchi marta yig'ilgan — oldingi kuni reytingda yo'q, o'sish noldan.
    person(3, reel("C", { "2026-12-08": 700 })),
    // Ko'rishlar tozalangan — o'sish manfiy.
    person(4, reel("D", { "2026-12-01": 900, "2026-12-08": 600 })),
  ];
  const r = buildDailyRating(base(people, { date: "2026-12-08" }));
  assert.deepEqual(rows(r), [
    ["2", 1, 2_000, 1_200, 3],
    ["1", 2, 1_500, 500, 1],
    ["3", 3, 700, 700, null],
    ["4", 4, 600, -300, 2],
  ]);
  assert.deepEqual(r.summary, { participants: 4, videos: 4, totalViews: 4_800, totalGrowth: 2_100, newEntries: 1 });

  // Yig'ilmagan kun: o'sish 0, o'rinlar o'zgarmagan.
  const quiet = buildDailyRating(base(people, { date: "2026-12-09" }));
  assert.deepEqual(rows(quiet).map((row) => [row[0], row[3], row[4]]), [
    ["2", 0, 1],
    ["1", 0, 2],
    ["3", 0, 3],
    ["4", 0, 4],
  ]);
});

test("on the first contest day nobody has a previous rank", () => {
  const people = [person(1, reel("A", { "2026-11-24": 50, "2026-11-25": 400 }))];
  const r = buildDailyRating(base(people, { date: "2026-11-25" }));
  assert.deepEqual(rows(r), [["1", 1, 400, 350, null]]);
  assert.equal(r.summary.newEntries, 1);
});

test("only accepted Reels of active, registered participants with a snapshot by that day are ranked", () => {
  const views = { "2026-12-01": 100 };
  const people = [
    person(1, reel("A", views)),
    person(2, reel("B", views), { status: "BLOCKED" }),
    person(3, reel("C", views), { status: "DISQUALIFIED" }),
    person(4, reel("D", views, { status: "MANUAL_REVIEW" })),
    person(5, reel("E", views, { status: "REJECTED" })),
    person(6, reel("F", views, { status: "PENDING" })),
    person(7, reel("G", { "2026-12-05": 100 })),
    person(8, null),
    person(9, reel("I", views), { firstName: null }),
  ];
  assert.deepEqual(
    buildDailyRating(base(people, { date: "2026-12-03" })).entries.map((e) => e.participantId),
    ["1"],
  );
});

test("hasTarget counts cases detected by that day and ignores dismissed ones", () => {
  const views = { "2026-12-01": 100 };
  const people = [person(1, reel("A", views)), person(2, reel("B", views)), person(3, reel("C", views))];
  const cases: CaseInfo[] = [
    { telegramId: 1, status: "NEW", detectedOn: "2026-12-04" },
    { telegramId: 2, status: "DISMISSED", detectedOn: "2026-12-02" },
    { telegramId: 3, status: "DISQUALIFIED", detectedOn: "2026-12-02" },
  ];
  const flags = (date: string) =>
    buildDailyRating(base(people, { cases, date })).entries.map((e) => [e.participantId, e.hasTarget]);
  assert.deepEqual(flags("2026-12-03"), [
    ["1", false],
    ["2", false],
    ["3", true],
  ]);
  assert.deepEqual(flags("2026-12-04")[0], ["1", true]);
});

test("several Reels: every accepted Reel is its own row — a participant appears as many times", () => {
  const people = [
    person(1, [
      reel("A1", { "2026-12-01": 1_000, "2026-12-08": 1_200 }, { submittedAt: at("2026-11-20") }),
      // 8-dekabrda birinchi marta yig'ilgan — oldingi kuni reytingda yo'q, o'sish to'liq.
      reel("A2", { "2026-12-08": 2_000 }, { submittedAt: at("2026-12-05") }),
      reel("A3", { "2026-12-01": 50_000 }, { status: "REJECTED" }),
      reel("A4", { "2026-12-01": 40_000 }, { status: "MANUAL_REVIEW" }),
    ]),
    // Teng ko'rish (2 000) — oldinroq yuborilgan video (26-noyabr) yuqorida.
    person(2, [
      reel("B1", { "2026-12-08": 1_200 }, { submittedAt: at("2026-12-07") }),
      reel("B2", { "2026-12-08": 2_000 }, { submittedAt: at("2026-11-26") }),
    ]),
  ];
  const r = buildDailyRating(base(people, { date: "2026-12-08" }));
  assert.deepEqual(
    r.entries.map((e) => [e.shortcode, e.participantId, e.rank, e.views, e.viewsGrowth, e.previousRank]),
    [
      ["B2", "2", 1, 2_000, 2_000, null],
      ["A2", "1", 2, 2_000, 2_000, null],
      // Teng (1 200): A1 20-noyabrda, B1 7-dekabrda yuborilgan.
      ["A1", "1", 3, 1_200, 200, 1],
      ["B1", "2", 4, 1_200, 1_200, null],
    ],
  );
  assert.deepEqual(
    r.entries.map((e) => [e.shortcode, e.reelUrl, e.instagramUsername]),
    [
      ["B2", "https://www.instagram.com/reel/B2/", "b2"],
      ["A2", "https://www.instagram.com/reel/A2/", "a2"],
      ["A1", "https://www.instagram.com/reel/A1/", "a1"],
      ["B1", "https://www.instagram.com/reel/B1/", "b1"],
    ],
  );
  assert.deepEqual(r.summary, { participants: 2, videos: 4, totalViews: 6_400, totalGrowth: 5_400, newEntries: 3 });
  assert.deepEqual(rankReelsOn(people, "2026-12-01").map((e) => [e.reel.shortcode, e.rank, e.views]), [["A1", 1, 1_000]]);
});
