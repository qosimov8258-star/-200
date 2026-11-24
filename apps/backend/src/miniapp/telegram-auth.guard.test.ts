import assert from "node:assert/strict";
import { test } from "node:test";

import type { ExecutionContext } from "@nestjs/common";
import { HttpException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";

import { config } from "../config/config";
import { ParticipantsService } from "../participants/participants.service";
import { RulesService } from "../rules/rules.service";
import { createSessionToken, SESSION_COOKIE } from "../web/web-session";
import { Public, TelegramAuthGuard } from "./telegram-auth.guard";

// `.env` bo'lmagan muhitda (CI) ham bot tokeni bo'lsin — guard sessiyani shu bilan tekshiradi.
const telegramConfig = config.telegram as { botToken: string | null };
telegramConfig.botToken ??= "123456:TEST_TOKEN";

class Routes {
  @Public()
  open(): void {}

  closed(): void {}
}

type FakeRequest = { headers: Record<string, string>; header(name: string): string | undefined; telegram?: unknown };

function context(handler: keyof Routes, headers: Record<string, string> = {}) {
  const request: FakeRequest = {
    headers,
    header: (name) => headers[name.toLowerCase()],
  };
  const ctx = {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => Routes.prototype[handler],
    getClass: () => Routes,
  } as unknown as ExecutionContext;
  return { ctx, request };
}

const status = (fn: () => unknown) => {
  try {
    fn();
    return 200;
  } catch (e) {
    return e instanceof HttpException ? e.getStatus() : -1;
  }
};

const guard = new TelegramAuthGuard(new Reflector());
const token = config.telegram.botToken ?? "";

test("a guest can open public routes but not private ones", () => {
  const open = context("open");
  assert.equal(status(() => guard.canActivate(open.ctx)), 200);
  assert.equal(open.request.telegram, undefined);
  assert.equal(status(() => guard.canActivate(context("closed").ctx)), 401);
});

test("a signed-in visitor is recognised on public and private routes", () => {
  const cookie = `${SESSION_COOKIE}=${createSessionToken(4242, token)}`;
  for (const handler of ["open", "closed"] as const) {
    const { ctx, request } = context(handler, { cookie });
    assert.equal(status(() => guard.canActivate(ctx)), 200);
    assert.deepEqual(request.telegram, { telegramId: 4242, firstName: "", username: null });
  }
});

test("a forged session is treated as a guest", () => {
  const cookie = `${SESSION_COOKIE}=${createSessionToken(4242, "999:OTHER")}`;
  const open = context("open", { cookie });
  assert.equal(status(() => guard.canActivate(open.ctx)), 200);
  assert.equal(open.request.telegram, undefined);
  assert.equal(status(() => guard.canActivate(context("closed", { cookie }).ctx)), 401);
});

test("a Telegram user linked to a web account is recognised as that account; older site sessions are closed", () => {
  const participants = new ParticipantsService(new RulesService());
  const linkedGuard = new TelegramAuthGuard(new Reflector(), participants);
  const webId = participants.registerWeb("Dilnoza", "90 123 45 67", 25);
  const issued = Date.now() - 60_000;
  const oldCookie = `${SESSION_COOKIE}=${createSessionToken(webId, token, issued, 400 * 86_400)}`;

  // Ulanmagan: saytdagi sessiya ishlaydi.
  let probe = context("closed", { cookie: oldCookie });
  assert.equal(status(() => linkedGuard.canActivate(probe.ctx)), 200);
  assert.equal((probe.request.telegram as { telegramId: number }).telegramId, webId);

  participants.getOrCreate(777); // /start
  assert.equal(participants.setPhone(777, 777, "+998901234567"), "LINKED");

  probe = context("closed", { cookie: oldCookie });
  assert.equal(status(() => linkedGuard.canActivate(probe.ctx)), 401, "ulanishdan oldingi sayt sessiyasi yopildi");

  // Telegram Login Widget orqali kirish (token — Telegram ID) → saytdagi hisob.
  const viaTelegram = `${SESSION_COOKIE}=${createSessionToken(777, token)}`;
  probe = context("closed", { cookie: viaTelegram });
  assert.equal(status(() => linkedGuard.canActivate(probe.ctx)), 200);
  assert.equal((probe.request.telegram as { telegramId: number }).telegramId, webId);
});
