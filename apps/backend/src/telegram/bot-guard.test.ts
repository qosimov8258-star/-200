import assert from "node:assert/strict";
import { test } from "node:test";

import {
  clip,
  FloodGuard,
  isOperator,
  maskToken,
  NoticeOnce,
  OperatorCache,
  parseOperatorIds,
  type ChatMemberStatus,
} from "./bot-guard";

test("flood: 20 updates a minute pass, the 21st warns once, the rest are dropped until the minute is over", () => {
  const guard = new FloodGuard(20, 60_000);
  const t = 1_000_000;
  for (let i = 0; i < 20; i += 1) assert.equal(guard.check(7, t + i), "ok");
  assert.equal(guard.check(7, t + 20), "warn");
  assert.equal(guard.check(7, t + 21), "drop");
  assert.equal(guard.check(7, t + 30_000), "drop");
  assert.equal(guard.check(8, t + 30_000), "ok", "boshqa foydalanuvchiga ta'sir qilmaydi");
  assert.equal(guard.check(7, t + 61_000 + 30_000), "ok", "bir daqiqadan keyin yana yozish mumkin");
});

test("limit notice is sent once per window", () => {
  const notice = new NoticeOnce(600_000);
  assert.equal(notice.shouldNotify(1, 0), true);
  assert.equal(notice.shouldNotify(1, 1_000), false);
  assert.equal(notice.shouldNotify(2, 1_000), true);
  assert.equal(notice.shouldNotify(1, 600_001), true);
});

test("operators: group admins by default; with an allowlist only listed IDs", () => {
  const none = parseOperatorIds(null);
  assert.equal(isOperator(1, "creator", none), true);
  assert.equal(isOperator(1, "administrator", none), true);
  assert.equal(isOperator(1, "member", none), false, "oddiy a'zo bot nomidan yoza olmaydi");
  assert.equal(isOperator(1, null, none), false);

  const list = parseOperatorIds(" 11, abc, 22 ,-5, 0 ");
  assert.deepEqual([...list], [11, 22]);
  assert.equal(isOperator(11, "member", list), true);
  assert.equal(isOperator(33, "administrator", list), false, "ro'yxat bo'lsa — faqat ro'yxatdagilar");
});

test("operator status is cached and a failing lookup is treated as not an operator", async () => {
  const cache = new OperatorCache(300_000);
  let calls = 0;
  const load = async (): Promise<ChatMemberStatus | null> => {
    calls += 1;
    return "administrator";
  };
  assert.equal(await cache.status(5, load, 0), "administrator");
  assert.equal(await cache.status(5, load, 1_000), "administrator");
  assert.equal(calls, 1);
  assert.equal(await cache.status(5, load, 300_001), "administrator");
  assert.equal(calls, 2);
  assert.equal(
    await cache.status(6, () => Promise.reject(new Error("Bad Request")), 0),
    null,
  );
});

test("long texts are clipped to Telegram limits and the token never reaches logs", () => {
  assert.equal(clip("salom", 10), "salom");
  const long = clip("a".repeat(5_000), 1_024);
  assert.equal(long.length, 1_024);
  assert.ok(long.endsWith("…"));
  assert.equal(maskToken("fetch https://api.telegram.org/file/bot123:ABC/x failed", "123:ABC"), "fetch https://api.telegram.org/file/bot***/x failed");
  assert.equal(maskToken("xato", null), "xato");
});
