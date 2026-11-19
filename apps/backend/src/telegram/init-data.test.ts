import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { test } from "node:test";

import { verifyInitData } from "./init-data";

const TOKEN = "123456:TEST-TOKEN-not-real";
const NOW = 1_800_000_000_000;

/** Telegram qanday imzolasa, shunday imzolangan initData yasaydi. */
function sign(fields: Record<string, string>, token = TOKEN): string {
  const dataCheckString = Object.keys(fields)
    .sort()
    .map((k) => `${k}=${fields[k]}`)
    .join("\n");
  const secret = createHmac("sha256", "WebAppData").update(token).digest();
  const hash = createHmac("sha256", secret).update(dataCheckString).digest("hex");
  return new URLSearchParams({ ...fields, hash }).toString();
}

const fields = {
  auth_date: String(NOW / 1000 - 60),
  query_id: "AAE1",
  user: JSON.stringify({ id: 777, first_name: "Jamshid", username: "jamshid" }),
};

test("accepts correctly signed, fresh init data", () => {
  assert.deepEqual(verifyInitData(sign(fields), TOKEN, 3600, NOW), {
    telegramId: 777,
    firstName: "Jamshid",
    username: "jamshid",
  });
});

test("rejects a tampered user", () => {
  const raw = new URLSearchParams(sign(fields));
  raw.set("user", JSON.stringify({ id: 1, first_name: "Boshqa" }));
  assert.equal(verifyInitData(raw.toString(), TOKEN, 3600, NOW), null);
});

test("rejects data signed with another bot token", () => {
  assert.equal(verifyInitData(sign(fields, "999:OTHER"), TOKEN, 3600, NOW), null);
});

test("rejects expired data", () => {
  const old = { ...fields, auth_date: String(NOW / 1000 - 7200) };
  assert.equal(verifyInitData(sign(old), TOKEN, 3600, NOW), null);
});

test("rejects empty or malformed input", () => {
  assert.equal(verifyInitData("", TOKEN, 3600, NOW), null);
  assert.equal(verifyInitData("hash=zz&user=1", TOKEN, 3600, NOW), null);
  assert.equal(verifyInitData(sign(fields), "", 3600, NOW), null);
});
