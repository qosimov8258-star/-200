import assert from "node:assert/strict";
import { test } from "node:test";

import { HttpException, type ExecutionContext } from "@nestjs/common";
import type { Response } from "express";

import { ADMIN_COOKIE, createAdminToken, verifyAdminToken } from "../admin/auth/admin-session";
import { parseOwnerAccounts, type OwnerUser } from "./auth/owner-accounts";
import { OwnerAuthController } from "./auth/owner-auth.controller";
import { OwnerAuthGuard } from "./auth/owner-auth.guard";
import { OwnerAuthService } from "./auth/owner-auth.service";
import { OWNER_COOKIE, createOwnerToken, deriveOwnerKey, ownerCookie, verifyOwnerToken } from "./auth/owner-session";

const SECRET = "test-secret-test-secret-test-secret";
const USERS = "Ega|Bosh Ega|ega-paroli-123456 ; ikkinchi|Ikkinchi Ega|boshqa-parol-7890";

function service(at = new Date("2026-12-01T10:00:00Z"), ttlMinutes = 120) {
  let now = at;
  const auth = new OwnerAuthService({
    users: USERS,
    sessionSecret: SECRET,
    sessionTtlMinutes: ttlMinutes,
    clock: () => now,
  });
  return { auth, advance: (ms: number) => (now = new Date(now.getTime() + ms)) };
}

/** Xato statusi va `{ message }` (bo'lmasa — "NONE"). */
function failure(fn: () => unknown): { status: number; message: string } | "NONE" {
  try {
    fn();
  } catch (e) {
    if (e instanceof HttpException) return { status: e.getStatus(), message: (e.getResponse() as { message: string }).message };
    throw e;
  }
  return "NONE";
}

/** Guard uchun soxta so'rov/javob. */
function httpContext(headers: Record<string, string>) {
  const req: { owner?: OwnerUser; header: (name: string) => string | undefined } = {
    header: (name) => headers[name.toLowerCase()],
  };
  const sent: Record<string, string> = {};
  const res = { setHeader: (name: string, value: string) => (sent[name] = value) };
  const context = {
    switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }),
  } as unknown as ExecutionContext;
  return { context, req, sent };
}

function fakeResponse() {
  const headers: Record<string, string> = {};
  const res = { setHeader: (name: string, value: string) => (headers[name] = value) } as unknown as Response;
  return { res, headers };
}

test("OWNER_USERS is parsed, logins are normalised and passwords are kept only as a hash", () => {
  const [first, second] = parseOwnerAccounts(USERS);
  assert.equal(first?.login, "ega");
  assert.equal(first?.id, "own_ega");
  assert.equal(first?.fullName, "Bosh Ega");
  assert.equal(first?.verify("ega-paroli-123456"), true);
  assert.equal(first?.verify("ega-paroli-123457"), false);
  assert.equal(second?.login, "ikkinchi");
  assert.notEqual(first?.fingerprint, second?.fingerprint);
  assert.equal(JSON.stringify(first).includes("ega-paroli"), false, "parol obyektda matn sifatida yo'q");
  assert.deepEqual(parseOwnerAccounts(null), []);
});

test("bad OWNER_USERS entries stop the server with a clear message (password is never echoed)", () => {
  assert.throws(() => parseOwnerAccounts("ega|Bosh Ega"), /login\|Ism Familiya\|parol/);
  assert.throws(() => parseOwnerAccounts("ega|ADMIN|Bosh Ega|ega-paroli-123456"), /login\|Ism Familiya\|parol/);
  assert.throws(() => parseOwnerAccounts("ega|Bosh Ega|qisqa-parol"), /kamida 12 belgi/);
  assert.throws(() => parseOwnerAccounts("e|Bosh Ega|ega-paroli-123456"), /login 3–32/);
  assert.throws(() => parseOwnerAccounts("ega| |ega-paroli-123456"), /ism yozilmagan/);
  assert.throws(() => parseOwnerAccounts("ega|A B|ega-paroli-123456;EGA|C D|boshqa-parol-7890"), /takrorlangan/);
  assert.throws(
    () => parseOwnerAccounts("ega|Bosh Ega|qisqa-parol"),
    (err: Error) => !err.message.includes("qisqa-parol"),
  );
  assert.throws(
    () => new OwnerAuthService({ users: "ega|Bosh Ega|qisqa", sessionSecret: SECRET, sessionTtlMinutes: 120 }),
    /OWNER_USERS 1-yozuv/,
  );
  assert.throws(
    () => new OwnerAuthService({ users: USERS, sessionSecret: SECRET, sessionTtlMinutes: 0 }),
    /OWNER_SESSION_TTL_MINUTES/,
  );
});

test("owner and admin session tokens are not interchangeable", () => {
  const secret = Buffer.from(SECRET);
  const key = deriveOwnerKey(secret);
  const now = Date.parse("2026-12-01T10:00:00Z");
  const claims = { login: "ega", fingerprint: "abc" };

  const ownerToken = createOwnerToken(claims, 3600, key, now);
  assert.deepEqual(verifyOwnerToken(ownerToken, key, now + 1000), claims);
  assert.equal(verifyOwnerToken(ownerToken, key, now + 3601_000), null, "muddati o'tgan");
  assert.equal(verifyAdminToken(ownerToken, secret, now), null, "ega tokeni admin API'da yaroqsiz");

  const adminToken = createAdminToken(claims, 3600, secret, now);
  assert.equal(verifyOwnerToken(adminToken, key, now), null, "admin tokeni ega uchun yaroqsiz");
  assert.equal(verifyOwnerToken(adminToken, secret, now), null, "xom kalit bilan ham — k belgisi yo'q");

  const [payload, signature] = ownerToken.split(".");
  const forged = Buffer.from(JSON.stringify({ k: "owner", l: "boshqa", f: "abc", e: 9_999_999_999 })).toString("base64url");
  assert.equal(verifyOwnerToken(`${forged}.${signature}`, key, now), null, "o'zgartirilgan payload");
  assert.equal(verifyOwnerToken(`${payload}`, key, now), null);
});

test("owner cookie is HttpOnly, SameSite=Strict and scoped to the owner API", () => {
  const cookie = ownerCookie("t", 7200, true);
  assert.match(cookie, /^reels_owner=t;/);
  assert.match(cookie, /Path=\/api\/v1\/owner(;|$)/);
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Strict/);
  assert.match(cookie, /Max-Age=7200/);
  assert.match(cookie, /Secure/);
  assert.doesNotMatch(ownerCookie("t", 60, false), /Secure/);
});

test("login works, five wrong passwords lock the login for 15 minutes, sessions expire after the TTL", () => {
  const { auth, advance } = service();
  assert.equal(auth.ttlSeconds, 7200);

  const { user, token } = auth.login("  EGA ", "ega-paroli-123456");
  assert.deepEqual(user, { id: "own_ega", login: "ega", fullName: "Bosh Ega" });
  assert.deepEqual(auth.fromToken(token), user);

  assert.deepEqual(failure(() => auth.login("ega", "xato")), { status: 401, message: "Login yoki parol noto'g'ri." });
  assert.equal(failure(() => auth.login("yoq-login", "ega-paroli-123456")) !== "NONE", true);
  for (let i = 2; i <= 5; i += 1) assert.equal((failure(() => auth.login("ega", "xato")) as { status: number }).status, 401);
  const locked = failure(() => auth.login("ega", "ega-paroli-123456"));
  assert.equal(locked !== "NONE" && locked.status, 429, "to'g'ri parol bilan ham — qulflangan");
  // Boshqa login qulflanmagan.
  assert.equal(auth.login("ikkinchi", "boshqa-parol-7890").user.login, "ikkinchi");

  advance(15 * 60_000 + 1);
  assert.equal(auth.login("ega", "ega-paroli-123456").user.login, "ega", "qulf muddati o'tdi");

  const fresh = auth.login("ega", "ega-paroli-123456").token;
  advance(119 * 60_000);
  assert.ok(auth.fromToken(fresh));
  advance(2 * 60_000);
  assert.equal(auth.fromToken(fresh), null, "120 daqiqadan keyin sessiya tugaydi");
});

test("owner guard accepts only the owner cookie — admin session and API key are rejected", () => {
  const { auth } = service(new Date());
  const guard = new OwnerAuthGuard(auth);
  const { token } = auth.login("ega", "ega-paroli-123456");
  const adminToken = createAdminToken({ login: "ega", fingerprint: "x" }, 3600, Buffer.from(SECRET));

  const ok = httpContext({ cookie: `${ADMIN_COOKIE}=${adminToken}; ${OWNER_COOKIE}=${encodeURIComponent(token)}` });
  assert.equal(guard.canActivate(ok.context), true);
  assert.equal(ok.req.owner?.login, "ega");
  assert.equal(ok.sent["Cache-Control"], "no-store");

  const rejected: Record<string, string>[] = [
    {},
    { cookie: `${ADMIN_COOKIE}=${adminToken}` },
    { cookie: `${OWNER_COOKIE}=${adminToken}` },
    { authorization: "Bearer some-admin-api-token" },
    { cookie: `${OWNER_COOKIE}=${token.slice(0, -2)}xx` },
  ];
  for (const headers of rejected) {
    const { context } = httpContext(headers);
    assert.deepEqual(failure(() => guard.canActivate(context)), {
      status: 401,
      message: "Sessiya tugadi. Qaytadan kiring.",
    });
  }
});

test("login controller sets the owner cookie; logout clears it even without a session", () => {
  const { auth } = service(new Date());
  const controller = new OwnerAuthController(auth);

  const login = fakeResponse();
  const user = controller.login({ login: "ega", password: "ega-paroli-123456" }, login.res);
  assert.equal(user.fullName, "Bosh Ega");
  const cookie = login.headers["Set-Cookie"] ?? "";
  assert.match(cookie, /^reels_owner=/);
  assert.match(cookie, /Max-Age=7200/);
  assert.equal(login.headers["Cache-Control"], "no-store");
  const token = decodeURIComponent(cookie.split(";")[0]?.split("=")[1] ?? "");
  assert.deepEqual(auth.fromToken(token), user);

  const badBody = fakeResponse();
  assert.equal((failure(() => controller.login({ login: "ega" }, badBody.res)) as { status: number }).status, 400);
  assert.equal(
    (failure(() => controller.login({ login: "ega", password: "x", role: "ADMIN" }, badBody.res)) as { status: number })
      .status,
    400,
  );
  assert.equal((failure(() => controller.login([], badBody.res)) as { status: number }).status, 400);
  assert.equal(badBody.headers["Set-Cookie"], undefined);

  const logout = fakeResponse();
  controller.logout(logout.res);
  assert.match(logout.headers["Set-Cookie"] ?? "", /^reels_owner=; Path=\/api\/v1\/owner; HttpOnly; SameSite=Strict; Max-Age=0/);
});
