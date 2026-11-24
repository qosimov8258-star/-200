import assert from "node:assert/strict";
import { createHash, createHmac } from "node:crypto";
import { test } from "node:test";

import type { Request, Response } from "express";

import type { ApiException } from "../common/api-exception";
import { config } from "../config/config";
import { ParticipantsService } from "../participants/participants.service";
import { RulesService } from "../rules/rules.service";
import { AuthController } from "./auth.controller";
import { parseLoginWidget, verifyLoginWidget, type LoginWidgetData } from "./login-widget";
import { createSessionToken, readCookie, sessionCookie, verifySessionToken } from "./web-session";

const BOT_TOKEN = "123456:TEST_TOKEN";
const NOW = 1_795_000_000_000;

/** Telegram Login Widget qanday imzolasa, shunday imzolaydi. */
function signWidget(fields: Omit<LoginWidgetData, "hash">, token = BOT_TOKEN): LoginWidgetData {
  const check = Object.entries(fields)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([k, v]) => `${k}=${String(v)}`)
    .join("\n");
  const secret = createHash("sha256").update(token).digest();
  return { ...fields, hash: createHmac("sha256", secret).update(check).digest("hex") };
}

const user = { id: 111, first_name: "Ali", username: "ali_uz", auth_date: Math.floor(NOW / 1000) - 60 };

test("accepts a correctly signed Login Widget payload", () => {
  const identity = verifyLoginWidget(signWidget(user), BOT_TOKEN, 86_400, NOW);
  assert.deepEqual(identity, { telegramId: 111, firstName: "Ali", username: "ali_uz" });
});

test("rejects tampered, foreign-bot and expired Login Widget payloads", () => {
  const signed = signWidget(user);
  assert.equal(verifyLoginWidget({ ...signed, id: 222 }, BOT_TOKEN, 86_400, NOW), null);
  assert.equal(verifyLoginWidget(signWidget(user, "999:OTHER"), BOT_TOKEN, 86_400, NOW), null);
  const old = signWidget({ ...user, auth_date: Math.floor(NOW / 1000) - 2 * 86_400 });
  assert.equal(verifyLoginWidget(old, BOT_TOKEN, 86_400, NOW), null);
});

test("Mini App initData signature is not accepted as a Login Widget signature", () => {
  // initData kaliti — HMAC("WebAppData", token); widget kaliti — SHA256(token).
  const check = `auth_date=${user.auth_date}\nfirst_name=Ali\nid=111\nusername=ali_uz`;
  const webAppSecret = createHmac("sha256", "WebAppData").update(BOT_TOKEN).digest();
  const hash = createHmac("sha256", webAppSecret).update(check).digest("hex");
  assert.equal(verifyLoginWidget({ ...user, hash }, BOT_TOKEN, 86_400, NOW), null);
});

test("widget body validation rejects unknown fields and wrong types", () => {
  assert.equal(parseLoginWidget({ ...signWidget(user), admin: true }), null);
  assert.equal(parseLoginWidget({ ...signWidget(user), id: "111" }), null);
  assert.equal(parseLoginWidget(null), null);
  assert.notEqual(parseLoginWidget(signWidget(user)), null);
});

test("session token round-trips, expires and cannot be forged", () => {
  const token = createSessionToken(111, BOT_TOKEN, NOW);
  assert.equal(verifySessionToken(token, BOT_TOKEN, NOW + 1000), 111);
  assert.equal(verifySessionToken(token, BOT_TOKEN, NOW + 31 * 86_400_000), null);
  assert.equal(verifySessionToken(token, "999:OTHER", NOW), null);

  const [payload, sig] = token.split(".");
  const forged = Buffer.from(JSON.stringify({ t: 222, e: 9_999_999_999 })).toString("base64url");
  assert.equal(verifySessionToken(`${forged}.${sig}`, BOT_TOKEN, NOW), null);
  assert.equal(verifySessionToken(`${payload}.${sig}.x`, BOT_TOKEN, NOW), null);
});

test("session cookie is HttpOnly, SameSite=Lax and Secure only over https", () => {
  assert.match(sessionCookie("abc", 60, true), /^reels_session=abc; Path=\/; HttpOnly; SameSite=Lax; Max-Age=60; Secure$/);
  assert.doesNotMatch(sessionCookie("abc", 60, false), /Secure/);
  assert.equal(readCookie("a=1; reels_session=xyz; b=2", "reels_session"), "xyz");
  assert.equal(readCookie(undefined, "reels_session"), null);
});

test("web-register creates an account with a session cookie and is rate limited per IP", () => {
  const settings = config.telegram as { botToken: string | null };
  const previous = settings.botToken;
  settings.botToken = BOT_TOKEN;
  try {
    const participants = new ParticipantsService(new RulesService());
    const controller = new AuthController(participants);
    const cookies: string[] = [];
    const res = { setHeader: (_name: string, value: string) => cookies.push(value) } as unknown as Response;
    const req = (ip: string) =>
      ({ secure: false, header: (h: string) => (h === "x-forwarded-for" ? `${ip}, 10.0.0.1` : undefined), socket: {} }) as unknown as Request;

    controller.webRegister({ firstName: "Dilnoza", phone: "90 123 45 67", age: 22 }, req("1.1.1.1"), res);
    const token = readCookie(cookies[0].split(";")[0], "reels_session");
    const id = verifySessionToken(token ?? "", BOT_TOKEN);
    assert.ok(id !== null && participants.get(id)?.phone === "+998901234567", "sessiya yangi akkauntga tegishli");
    assert.match(cookies[0], /HttpOnly/);

    const status = (fn: () => unknown) => {
      try {
        fn();
      } catch (e) {
        return (e as ApiException).getStatus();
      }
      return 204;
    };
    assert.equal(status(() => controller.webRegister({ firstName: "Ali", phone: "+998901234567", age: 22 }, req("2.2.2.2"), res)), 409);
    for (let i = 0; i < 4; i += 1) {
      controller.webRegister({ firstName: "Ali", phone: `91 000 00 0${i}`, age: 22 }, req("1.1.1.1"), res);
    }
    assert.equal(
      status(() => controller.webRegister({ firstName: "Ali", phone: "91 000 00 09", age: 22 }, req("1.1.1.1"), res)),
      429,
      "bitta IP dan soatiga 5 tadan ko'p emas",
    );
    assert.equal(status(() => controller.webRegister({ firstName: "Ali", phone: "91 000 00 09", age: 22 }, req("3.3.3.3"), res)), 204);
  } finally {
    settings.botToken = previous;
  }
});
