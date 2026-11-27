import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { ApiException } from "../common/api-exception";
import { parseRegister, parseWebRegister } from "../miniapp/validation";
import { StateStore } from "../persistence/state-store";
import { RulesService } from "../rules/rules.service";
import {
  bestReel,
  instagramUsernames,
  isWebAccount,
  migrateParticipant,
  parseUzPhone,
  participantViews,
  ParticipantsService,
  reelsForDisplay,
  topReel,
  type Reel,
  type StoredParticipant,
  WEB_ID_BASE,
} from "./participants.service";

const RULES_VERSION = 1;
const make = () => new ParticipantsService(new RulesService());

const code = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    return e instanceof ApiException ? (e.getResponse() as { code: string }).code : "OTHER";
  }
  return "NONE";
};

function active(svc: ParticipantsService, id: number, phone: string) {
  svc.setPhone(id, id, phone);
  svc.register(id, "Jamshid", "Ergashev", 25);
  svc.acceptRules(id, RULES_VERSION);
}

test("stages follow contact → profile → consent", () => {
  const svc = make();
  const p = svc.getOrCreate(1);
  assert.equal(svc.stage(p), "NEEDS_CONTACT");
  assert.equal(code(() => svc.register(1, "Ali", "Valiyev", 30)), "UNAUTHORIZED");
  svc.setPhone(1, 1, "998 90 123-45-67");
  assert.equal(svc.stage(p), "NEEDS_PROFILE");
  svc.register(1, "Ali", "Valiyev", 30);
  assert.equal(svc.stage(p), "NEEDS_CONSENT");
  svc.acceptRules(1, RULES_VERSION);
  assert.equal(svc.stage(p), "ACTIVE");
});

test("profile is written once and age is enforced", () => {
  const svc = make();
  svc.setPhone(1, 1, "+998901234567");
  assert.equal(code(() => svc.register(1, "Ali", "Valiyev", 16)), "UNDER_AGE");
  svc.register(1, "Ali", "Valiyev", 30);
  assert.equal(code(() => svc.register(1, "Boshqa", "Odam", 40)), "PROFILE_LOCKED");
  assert.equal(svc.get(1)?.firstName, "Ali");
});

test("one phone number — one participant", () => {
  const svc = make();
  assert.equal(svc.setPhone(1, 1, "+998901234567"), "OK");
  assert.equal(svc.setPhone(2, 2, "998901234567"), "TAKEN");
  assert.equal(svc.setPhone(1, 1, "+998901234567"), "OK");
});

test("a participant can submit any number of Reels; each live link belongs to one participant", () => {
  const svc = make();
  active(svc, 1, "+998900000001");
  active(svc, 2, "+998900000002");
  for (const shortcode of ["AAAAA1", "BBBBB2", "CCCCC3", "DDDDD4", "EEEEE5"]) {
    assert.equal(code(() => svc.submitReel(1, `https://www.instagram.com/reel/${shortcode}/`, shortcode)), "NONE");
  }
  assert.deepEqual(
    svc.get(1)?.reels.map((r) => [r.shortcode, r.status]),
    [
      ["AAAAA1", "PENDING"],
      ["BBBBB2", "PENDING"],
      ["CCCCC3", "PENDING"],
      ["DDDDD4", "PENDING"],
      ["EEEEE5", "PENDING"],
    ],
    "eskidan yangiga, yuborilish tartibida",
  );
  // O'zida bor (rad etilmagan) link — qayta yuborilmaydi; boshqada bor — band.
  assert.equal(code(() => svc.submitReel(1, "u", "CCCCC3")), "REEL_ALREADY_SUBMITTED");
  assert.equal(code(() => svc.submitReel(2, "u", "AAAAA1")), "REEL_TAKEN");
  assert.equal(svc.get(1)?.reels.length, 5);
  assert.equal(svc.get(2)?.reels.length, 0);
});

test("only active participants can submit; no Instagram connection is needed", () => {
  const svc = make();
  svc.setPhone(1, 1, "+998900000001");
  assert.equal(code(() => svc.submitReel(1, "u", "AAAAA1")), "UNAUTHORIZED");
  svc.register(1, "Ali", "Valiyev", 30);
  svc.acceptRules(1, RULES_VERSION);
  assert.equal(code(() => svc.submitReel(1, "u", "AAAAA1")), "NONE");
});

test("a rejected Reel's link is free for others; a new link is added next to it", () => {
  const svc = make();
  active(svc, 1, "+998900000001");
  active(svc, 2, "+998900000002");
  const first = svc.submitReel(1, "u", "AAAAA1");
  first.status = "REJECTED";
  first.rejectReason = "NOT_FOUND";
  assert.equal(code(() => svc.submitReel(2, "u", "AAAAA1")), "NONE");
  assert.equal(code(() => svc.submitReel(1, "u", "CCCCC3")), "NONE");
  assert.deepEqual(svc.get(1)?.reels.map((r) => [r.shortcode, r.status]), [
    ["AAAAA1", "REJECTED"],
    ["CCCCC3", "PENDING"],
  ]);
  // Endi bu link 2-ishtirokchida band — 1-ishtirokchi o'zining rad etilganini qayta yubora olmaydi.
  assert.equal(code(() => svc.submitReel(1, "u", "AAAAA1")), "REEL_TAKEN");
});

test("re-submitting one's own rejected link replaces the old entry", () => {
  const svc = make();
  active(svc, 1, "+998900000001");
  const first = svc.submitReel(1, "u", "AAAAA1");
  svc.submitReel(1, "u", "BBBBB2");
  first.status = "REJECTED";
  first.rejectReason = "NOT_FOUND";

  const again = svc.submitReel(1, "https://www.instagram.com/reel/AAAAA1/", "AAAAA1");
  assert.notEqual(again, first);
  assert.deepEqual(svc.get(1)?.reels.map((r) => [r.shortcode, r.status, r.rejectReason]), [
    ["BBBBB2", "PENDING", null],
    ["AAAAA1", "PENDING", null],
  ]);
  assert.equal(code(() => svc.submitReel(1, "u", "AAAAA1")), "REEL_ALREADY_SUBMITTED");
  assert.equal(svc.findByShortcode("AAAAA1")?.reel, again);
});

test("one Instagram account — one participant, but a participant may use several own accounts", () => {
  const svc = make();
  active(svc, 1, "+998900000001");
  active(svc, 2, "+998900000002");
  svc.submitReel(1, "u", "AAAAA1").owner = "ali";
  svc.submitReel(1, "u", "BBBBB2").owner = "ali_second";
  const rejected = svc.submitReel(1, "u", "CCCCC3");
  rejected.owner = "old_account";
  rejected.status = "REJECTED";
  assert.equal(svc.ownerTakenByOther("ali", 2), true);
  assert.equal(svc.ownerTakenByOther("ali_second", 2), true);
  assert.equal(svc.ownerTakenByOther("ali", 1), false, "o'zining boshqa videosi to'sqinlik qilmaydi");
  assert.equal(svc.ownerTakenByOther("old_account", 2), false, "rad etilgan video akkauntni band qilmaydi");
  assert.deepEqual(instagramUsernames(svc.get(1)!), ["ali", "ali_second"]);
});

test("views are the sum of every accepted Reel's latest views (oferta 7.1); undecided and rejected do not count", () => {
  const svc = make();
  active(svc, 1, "+998900000001");
  const snap = (reel: Reel, ...views: number[]) => {
    reel.history = views.map((v, i) => ({ date: `2026-12-0${i + 1}`, at: new Date(), views: v, likes: null, comments: null }));
  };
  const a = svc.submitReel(1, "u", "AAAAA1");
  const b = svc.submitReel(1, "u", "BBBBB2");
  const c = svc.submitReel(1, "u", "CCCCC3");
  const d = svc.submitReel(1, "u", "DDDDD4");
  a.status = "ACCEPTED";
  snap(a, 100, 1_000);
  b.status = "ACCEPTED";
  snap(b, 5_000);
  c.status = "MANUAL_REVIEW"; // reytingda hisoblanmaydi
  snap(c, 90_000);
  d.status = "REJECTED";
  snap(d, 70_000);
  const p = svc.get(1)!;
  assert.equal(participantViews(p), 6_000, "1 000 + 5 000 — faqat qabul qilinganlarning oxirgi ko'rishlari");
  assert.equal(bestReel(p), b);
  assert.equal(topReel([a, b]), b);
  assert.equal(topReel([]), null);
  // Teng ko'rishda — oldinroq yuborilgani (ro'yxat tartibidan qat'i nazar).
  snap(a, 5_000);
  a.submittedAt = new Date("2026-12-01T10:00:00Z");
  b.submittedAt = new Date("2026-12-02T10:00:00Z");
  assert.equal(topReel([b, a]), a);
  assert.equal(participantViews(p), 10_000);
});

test("without accepted Reels the views are 0 and there is no best Reel", () => {
  const svc = make();
  active(svc, 1, "+998900000001");
  const r = svc.submitReel(1, "u", "AAAAA1");
  r.history = [{ date: "2026-12-01", at: new Date(), views: 9_000, likes: null, comments: null }];
  const p = svc.get(1)!;
  assert.equal(participantViews(p), 0);
  assert.equal(bestReel(p), null);
});

test("display order: accepted by views (best first), then undecided, then rejected — newest first", () => {
  const svc = make();
  active(svc, 1, "+998900000001");
  const at = (day: number) => new Date(`2026-12-${String(day).padStart(2, "0")}T10:00:00Z`);
  const reel = (code: string, status: Reel["status"], day: number, views: number | null) => {
    const r = svc.submitReel(1, "u", code);
    r.status = status;
    r.submittedAt = at(day);
    r.history = views === null ? [] : [{ date: "2026-12-20", at: new Date(), views, likes: null, comments: null }];
    return r;
  };
  reel("REJ001", "REJECTED", 1, 99_000);
  reel("ACC001", "ACCEPTED", 2, 1_000);
  reel("PEN001", "PENDING", 3, null);
  reel("ACC002", "ACCEPTED", 4, 7_000);
  reel("MAN001", "MANUAL_REVIEW", 5, 500);
  reel("ACC003", "ACCEPTED", 6, 1_000);
  reel("REJ002", "REJECTED", 7, null);
  assert.deepEqual(
    reelsForDisplay(svc.get(1)!.reels).map((r) => r.shortcode),
    ["ACC002", "ACC001", "ACC003", "MAN001", "PEN001", "REJ002", "REJ001"],
  );
});

test("saved state with the old single `reel` is migrated to `reels`", () => {
  const svc = make();
  active(svc, 1, "+998900000001");
  const reel = svc.submitReel(1, "u", "AAAAA1");
  const { reels: _reels, ...rest } = svc.get(1)!;
  const old: StoredParticipant = { ...rest, reel };
  const migrated = migrateParticipant(old);
  assert.deepEqual(migrated.reels, [reel]);
  assert.equal("reel" in migrated, false);
  assert.deepEqual(migrateParticipant({ ...rest, reel: null }).reels, []);
  assert.deepEqual(migrateParticipant({ ...rest, reels: [reel] }).reels, [reel]);
});

test("a major rules change asks active participants to consent again", () => {
  const rules = new RulesService();
  const svc = new ParticipantsService(rules);
  active(svc, 1, "+998900000001");
  assert.equal(svc.stage(svc.get(1)!), "ACTIVE");

  // Kichik tuzatish — versiya o'zgarmaydi, ishtirokchi faolligicha qoladi.
  rules.update([{ title: "1. Qoida", body: "Imlo xatosi tuzatildi." }], false, "Admin");
  assert.equal(rules.version, 1);
  assert.equal(svc.stage(svc.get(1)!), "ACTIVE");

  // Muhim o'zgarish — qayta rozilik.
  rules.update([{ title: "1. Qoida", body: "Yangi shart qo'shildi." }], true, "Admin");
  assert.equal(rules.version, 2);
  assert.equal(svc.stage(svc.get(1)!), "NEEDS_CONSENT");
  assert.equal(code(() => svc.acceptRules(1, 1)), "RULES_OUTDATED");
  svc.acceptRules(1, 2);
  assert.equal(svc.stage(svc.get(1)!), "ACTIVE");
});

test("web sign-up: name and phone create a separate account; phone stays unique", () => {
  const participants = new ParticipantsService(new RulesService());
  assert.equal(parseUzPhone("90 123 45 67"), "+998901234567");
  assert.equal(parseUzPhone("+998 (90) 123-45-67"), "+998901234567");
  assert.equal(parseUzPhone("998901234567"), "+998901234567");
  assert.equal(parseUzPhone("+7 901 234 56 78"), null);
  assert.equal(parseUzPhone("12345"), null);

  const id = participants.registerWeb("Dilnoza", "90 123 45 67", 25);
  assert.ok(isWebAccount(id) && id > WEB_ID_BASE && Number.isSafeInteger(id));
  const p = participants.get(id)!;
  assert.equal(p.phone, "+998901234567");
  assert.equal(p.firstName, "Dilnoza");
  assert.equal(p.lastName, "", "familiya so'ralmaydi");
  assert.equal(p.chatId, null);
  assert.equal(participants.stage(p), "NEEDS_CONSENT");

  const second = participants.registerWeb("Jasur", "+998 91 000 00 01", 30);
  assert.equal(second, id + 1);
  const code = (fn: () => unknown) => {
    try {
      fn();
    } catch (e) {
      return (e as ApiException).getResponse();
    }
    return null;
  };
  assert.deepEqual(code(() => participants.registerWeb("Ali", "998901234567", 20)), { code: "PHONE_TAKEN" });
  assert.deepEqual(code(() => participants.registerWeb("Ali", "+7 999 111 22 33", 20)), { code: "INVALID_PHONE" });
  assert.deepEqual(code(() => participants.registerWeb("Ali", "93 111 22 33", 15)), { code: "UNDER_AGE" });

  // Shu raqamni Telegram bot orqali ulashsa — saytdagi hisob unga ulanadi (raqam egasi tasdiqlandi).
  assert.equal(participants.setPhone(555, 555, "+998901234567"), "LINKED");
  assert.equal(participants.setPhone(556, 556, "+998901234568"), "OK");
  participants.setPhone(557, 557, "+998901234569");
  assert.equal(participants.setPhone(558, 558, "+998901234569"), "TAKEN");
});

test("profile without a surname is accepted; an old app may still send one", () => {
  const participants = new ParticipantsService(new RulesService());
  participants.setPhone(1, 1, "+998900000001");
  participants.register(1, "Ali", "", 20);
  assert.equal(participants.stage(participants.get(1)!), "NEEDS_CONSENT");
  assert.deepEqual(parseRegister({ firstName: "Ali", age: 20 }), { firstName: "Ali", lastName: "", age: 20 });
  assert.deepEqual(parseRegister({ firstName: "Ali", lastName: "Valiyev", age: 20 }), {
    firstName: "Ali",
    lastName: "Valiyev",
    age: 20,
  });
  assert.throws(() => parseRegister({ firstName: "Ali", lastName: "1", age: 20 }));
  assert.throws(() => parseWebRegister({ firstName: "Ali", phone: "901234567", age: 20, lastName: "X" }));
  assert.deepEqual(parseWebRegister({ firstName: " Ali ", phone: "901234567", age: 20 }), {
    firstName: "Ali",
    phone: "901234567",
    age: 20,
  });
});

test("sign-up asks only for the name (and phone on the site); age is optional but still checked if sent", () => {
  const participants = new ParticipantsService(new RulesService());
  participants.setPhone(1, 1, "+998900000001");
  participants.register(1, "Ali", "");
  assert.equal(participants.get(1)?.age, null);
  assert.equal(participants.stage(participants.get(1)!), "NEEDS_CONSENT");

  const web = participants.registerWeb("Dilnoza", "90 765 43 21");
  assert.equal(participants.get(web)?.age, null);
  assert.equal(participants.stage(participants.get(web)!), "NEEDS_CONSENT");

  assert.deepEqual(parseRegister({ firstName: "Ali" }), { firstName: "Ali", lastName: "", age: null });
  assert.deepEqual(parseWebRegister({ firstName: "Ali", phone: "901234567" }), {
    firstName: "Ali",
    phone: "901234567",
    age: null,
  });
  // Eski ilova yoshni yuborsa — tekshiriladi.
  assert.throws(() => parseRegister({ firstName: "Ali", age: "20" }));
  participants.setPhone(2, 2, "+998900000002");
  assert.equal(code(() => participants.register(2, "Vali", "", 15)), "UNDER_AGE");
});

test("sharing the web account's phone in the bot links that account to Telegram", () => {
  const participants = new ParticipantsService(new RulesService());
  const webId = participants.registerWeb("Dilnoza", "90 123 45 67", 25);
  participants.getOrCreate(777); // /start — hali ro'yxatdan o'tmagan yozuv

  const now = new Date("2026-12-01T10:00:00Z");
  assert.equal(participants.setPhone(777, 7770, "+998901234567", now), "LINKED");
  const account = participants.get(webId)!;
  assert.equal(account.linkedTelegramId, 777);
  assert.equal(account.chatId, 7770, "bot xabarlari endi Telegram'ga boradi");
  assert.deepEqual(account.sessionsFrom, now);
  assert.equal(participants.get(777), null, "bo'sh Telegram yozuvi o'rnini saytdagi hisob oldi");
  assert.equal(participants.resolve(777), webId);

  // Qayta ulashish — o'zgarishsiz (boshqa raqam bo'lsa ham alohida yozuv ochilmaydi).
  assert.equal(participants.setPhone(777, 7771, "+998901234567"), "OK");
  assert.equal(participants.setPhone(777, 7771, "+998935550000"), "OK");
  assert.equal(participants.get(777), null);
  assert.equal(account.phone, "+998901234567");
  assert.equal(account.chatId, 7771);

  // Boshqa Telegram foydalanuvchisi shu raqamni ulasha olmaydi.
  assert.equal(participants.setPhone(888, 888, "+998901234567"), "TAKEN");

  // O'z profili bor Telegram foydalanuvchisi — ikki hisob qo'shilmaydi.
  const other = participants.registerWeb("Jasur", "91 000 00 01", 30);
  participants.setPhone(999, 999, "+998911111111");
  participants.register(999, "Jasur", "", 30);
  participants.get(999)!.phone = null; // raqamsiz profil (eski holat)
  assert.equal(participants.setPhone(999, 999, "+998910000001"), "TAKEN_WEB");
  assert.equal(participants.get(other)?.linkedTelegramId ?? null, null);

  // Hisob o'chirilsa — ulanish ham yo'qoladi.
  participants.delete(webId);
  assert.equal(participants.resolve(777), 777);
});

test("a linked account survives a restart", () => {
  const dir = mkdtempSync(join(tmpdir(), "participants-link-"));
  try {
    const open = () => {
      const store = new StateStore({ dir, saveEveryMs: 60_000, keepBackups: 1 });
      return { store, participants: new ParticipantsService(new RulesService(), store) };
    };
    const first = open();
    const webId = first.participants.registerWeb("Dilnoza", "90 123 45 67", 25);
    first.participants.setPhone(777, 777, "+998901234567");
    first.store.flush();

    const second = open();
    assert.equal(second.participants.resolve(777), webId);
    assert.ok(second.participants.get(webId)?.sessionsFrom instanceof Date);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
