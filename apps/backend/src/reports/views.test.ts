import assert from "node:assert/strict";
import { test } from "node:test";

import { eachDay } from "./days";
import { growthByDay, growthOn, viewsOn } from "./views";

/** Ko'rishlar 10 kunda bir yig'iladi; oxirgisida Instagram sun'iy ko'rishlarni tozalagan. */
const history = [
  { date: "2026-12-01", views: 100 },
  { date: "2026-12-11", views: 1_000 },
  { date: "2026-12-21", views: 900 },
];

test("viewsOn takes the last snapshot on or before the day", () => {
  assert.equal(viewsOn([], "2026-12-01"), null);
  assert.equal(viewsOn(history, "2026-11-30"), null);
  assert.equal(viewsOn(history, "2026-12-01"), 100);
  assert.equal(viewsOn(history, "2026-12-05"), 100);
  assert.equal(viewsOn(history, "2026-12-11"), 1_000);
  assert.equal(viewsOn(history, "2027-01-01"), 900);
});

test("viewsOn does not depend on the order; for the same day the later record wins", () => {
  const shuffled = [history[2], history[0], history[1]];
  assert.equal(viewsOn(shuffled, "2026-12-15"), 1_000);
  const twice = [...history, { date: "2026-12-21", views: 950 }];
  assert.equal(viewsOn(twice, "2026-12-21"), 950);
  assert.equal(growthByDay(twice).get("2026-12-21"), -50);
});

test("growthOn: the first snapshot counts from zero, days without a sync grow by 0, a drop is negative", () => {
  assert.equal(growthOn(history, "2026-11-30"), 0);
  assert.equal(growthOn(history, "2026-12-01"), 100);
  assert.equal(growthOn(history, "2026-12-02"), 0);
  assert.equal(growthOn(history, "2026-12-11"), 900);
  assert.equal(growthOn(history, "2026-12-21"), -100);
});

test("growthByDay matches growthOn day by day and sums up to the latest views", () => {
  const map = growthByDay(history);
  assert.deepEqual([...map], [
    ["2026-12-01", 100],
    ["2026-12-11", 900],
    ["2026-12-21", -100],
  ]);
  for (const day of eachDay("2026-11-28", "2026-12-25")) {
    assert.equal(map.get(day) ?? 0, growthOn(history, day), day);
  }
  assert.equal([...map.values()].reduce((a, b) => a + b, 0), 900);
});
