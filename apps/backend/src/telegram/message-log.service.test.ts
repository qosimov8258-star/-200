import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { HttpException } from "@nestjs/common";

import { ParticipantsService } from "../participants/participants.service";
import { StateStore } from "../persistence/state-store";
import { RulesService } from "../rules/rules.service";
import { MessageLogService, UNREAD_AFTER_MS, failureReasonOf, type LoggedMessage } from "./message-log.service";

const HOUR = 60 * 60 * 1000;

/** Telegram'ning "bot bloklangan" xatosi (grammY GrammyError kabi `error_code` bilan). */
const blockedError = () => Object.assign(new Error("Forbidden: bot was blocked by the user"), { error_code: 403 });

function setup(store: StateStore | null = null) {
  let now = new Date("2026-12-01T10:00:00Z");
  const participants = new ParticipantsService(new RulesService());
  const log = new MessageLogService(participants, store, { clock: () => now, resendIntervalMs: 0 });
  const sent: { chatId: number; text: string; logId: string }[] = [];
  const blocked = new Set<number>();
  const flaky = new Set<number>();
  log.setMessenger({
    send: (chatId, text, logId) => {
      if (blocked.has(chatId)) return Promise.reject(blockedError());
      if (flaky.has(chatId)) return Promise.reject(new Error("Network request for 'sendMessage' failed!"));
      sent.push({ chatId, text, logId });
      return Promise.resolve();
    },
  });
  /** Profilini to'ldirgan ishtirokchi (chatId === telegramId). */
  const person = (id: number, firstName = `Ism${id}`, lastName = `Familiya${id}`) => {
    participants.setPhone(id, id, `+99890${String(id).padStart(7, "0")}`);
    participants.register(id, firstName, lastName, 25);
  };
  const advance = (ms: number) => {
    now = new Date(now.getTime() + ms);
  };
  return { log, participants, sent, blocked, flaky, person, advance };
}

const status = async (fn: () => Promise<unknown>) => {
  try {
    await fn();
    return 0;
  } catch (e) {
    return e instanceof HttpException ? e.getStatus() : -1;
  }
};

test("send: logs the message as DELIVERED with the read button id, kind defaults to OTHER", async () => {
  const { log, sent, person } = setup();
  person(1);
  await log.send(1, "✅ Videongiz qabul qilindi", "REEL_ACCEPTED");
  await log.send(1, "Boshqa xabar");

  const { rows } = log.list({});
  assert.equal(rows.length, 2);
  const accepted = rows.find((r) => r.kind === "REEL_ACCEPTED");
  assert.ok(accepted);
  assert.equal(accepted.status, "DELIVERED");
  assert.equal(accepted.attempts, 1);
  assert.equal(accepted.participant.firstName, "Ism1");
  assert.equal(accepted.participant.phone, "+998900000001");
  assert.ok(accepted.deliveredAt);
  assert.equal(accepted.canResend, false);
  assert.equal(rows.find((r) => r.kind === "OTHER")?.text, "Boshqa xabar");
  assert.deepEqual(
    sent.map((s) => s.logId).sort(),
    rows.map((r) => r.id).sort(),
    "tugma aynan shu yozuvga tegishli",
  );
});

test("markRead: READ only by the owner; READ never becomes UNREAD", async () => {
  const { log, person, advance } = setup();
  person(1);
  await log.send(1, "Salom", "WARNING");
  const id = log.list({}).rows[0]!.id;

  assert.equal(log.markRead(id, 2), false, "boshqa ishtirokchi belgilay olmaydi");
  assert.equal(log.markRead("tgm_999", 1), false);
  assert.equal(log.list({}).rows[0]!.status, "DELIVERED");

  advance(HOUR);
  assert.equal(log.markRead(id, 1), true);
  const read = log.list({}).rows[0]!;
  assert.equal(read.status, "READ");
  assert.ok(read.readAt);

  advance(3 * UNREAD_AFTER_MS);
  assert.equal(log.list({}).rows[0]!.status, "READ");
});

test("UNREAD: delivered more than 24 hours ago and not read; counted in statusCounts", async () => {
  const { log, person, advance } = setup();
  person(1);
  person(2);
  await log.send(1, "Birinchi", "REEL_ACCEPTED");
  await log.send(2, "Ikkinchi", "REEL_ACCEPTED");
  log.markRead(log.list({ search: "Ism2" }).rows[0]!.id, 2);

  advance(UNREAD_AFTER_MS - 1000);
  assert.equal(log.list({}).statusCounts.UNREAD, 0, "24 soat hali o'tmadi");

  advance(2000);
  const { rows, statusCounts } = log.list({});
  assert.deepEqual(
    { ALL: statusCounts.ALL, UNREAD: statusCounts.UNREAD, READ: statusCounts.READ, DELIVERED: statusCounts.DELIVERED },
    { ALL: 2, UNREAD: 1, READ: 1, DELIVERED: 0 },
  );
  const unread = rows.find((r) => r.status === "UNREAD");
  assert.equal(unread?.participant.id, "1");
  assert.equal(unread?.canResend, true);
  assert.equal(log.list({ status: "UNREAD" }).rows.length, 1);
});

test("blocked bot: FAILED + BOT_BLOCKED, error is rethrown, resend refused, counted in summary", async () => {
  const { log, person, blocked } = setup();
  person(1);
  person(2);
  blocked.add(1);

  await assert.rejects(log.send(1, "Xabar", "VOUCHER_WIN"), /blocked/);
  const failed = log.list({ status: "FAILED" }).rows[0]!;
  assert.equal(failed.failureReason, "BOT_BLOCKED");
  assert.equal(failed.canResend, false);
  assert.equal(await status(() => log.resend(failed.id)), 409);

  await log.send(2, "Xabar", "VOUCHER_WIN");
  assert.deepEqual(log.list({}).summary, { totalParticipants: 2, linkedParticipants: 2, blockedBot: 1 });
});

test("network error: FAILED + NETWORK can be resent; resend updates attempts and status", async () => {
  const { log, person, flaky, advance } = setup();
  person(1);
  flaky.add(1);
  await assert.rejects(log.send(1, "Xabar", "REEL_REJECTED"));
  const failed = log.list({}).rows[0]!;
  assert.equal(failed.failureReason, "NETWORK");
  assert.equal(failed.canResend, true);

  // Yana xato — 409 emas, `ok: false` (controller 502 qaytaradi), urinish hisoblanadi.
  const again = await log.resend(failed.id);
  assert.equal(again.ok, false);
  assert.equal(again.item.attempts, 2);

  flaky.delete(1);
  advance(HOUR);
  const outcome = await log.resend(failed.id);
  assert.equal(outcome.ok, true);
  assert.equal(outcome.before, "FAILED");
  assert.equal(outcome.item.status, "DELIVERED");
  assert.equal(outcome.item.attempts, 3);
  assert.equal(outcome.item.failureReason, null);
  assert.notEqual(outcome.item.lastSentAt, outcome.item.firstSentAt);
});

test("resend: UNREAD goes out again, DELIVERED is refused (409), unknown id is 404", async () => {
  const { log, person, sent, advance } = setup();
  person(1);
  await log.send(1, "Xabar", "REEL_ACCEPTED");
  const id = log.list({}).rows[0]!.id;
  assert.equal(await status(() => log.resend(id)), 409);
  assert.equal(await status(() => log.resend("tgm_404")), 404);

  advance(UNREAD_AFTER_MS + HOUR);
  const outcome = await log.resend(id);
  assert.equal(outcome.before, "UNREAD");
  assert.equal(outcome.item.status, "DELIVERED");
  assert.equal(outcome.item.attempts, 2);
  assert.equal(sent.length, 2);
  assert.equal(sent[1]!.logId, id, "yangi nusxa ham o'sha yozuvga tegishli");
});

test("send without a running bot: FAILED + NETWORK and the error reaches the caller", async () => {
  const { log, person } = setup();
  person(1);
  log.setMessenger(null);
  await assert.rejects(log.send(1, "Xabar"), /ishga tushmagan/);
  assert.equal(log.list({}).rows[0]!.failureReason, "NETWORK");
  assert.equal(await status(() => log.resend(log.list({}).rows[0]!.id)), 503);
  assert.equal(await status(() => log.resendUnread({})), 503);
});

test("resendUnread: only UNREAD matching kind and search; blocked ones are counted as failed", async () => {
  const { log, person, blocked, sent, advance } = setup();
  person(1, "Ali", "Valiyev");
  person(2, "Olim", "Karimov");
  person(3, "Aziz", "Rasulov");
  await log.send(1, "a", "REEL_ACCEPTED");
  await log.send(2, "b", "REEL_ACCEPTED");
  await log.send(3, "c", "WARNING");
  await log.send(1, "d", "WARNING");
  advance(UNREAD_AFTER_MS + HOUR);
  await log.send(2, "yangi", "REEL_ACCEPTED"); // hali UNREAD emas
  sent.length = 0;

  assert.deepEqual(await log.resendUnread({ kind: "REEL_ACCEPTED", search: "valiyev" }), { resent: 1, failed: 0 });
  assert.deepEqual(sent.map((s) => s.text), ["a"]);

  blocked.add(3);
  assert.deepEqual(await log.resendUnread({ kind: "WARNING" }), { resent: 1, failed: 1 });
  assert.equal(log.list({}).statusCounts.UNREAD, 1, "faqat Olimning eski xabari qoldi");
  assert.equal(log.list({ status: "FAILED" }).rows[0]?.failureReason, "BOT_BLOCKED");
});

test("list: search by name, phone digits and @username; kind filter; newest first", async () => {
  const { log, person, advance } = setup();
  person(1, "Oʻtkir", "Hamidov");
  person(2, "Bobur", "Aliyev");
  log.noteUsername(2, "bobur_a");
  await log.send(1, "birinchi", "REEL_ACCEPTED");
  advance(1000);
  await log.send(2, "ikkinchi", "WARNING");

  assert.deepEqual(log.list({}).rows.map((r) => r.text), ["ikkinchi", "birinchi"]);
  assert.equal(log.list({ search: "o'tkir" }).rows[0]?.text, "birinchi", "apostrof variantlari bir xil");
  assert.equal(log.list({ search: "aliyev bobur" }).rows[0]?.text, "ikkinchi");
  assert.equal(log.list({ search: "@bobur" }).rows[0]?.participant.telegramUsername, "bobur_a");
  assert.equal(log.list({ search: "0000001" }).rows[0]?.text, "birinchi");
  assert.equal(log.list({ search: "99" }).rows.length, 0, "3 tadan kam raqam — telefon bo'yicha qidirilmaydi");
  const warnings = log.list({ kind: "WARNING" });
  assert.equal(warnings.rows.length, 1);
  assert.equal(warnings.statusCounts.ALL, 1);

  log.noteUsername(2, null);
  assert.equal(log.list({ kind: "WARNING" }).rows[0]?.participant.telegramUsername, null);
});

test("failureReasonOf: 403 is BOT_BLOCKED, anything else is NETWORK", () => {
  assert.equal(failureReasonOf(blockedError()), "BOT_BLOCKED");
  assert.equal(failureReasonOf(Object.assign(new Error("Too Many Requests"), { error_code: 429 })), "NETWORK");
  assert.equal(failureReasonOf(new Error("fetch failed")), "NETWORK");
  assert.equal(failureReasonOf("x"), "NETWORK");
});

test("persistence: log and usernames survive a restart; an interrupted send becomes resendable", async () => {
  const dir = mkdtempSync(join(tmpdir(), "message-log-"));
  const first = new StateStore({ dir, saveEveryMs: 60_000, keepBackups: 1 });
  const a = setup(first);
  a.person(1);
  a.log.noteUsername(1, "ali_v");
  await a.log.send(1, "Saqlanadi", "SUPPORT_REPLY");
  first.flush();

  const second = new StateStore({ dir, saveEveryMs: 60_000, keepBackups: 1 });
  const b = setup(second);
  const [item] = b.log.list({}).rows;
  assert.equal(item?.text, "Saqlanadi");
  assert.equal(item?.kind, "SUPPORT_REPLY");
  assert.equal(item?.status, "DELIVERED");
  assert.equal(item?.participant.telegramUsername, "ali_v");
  await b.log.send(1, "Keyingi");
  assert.equal(b.log.list({}).rows.length, 2);
  assert.notEqual(b.log.list({}).rows[0]?.id, item?.id, "ID lar takrorlanmaydi");

  // Eski/chala yozuv: server yuborish paytida to'xtagan (SENT), ba'zi maydonlar yo'q.
  const oldDir = mkdtempSync(join(tmpdir(), "message-log-"));
  const third = new StateStore({ dir: oldDir, saveEveryMs: 60_000, keepBackups: 1 });
  const partial: Partial<LoggedMessage>[] = [
    { id: "tgm_7", chatId: 5, text: "chala", status: "SENT", firstSentAt: new Date("2026-11-30T10:00:00Z") },
    { id: "bad" },
  ];
  third.attach("telegramLog", () => ({ seq: 7, messages: partial }));
  third.flush();
  const restored = setup(new StateStore({ dir: oldDir, saveEveryMs: 60_000, keepBackups: 1 }));
  const [old] = restored.log.list({}).rows;
  assert.equal(restored.log.list({}).rows.length, 1);
  assert.equal(old?.status, "FAILED");
  assert.equal(old?.failureReason, "NETWORK");
  assert.equal(old?.kind, "OTHER");
  assert.equal(old?.canResend, true);
  await restored.log.send(5, "yangi");
  assert.ok(restored.log.get("tgm_8"), "seq saqlangandan davom etadi");
});
