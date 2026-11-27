import assert from "node:assert/strict";
import { test } from "node:test";

import { ApiException } from "../common/api-exception";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { encodeState } from "../persistence/state-codec";
import { StateStore } from "../persistence/state-store";
import { OFFER_RU, OFFER_UZ } from "./offer-text";
import { RULES_LIMITS, RulesService, validateSections } from "./rules.service";

const rejects = (input: unknown) =>
  assert.throws(() => validateSections(input), (e: unknown) => e instanceof ApiException);

test("sections are trimmed and validated", () => {
  assert.deepEqual(validateSections([{ title: "  Sarlavha ", body: " Matn matni " }]), [
    { title: "Sarlavha", body: "Matn matni" },
  ]);
  rejects([]);
  rejects("matn");
  rejects([{ title: "S", body: "Matn matni" }]);
  rejects([{ title: "Sarlavha", body: "" }]);
  rejects([{ title: "Sarlavha", body: "Matn matni", extra: 1 }]);
  rejects(Array.from({ length: RULES_LIMITS.maxSections + 1 }, () => ({ title: "Sarlavha", body: "Matn matni" })));
});

test("version grows only when re-consent is requested", () => {
  const svc = new RulesService();
  const before = svc.get();
  assert.equal(svc.update(before.sections, false, "Admin"), before, "o'zgarishsiz saqlash — hech narsa o'zgarmaydi");
  // Oferta 20 bo'limdan iborat (chegara) — oxirgisi almashtiriladi.
  const minor = svc.update([...before.sections.slice(0, -1), { title: "17. Yangi", body: "Qo'shimcha qoida." }], false, "Admin");
  assert.equal(minor.version, 1);
  assert.equal(minor.sections.length, 20);
  assert.deepEqual(minor.sectionsRu, OFFER_RU, "ruscha matn admin tahririda yo'qolmaydi");
  assert.equal(minor.updatedBy, "Admin");
  assert.equal(svc.update(minor.sections, true, "Admin").version, 2);
});

test("defaults are the public offer in both languages; Russian falls back to the offer", () => {
  const svc = new RulesService();
  assert.equal(svc.get().version, 1);
  assert.deepEqual(svc.get().sections, OFFER_UZ);
  assert.deepEqual(svc.sectionsFor("uz"), OFFER_UZ);
  assert.deepEqual(svc.sectionsFor("ru"), OFFER_RU);
  assert.equal(validateSections(OFFER_UZ).length, OFFER_UZ.length, "oferta matni cheklovlarga sig'adi");
  assert.equal(validateSections(OFFER_RU).length, OFFER_RU.length);
});

test("saved old rules are replaced by the offer once, with a new consent version; later edits are kept", () => {
  const dir = mkdtempSync(join(tmpdir(), "rules-"));
  try {
    const old = { version: 3, sections: [{ title: "1. Eski", body: "Eski qoida matni." }], updatedAt: null, updatedBy: null };
    writeFileSync(join(dir, "state.json"), encodeState({ version: 1, savedAt: new Date(), parts: { rules: old } }));
    const open = () => {
      const store = new StateStore({ dir, saveEveryMs: 60_000, keepBackups: 1 });
      return { store, rules: new RulesService(store) };
    };

    const first = open();
    assert.equal(first.rules.get().version, 4, "ishtirokchilar ofertani qaytadan qabul qiladi");
    assert.deepEqual(first.rules.get().sections, OFFER_UZ);
    assert.deepEqual(first.rules.sectionsFor("ru"), OFFER_RU);
    first.rules.update([{ title: "1. Admin", body: "Admin tahrir qilgan matn." }], false, "Admin");
    first.store.flush();

    const second = open();
    assert.equal(second.rules.get().version, 4);
    assert.equal(second.rules.get().sections[0].title, "1. Admin", "admin tahriri qayta almashtirilmaydi");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
