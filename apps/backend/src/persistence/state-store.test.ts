import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { ParticipantsService } from "../participants/participants.service";
import { RulesService } from "../rules/rules.service";
import { decodeState, encodeState } from "./state-codec";
import { StateStore } from "./state-store";

const tempDir = () => mkdtempSync(join(tmpdir(), "state-store-"));
const store = (dir: string, at = new Date("2026-11-25T10:00:00Z")) =>
  new StateStore({ dir, saveEveryMs: 60_000, keepBackups: 3, clock: () => at });

test("codec keeps Date objects and leaves look-alike text alone", () => {
  const at = new Date("2026-11-25T06:00:00.000Z");
  const decoded = decodeState(
    encodeState({ at, text: "2026-11-25T06:00:00.000Z", nested: [{ at }], tag: { $date: "x" } }),
  ) as { at: Date; text: string; nested: { at: Date }[]; tag: { $date: string } };
  assert.ok(decoded.at instanceof Date);
  assert.equal(decoded.at.getTime(), at.getTime());
  assert.equal(decoded.text, "2026-11-25T06:00:00.000Z");
  assert.ok(decoded.nested[0]?.at instanceof Date);
  assert.deepEqual(decoded.tag, { $date: "x" });
});

test("state survives a restart and is written only when it changes", () => {
  const dir = tempDir();
  const first = store(dir);
  const data = { count: 1, at: new Date("2026-11-25T06:00:00Z"), note: "$& va $' belgilar" };
  assert.equal(first.attach("demo", () => data), null);
  first.flush();
  const written = readFileSync(join(dir, "state.json"), "utf8");
  first.flush();
  assert.equal(readFileSync(join(dir, "state.json"), "utf8"), written, "o'zgarishsiz — qayta yozilmaydi");

  const second = store(dir);
  const loaded = second.attach("demo", () => data);
  assert.equal(loaded?.count, 1);
  assert.ok(loaded?.at instanceof Date);
  assert.equal(loaded?.note, "$& va $' belgilar");
  assert.throws(() => second.attach("demo", () => data), /ikki marta/);
});

test("a broken state file falls back to the newest backup", () => {
  const dir = tempDir();
  const first = store(dir);
  first.attach("demo", () => ({ value: "eski" }));
  first.flush();
  // Ikkinchi ishga tushish — oldingi fayldan "boot" zaxira olinadi.
  const second = store(dir, new Date("2026-11-26T10:00:00Z"));
  assert.equal(second.attach("demo", () => ({ value: "eski" }))?.value, "eski");

  writeFileSync(join(dir, "state.json"), "{ buzilgan");
  const third = store(dir, new Date("2026-11-27T10:00:00Z"));
  assert.equal(third.attach("demo", () => ({ value: "" }))?.value, "eski");
  assert.ok(readdirSync(dir).some((name) => name.startsWith("state.broken-")));
});

test("refuses to start empty when the file and all backups are broken", () => {
  const dir = tempDir();
  writeFileSync(join(dir, "state.json"), "{ buzilgan");
  assert.throws(() => store(dir), /yaroqli zaxira topilmadi/);
});

test("files are stored by safe names only", () => {
  const dir = tempDir();
  const s = store(dir);
  s.putFile("att_1.jpg", Buffer.from("rasm"));
  assert.equal(s.getFile("att_1.jpg")?.toString(), "rasm");
  assert.equal(s.getFile("att_2.jpg"), null);
  assert.throws(() => s.putFile("../state.json", Buffer.from("x")), /noto'g'ri/);
});

test("participants with reel history survive a restart", () => {
  const dir = tempDir();
  const first = store(dir);
  const rules = new RulesService(first);
  const participants = new ParticipantsService(rules, first);
  participants.setPhone(42, 42, "+998 90 123 45 67");
  participants.register(42, "Ali", "Valiyev", 25);
  participants.acceptRules(42, rules.version);
  const reel = participants.submitReel(42, "https://www.instagram.com/reel/ABC123/", "ABC123");
  reel.history.push({ date: "2026-11-25", at: new Date("2026-11-25T01:00:00Z"), views: 1500, likes: 40, comments: 2 });
  first.flush();

  const second = store(dir);
  const restored = new ParticipantsService(new RulesService(second), second).get(42);
  assert.equal(restored?.firstName, "Ali");
  assert.equal(restored?.phone, "+998901234567");
  assert.ok(restored?.reels[0]?.submittedAt instanceof Date);
  assert.equal(restored?.reels[0]?.history[0]?.views, 1500);
  assert.ok(restored?.reels[0]?.history[0]?.at instanceof Date);
  assert.ok(restored?.createdAt instanceof Date);
});

test("an old state file with a single `reel` per participant loads as `reels`", () => {
  const dir = tempDir();
  const first = store(dir);
  const submittedAt = new Date("2026-11-26T09:00:00Z");
  const reel = {
    url: "https://www.instagram.com/reel/OLD123/",
    shortcode: "OLD123",
    status: "ACCEPTED",
    submittedAt,
    owner: "ali",
    postedAt: null,
    rejectReason: null,
    history: [{ date: "2026-11-26", at: submittedAt, views: 700, likes: 10, comments: 1 }],
    flags: [],
    misses: 0,
    lastFoundAt: submittedAt,
    review: null,
  };
  const person = (telegramId: number, phone: string) => ({
    telegramId,
    chatId: telegramId,
    phone,
    firstName: "Ali",
    lastName: "Valiyev",
    age: 25,
    consentVersion: 1,
    status: "ACTIVE",
    createdAt: submittedAt,
  });
  // Eski ko'rinish: `reel` (bitta yoki null), `reels` yo'q.
  first.attach("participants", () => ({
    participants: [
      { ...person(1, "+998900000001"), reel },
      { ...person(2, "+998900000002"), reel: null },
    ],
  }));
  first.flush();

  const second = store(dir);
  const participants = new ParticipantsService(new RulesService(second), second);
  const one = participants.get(1);
  assert.equal(one?.reels.length, 1);
  assert.equal(one?.reels[0]?.shortcode, "OLD123");
  assert.ok(one?.reels[0]?.submittedAt instanceof Date);
  assert.equal("reel" in (one ?? {}), false, "eski maydon tashlanadi");
  assert.deepEqual(participants.get(2)?.reels, []);

  // Keyingi yozishda yangi ko'rinishda saqlanadi.
  second.flush();
  const saved = decodeState(readFileSync(join(dir, "state.json"), "utf8")) as {
    parts: { participants: { participants: Record<string, unknown>[] } };
  };
  const written = saved.parts.participants.participants;
  assert.ok(written.every((p) => Array.isArray(p.reels) && !("reel" in p)));
});
