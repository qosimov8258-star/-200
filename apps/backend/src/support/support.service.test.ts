import assert from "node:assert/strict";
import { test } from "node:test";

import { HttpException } from "@nestjs/common";

import { parseSupportMessage } from "../miniapp/validation";
import { SupportService } from "./support.service";

test("thread: shows the participant's messages and operator replies in order, only their own", () => {
  const support = new SupportService();
  support.addParticipantMessage(1, "Ismimni o'zgartirmoqchiman", null);
  support.addParticipantMessage(2, "Boshqa ishtirokchi", null);
  support.addOperatorReply(1, "Pasport nusxasini yuboring");

  const thread = support.thread(1);
  assert.deepEqual(
    thread.map((m) => [m.from, m.text]),
    [
      ["PARTICIPANT", "Ismimni o'zgartirmoqchiman"],
      ["OPERATOR", "Pasport nusxasini yuboring"],
    ],
  );
  assert.equal(support.thread(3).length, 0);
});

test("recentParticipantMessages counts only the participant's own messages inside the window", () => {
  const support = new SupportService();
  for (let i = 0; i < 3; i++) support.addParticipantMessage(7, `xabar ${i}`, null);
  support.addOperatorReply(7, "javob");

  assert.equal(support.recentParticipantMessages(7, 60_000), 3);
  const later = new Date(Date.now() + 2 * 60_000);
  assert.equal(support.recentParticipantMessages(7, 60_000, later), 0);
});

test("parseSupportMessage: trims text, rejects empty, too long and unknown fields", () => {
  assert.equal(parseSupportMessage({ text: "  Salom  " }), "Salom");
  const status = (body: unknown) => {
    try {
      parseSupportMessage(body);
      return 0;
    } catch (e) {
      return e instanceof HttpException ? e.getStatus() : -1;
    }
  };
  assert.equal(status({ text: "   " }), 422);
  assert.equal(status({ text: "a".repeat(1001) }), 422);
  assert.equal(status({ text: "salom", extra: 1 }), 400);
});
