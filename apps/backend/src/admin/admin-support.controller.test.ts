import assert from "node:assert/strict";
import { test } from "node:test";

import type { HttpException } from "@nestjs/common";

import { AuditService } from "../audit/audit.service";
import { ParticipantsService } from "../participants/participants.service";
import { RulesService } from "../rules/rules.service";
import { SupportService } from "../support/support.service";
import { ParticipantNotifier } from "../telegram/notifier";
import type { TelegramService } from "../telegram/telegram.service";
import { texts } from "../telegram/texts";
import { AdminSupportController } from "./admin-support.controller";
import type { AdminUser } from "./auth/admin-accounts";

class FakeNotifier extends ParticipantNotifier {
  readonly sent: { chatId: number; text: string }[] = [];
  async notify(chatId: number, text: string): Promise<void> {
    this.sent.push({ chatId, text });
  }
}

const staff: AdminUser = { id: "u1", login: "support", fullName: "Support xodimi", role: "SUPPORT" };

function setup() {
  const participants = new ParticipantsService(new RulesService());
  const support = new SupportService();
  const notifier = new FakeNotifier();
  const audit = new AuditService();
  const controller = new AdminSupportController(support, participants, notifier, {} as TelegramService, audit);
  return { participants, support, notifier, audit, controller };
}

const statusOf = async (fn: () => Promise<unknown>): Promise<number> => {
  try {
    await fn();
  } catch (e) {
    return (e as HttpException).getStatus();
  }
  return 200;
};

test("support ticket: staff give a one-time permission to re-enter the site; it is audited and the participant is told", async () => {
  const { participants, support, notifier, audit, controller } = setup();
  const webId = participants.registerWeb("Dilnoza", "90 123 45 67");
  participants.startWebSession(webId);
  participants.setPhone(42, 42, "+998901234567"); // Telegram'ga ulandi — bot orqali yozadi
  const ticket = support.addParticipantMessage(webId, "Chiqib ketdim, saytga kira olmayapman", null);

  assert.equal(controller.get(String(ticket.id)).participant.webLogin, "USED");
  const detail = await controller.allowWebLogin(String(ticket.id), staff);
  assert.equal(detail.participant.webLogin, "GRANTED");
  assert.equal(participants.canStartWebSession(webId), true);
  assert.deepEqual(notifier.sent, [{ chatId: 42, text: texts.webLoginAllowed }]);
  const entry = audit.list({}).items[0];
  assert.equal(entry?.action, "participant.web_login");
  assert.equal(entry?.reason, `Murojaat #${ticket.id}`);

  assert.equal(await statusOf(() => controller.allowWebLogin(String(ticket.id), staff)), 409, "allaqachon berilgan");
  participants.startWebSession(webId);
  assert.equal(participants.canStartWebSession(webId), false, "ruxsat bir martalik");
  assert.equal(await statusOf(() => controller.allowWebLogin("999", staff)), 404);
});

test("support ticket: no permission is needed for someone who has never entered the site", async () => {
  const { participants, support, controller } = setup();
  participants.setPhone(7, 7, "+998911112233");
  participants.register(7, "Ali", "");
  const ticket = support.addParticipantMessage(7, "Savol", null);
  assert.equal(controller.get(String(ticket.id)).participant.webLogin, "NEVER");
  assert.equal(await statusOf(() => controller.allowWebLogin(String(ticket.id), staff)), 409);
});
