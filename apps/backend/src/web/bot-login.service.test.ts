import assert from "node:assert/strict";
import { test } from "node:test";

import { BOT_LOGIN_GRACE_MS, BOT_LOGIN_ID, BOT_LOGIN_MAX_OPEN, BOT_LOGIN_TTL_MS, BotLoginService } from "./bot-login.service";

const NOW = 1_795_000_000_000;

test("start: unguessable id that fits a Telegram start link, a 4-digit code and a separate secret", () => {
  const service = new BotLoginService();
  const a = service.start(NOW);
  const b = service.start(NOW);
  assert.ok(a && b);
  assert.match(a.id, BOT_LOGIN_ID);
  assert.ok(`login_${a.id}`.length <= 64, "Telegram start parametri 64 belgigacha");
  assert.match(a.code, /^\d{4}$/);
  assert.notEqual(a.id, b.id);
  assert.notEqual(a.secret, a.id);
  assert.equal(a.expiresAt.getTime(), NOW + BOT_LOGIN_TTL_MS);
});

test("only the Telegram user who opened the link can confirm; the browser needs the secret; an issued result lasts only a short grace period", () => {
  const service = new BotLoginService();
  const r = service.start(NOW);
  assert.ok(r);
  assert.equal(service.confirm(r.id, 42, 9_000, NOW), false, "botda ochilmagan so'rov tasdiqlanmaydi");
  assert.deepEqual(service.claim(r.id, 42, NOW), { code: r.code });
  assert.deepEqual(service.claim(r.id, 42, NOW), { code: r.code }, "o'zi qayta ochsa bo'ladi");
  assert.equal(service.claim(r.id, 77, NOW), null, "boshqa odam ololmaydi");
  assert.equal(service.confirm(r.id, 77, 7_000, NOW), false);
  assert.deepEqual(service.claimedBy(42, NOW), { id: r.id, code: r.code });
  assert.equal(service.claimedBy(77, NOW), null);

  assert.equal(service.confirm(r.id, 42, 9_000, NOW), true);
  assert.equal(service.claimedBy(42, NOW), null, "tasdiqlangani endi kutilmaydi");
  assert.deepEqual(service.poll(r.id, "noto'g'ri", NOW), { status: "EXPIRED", accountId: null, issuedAt: null });
  assert.deepEqual(service.poll(r.id, "", NOW), { status: "EXPIRED", accountId: null, issuedAt: null });
  assert.deepEqual(service.poll(r.id, r.secret, NOW), { status: "CONFIRMED", accountId: 9_000, issuedAt: null });

  // Sessiya berildi: qisqa muddat o'sha sessiya vaqti qaytadi (javob yo'qolsa), keyin so'rov tugaydi.
  service.issued(r.id, NOW + 500, NOW);
  service.issued(r.id, NOW + 9_999, NOW);
  const grace = NOW + BOT_LOGIN_GRACE_MS;
  assert.deepEqual(service.poll(r.id, r.secret, grace - 1), { status: "CONFIRMED", accountId: 9_000, issuedAt: NOW + 500 });
  assert.equal(service.poll(r.id, "noto'g'ri", grace - 1).status, "EXPIRED", "kalitsiz — baribir yo'q");
  assert.equal(service.claim(r.id, 42, NOW), null, "tasdiqlangani qayta ochilmaydi");
  assert.equal(service.confirm(r.id, 42, 7_000, NOW), false);
  assert.deepEqual(service.poll(r.id, r.secret, grace), { status: "EXPIRED", accountId: null, issuedAt: null });
  assert.equal(service.poll(r.id, r.secret, NOW).status, "EXPIRED", "o'chirildi");

  // Sessiya berilmaydigan bo'lsa (hisob yo'q, kirish yopiq) — chaqiruvchi so'rovni yopadi.
  const dropped = service.start(NOW);
  assert.ok(dropped);
  service.claim(dropped.id, 42, NOW);
  service.confirm(dropped.id, 42, 9_000, NOW);
  assert.equal(service.poll(dropped.id, dropped.secret, NOW).status, "CONFIRMED");
  service.drop(dropped.id);
  assert.equal(service.poll(dropped.id, dropped.secret, NOW).status, "EXPIRED");
});

test("deny / fail close the request; expired requests cannot be claimed, confirmed or polled", () => {
  const service = new BotLoginService();
  const denied = service.start(NOW);
  const failed = service.start(NOW);
  const late = service.start(NOW);
  assert.ok(denied && failed && late);

  service.claim(denied.id, 42, NOW);
  assert.equal(service.close(denied.id, 77, "DENIED", NOW), false);
  assert.equal(service.close(denied.id, 42, "DENIED", NOW), true);
  assert.equal(service.confirm(denied.id, 42, 1, NOW), false, "rad etilgani tasdiqlanmaydi");
  assert.equal(service.poll(denied.id, denied.secret, NOW).status, "DENIED");

  service.claim(failed.id, 43, NOW);
  service.close(failed.id, 43, "FAILED", NOW);
  assert.equal(service.poll(failed.id, failed.secret, NOW).status, "FAILED");

  const after = NOW + BOT_LOGIN_TTL_MS;
  assert.equal(service.claim(late.id, 42, after), null);
  assert.equal(service.poll(late.id, late.secret, NOW + 1).status, "PENDING");
  assert.equal(service.poll(late.id, late.secret, after).status, "EXPIRED");
});

test("open requests are capped; expired ones are pruned", () => {
  const service = new BotLoginService();
  for (let i = 0; i < BOT_LOGIN_MAX_OPEN; i += 1) assert.ok(service.start(NOW));
  assert.equal(service.start(NOW), null);
  assert.ok(service.start(NOW + BOT_LOGIN_TTL_MS), "eskirganlar tozalanadi");
});
