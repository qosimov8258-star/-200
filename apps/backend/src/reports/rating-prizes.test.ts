import assert from "node:assert/strict";
import { test } from "node:test";

import { DEFAULT_MAIN_DRAW_MESSAGE } from "../draws/draw-rules";
import type { DrawCandidate, DrawEntry, VoucherDraw } from "../draws/draws.service";
import type { ContestPrizes } from "../miniapp/prizes";
import type { Participant, Reel } from "../participants/participants.service";
import { buildRatingPrizes, PREVIEW_COUNT, type RankedParticipant, type RatingPrizeKind } from "./rating-prizes";

const at = (day: string) => new Date(`${day}T12:00:00+05:00`);

function reel(code: string, views: number, flagged = false): Reel {
  return {
    url: `https://www.instagram.com/reel/${code}/`,
    shortcode: code,
    status: "ACCEPTED",
    submittedAt: at("2026-11-28"),
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
    createdAt: at("2026-11-27"),
  };
}

/**
 * Reyting: qatorlar ko'rishlar (videolar yig'indisi) kamayishi tartibida berilgan, o'rin — 1 dan.
 * Eng ko'p ko'rilgani — birinchi video; 4-ishtirokchining birinchi videosida nakrutka belgisi bor.
 */
function ranking(rows: [id: number, ...views: number[]][]): RankedParticipant[] {
  return rows.map(([id, ...views], i) => {
    const reels = views.map((v, j) => reel(`R${id}X${j}`, v, id === 4 && j === 0));
    return { participant: { ...person(id), reels }, reels, views: views.reduce((a, b) => a + b, 0), rank: i + 1 };
  });
}

const tiers: ContestPrizes["tiers"] = [
  { kind: "tablet", title: "Planshet", quantity: 2, unit: null, minViews: 100_001, maxViews: 500_000 },
  { kind: "phone", title: "iPhone", quantity: 1, unit: null, minViews: 500_001, maxViews: 1_500_000 },
  { kind: "car", title: "Avtomobil", quantity: 1, unit: null, minViews: 4_000_001, maxViews: null },
];

/** Tanlovdagi nomzod (ko'rishlar — tanlov paytidagi holat). */
const candidate = (id: number, views: number): DrawCandidate => ({
  participantId: String(id),
  firstName: `Ism${id}`,
  lastName: `Familiya${id}`,
  phone: `+99890000${String(id).padStart(4, "0")}`,
  instagramUsername: `r${id}x0`,
  reelUrl: `https://www.instagram.com/reel/R${id}X0/`,
  views,
  postedOn: "2026-11-28",
  submittedOn: "2026-11-28",
});

const entry = (position: number, state: DrawEntry["state"], c: DrawCandidate): DrawEntry => ({
  position,
  state,
  candidate: c,
  replaced: null,
  promotedFor: null,
  notify: { status: "NOT_SENT", at: null, error: null },
});

/** Asosiy sovrin bo'yicha o'tkazilgan random tanlov (kerakli maydonlar bilan). */
function draw(kind: RatingPrizeKind, number: number, winnerEntries: DrawEntry[], reserveEntries: DrawEntry[]): VoucherDraw {
  return {
    id: `drw_${kind}`,
    number,
    prizeTitle: kind,
    stage: null,
    periodFrom: "2026-11-27",
    periodTo: "2027-02-27",
    status: "CONFIRMED",
    winners: winnerEntries.filter((e) => e.state === "ACTIVE").length,
    reserves: reserveEntries.filter((e) => e.state === "ACTIVE").length,
    poolSize: 7,
    createdAt: "2026-12-02T05:00:00.000Z",
    createdBy: "Admin",
    delivery: { sent: 0, failed: 0, notSent: 0 },
    settings: {
      prizeId: `main-${kind}`,
      stage: null,
      periodFrom: "2026-11-27",
      periodTo: "2027-02-27",
      dateBasis: "SUBMITTED",
      minViews: 0,
      maxViews: 1_000_000_000,
      winnersCount: 1,
      reservesCount: 3,
      excludeWarned: false,
      excludeTargets: true,
      excludePreviousWinners: true,
      messageTemplate: DEFAULT_MAIN_DRAW_MESSAGE,
    },
    viewsAsOf: "2026-12-02",
    seed: "0".repeat(32),
    poolHash: "0".repeat(16),
    winnerEntries,
    reserveEntries,
    confirmed: null,
    sent: null,
    cancelled: null,
  };
}

test("main prizes: each range counts participants by total views; a drawn tier shows the draw's active winners and reserves, the rest a preview", () => {
  const rows = ranking([
    [1, 3_000_000, 1_500_000], // 4 500 000 — videolar yig'indisi
    [2, 4_100_000],
    [3, 3_900_000], // oraliqlar orasida (1,5–4 mln, bu testda sayohat yo'q) — hech qaysi sovringa tushmaydi
    [4, 900_000],
    [5, 600_000],
    [6, 400_000, 100_000], // 500 000 — yuqori chegara kiradi
    [7, 300_000],
    [8, 100_001],
    [9, 60_000, 40_000], // 100 000 — planshetdan kam
  ]);
  // Avtomobil: random g'olib — reytingda 2-o'rindagi (o'rin g'olibni aniqlamaydi), 1-o'rindagi — zaxira.
  const car = draw("car", 1, [entry(1, "ACTIVE", candidate(2, 4_050_000))], [entry(1, "ACTIVE", candidate(1, 4_400_000))]);
  // iPhone: g'olib zaxira bilan almashtirilgan — faqat faol yozuvlar ko'rinadi.
  const phone = draw(
    "phone",
    2,
    [entry(1, "REPLACED", candidate(5, 600_000)), entry(1, "ACTIVE", candidate(4, 880_000))],
    [entry(1, "PROMOTED", candidate(4, 880_000))],
  );
  const drawn = new Map<RatingPrizeKind, VoucherDraw>([
    ["car", car],
    ["phone", phone],
  ]);
  const r = buildRatingPrizes({
    ranking: rows,
    tiers,
    cases: [
      { telegramId: 2, status: "WARNED", detectedOn: "2026-12-01" },
      { telegramId: 7, status: "DISMISSED", detectedOn: "2026-12-01" },
    ],
    updatedAt: "2026-12-02T01:00:00.000Z",
    drawFor: (kind) => drawn.get(kind) ?? null,
  });
  assert.equal(r.updatedAt, "2026-12-02T01:00:00.000Z");
  assert.deepEqual(
    r.tiers.map((t) => [
      t.kind,
      t.eligibleCount,
      t.draw?.number ?? null,
      t.winners.map((e) => e.participant.id),
      t.next.map((e) => e.participant.id),
      t.eligible.map((e) => e.participant.id),
    ]),
    [
      ["car", 2, 1, ["2"], ["1"], []],
      ["phone", 2, 2, ["4"], [], []],
      ["tablet", 3, null, [], [], ["6", "7", "8"]],
    ],
  );

  const [carTier, phoneTier, tabletTier] = r.tiers;
  assert.deepEqual(carTier.draw, { id: "drw_car", number: 1, status: "CONFIRMED", viewsAsOf: "2026-12-02", poolSize: 7 });
  // Tanlovdagi yozuv: navbat raqami, reytingdagi o'rni (ma'lumot uchun), tanlov paytidagi ko'rishlar.
  assert.deepEqual(carTier.winners[0], {
    place: 1,
    rank: 2,
    participant: { id: "2", firstName: "Ism2", lastName: "Familiya2", phone: "+998900000002", instagramUsername: "r2x0" },
    views: 4_050_000,
    reelUrl: "https://www.instagram.com/reel/R2X0/",
    hasTarget: true,
    flagged: false,
  });
  assert.deepEqual([carTier.next[0].place, carTier.next[0].rank, carTier.next[0].views], [1, 1, 4_400_000]);
  assert.equal(phoneTier.winners[0].flagged, true, "videolaridan birida nakrutka belgisi");

  // Tanlov o'tkazilmagan oraliq: ishtirokchilar ko'rishlar kamayishi bo'yicha, ko'rishlar — yig'indi.
  assert.equal(tabletTier.draw, null);
  assert.deepEqual(tabletTier.eligible[0], {
    place: 1,
    rank: 6,
    participant: { id: "6", firstName: "Ism6", lastName: "Familiya6", phone: "+998900000006", instagramUsername: "r6x0" },
    views: 500_000,
    reelUrl: "https://www.instagram.com/reel/R6X0/",
    hasTarget: false,
    flagged: false,
  });
  assert.deepEqual(tabletTier.eligible.map((e) => e.place), [1, 2, 3]);
  assert.equal(tabletTier.eligible[1].hasTarget, false, "DISMISSED — hisobga olinmaydi");
});

test("an empty rating gives empty prizes; the preview before a draw is capped", () => {
  assert.deepEqual(
    buildRatingPrizes({ ranking: [], tiers, cases: [], updatedAt: null, drawFor: () => null }).tiers.map((t) => [
      t.kind,
      t.eligibleCount,
      t.draw,
      t.winners.length,
      t.next.length,
      t.eligible.length,
    ]),
    [
      ["car", 0, null, 0, 0, 0],
      ["phone", 0, null, 0, 0, 0],
      ["tablet", 0, null, 0, 0, 0],
    ],
  );
  const many = ranking(Array.from({ length: 40 }, (_, i): [number, number] => [i + 1, 400_000 - i]));
  const tablet = buildRatingPrizes({ ranking: many, tiers, cases: [], updatedAt: null, drawFor: () => null }).tiers[2];
  assert.equal(tablet.eligibleCount, 40);
  assert.equal(tablet.eligible.length, PREVIEW_COUNT);
  assert.deepEqual(
    tablet.eligible.map((e) => e.place),
    Array.from({ length: PREVIEW_COUNT }, (_, i) => i + 1),
  );
  assert.deepEqual([tablet.winners.length, tablet.next.length], [0, 0], "g'oliblar faqat random tanlovdan");
});
