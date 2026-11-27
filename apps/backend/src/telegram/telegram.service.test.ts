import assert from "node:assert/strict";
import { test } from "node:test";

import { Bot } from "grammy";
import type { Update, UserFromGetMe } from "grammy/types";

import { config } from "../config/config";
import { ParticipantsService } from "../participants/participants.service";
import { RulesService } from "../rules/rules.service";
import { SupportService } from "../support/support.service";
import { BotLoginService } from "../web/bot-login.service";
import { MessageLogService } from "./message-log.service";
import { TelegramService } from "./telegram.service";
import { texts } from "./texts";

const SUPPORT_CHAT = -100_500;
const BOT_INFO: UserFromGetMe = {
  id: 999,
  is_bot: true,
  first_name: "Olivia",
  username: "olivia_test_bot",
  can_join_groups: true,
  can_read_all_group_messages: false,
  supports_inline_queries: false,
  can_connect_to_business: false,
  has_main_web_app: false,
};

interface ApiCall {
  method: string;
  payload: Record<string, unknown>;
}

/** Bot va soxta Telegram API: har bir chaqiruv yoziladi, natija — oddiy muvaffaqiyat. */
function setup(memberStatus: Record<number, string> = {}, supportChat: number | null = SUPPORT_CHAT) {
  (config.telegram as { supportChatId: string | null }).supportChatId = supportChat === null ? null : String(supportChat);
  const participants = new ParticipantsService(new RulesService());
  const support = new SupportService();
  const log = new MessageLogService(participants);
  const botLogin = new BotLoginService();
  const service = new TelegramService(participants, support, log, botLogin);
  const bot = new Bot("123:TEST", { botInfo: BOT_INFO });
  const calls: ApiCall[] = [];
  let messageId = 1_000;
  bot.api.config.use((_prev, method, payload) => {
    const p = (payload ?? {}) as Record<string, unknown>;
    calls.push({ method, payload: p });
    let result: unknown = true;
    if (method === "sendMessage" || method === "sendPhoto") {
      result = { message_id: (messageId += 1), date: 0, chat: { id: p.chat_id, type: "private" } };
    }
    if (method === "getChatMember") {
      result = { status: memberStatus[Number(p.user_id)] ?? "member", user: { id: p.user_id, is_bot: false, first_name: "X" } };
    }
    return Promise.resolve({ ok: true, result } as never);
  });
  log.setMessenger({
    send: async (chatId, text) => {
      calls.push({ method: "notify", payload: { chat_id: chatId, text } });
    },
  });
  (service as unknown as { register(bot: Bot): void }).register(bot);

  let updateId = 0;
  const privateText = (userId: number, text: string): Update => ({
    update_id: (updateId += 1),
    message: {
      message_id: updateId,
      date: 0,
      chat: { id: userId, type: "private", first_name: "U" },
      from: { id: userId, is_bot: false, first_name: "U" },
      text,
    },
  });
  const groupReply = (userId: number, replyTo: number, text: string): Update => ({
    update_id: (updateId += 1),
    message: {
      message_id: updateId,
      date: 0,
      chat: { id: SUPPORT_CHAT, type: "supergroup", title: "Support" },
      from: { id: userId, is_bot: false, first_name: "Operator" },
      text,
      reply_to_message: {
        message_id: replyTo,
        date: 0,
        chat: { id: SUPPORT_CHAT, type: "supergroup", title: "Support" },
        from: { id: BOT_INFO.id, is_bot: true, first_name: "Olivia" },
        text: "murojaat",
      },
    },
  });
  /** `/start <payload>` — grammy buyruqni `bot_command` belgisi bo'yicha taniydi. */
  const start = (userId: number, payload: string): Update => {
    const text = `/start ${payload}`;
    return {
      update_id: (updateId += 1),
      message: {
        message_id: updateId,
        date: 0,
        chat: { id: userId, type: "private", first_name: "U" },
        from: { id: userId, is_bot: false, first_name: "U" },
        text,
        entities: [{ type: "bot_command", offset: 0, length: 6 }],
      },
    };
  };
  const contact = (userId: number, phone: string, ownerId = userId): Update => ({
    update_id: (updateId += 1),
    message: {
      message_id: updateId,
      date: 0,
      chat: { id: userId, type: "private", first_name: "U" },
      from: { id: userId, is_bot: false, first_name: "U" },
      contact: { phone_number: phone, first_name: "U", user_id: ownerId },
    },
  });
  const press = (userId: number, data: string): Update => ({
    update_id: (updateId += 1),
    callback_query: {
      id: `cb${updateId}`,
      from: { id: userId, is_bot: false, first_name: "U" },
      chat_instance: "ci",
      data,
      message: { message_id: 1, date: 0, chat: { id: userId, type: "private", first_name: "U" }, text: "…" },
    },
  });
  return {
    bot,
    calls,
    participants,
    support,
    botLogin,
    privateText,
    groupReply,
    start,
    contact,
    press,
    nextId: () => (updateId += 1),
  };
}

const sent = (calls: ApiCall[], chatId: number) =>
  calls.filter((c) => c.method === "sendMessage" && c.payload.chat_id === chatId).map((c) => String(c.payload.text));

test("flood: only 20 messages a minute are handled, then one warning and silence", async () => {
  const { bot, calls, privateText } = setup();
  for (let i = 0; i < 30; i += 1) await bot.handleUpdate(privateText(42, `salom ${i}`));
  const replies = sent(calls, 42);
  assert.equal(replies.filter((t) => t === texts.supportNeedsContact).length, 20);
  assert.equal(replies.filter((t) => t === texts.tooManyRequests).length, 1);
  assert.equal(replies.length, 21, "qolgan 9 tasiga javob ham berilmaydi");
});

test("support spam: 10 messages in 10 minutes reach operators, then one notice; long texts are clipped", async () => {
  const { bot, calls, participants, support, privateText } = setup();
  participants.setPhone(42, 42, "+998901234567");
  participants.register(42, "Ali", "", 25);
  await bot.handleUpdate(privateText(42, "x".repeat(6_000)));
  for (let i = 0; i < 11; i += 1) await bot.handleUpdate(privateText(42, `savol ${i}`));
  const toGroup = sent(calls, SUPPORT_CHAT);
  assert.equal(toGroup.length, 10);
  assert.ok(toGroup[0].length <= 4_096, "Telegram chegarasidan oshmaydi");
  assert.ok(toGroup[0].includes("…"));
  assert.equal(sent(calls, 42).filter((t) => t === texts.supportTooMany).length, 1);
  assert.equal(support.recentParticipantMessages(42, 600_000), 10, "ortiqchasi saqlanmaydi");
});

test("support: the Support button asks for the question; messages land in the admin panel even without an operators group", async () => {
  const { bot, calls, participants, support, privateText, press } = setup({}, null);
  participants.setPhone(42, 42, "+998901234567");
  participants.register(42, "Ali", "", 25);

  await bot.handleUpdate(privateText(42, texts.supportButton));
  await bot.handleUpdate(press(42, "support"));
  assert.equal(sent(calls, 42).filter((t) => t === texts.supportPrompt).length, 2, "pastdagi va xabar ostidagi tugma");
  assert.equal(support.recentParticipantMessages(42, 600_000), 0, "tugma bosilishi murojaat emas");

  await bot.handleUpdate(privateText(42, "Saytga qayta kira olmayapman"));
  assert.equal(support.recentParticipantMessages(42, 600_000), 1, "admin paneldagi Support bo'limiga tushdi");
  assert.ok(sent(calls, 42).includes(texts.supportReceived), "\"ulanmagan\" demaydi");
  const keyboard = calls.filter((c) => c.method === "sendMessage" && c.payload.chat_id === 42).at(-1)?.payload.reply_markup as
    | { keyboard?: { text: string }[][]; is_persistent?: boolean }
    | undefined;
  assert.deepEqual(keyboard?.keyboard?.[0]?.[0]?.text, texts.supportButton, "pastda doimiy Support tugmasi");
  assert.equal(keyboard?.is_persistent, true);
  (config.telegram as { supportChatId: string | null }).supportChatId = String(SUPPORT_CHAT);
});

test("only support group admins can reply to participants through the bot", async () => {
  const { bot, calls, participants, support, groupReply } = setup({ 7: "administrator", 8: "member" });
  participants.setPhone(42, 42, "+998901234567");
  support.addParticipantMessage(42, "yordam", null);
  support.rememberGroupMessage(555, 42);

  await bot.handleUpdate(groupReply(8, 555, "Bu firibgar xabar"));
  assert.equal(calls.filter((c) => c.method === "notify").length, 0, "oddiy a'zo yoza olmaydi");
  assert.ok(sent(calls, SUPPORT_CHAT).includes(texts.operatorNotAllowed));

  await bot.handleUpdate(groupReply(7, 555, "Salom, yordam beramiz"));
  const notified = calls.filter((c) => c.method === "notify");
  assert.equal(notified.length, 1);
  assert.equal(notified[0].payload.chat_id, 42);

  // Guruhdagi oddiy suhbat xabariga "Reply" — bot jim.
  const before = calls.length;
  await bot.handleUpdate(groupReply(7, 777, "ok"));
  assert.equal(calls.length, before);
});

test("the bot leaves foreign groups it is added to and ignores other bots", async () => {
  const { bot, calls, privateText, nextId } = setup();
  await bot.handleUpdate({
    update_id: nextId(),
    my_chat_member: {
      chat: { id: -200, type: "group", title: "Begona" },
      from: { id: 5, is_bot: false, first_name: "X" },
      date: 0,
      old_chat_member: { status: "left", user: { ...BOT_INFO } },
      new_chat_member: { status: "member", user: { ...BOT_INFO } },
    },
  });
  assert.deepEqual(
    calls.filter((c) => c.method === "leaveChat").map((c) => c.payload.chat_id),
    [-200],
  );

  const fromBot = privateText(43, "spam");
  if (fromBot.message?.from) fromBot.message.from.is_bot = true;
  await bot.handleUpdate(fromBot);
  assert.equal(sent(calls, 43).length, 0);
});

// --- Saytdagi "Hisobim bor" — bot orqali kirish ------------------------------

const edited = (calls: ApiCall[]) =>
  calls.filter((c) => c.method === "editMessageText").map((c) => String(c.payload.text));
const loginButtons = (calls: ApiCall[], chatId: number) =>
  calls
    .filter((c) => c.method === "sendMessage" && c.payload.chat_id === chatId)
    .flatMap((c) => {
      const markup = c.payload.reply_markup as { inline_keyboard?: { callback_data?: string }[][] } | undefined;
      return (markup?.inline_keyboard ?? []).flat().map((b) => b.callback_data ?? "");
    })
    .filter((d) => d.startsWith("login:"));

test("site login: a web-only account is locked after its one entry; with the admin's permission it confirms and the site gets it", async () => {
  const { bot, calls, participants, botLogin, start, contact, press } = setup();
  // Saytda ro'yxatdan o'tgan (shu bilan saytga bir marta kirilgan) hisob — keyin chiqib ketgan.
  const webId = participants.registerWeb("Dilnoza", "90 123 45 67", 22);
  const locked = botLogin.start();
  assert.ok(locked);

  await bot.handleUpdate(start(42, `login_${locked.id}`));
  assert.ok(sent(calls, 42).some((t) => t === texts.loginShareContact(locked.code)), "raqam so'raladi, kod ko'rinadi");

  await bot.handleUpdate(contact(42, "+998 90 123 45 67"));
  assert.ok(sent(calls, 42).includes(texts.loginContactLinked));
  assert.equal(participants.resolve(42), webId, "saytdagi hisob Telegram'ga ulandi");
  assert.ok(sent(calls, 42).includes(texts.loginLocked), "qayta kirish yopiq — supportga yozish taklif qilinadi");
  assert.ok(!sent(calls, 42).includes(texts.loginConfirm("Dilnoza", locked.code)), "tasdiq so'ralmaydi");
  assert.equal(botLogin.poll(locked.id, locked.secret).status, "LOCKED");

  // Admin (Support murojaati orqali) bir martalik ruxsat berdi.
  assert.ok(participants.allowWebLogin(webId));
  const request = botLogin.start();
  assert.ok(request);
  await bot.handleUpdate(start(42, `login_${request.id}`));
  assert.ok(sent(calls, 42).includes(texts.loginConfirm("Dilnoza", request.code)));
  assert.deepEqual(loginButtons(calls, 42), [`login:ok:${request.id}`, `login:no:${request.id}`]);
  assert.equal(botLogin.poll(request.id, request.secret).status, "PENDING", "tugma bosilmaguncha kirilmaydi");

  await bot.handleUpdate(press(42, `login:ok:${request.id}`));
  assert.deepEqual(edited(calls), [texts.loginDone]);
  assert.deepEqual(botLogin.poll(request.id, request.secret), { status: "CONFIRMED", accountId: webId });
  assert.equal(botLogin.poll(request.id, request.secret).status, "EXPIRED", "bir martalik");
});

test("site login: a registered Telegram user confirms straight away; another person cannot take over the link", async () => {
  const { bot, calls, participants, botLogin, start, press } = setup();
  participants.setPhone(42, 42, "+998901234567");
  participants.register(42, "Ali", "", 25);
  const request = botLogin.start();
  assert.ok(request);

  await bot.handleUpdate(start(42, `login_${request.id}`));
  assert.ok(sent(calls, 42).includes(texts.loginConfirm("Ali", request.code)));
  assert.equal(sent(calls, 42).filter((t) => t.startsWith("🔐 Saytga kirish\n")).length, 0, "raqam qayta so'ralmaydi");

  // Havolani ko'rgan boshqa odam: ochsa ham, tugmani bossa ham — hech narsa bo'lmaydi.
  await bot.handleUpdate(start(77, `login_${request.id}`));
  assert.ok(sent(calls, 77).includes(texts.loginExpired));
  await bot.handleUpdate(press(77, `login:ok:${request.id}`));
  assert.equal(botLogin.poll(request.id, request.secret).status, "PENDING");

  await bot.handleUpdate(press(42, `login:ok:${request.id}`));
  assert.deepEqual(botLogin.poll(request.id, request.secret), { status: "CONFIRMED", accountId: 42 });
});

test("site login: 'Men emas' denies; unknown links and a phone owned by someone else fail", async () => {
  const { bot, calls, participants, botLogin, start, contact, press } = setup();
  participants.setPhone(42, 42, "+998901234567");
  participants.register(42, "Ali", "", 25);

  const denied = botLogin.start();
  assert.ok(denied);
  await bot.handleUpdate(start(42, `login_${denied.id}`));
  await bot.handleUpdate(press(42, `login:no:${denied.id}`));
  assert.ok(edited(calls).includes(texts.loginDenied));
  assert.equal(botLogin.poll(denied.id, denied.secret).status, "DENIED");

  await bot.handleUpdate(start(42, "login_AAAAAAAAAAAAAAAAAAAAAA"));
  await bot.handleUpdate(start(42, "login_bad"));
  assert.equal(sent(calls, 42).filter((t) => t === texts.loginExpired).length, 2);

  // Boshqa Telegram foydalanuvchisi Ali'ning raqamini ulasholmaydi — kirish FAILED.
  const taken = botLogin.start();
  assert.ok(taken);
  await bot.handleUpdate(start(55, `login_${taken.id}`));
  await bot.handleUpdate(contact(55, "+998901234567"));
  assert.ok(sent(calls, 55).includes(texts.contactTaken));
  assert.equal(botLogin.poll(taken.id, taken.secret).status, "FAILED");
  assert.equal(loginButtons(calls, 55).length, 0);
});
