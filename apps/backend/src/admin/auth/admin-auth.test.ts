import assert from "node:assert/strict";
import { test } from "node:test";

import { parseAdminAccounts } from "./admin-accounts";
import { adminCookie, createAdminToken, verifyAdminToken } from "./admin-session";

const secret = Buffer.from("test-secret-test-secret-test-secret");

test("ADMIN_USERS is parsed and passwords are verified by hash", () => {
  const [admin, support] = parseAdminAccounts(
    " Usmon|admin|Usmon Umaraliyev|parol-1234567 ; operator|SUPPORT|Operator Bir|boshqa-parol-99",
  );
  assert.equal(admin?.login, "usmon");
  assert.equal(admin?.role, "ADMIN");
  assert.equal(admin?.fullName, "Usmon Umaraliyev");
  assert.equal(admin?.verify("parol-1234567"), true);
  assert.equal(admin?.verify("parol-1234568"), false);
  assert.equal(support?.role, "SUPPORT");
  assert.notEqual(admin?.fingerprint, support?.fingerprint);
  assert.deepEqual(parseAdminAccounts(null), []);
});

test("bad ADMIN_USERS entries stop the server with a clear message", () => {
  assert.throws(() => parseAdminAccounts("usmon|ADMIN|Usmon"), /login\|ROL/);
  assert.throws(() => parseAdminAccounts("usmon|BOSS|Usmon U|parol-1234567"), /rol/);
  assert.throws(() => parseAdminAccounts("usmon|ADMIN|Usmon U|qisqa"), /parol kamida/);
  assert.throws(() => parseAdminAccounts("a|ADMIN|Usmon U|parol-1234567"), /login/);
  assert.throws(
    () => parseAdminAccounts("usmon|ADMIN|Usmon U|parol-1234567;usmon|SUPPORT|Boshqa|parol-7654321"),
    /takrorlangan/,
  );
});

test("session token is signed, expires and carries the password fingerprint", () => {
  const now = Date.parse("2026-11-25T10:00:00Z");
  const token = createAdminToken({ login: "usmon", fingerprint: "abc" }, 3600, secret, now);
  assert.deepEqual(verifyAdminToken(token, secret, now + 1000), { login: "usmon", fingerprint: "abc" });
  assert.equal(verifyAdminToken(token, secret, now + 3601_000), null, "muddati o'tgan");
  assert.equal(verifyAdminToken(token, Buffer.from("boshqa-kalit"), now), null, "boshqa kalit");
  const [payload, signature] = token.split(".");
  const forged = Buffer.from(JSON.stringify({ l: "boss", f: "abc", e: 9_999_999_999 })).toString("base64url");
  assert.equal(verifyAdminToken(`${forged}.${signature}`, secret, now), null, "o'zgartirilgan payload");
  assert.equal(verifyAdminToken(`${payload}`, secret, now), null);
});

test("admin cookie is HttpOnly, SameSite=Strict and scoped to the admin API", () => {
  const cookie = adminCookie("t", 60, true);
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Strict/);
  assert.match(cookie, /Path=\/api\/v1\/admin/);
  assert.match(cookie, /Secure/);
  assert.doesNotMatch(adminCookie("t", 60, false), /Secure/);
});
