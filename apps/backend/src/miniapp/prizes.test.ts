import assert from "node:assert/strict";
import { test } from "node:test";

import { contestPrizes } from "./prizes";

test("prize tiers go from cheapest to the car and do not overlap", () => {
  const { tiers } = contestPrizes;
  for (const [i, tier] of tiers.entries()) {
    if (tier.maxViews !== null) assert.ok(tier.minViews <= tier.maxViews, tier.title);
    const next = tiers[i + 1];
    if (next) {
      assert.notEqual(tier.maxViews, null, `${tier.title}: faqat oxirgi toifa chegarasiz bo'ladi`);
      assert.ok(next.minViews > (tier.maxViews ?? 0), `${tier.title} va ${next.title} kesishmaydi`);
    }
  }
  assert.equal(tiers.at(-1)?.kind, "car");
});

test("monthly voucher range ends below the first main prize tier", () => {
  const { monthly, tiers } = contestPrizes;
  assert.ok(monthly.minViews < monthly.maxViews);
  assert.ok(monthly.maxViews < tiers[0].minViews);
  assert.equal(monthly.perMonth * contestPrizes.stages.length, monthly.total);
});

test("stages follow each other day by day", () => {
  const { stages } = contestPrizes;
  for (const [i, stage] of stages.entries()) {
    assert.ok(stage.startsOn <= stage.endsOn);
    const next = stages[i + 1];
    if (next) {
      const gapDays = (Date.parse(next.startsOn) - Date.parse(stage.endsOn)) / 86_400_000;
      assert.equal(gapDays, 1, `${i + 1}- va ${i + 2}-bosqich orasida bo'shliq yo'q`);
    }
  }
});
