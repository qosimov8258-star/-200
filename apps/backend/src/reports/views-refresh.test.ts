import assert from "node:assert/strict";
import { test } from "node:test";

import { ParticipantsService } from "../participants/participants.service";
import { RulesService } from "../rules/rules.service";
import { effectiveRange, refreshCandidates } from "./views-refresh";

function people() {
  const svc = new ParticipantsService(new RulesService());
  const add = (id: number, views: number | null, status: "ACTIVE" | "BLOCKED" = "ACTIVE") => {
    svc.setPhone(id, id, `+99890000000${id}`);
    svc.register(id, `Ism${id}`, `Familiya${id}`, 25);
    svc.acceptRules(id, 1);
    const reel = svc.submitReel(id, `https://www.instagram.com/reel/R${id}/`, `R${id}`);
    if (views !== null) {
      reel.status = "ACCEPTED";
      reel.history.push({ date: "2026-12-05", at: new Date("2026-12-05T01:00:00Z"), views, likes: 1, comments: 0 });
    }
    const p = svc.get(id);
    if (p) p.status = status;
  };
  add(1, 70_000);
  add(2, 85_000);
  add(3, 100_000);
  add(4, 640_000);
  add(5, 1_000_001);
  add(6, 300_000, "BLOCKED");
  add(7, null); // hali qabul qilinmagan
  return svc.all();
}

test("refresh picks active accepted reels inside the range, both bounds inclusive", () => {
  const all = people();
  assert.deepEqual(refreshCandidates(all, { minViews: 100_000, maxViews: 1_000_000, includeNear: false }), [3, 4]);
  assert.deepEqual(refreshCandidates(all, { minViews: null, maxViews: null, includeNear: false }), [1, 2, 3, 4, 5]);
  assert.deepEqual(refreshCandidates(all, { minViews: 1_000_000, maxViews: null, includeNear: false }), [5]);
});

test("near the lower bound: those 20% below are included — they may have crossed it since the last sync", () => {
  const all = people();
  assert.deepEqual(effectiveRange({ minViews: 100_000, maxViews: 1_000_000, includeNear: true }), { from: 80_000, to: 1_000_000 });
  assert.deepEqual(refreshCandidates(all, { minViews: 100_000, maxViews: 1_000_000, includeNear: true }), [2, 3, 4]);
});
