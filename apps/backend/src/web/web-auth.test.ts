import assert from "node:assert/strict";
import { createHash, createHmac } from "node:crypto";
import { test } from "node:test";

import type { Request, Response } from "express";

import type { ApiException } from "../common/api-exception";
import { config } from "../config/config";
import { ParticipantsService, webLoginState } from "../participants/participants.service";
import { RulesService } from "../rules/rules.service";
import { AuthController } from "./auth.controller";
import { BOT_LOGIN_TTL_MS, BotLoginService } from "./bot-login.service";
import { parseLoginWidget, verifyLoginWidget, type LoginWidgetData } from "./login-widget";
import { createSessionToken, readCookie, readSessionToken, sessionCookie, verifySessionToken } from "./web-session";

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
  assert.equal(verifySessionToken(token, BOT_TOKEN, NOW + 399 * 86_400_000), 111, "uzoq — qayta kirish admin ruxsati bilan");
  assert.equal(verifySessionToken(token, BOT_TOKEN, NOW + 401 * 86_400_000), null);
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
    const controller = new AuthController(participants, new BotLoginService());
    const cookies: string[] = [];
    const res = {
      setHeader: (_name: string, value: string | string[]) => cookies.push(...(Array.isArray(value) ? value : [value])),
    } as unknown as Response;
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

test("bot login: start sets a secret cookie; poll gives the session only to that browser, once", () => {
  const settings = config.telegram as { botToken: string | null; botUsername: string | null };
  const previous = { ...settings };
  settings.botToken = BOT_TOKEN;
  settings.botUsername = "olivia_test_bot";
  try {
    const participants = new ParticipantsService(new RulesService());
    const botLogin = new BotLoginService();
    const controller = new AuthController(participants, botLogin);
    const webId = participants.registerWeb("Dilnoza", "90 123 45 67", 22);
    let cookies: string[] = [];
    const res = {
      setHeader: (_name: string, value: string | string[]) => {
        cookies = Array.isArray(value) ? value : [value];
      },
    } as unknown as Response;
    const req = (cookie?: string, ip = "1.1.1.1") =>
      ({
        secure: false,
        header: (h: string) => (h === "x-forwarded-for" ? ip : h === "cookie" ? cookie : undefined),
        socket: {},
      }) as unknown as Request;

    const started = controller.startBotLogin({}, req(), res);
    assert.match(started.botUrl, new RegExp(`^https://t\\.me/olivia_test_bot\\?start=login_${started.id}$`));
    assert.match(started.code, /^\d{4}$/);
    assert.match(cookies[0], /^reels_bot_login=[^;]+; Path=\/api\/v1\/auth\/bot-login; HttpOnly; SameSite=Lax; Max-Age=600$/);
    const secretCookie = cookies[0].split(";")[0];

    assert.deepEqual(controller.pollBotLogin({ id: started.id }, req(secretCookie), res), { status: "PENDING" });

    // Bot tomoni: hisob Telegram'ga ulanadi (eski sayt sessiyalari bekor, raqam egasiga bir marta
    // qayta kirish beriladi) va tasdiqlanadi.
    assert.equal(participants.setPhone(42, 42, "+998901234567"), "LINKED");
    assert.ok(botLogin.claim(started.id, 42));
    assert.ok(botLogin.confirm(started.id, 42, participants.resolve(42)));

    // Havolani (id) bilgan, lekin kalit cookie'si yo'q boshqa brauzer — sessiya olmaydi.
    cookies = [];
    assert.deepEqual(controller.pollBotLogin({ id: started.id }, req("reels_bot_login=begona"), res), { status: "EXPIRED" });
    assert.equal(cookies.length, 0);

    assert.deepEqual(controller.pollBotLogin({ id: started.id }, req(secretCookie), res), { status: "CONFIRMED" });
    const session = readSessionToken(readCookie(cookies[0].split(";")[0], "reels_session") ?? "", BOT_TOKEN);
    assert.equal(session?.id, webId, "sessiya saytdagi hisobga");
    const sessionsFrom = participants.get(webId)?.sessionsFrom?.getTime() ?? 0;
    assert.ok((session?.issuedAt ?? 0) * 1000 >= sessionsFrom, "ulangandan keyin berilgan — guard rad etmaydi");
    assert.match(cookies[0], /Max-Age=34560000/, "saytdagi hisob — uzoq sessiya");
    assert.match(cookies[1], /^reels_device=\d+\./, "qurilma belgisi");
    assert.match(cookies[2], /^reels_bot_login=; .*Max-Age=0/);
    // Javobni olgan brauzerda kalit cookie'si o'chgan — qayta so'rov hech narsa olmaydi.
    assert.deepEqual(controller.pollBotLogin({ id: started.id }, req(), res), { status: "EXPIRED" }, "bir martalik");

    // Ruxsat ishlatildi — keyingi kirish yana yopiq (botda tasdiqlansa ham sessiya berilmaydi).
    const again = controller.startBotLogin({}, req(undefined, "7.7.7.7"), res);
    const againCookie = cookies[0].split(";")[0];
    assert.ok(botLogin.claim(again.id, 42));
    assert.ok(botLogin.confirm(again.id, 42, webId));
    cookies = [];
    assert.deepEqual(controller.pollBotLogin({ id: again.id }, req(againCookie), res), { status: "LOCKED" });
    assert.equal(cookies.length, 0, "sessiya berilmadi");

    // Noto'g'ri tana va IP chegarasi.
    assert.throws(() => controller.startBotLogin({ x: 1 }, req(), res));
    assert.throws(() => controller.pollBotLogin({ id: "../../etc" }, req(), res));
    for (let i = 0; i < 10; i += 1) controller.startBotLogin({}, req(undefined, "9.9.9.9"), res);
    assert.throws(() => controller.startBotLogin(undefined, req(undefined, "9.9.9.9"), res), "bitta IP dan 10 daqiqada 10 tadan ko'p emas");
    assert.ok(controller.startBotLogin(undefined, req(undefined, "8.8.8.8"), res));
    assert.equal(BOT_LOGIN_TTL_MS, 600_000);
  } finally {
    settings.botToken = previous.botToken;
    settings.botUsername = previous.botUsername;
  }
});

test("site: one entry per account (again only with the admin's one-time permission) and one account per device", () => {
  const settings = config.telegram as { botToken: string | null };
  const previous = settings.botToken;
  settings.botToken = BOT_TOKEN;
  try {
    const participants = new ParticipantsService(new RulesService());
    const controller = new AuthController(participants, new BotLoginService());
    let cookies: string[] = [];
    const res = {
      setHeader: (_name: string, value: string | string[]) => {
        cookies = Array.isArray(value) ? value : [value];
      },
    } as unknown as Response;
    const req = (cookie?: string, ip = "1.1.1.1") =>
      ({
        secure: false,
        header: (h: string) => (h === "x-forwarded-for" ? ip : h === "cookie" ? cookie : undefined),
        socket: {},
      }) as unknown as Request;
    const failure = (fn: () => unknown) => {
      try {
        fn();
      } catch (e) {
        const error = e as ApiException;
        return { status: error.getStatus(), body: error.getResponse() };
      }
      return null;
    };
    const pair = (name: string) => cookies.find((c) => c.startsWith(`${name}=`))?.split(";")[0] ?? "";
    const session = () => readSessionToken(readCookie(pair("reels_session"), "reels_session") ?? "", BOT_TOKEN);

    // Bitta qurilma — bitta hisob: chiqib ketgandan keyin ham shu brauzerda yangi hisob ochilmaydi.
    controller.webRegister({ firstName: "Dilnoza", phone: "90 123 45 67" }, req(), res);
    const device = pair("reels_device");
    assert.match(device, /^reels_device=\d+\./);
    assert.match(cookies.find((c) => c.startsWith("reels_device="))!, /HttpOnly/);
    assert.deepEqual(failure(() => controller.webRegister({ firstName: "Ali", phone: "91 111 11 11" }, req(device), res)), {
      status: 409,
      body: { code: "DEVICE_TAKEN" },
    });
    const forged = device.replace(/\.[^.]+$/, ".AAAA");
    assert.equal(failure(() => controller.webRegister({ firstName: "Ali", phone: "91 111 11 11" }, req(forged, "2.2.2.2"), res)), null, "soxta belgi hisobga olinmaydi");

    // Telegram orqali saytga: birinchi kirish ochiq, keyingisi — faqat admin ruxsati bilan, bir marta.
    const widget = signWidget({ id: 555, first_name: "Vali", auth_date: Math.floor(Date.now() / 1000) - 10 });
    controller.login(widget, req(), res);
    const first = session();
    assert.equal(first?.id, 555);
    assert.deepEqual(failure(() => controller.login(widget, req(), res)), { status: 403, body: { code: "LOGIN_LOCKED" } });

    assert.ok(participants.allowWebLogin(555));
    controller.login(widget, req(), res);
    const second = session();
    const from = participants.get(555)?.sessionsFrom?.getTime() ?? 0;
    assert.ok(second && second.issuedAt * 1000 >= from, "yangi sessiya amal qiladi");
    assert.ok(first && first.issuedAt * 1000 < from, "boshqa qurilmadagi eski sessiya yopildi (bir soniya ichida ham)");
    assert.equal(failure(() => controller.login(widget, req(), res))?.status, 403, "ruxsat bir martalik");
  } finally {
    settings.botToken = previous;
  }
});

// --- Telegram'ga ulash, eski sessiyalar va qurilma belgisi ------------------------

/** Bot tokeni (va nomi) sozlangan holda ishlatadi, keyin avvalgisini qaytaradi. */
function withBot(fn: () => void): void {
  const settings = config.telegram as { botToken: string | null; botUsername: string | null };
  const previous = { botToken: settings.botToken, botUsername: settings.botUsername };
  settings.botToken = BOT_TOKEN;
  settings.botUsername = "olivia_test_bot";
  try {
    fn();
  } finally {
    settings.botToken = previous.botToken;
    settings.botUsername = previous.botUsername;
  }
}

/** Kontroller, soxta so'rov va javob: `cookies()` — oxirgi javobning `Set-Cookie` qiymatlari. */
function harness() {
  const participants = new ParticipantsService(new RulesService());
  const botLogin = new BotLoginService();
  const controller = new AuthController(participants, botLogin);
  let cookies: string[] = [];
  const res = {
    setHeader: (_name: string, value: string | string[]) => {
      cookies = Array.isArray(value) ? value : [value];
    },
  } as unknown as Response;
  const req = (cookie?: string, ip = "1.1.1.1") =>
    ({
      secure: false,
      header: (h: string) => (h === "x-forwarded-for" ? ip : h === "cookie" ? cookie : undefined),
      socket: {},
    }) as unknown as Request;
  /** Oxirgi javobdagi cookie "nom=qiymat" ko'rinishida (yo'q bo'lsa — bo'sh satr). */
  const pair = (name: string) => cookies.find((c) => c.startsWith(`${name}=`))?.split(";")[0] ?? "";
  const session = () => readSessionToken(readCookie(pair("reels_session"), "reels_session") ?? "", BOT_TOKEN);
  const failure = (fn: () => unknown) => {
    try {
      fn();
    } catch (e) {
      const error = e as ApiException;
      return { status: error.getStatus(), body: error.getResponse() };
    }
    return null;
  };
  /** "Hisobim bor": so'rov ochiladi, botda shu Telegram foydalanuvchisi tasdiqlaydi; natija — id va kalit cookie'si. */
  const confirmedBotLogin = (telegramId: number, ip = "1.1.1.1") => {
    const started = controller.startBotLogin({}, req(undefined, ip), res);
    const secret = pair("reels_bot_login");
    assert.ok(botLogin.claim(started.id, telegramId));
    assert.ok(botLogin.confirm(started.id, telegramId, participants.resolve(telegramId)));
    return { id: started.id, secret };
  };
  const widget = (telegramId: number) =>
    signWidget({ id: telegramId, first_name: "Dilnoza", auth_date: Math.floor(Date.now() / 1000) - 10 });
  return { participants, botLogin, controller, res, req, pair, session, failure, confirmedBotLogin, widget, cookies: () => cookies };
}

const DEVICE_TAKEN = { status: 409, body: { code: "DEVICE_TAKEN" } };

test("linking the web account in the bot closes its old site sessions and lets the verified phone owner sign in once", () => {
  withBot(() => {
    const h = harness();
    // Saytda ro'yxatdan o'tdi — shu bilan saytga bir marta kirildi.
    h.controller.webRegister({ firstName: "Dilnoza", phone: "90 123 45 67" }, h.req(), h.res);
    const registered = h.session();
    assert.ok(registered);
    const webId = registered.id;
    const account = h.participants.get(webId);
    assert.ok(account);
    assert.equal(webLoginState(account), "USED");

    // "Telegram'ga ulash": botda shu raqam ulashildi. Sessiyalarni tizim yopdi — bir marta kirish ochiq.
    assert.equal(h.participants.setPhone(42, 42, "+998901234567"), "LINKED");
    const linkedAt = account.sessionsFrom?.getTime() ?? 0;
    assert.ok(registered.issuedAt * 1000 < linkedAt, "ulanishdan oldingi sessiya yopildi");
    assert.equal(webLoginState(account), "GRANTED");
    assert.ok(h.participants.canStartWebSession(webId));

    // "Hisobim bor" — bot orqali kirish o'tadi.
    const login = h.confirmedBotLogin(42);
    assert.deepEqual(h.controller.pollBotLogin({ id: login.id }, h.req(login.secret), h.res), { status: "CONFIRMED" });
    const renewed = h.session();
    assert.equal(renewed?.id, webId);
    assert.ok((renewed?.issuedAt ?? 0) * 1000 >= linkedAt, "yangi sessiya amal qiladi");
    assert.equal(webLoginState(account), "USED", "bir martalik kirish ishlatildi");

    // Keyingi kirish — yana faqat admin ruxsati bilan (Telegram orqali ham, bot orqali ham).
    assert.deepEqual(h.failure(() => h.controller.login(h.widget(42), h.req(), h.res)), {
      status: 403,
      body: { code: "LOGIN_LOCKED" },
    });
    const again = h.confirmedBotLogin(42, "2.2.2.2");
    assert.deepEqual(h.controller.pollBotLogin({ id: again.id }, h.req(again.secret), h.res), { status: "LOCKED" });
  });
});

test("an account linked before the one-entry rule (no sign-in marks yet) can sign in once more", () => {
  withBot(() => {
    const h = harness();
    const webId = h.participants.registerWeb("Dilnoza", "90 123 45 67");
    assert.equal(h.participants.setPhone(42, 42, "+998901234567"), "LINKED");
    // Eski holat fayli: hisob ulangan, lekin kirish belgilari hali yo'q edi.
    const account = h.participants.get(webId);
    assert.ok(account);
    delete account.webLoginGrant;
    delete account.webLoginUsed;
    assert.equal(webLoginState(account), "NEVER");
    assert.equal(webLoginState({ ...account, linkedTelegramId: null }), "USED", "ulanmagan eski saytdagi hisob — kirilgan");

    // Telegram orqali (widget) — saytdagi hisobga, bir marta.
    h.controller.login(h.widget(42), h.req(), h.res);
    const session = h.session();
    assert.equal(session?.id, webId);
    assert.ok((session?.issuedAt ?? 0) * 1000 >= (account.sessionsFrom?.getTime() ?? 0), "yangi sessiya amal qiladi");
    assert.equal(webLoginState(account), "USED");
    assert.equal(h.failure(() => h.controller.login(h.widget(42), h.req(), h.res))?.status, 403, "bir marta");
  });
});

test("one account per device: a Telegram id merged into a web account still marks the device", () => {
  withBot(() => {
    const h = harness();
    // D qurilmada Telegram orqali kirdi — qurilma belgisi Telegram ID si bilan.
    h.controller.login(h.widget(42), h.req(), h.res);
    const device = h.pair("reels_device");
    assert.match(device, /^reels_device=42\./);

    // Botda boshqa (saytdagi) hisobning raqamini ulashdi: bo'sh 42-yozuv o'chdi, hisoblar ulandi.
    const webId = h.participants.registerWeb("Dilnoza", "90 123 45 67");
    assert.equal(h.participants.setPhone(42, 42, "+998901234567"), "LINKED");
    assert.equal(h.participants.get(42), null);
    assert.equal(h.participants.resolve(42), webId);

    assert.deepEqual(
      h.failure(() => h.controller.webRegister({ firstName: "Ali", phone: "91 111 11 11" }, h.req(device), h.res)),
      DEVICE_TAKEN,
    );
    assert.equal(
      h.failure(() => h.controller.webRegister({ firstName: "Ali", phone: "91 111 11 11" }, h.req(undefined, "2.2.2.2"), h.res)),
      null,
      "boshqa qurilmadan — ochiladi",
    );
  });
});

test("a session from before the device mark: web-register is refused and logout leaves the mark", () => {
  withBot(() => {
    const h = harness();
    // Deploy'dan oldin berilgan sessiya — qurilma belgisi yo'q.
    const webId = h.participants.registerWeb("Dilnoza", "90 123 45 67");
    const oldSession = `reels_session=${createSessionToken(webId, BOT_TOKEN, Date.now() - 86_400_000)}`;
    assert.deepEqual(
      h.failure(() => h.controller.webRegister({ firstName: "Ali", phone: "91 111 11 11" }, h.req(oldSession), h.res)),
      DEVICE_TAKEN,
    );

    // Chiqish: sessiya o'chadi, o'rniga qurilma belgisi qoladi — chiqib ketgach ham yangi hisob ochilmaydi.
    h.controller.logout(h.req(oldSession), h.res);
    assert.match(h.cookies().find((c) => c.startsWith("reels_session=")) ?? "", /^reels_session=; .*Max-Age=0/);
    const mark = h.pair("reels_device");
    assert.match(mark, new RegExp(`^reels_device=${webId}\\.`));
    assert.match(h.cookies().find((c) => c.startsWith("reels_device=")) ?? "", /HttpOnly/);
    assert.deepEqual(
      h.failure(() => h.controller.webRegister({ firstName: "Ali", phone: "91 111 11 11" }, h.req(mark, "2.2.2.2"), h.res)),
      DEVICE_TAKEN,
    );

    // Belgi bor, sessiya yo'q yoki soxta — faqat sessiya cookie'si o'chadi.
    for (const cookie of [`${oldSession}; ${mark}`, undefined, `reels_session=${createSessionToken(webId, "999:OTHER")}`]) {
      h.controller.logout(h.req(cookie), h.res);
      assert.equal(h.cookies().length, 1);
      assert.match(h.cookies()[0], /^reels_session=; /);
    }
    assert.equal(
      h.failure(() => h.controller.webRegister({ firstName: "Ali", phone: "91 111 11 11" }, h.req(undefined, "3.3.3.3"), h.res)),
      null,
      "belgisiz begona brauzer — ochiladi",
    );
  });
});

test("bot login: if the confirmed answer is lost, a repeated poll gets the same session and the permission is spent once", () => {
  withBot(() => {
    const h = harness();
    const webId = h.participants.registerWeb("Dilnoza", "90 123 45 67");
    h.participants.setPhone(42, 42, "+998901234567"); // ulandi — bir marta kirish ochiq
    let starts = 0;
    const startWebSession = h.participants.startWebSession.bind(h.participants);
    h.participants.startWebSession = (accountId, now) => {
      starts += 1;
      return startWebSession(accountId, now);
    };

    const login = h.confirmedBotLogin(42);
    assert.deepEqual(h.controller.pollBotLogin({ id: login.id }, h.req(login.secret), h.res), { status: "CONFIRMED" });
    const first = h.pair("reels_session");
    const sessionsFrom = h.participants.get(webId)?.sessionsFrom?.getTime();
    assert.equal(starts, 1);

    // Javob yetib bormadi: brauzerda kalit qoldi, sayt yana so'raydi — o'sha sessiya, kirish qayta qayd etilmaydi.
    assert.deepEqual(h.controller.pollBotLogin({ id: login.id }, h.req(login.secret), h.res), { status: "CONFIRMED" });
    assert.equal(h.pair("reels_session"), first, "o'sha sessiya");
    assert.match(h.pair("reels_device"), new RegExp(`^reels_device=${webId}\\.`));
    assert.equal(starts, 1, "startWebSession ikkinchi marta chaqirilmadi");
    assert.equal(h.participants.get(webId)?.sessionsFrom?.getTime(), sessionsFrom, "sessiya yopilmadi");
    assert.equal(webLoginState(h.participants.get(webId)!), "USED");

    // Shu orada hisobga boshqa joydan (admin ruxsati bilan) kirildi — eski so'rov endi sessiya bermaydi.
    assert.ok(h.participants.allowWebLogin(webId));
    h.controller.login(h.widget(42), h.req(), h.res);
    assert.deepEqual(h.controller.pollBotLogin({ id: login.id }, h.req(login.secret), h.res), { status: "EXPIRED" });
    assert.deepEqual(h.controller.pollBotLogin({ id: login.id }, h.req(login.secret), h.res), { status: "EXPIRED" });
    assert.equal(starts, 2, "faqat widget orqali kirish qayd etildi");
  });
});
