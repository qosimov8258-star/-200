import assert from "node:assert/strict";
import { test } from "node:test";

import { HttpException } from "@nestjs/common";

import { ContestSettingsService } from "./contest-settings.service";

const rejects = (fn: () => unknown, message: RegExp) =>
  assert.throws(fn, (e: unknown) => e instanceof HttpException && message.test(JSON.stringify(e.getResponse())));

test("defaults: contest ends at midnight after the last day (Tashkent)", () => {
  const svc = new ContestSettingsService();
  assert.equal(svc.get().startsOn, "2026-11-25");
  assert.equal(svc.get().endsOn, "2027-02-25");
  assert.equal(svc.endsAt.toISOString(), "2027-02-25T19:00:00.000Z");
  assert.equal(svc.started(new Date("2026-11-24T18:59:00Z")), false);
  assert.equal(svc.started(new Date("2026-11-24T19:00:00Z")), true, "25-noyabr 00:00 Toshkent");
});

test("update is validated and records who changed it", () => {
  const svc = new ContestSettingsService();
  const now = new Date("2026-11-20T10:00:00Z");
  const next = svc.update({ startsOn: "2026-11-26", endsOn: "2027-03-01", syncTime: "07:30", minAge: 16 }, "Usmon", now);
  assert.equal(next.updatedBy, "Usmon");
  assert.equal(svc.endsAt.toISOString(), "2027-03-01T19:00:00.000Z");

  const base = { startsOn: "2026-11-26", endsOn: "2027-03-01", syncTime: "07:30", minAge: 18 };
  rejects(() => svc.update({ ...base, endsOn: "2026-11-26" }, "U", now), /keyin/);
  rejects(() => svc.update({ ...base, startsOn: "2026-02-30" }, "U", now), /YYYY-MM-DD/);
  rejects(() => svc.update({ ...base, syncTime: "25:00" }, "U", now), /HH:MM/);
  rejects(() => svc.update({ ...base, minAge: 10 }, "U", now), /yosh/);
  rejects(() => svc.update({ ...base, startsOn: "2026-11-19" }, "U", now), /o'tgan kun/);
});

test("start date is locked once the contest has started", () => {
  const svc = new ContestSettingsService();
  const during = new Date("2026-12-01T10:00:00Z");
  rejects(
    () => svc.update({ startsOn: "2026-11-26", endsOn: "2027-02-25", syncTime: "06:00", minAge: 18 }, "U", during),
    /boshlangan/,
  );
  const extended = svc.update({ startsOn: "2026-11-25", endsOn: "2027-03-10", syncTime: "06:00", minAge: 18 }, "U", during);
  assert.equal(extended.endsOn, "2027-03-10");
});
