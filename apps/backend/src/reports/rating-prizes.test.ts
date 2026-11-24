import assert from "node:assert/strict";
import { test } from "node:test";

import type { ContestPrizes } from "../miniapp/prizes";
import type { Participant, Reel } from "../participants/participants.service";
import { buildRatingPrizes, NEXT_COUNT, type RankedParticipant } from "./rating-prizes";

const at = (day: string) => new Date(`${day}T12:00:00+05:00`);

function reel(code: string, views: number, flagged = false): Reel {
  return {
    url: `https://www.instagram.com/reel/${code}/`,
    shortcode: code,
    status: "ACCEPTED",
    submittedAt: at("2026-11-26"),
    owner: code.toLowerCase(),
    postedAt: null,
    rejectReason: null,
    history: [{ date: "2026-12-01", at: at("2026-12-01"), views, likes: null, comments: null }],
    flags: flagged ? [{ type: "LOW_ENGAGEMENT", date: "2026-12-01", detail: "test" }] : [],
    misses: 0,
    lastFoundAt: null,
    review: null,
  };
}

function person(id: number): Participant {
  return {
    telegramId: id,
    chatId: id,
    phone: `+99890000${String(id).padStart(4, "0")}`,
    firstName: `Ism${id}`,
    lastName: `Familiya${id}`,
    age: 25,
    consentVersion: 1,
    reels: [],
    status: "ACTIVE",
    createdAt: at("2026-11-24"),
  };
}

/** Reyting: ko'rishlar kamayishi tartibida, o'rin — 1 dan. Eng ko'p ko'rilgani — birinchi video. */
function ranking(rows: [id: number, ...views: number[]][]): RankedParticipant[] {
  return rows.map(([id, ...views], i) => {
    const reels = views.map((v, j) => reel(`R${id}X${j}`, v, id === 4 && j === 0));
    return { participant: { ...person(id), reels }, reels, views: Math.max(...views), rank: i + 1 };
  });
}

const tiers: ContestPrizes["tiers"] = [
  { kind: "tablet", title: "Planshet", quantity: 2, unit: null, minViews: 101_000, maxViews: 500_000 },
  { kind: "phone", title: "iPhone", quantity: 1, unit: null, minViews: 500_001, maxViews: 1_500_000 },
  { kind: "car", title: "Avtomobil", quantity: 1, unit: null, minViews: 4_000_000, maxViews: null },
];

test("main prizes go by rating inside each views range: the most valuable first, top N win, the rest wait", () => {
  const rows = ranking([
    [1, 5_000_000, 20_000],
    [2, 4_100_000],
    [3, 3_900_000], // oraliqlar orasida (3,5–4 mln) — hech qaysi sovringa tushmaydi
    [4, 900_000],
    [5, 600_000],
    [6, 500_000],
    [7, 300_000],
    [8, 101_000],
    [9, 100_999], // planshetdan kam
  ]);
  const r = buildRatingPrizes({
    ranking: rows,
    tiers,
    cases: [
      { telegramId: 2, status: "WARNED", detectedOn: "2026-12-01" },
      { telegramId: 5, status: "DISMISSED", detectedOn: "2026-12-01" },
    ],
    updatedAt: "2026-12-02T01:00:00.000Z",
  });
  assert.equal(r.updatedAt, "2026-12-02T01:00:00.000Z");
  assert.deepEqual(
    r.tiers.map((t) => [t.kind, t.eligibleCount, t.winners.map((e) => e.participant.id), t.next.map((e) => e.participant.id)]),
    [
      ["car", 2, ["1"], ["2"]],
      ["phone", 2, ["4"], ["5"]],
      ["tablet", 3, ["6", "7"], ["8"]],
    ],
  );
  const car = r.tiers[0];
  assert.deepEqual(car.winners[0], {
    place: 1,
    rank: 1,
    participant: { id: "1", firstName: "Ism1", lastName: "Familiya1", phone: "+998900000001", instagramUsername: "r1x0" },
    views: 5_000_000,
    reelUrl: "https://www.instagram.com/reel/R1X0/",
    hasTarget: false,
    flagged: false,
  });
  // Navbatdagilar raqamlashni davom ettiradi; ochiq target holati va nakrutka belgisi ko'rinadi.
  assert.deepEqual([car.next[0].place, car.next[0].hasTarget], [2, true]);
  assert.equal(r.tiers[1].winners[0].flagged, true);
  assert.equal(r.tiers[1].next[0].hasTarget, false, "DISMISSED — hisobga olinmaydi");
});

test("an empty rating gives empty prizes; next is capped", () => {
  assert.deepEqual(
    buildRatingPrizes({ ranking: [], tiers, cases: [], updatedAt: null }).tiers.map((t) => [t.eligibleCount, t.winners.length]),
    [
      [0, 0],
      [0, 0],
      [0, 0],
    ],
  );
  const many = ranking(Array.from({ length: 20 }, (_, i): [number, number] => [i + 1, 400_000 - i]));
  const tablet = buildRatingPrizes({ ranking: many, tiers, cases: [], updatedAt: null }).tiers[2];
  assert.equal(tablet.winners.length, 2);
  assert.equal(tablet.next.length, NEXT_COUNT);
  assert.deepEqual(tablet.next.map((e) => e.place), [3, 4, 5, 6, 7]);
});
