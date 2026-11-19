import assert from "node:assert/strict";
import { test } from "node:test";

import { ApiException } from "../common/api-exception";
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
  const minor = svc.update([...before.sections, { title: "6. Yangi", body: "Qo'shimcha qoida." }], false, "Admin");
  assert.equal(minor.version, 1);
  assert.equal(minor.sections.length, 6);
  assert.equal(minor.updatedBy, "Admin");
  assert.equal(svc.update(minor.sections, true, "Admin").version, 2);
});
