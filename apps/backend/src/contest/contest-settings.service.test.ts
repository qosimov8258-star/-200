import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { HttpException } from "@nestjs/common";

import { encodeState } from "../persistence/state-codec";
import { StateStore } from "../persistence/state-store";
import { ContestSettingsService } from "./contest-settings.service";

const rejects = (fn: () => unknown, message: RegExp) =>
  assert.throws(fn, (e: unknown) => e instanceof HttpException && message.test(JSON.stringify(e.getResponse())));

test("defaults: contest ends at midnight after the last day (Tashkent)", () => {
  const svc = new ContestSettingsService();
  assert.equal(svc.get().startsOn, "2026-11-27", "oferta 2.5");
  assert.equal(svc.get().endsOn, "2027-02-27", "oferta 2.5");
  assert.equal(svc.endsAt.toISOString(), "2027-02-27T19:00:00.000Z");
  assert.equal(svc.started(new Date("2026-11-26T18:59:00Z")), false);
  assert.equal(svc.started(new Date("2026-11-26T19:00:00Z")), true, "27-noyabr 00:00 Toshkent");
});

test("update is validated and records who changed it", () => {
  const svc = new ContestSettingsService();
  const now = new Date("2026-11-20T10:00:00Z");
  const next = svc.update({ startsOn: "2026-11-26", endsOn: "2027-03-01", syncTime: "07:30", minAge: 21 }, "Usmon", now);
  assert.equal(next.updatedBy, "Usmon");
  assert.equal(svc.endsAt.toISOString(), "2027-03-01T19:00:00.000Z");

  const base = { startsOn: "2026-11-26", endsOn: "2027-03-01", syncTime: "07:30", minAge: 18 };
  rejects(() => svc.update({ ...base, endsOn: "2026-11-26" }, "U", now), /keyin/);
  rejects(() => svc.update({ ...base, startsOn: "2026-02-30" }, "U", now), /YYYY-MM-DD/);
  rejects(() => svc.update({ ...base, syncTime: "25:00" }, "U", now), /HH:MM/);
  rejects(() => svc.update({ ...base, minAge: 17 }, "U", now), /yosh/);
  rejects(() => svc.update({ ...base, startsOn: "2026-11-19" }, "U", now), /o'tgan kun/);
});

test("start date is locked once the contest has started", () => {
  const svc = new ContestSettingsService();
  const during = new Date("2026-12-01T10:00:00Z");
  rejects(
    () => svc.update({ startsOn: "2026-11-26", endsOn: "2027-02-27", syncTime: "06:00", minAge: 18 }, "U", during),
    /boshlangan/,
  );
  const extended = svc.update({ startsOn: "2026-11-27", endsOn: "2027-03-10", syncTime: "06:00", minAge: 18 }, "U", during);
  assert.equal(extended.endsOn, "2027-03-10");
});

test("saved 06:00 sync time moves to 00:00 once; a later admin choice is kept", () => {
  const dir = mkdtempSync(join(tmpdir(), "contest-settings-"));
  try {
    const old = { ...new ContestSettingsService().get(), syncTime: "06:00" };
    writeFileSync(
      join(dir, "state.json"),
      encodeState({ version: 1, savedAt: new Date(), parts: { contestSettings: old } }),
    );
    const open = () => {
      const store = new StateStore({ dir, saveEveryMs: 60_000, keepBackups: 1 });
      return { store, settings: new ContestSettingsService(store) };
    };

    const first = open();
    assert.equal(first.settings.get().syncTime, "00:00", "eski standart — yarim tunga");
    first.settings.update({ ...first.settings.get(), syncTime: "06:00" }, "Admin", new Date("2026-11-20T10:00:00Z"));
    first.store.flush();

    const second = open();
    assert.equal(second.settings.get().syncTime, "06:00", "admin tanlovi qayta o'zgartirilmaydi");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("views are collected weekly by default; the period is validated and kept when not sent", () => {
  const svc = new ContestSettingsService();
  assert.equal(svc.get().syncEveryDays, 7, "standart — haftada bir marta");
  const now = new Date("2026-11-20T10:00:00Z");
  const base = { startsOn: "2026-11-26", endsOn: "2027-03-01", syncTime: "00:00", minAge: 18 };
  assert.equal(svc.update({ ...base, syncEveryDays: 1 }, "Admin", now).syncEveryDays, 1);
  assert.equal(svc.update(base, "Admin", now).syncEveryDays, 1, "berilmasa — joriy qiymat qoladi");
  rejects(() => svc.update({ ...base, syncEveryDays: 0 }, "U", now), /davri/);
  rejects(() => svc.update({ ...base, syncEveryDays: 31 }, "U", now), /davri/);
  rejects(() => svc.update({ ...base, syncEveryDays: 2.5 }, "U", now), /davri/);
});

test("saved settings (daily, before the period was a setting) switch to weekly once; a later admin choice is kept", () => {
  const dir = mkdtempSync(join(tmpdir(), "contest-settings-"));
  try {
    const { syncEveryDays: _dropped, ...old } = new ContestSettingsService().get();
    writeFileSync(
      join(dir, "state.json"),
      encodeState({
        version: 1,
        savedAt: new Date(),
        parts: { contestSettings: old, contestSettingsMigrations: ["sync-time-midnight-2026-11-24"] },
      }),
    );
    const open = () => {
      const store = new StateStore({ dir, saveEveryMs: 60_000, keepBackups: 1 });
      return { store, settings: new ContestSettingsService(store) };
    };

    const first = open();
    assert.equal(first.settings.get().syncEveryDays, 7, "haftalikka o'tdi");
    assert.equal(first.settings.get().updatedBy, "Tizim");
    first.settings.update({ ...first.settings.get(), syncEveryDays: 1 }, "Admin", new Date("2026-11-20T10:00:00Z"));
    first.store.flush();

    const second = open();
    assert.equal(second.settings.get().syncEveryDays, 1, "admin tanlovi qayta o'zgartirilmaydi");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("saved old default dates (25.11–25.02) move to the offer dates (27.11–27.02) once; other dates are kept", () => {
  const dir = mkdtempSync(join(tmpdir(), "contest-settings-"));
  try {
    const write = (startsOn: string, endsOn: string, migrations: string[]) =>
      writeFileSync(
        join(dir, "state.json"),
        encodeState({
          version: 1,
          savedAt: new Date(),
          parts: {
            contestSettings: { ...new ContestSettingsService().get(), startsOn, endsOn },
            contestSettingsMigrations: migrations,
          },
        }),
      );
    const open = () => {
      const store = new StateStore({ dir, saveEveryMs: 60_000, keepBackups: 1 });
      return { store, settings: new ContestSettingsService(store) };
    };

    write("2026-11-25", "2027-02-25", ["sync-time-midnight-2026-11-24", "sync-every-week-2026-11-25"]);
    const first = open();
    assert.equal(first.settings.get().startsOn, "2026-11-27");
    assert.equal(first.settings.get().endsOn, "2027-02-27");
    assert.equal(first.settings.get().updatedBy, "Tizim");
    assert.equal(first.settings.endsAt.toISOString(), "2027-02-27T19:00:00.000Z");
    // Admin keyin eski sanalarni o'zi qaytarsa — qayta o'zgartirilmaydi (migratsiya bir martalik).
    first.settings.update(
      { ...first.settings.get(), startsOn: "2026-11-25", endsOn: "2027-02-25" },
      "Admin",
      new Date("2026-11-20T10:00:00Z"),
    );
    first.store.flush();
    const second = open();
    assert.equal(second.settings.get().startsOn, "2026-11-25", "admin tanlovi qayta o'zgartirilmaydi");
    assert.equal(second.settings.get().endsOn, "2027-02-25");
    second.store.flush();

    // Admin boshqa sana qo'ygan bo'lsa — tegilmaydi.
    write("2026-11-26", "2027-03-01", ["sync-time-midnight-2026-11-24", "sync-every-week-2026-11-25"]);
    const custom = open();
    assert.equal(custom.settings.get().startsOn, "2026-11-26");
    assert.equal(custom.settings.get().endsOn, "2027-03-01");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
