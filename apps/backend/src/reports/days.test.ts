import assert from "node:assert/strict";
import { test } from "node:test";

import { clampDay, eachDay, reportWindow } from "./days";

test("clampDay keeps the day inside the range", () => {
  assert.equal(clampDay("2026-11-20", "2026-11-25", "2026-12-10"), "2026-11-25");
  assert.equal(clampDay("2026-12-01", "2026-11-25", "2026-12-10"), "2026-12-01");
  assert.equal(clampDay("2027-01-01", "2026-11-25", "2026-12-10"), "2026-12-10");
});

test("eachDay is inclusive, crosses month and year ends, and is empty for a reversed range", () => {
  assert.deepEqual(eachDay("2026-12-30", "2027-01-02"), ["2026-12-30", "2026-12-31", "2027-01-01", "2027-01-02"]);
  assert.deepEqual(eachDay("2026-12-05", "2026-12-05"), ["2026-12-05"]);
  assert.deepEqual(eachDay("2026-12-06", "2026-12-05"), []);
});

test("reportWindow: not started → only the start day; running → up to today; finished → up to the last day", () => {
  assert.deepEqual(reportWindow("2026-11-25", "2027-02-25", "2026-11-20"), { from: "2026-11-25", to: "2026-11-25" });
  assert.deepEqual(reportWindow("2026-11-25", "2027-02-25", "2026-12-10"), { from: "2026-11-25", to: "2026-12-10" });
  assert.deepEqual(reportWindow("2026-11-25", "2027-02-25", "2027-03-15"), { from: "2026-11-25", to: "2027-02-25" });
});
