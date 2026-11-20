import assert from "node:assert/strict";
import { test } from "node:test";

import type { ReelFlagType } from "../participants/participants.service";
import type { TargetCaseStatus } from "../targets/targets.service";
import { assessRisk, hiddenBySafe, riskLevel, riskSignals, type RiskReel } from "./risk";

const flag = (type: ReelFlagType, date: string, detail = `${type} ${date}`) => ({ type, date, detail });
const reel = (over: Partial<RiskReel> = {}): RiskReel => ({
  status: "ACCEPTED",
  flags: [],
  misses: 0,
  review: null,
  ...over,
});
const targetCase = (status: TargetCaseStatus, detectedOn: string, reportDays: string[] = []) => ({
  status,
  detectedOn,
  reports: reportDays.map((day) => ({ day })),
});

test("each video flag type counts once, with the latest flag's day and detail", () => {
  const signals = riskSignals({
    reels: [reel({
      flags: [
        flag("VIEW_SPIKE", "2026-12-03", "birinchi"),
        flag("VIEW_SPIKE", "2026-12-10", "oxirgi"),
        flag("VIEW_SPIKE", "2026-12-05", "o'rtadagi"),
        flag("ENGAGEMENT_GAP", "2026-12-10"),
        flag("LOW_ENGAGEMENT", "2026-12-08"),
        flag("VIEW_DROP", "2026-12-04"),
      ],
    })],
    cases: [],
  });
  assert.deepEqual(
    signals.map((s) => [s.kind, s.points, s.at]),
    [
      ["ENGAGEMENT_GAP", 40, "2026-12-10"],
      ["VIEW_SPIKE", 35, "2026-12-10"],
      ["LOW_ENGAGEMENT", 25, "2026-12-08"],
      ["VIEW_DROP", 20, "2026-12-04"],
    ],
  );
  assert.equal(signals.find((s) => s.kind === "VIEW_SPIKE")?.detail, "oxirgi");
  const all = assessRisk({ reels: [reel({ flags: signals.map((s) => flag(s.kind as ReelFlagType, s.at ?? "")) })], cases: [] });
  assert.equal(all.score, 120);
  assert.equal(all.level, "HIGH");
});

test("target cases: open case 40 (+10 if warned), closed cases do not count; reports 10 each, at most 30", () => {
  const onlyClosed = riskSignals({
    reels: [reel()],
    cases: [targetCase("DISMISSED", "2026-12-01"), targetCase("DISQUALIFIED", "2026-12-02")],
  });
  assert.deepEqual(onlyClosed, []);

  const open = riskSignals({ reels: [reel()], cases: [targetCase("NEW", "2026-12-01"), targetCase("NEW", "2026-12-07")] });
  assert.deepEqual(open, [{ kind: "TARGET", detail: "2 ta ochiq target holati", at: "2026-12-07", points: 40 }]);

  const warned = riskSignals({ reels: [reel()], cases: [targetCase("WARNED", "2026-12-01"), targetCase("NEW", "2026-12-03")] });
  assert.equal(warned[0]?.points, 50);
  assert.match(warned[0]?.detail ?? "", /ogohlantirilgan/);

  const reports = (n: number) =>
    riskSignals({
      reels: [reel()],
      cases: [targetCase("DISMISSED", "2026-12-01", Array.from({ length: n }, (_, i) => `2026-12-${String(10 + i)}`))],
    }).find((s) => s.kind === "REPORTS");
  assert.equal(reports(0), undefined);
  assert.deepEqual(reports(2), { kind: "REPORTS", detail: "2 ta shikoyat", at: "2026-12-11", points: 20 });
  assert.equal(reports(3)?.points, 30);
  assert.equal(reports(5)?.points, 30, "ko'pi bilan 30");
});

test("manual review (15, with its day) and not-found misses (10, no day)", () => {
  const signals = riskSignals({
    reels: [reel({
      status: "MANUAL_REVIEW",
      misses: 3,
      review: { kind: "LOST_REEL", requestedAt: new Date("2026-12-04T20:30:00Z") },
    })],
    cases: [],
  });
  assert.deepEqual(
    signals.map((s) => [s.kind, s.points, s.at]),
    [
      // 20:30 UTC — Toshkentda ertasi kun.
      ["MANUAL_REVIEW", 15, "2026-12-05"],
      ["NOT_FOUND", 10, null],
    ],
  );
  assert.equal(assessRisk({ reels: [reel({ misses: 1 })], cases: [] }).level, "LOW");
  assert.deepEqual(assessRisk({ reels: [], cases: [] }), { score: 0, level: null, signals: [] });
  assert.deepEqual(assessRisk({ reels: [reel({ status: "PENDING" })], cases: [] }).signals, []);
});

test("levels: ≥ 60 HIGH, ≥ 30 MEDIUM, > 0 LOW, 0 — none", () => {
  assert.equal(riskLevel(0), null);
  assert.equal(riskLevel(10), "LOW");
  assert.equal(riskLevel(29), "LOW");
  assert.equal(riskLevel(30), "MEDIUM");
  assert.equal(riskLevel(59), "MEDIUM");
  assert.equal(riskLevel(60), "HIGH");
  // TARGET (40) + ogohlantirilgan (10) + MANUAL_REVIEW (15) = 65.
  const mixed = assessRisk({
    reels: [reel({ status: "MANUAL_REVIEW", review: { kind: "NEW_REEL", requestedAt: new Date("2026-12-01T05:00:00Z") } })],
    cases: [targetCase("WARNED", "2026-12-01")],
  });
  assert.equal(mixed.score, 65);
  assert.equal(mixed.level, "HIGH");
  assert.deepEqual(
    mixed.signals.map((s) => s.kind),
    ["TARGET", "MANUAL_REVIEW"],
  );
});

test("SAFE hides an account until a signal appears on a later contest day", () => {
  const signals = riskSignals({
    reels: [reel({ flags: [flag("VIEW_SPIKE", "2026-12-05")], misses: 2 })],
    cases: [],
  });
  // 2026-12-05 15:00 Toshkent.
  const safe = { verdict: "SAFE" as const, at: "2026-12-05T10:00:00.000Z", by: "Bosh Ega" };
  assert.equal(hiddenBySafe(signals, safe), true, "o'sha kungi signal — ko'rilgan");
  assert.equal(hiddenBySafe(signals, null), false);
  assert.equal(hiddenBySafe(signals, { ...safe, verdict: "WATCH" }), false, "WATCH yashirmaydi");

  const later = riskSignals({
    reels: [reel({ flags: [flag("VIEW_SPIKE", "2026-12-05"), flag("VIEW_DROP", "2026-12-06")], misses: 2 })],
    cases: [],
  });
  assert.equal(hiddenBySafe(later, safe), false, "belgidan keyingi kunda yangi signal — yana ko'rinadi");

  // Belgi 2026-12-05 21:00 UTC = 2026-12-06 02:00 Toshkent: 06-dekabrdagi signal o'sha kun hisoblanadi.
  assert.equal(hiddenBySafe(later, { ...safe, at: "2026-12-05T21:00:00.000Z" }), true);
});
