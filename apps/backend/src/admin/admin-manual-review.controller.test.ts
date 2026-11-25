import assert from "node:assert/strict";
import { test } from "node:test";

import { AuditService } from "../audit/audit.service";
import { MockReelStatsProvider } from "../instagram/mock.provider";
import { ParticipantsService } from "../participants/participants.service";
import { RulesService } from "../rules/rules.service";
import { StatsService } from "../stats/stats.service";
import type { AdminUser } from "./auth/admin-accounts";
import { AdminManualReviewController } from "./admin-manual-review.controller";

const ADMIN: AdminUser = { id: "adm_1", login: "admin", fullName: "Bosh Admin", role: "ADMIN" };

function setup() {
  const participants = new ParticipantsService(new RulesService());
  const provider = new MockReelStatsProvider();
  const stats = new StatsService(participants, provider, { notify: () => Promise.resolve() }, {
    syncTime: "06:00",
    everyDays: 1,
    verifyDelayMs: 0,
    contestStartsOn: "2026-11-30",
    contestEndsAt: new Date("2027-01-01T07:00:00Z"),
    clock: () => new Date("2026-12-01T02:00:00Z"),
  });
  const controller = new AdminManualReviewController(stats, new AuditService());
  participants.setPhone(1, 1, "+998900000001");
  participants.register(1, "Ism1", "Familiya1", 25);
  participants.acceptRules(1, 1);
  return { participants, provider, stats, controller };
}

test("manual review list: after approval the row shows the views read from Apify and when", async () => {
  const { participants, provider, stats, controller } = setup();
  provider.set("GONE01", null);
  participants.submitReel(1, "https://www.instagram.com/reel/GONE01/", "GONE01");
  // Apify 3 marta topa olmadi — qo'lda tekshiruvga tushadi.
  for (let i = 0; i < 3; i++) {
    stats.queueVerification(1);
    await stats.flushVerification();
  }
  const open = controller.list("OPEN").items[0];
  assert.equal(open?.shortcode, "GONE01");
  assert.equal(open?.lastViews, null, "hali o'qilmagan");
  assert.equal(open?.lastSyncedAt, null);

  provider.set("GONE01", { owner: "ali", views: 4_200, likes: 300 });
  const decided = controller.decide("GONE01", { decision: "approve" }, ADMIN);
  assert.equal(decided.status, "APPROVED");
  await stats.flushVerification();

  const approved = controller.list("APPROVED").items[0];
  assert.equal(approved?.participant.id, "1", "ishtirokchi oynasini ochish uchun ID");
  assert.equal(approved?.lastViews, 4_200);
  assert.equal(approved?.lastSyncedAt, "2026-12-01T02:00:00.000Z");
  assert.equal(approved?.owner, "ali");
});
