import assert from "node:assert/strict";
import { test } from "node:test";

import { ApiException } from "../common/api-exception";
import { RulesService } from "../rules/rules.service";
import { ParticipantsService } from "./participants.service";

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

test("a Reel can be submitted once and only by one participant", () => {
  const svc = make();
  active(svc, 1, "+998900000001");
  active(svc, 2, "+998900000002");
  svc.submitReel(1, "https://www.instagram.com/reel/AAAAA1/", "AAAAA1");
  assert.equal(code(() => svc.submitReel(1, "u", "BBBBB2")), "REEL_ALREADY_SUBMITTED");
  assert.equal(code(() => svc.submitReel(2, "u", "AAAAA1")), "REEL_TAKEN");
  assert.equal(svc.get(1)?.reel?.status, "PENDING");
});

test("only active participants can submit; no Instagram connection is needed", () => {
  const svc = make();
  svc.setPhone(1, 1, "+998900000001");
  assert.equal(code(() => svc.submitReel(1, "u", "AAAAA1")), "UNAUTHORIZED");
  svc.register(1, "Ali", "Valiyev", 30);
  svc.acceptRules(1, RULES_VERSION);
  assert.equal(code(() => svc.submitReel(1, "u", "AAAAA1")), "NONE");
});

test("a rejected Reel can be replaced, and its link is free for others", () => {
  const svc = make();
  active(svc, 1, "+998900000001");
  active(svc, 2, "+998900000002");
  const first = svc.submitReel(1, "u", "AAAAA1");
  first.status = "REJECTED";
  first.rejectReason = "NOT_FOUND";
  assert.equal(code(() => svc.submitReel(2, "u", "AAAAA1")), "NONE");
  assert.equal(code(() => svc.submitReel(1, "u", "CCCCC3")), "NONE");
  assert.equal(svc.get(1)?.reel?.shortcode, "CCCCC3");
  assert.equal(svc.get(1)?.reel?.status, "PENDING");
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
