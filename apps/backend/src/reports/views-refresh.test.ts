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
  assert.deepEqual(refreshCandidates(all, { minViews: 100_000, maxViews: 1_000_000, includeNear: false }).ids, [3, 4]);
  assert.deepEqual(refreshCandidates(all, { minViews: null, maxViews: null, includeNear: false }).ids, [1, 2, 3, 4, 5]);
  assert.deepEqual(refreshCandidates(all, { minViews: 1_000_000, maxViews: null, includeNear: false }).ids, [5]);
});

test("near the lower bound: those 20% below are included — they may have crossed it since the last sync", () => {
  const all = people();
  assert.deepEqual(effectiveRange({ minViews: 100_000, maxViews: 1_000_000, includeNear: true }), { from: 80_000, to: 1_000_000 });
  assert.deepEqual(refreshCandidates(all, { minViews: 100_000, maxViews: 1_000_000, includeNear: true }).ids, [2, 3, 4]);
});

test("picked by the sum of accepted reels (oferta 7.1); the video count covers every accepted reel", () => {
  const svc = new ParticipantsService(new RulesService());
  svc.setPhone(9, 9, "+998900000099");
  svc.register(9, "Ism", "Familiya", 30);
  svc.acceptRules(9, 1);
  for (const [code, views] of [["A9", 60_000], ["B9", 50_000]] as const) {
    const reel = svc.submitReel(9, `https://www.instagram.com/reel/${code}/`, code);
    reel.status = "ACCEPTED";
    reel.history.push({ date: "2026-12-05", at: new Date("2026-12-05T01:00:00Z"), views, likes: 1, comments: 0 });
  }
  // 60 000 + 50 000 = 110 000 — har bir video 100 000 dan past bo'lsa ham, yig'indisi oraliqda.
  assert.deepEqual(refreshCandidates(svc.all(), { minViews: 100_000, maxViews: null, includeNear: false }), { ids: [9], videos: 2 });
  assert.deepEqual(refreshCandidates(svc.all(), { minViews: 115_000, maxViews: null, includeNear: false }), { ids: [], videos: 0 });
  // Yuqori chegara ham yig'indiga qo'llanadi.
  assert.deepEqual(refreshCandidates(svc.all(), { minViews: null, maxViews: 100_000, includeNear: false }), { ids: [], videos: 0 });
});
