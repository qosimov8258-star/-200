import { Injectable, Logger, type OnApplicationBootstrap, type OnApplicationShutdown } from "@nestjs/common";
import { Bot, InlineKeyboard, Keyboard, type Context } from "grammy";

import { config } from "../config/config";
import { ParticipantsService, type Participant } from "../participants/participants.service";
import type { SupportRelay } from "../support/support-relay";
import { SupportService } from "../support/support.service";
import { BOT_LOGIN_ID, BOT_LOGIN_START_PREFIX, BotLoginService } from "../web/bot-login.service";
import {
  BOT_SUPPORT_MAX_IN_WINDOW,
  BOT_SUPPORT_WINDOW_MS,
  clip,
  FloodGuard,
  isOperator,
  maskToken,
  NoticeOnce,
  OPERATOR_REPLY_MAX,
  OperatorCache,
  parseOperatorIds,
  SUPPORT_TEXT_MAX,
  TELEGRAM_CAPTION_MAX,
  TELEGRAM_TEXT_MAX,
  type ChatMemberStatus,
} from "./bot-guard";
import { failureReasonOf, MessageLogService } from "./message-log.service";
import type { ParticipantNotifier, TelegramMessageKind } from "./notifier";
import { chosenLang } from "../common/lang";
import { BOT_COMMANDS, LANGUAGE_BUTTONS, LANGUAGE_PROMPT, textsFor } from "./bot-texts";
import { texts, type BotTexts } from "./texts";
import { textsRu } from "./texts.ru";

/**
 * Saytdan kelgan havolalar: `?start=web` (saytda ro'yxatdan o'tish — raqam ulashish) va
 * `?start=link` (saytdagi hisobni Telegram'ga ulash). Sayt tanlangan tilni ham qo'shadi
 * (`web_ru`, `link_uz`) — bot shu tilda gapiradi; tilsiz (eski) havolalar ham qabul qilinadi.
 */
const SITE_START = /^(web|link)(?:_(uz|ru))?$/;
/** Til tanlash tugmalari: `lang:uz` / `lang:ru`. */
const LANG_CALLBACK = /^lang:(uz|ru)$/;
/** Xabarnoma ostidagi "✅ O'qidim" tugmasi: `read:<jurnal yozuvi ID si>`. */
const READ_PREFIX = "read:";
/** Bot menyusi tugmasi — hamma uchun bitta (Telegram bot darajasida), ikki tilda. */
const MENU_BUTTON_TEXT = "OLIVIA";
/** Saytga kirishni tasdiqlash tugmalari: `login:ok:<id>` / `login:no:<id>` (`BotLoginService`). */
const LOGIN_CALLBACK = /^login:(ok|no):([A-Za-z0-9_-]{22})$/;
/** "💬 Supportga yozish" (xabar ostidagi tugma) — support taklifi. */
const SUPPORT_CALLBACK = "support";
/** Pastdagi doimiy "Supportga yozish" tugmasining matni (ikkala tilda) — murojaat emas, taklif. */
const SUPPORT_BUTTON_TEXTS = new Set([texts.supportButton, textsRu.supportButton]);
/** Bot API orqali yuklab olinadigan fayl chegarasi (`getFile` — 20 MB gacha). */
const MAX_FILE_BYTES = 20 * 1024 * 1024;
const FILE_TIMEOUT_MS = 15_000;

/** Telegram'dan yuklab olingan fayl (support skrinshoti). */
export interface DownloadedFile {
  data: Buffer;
  /** Fayl boshidagi baytlar bo'yicha; rasm bo'lmasa — `application/octet-stream`. */
  mime: string;
}

/**
 * Telegram bot:
 * - /start — avval tilni so'raydi (o'zbekcha / ruscha), keyin shu tilda salomlashadi va raqam
 *   ulashishni so'raydi (yoki Mini App tugmasini beradi); /lang — tilni o'zgartirish. Til
 *   tanlanmagan bo'lsa — o'zbekcha (Telegram ilovasining tiliga qaralmaydi);
 * - /start login_<id> — saytdagi "Hisobim bor": raqam (kerak bo'lsa) va "Ha, kirish" tasdig'i;
 * - raqam (kontakt) — faqat o'z raqami qabul qilinadi, keyin Mini App tugmasi;
 * - shaxsiy chatdagi boshqa har qanday xabar — support murojaati, operatorlar guruhiga boradi;
 * - operator guruhda ishtirokchi xabariga "Reply" qilsa — javob ishtirokchiga yetkaziladi;
 * - xabarnomalar ("✅ O'qidim" tugmasi bilan) — Telegram jurnaliga yoziladi (MessageLogService).
 *
 * Lokal ishlab chiqishda long polling; prod da webhook'ga o'tkaziladi.
 */
@Injectable()
export class TelegramService
  implements OnApplicationBootstrap, OnApplicationShutdown, ParticipantNotifier, SupportRelay
{
  private readonly logger = new Logger(TelegramService.name);
  private bot: Bot | null = null;
  /** Saytdan raqam ulashish uchun kelganlar — raqamdan keyin "saytga qayting" deyiladi. */
  private readonly webStarts = new Set<number>();
  /** Himoya: flood, support spami, operator ruxsati (`bot-guard.ts`). */
  private readonly flood = new FloodGuard();
  private readonly supportLimitNotice = new NoticeOnce(BOT_SUPPORT_WINDOW_MS);
  private readonly operators = new OperatorCache();
  private readonly operatorAllowlist = parseOperatorIds(config.telegram.supportOperatorIds);

  constructor(
    private readonly participants: ParticipantsService,
    private readonly support: SupportService,
    private readonly log: MessageLogService,
    private readonly botLogin: BotLoginService,
  ) {}

  onApplicationBootstrap(): void {
    const token = config.telegram.botToken;
    if (!token) {
      this.logger.warn("TELEGRAM_BOT_TOKEN berilmagan — bot ishga tushmadi.");
      return;
    }
    if (config.telegram.mode !== "polling") {
      this.logger.warn(`TELEGRAM_MODE=${config.telegram.mode} — bot ishga tushmadi (faqat API).`);
      return;
    }
    const bot = new Bot(token);
    this.register(bot);
    // Xato matnida token bo'lsa ham log'ga chiqmasin.
    bot.catch((err) => this.logger.error(`Bot xatosi: ${maskToken(err.message, token)}`));
    this.bot = bot;
    this.log.setMessenger({
      send: async (chatId, text, logId) => {
        await bot.api.sendMessage(chatId, text, {
          reply_markup: new InlineKeyboard().text(
            textsFor(this.participants.byChatId(chatId)?.lang).readButton,
            `${READ_PREFIX}${logId}`,
          ),
        });
      },
    });

    void this.configureMenuButton(bot);
    void this.configureCommands(bot);
    // `start` bot to'xtaguncha tugamaydi — kutmaymiz.
    void bot
      .start({
        onStart: (me) => this.logger.log(`Bot ishga tushdi: @${me.username}`),
        // `my_chat_member` — botni begona guruhga qo'shishsa, chiqib ketish uchun.
        allowed_updates: ["message", "callback_query", "my_chat_member"],
      })
      .catch((err: Error) => this.logger.error(`Polling to'xtadi: ${err.message}`));
  }

  async onApplicationShutdown(): Promise<void> {
    this.log.setMessenger(null);
    await this.bot?.stop();
  }

  /**
   * Ishtirokchiga bot orqali xabar (xabarnomalar, support javoblari) — Telegram jurnaliga
   * `kind` bilan yoziladi. Bot ishlamasa yoki Telegram rad etsa — xato: chaqiruvchi xabarni
   * "yuborildi" deb hisoblamasin.
   */
  async notify(chatId: number, text: string, kind: TelegramMessageKind = "OTHER"): Promise<void> {
    await this.log.send(chatId, text, kind);
  }

  /**
   * Ilova/saytdan yozilgan support xabarini operatorlar guruhiga yuboradi. Operator shu xabarga
   * "Reply" qilsa — javob odatdagidek bot orqali ishtirokchiga boradi (pastdagi handler).
   */
  async forward(telegramId: number, header: string, text: string): Promise<void> {
    const supportChatId = config.telegram.supportChatId ? Number(config.telegram.supportChatId) : null;
    if (!this.bot || supportChatId === null) {
      this.logger.warn("Support guruhi ulanmagan — xabar faqat saqlandi.");
      return;
    }
    const sent = await this.bot.api.sendMessage(supportChatId, clip(`${header}\n\n${text}`, TELEGRAM_TEXT_MAX));
    this.support.rememberGroupMessage(sent.message_id, telegramId);
  }

  /**
   * Telegram'dagi faylni (support skrinshoti) bot orqali yuklab oladi. Bot ishlamasa yoki
   * yuklab bo'lmasa — null. Bot tokeni yuklash manzilida bor — u javobga ham, logga ham chiqmaydi.
   */
  async downloadFile(fileId: string): Promise<DownloadedFile | null> {
    const token = config.telegram.botToken;
    if (!this.bot || !token) return null;
    try {
      const file = await this.bot.api.getFile(fileId);
      if (!file.file_path || (file.file_size ?? 0) > MAX_FILE_BYTES) return null;
      const res = await fetch(`https://api.telegram.org/file/bot${token}/${file.file_path}`, {
        signal: AbortSignal.timeout(FILE_TIMEOUT_MS),
      });
      if (!res.ok) {
        this.logger.warn(`Telegram faylini yuklab bo'lmadi: HTTP ${res.status}`);
        return null;
      }
      if (Number(res.headers.get("content-length") ?? 0) > MAX_FILE_BYTES) return null;
      const data = Buffer.from(await res.arrayBuffer());
      if (data.length > MAX_FILE_BYTES) return null;
      return { data, mime: sniffMime(data) };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Telegram faylini yuklab bo'lmadi: ${message.split(token).join("***")}`);
      return null;
    }
  }

  // -------------------------------------------------------------------------

  private register(bot: Bot): void {
    const supportChatId = config.telegram.supportChatId
      ? Number(config.telegram.supportChatId)
      : null;
    const isSupportChat = (ctx: Context) => supportChatId !== null && ctx.chat?.id === supportChatId;
    const isPrivate = (ctx: Context) => ctx.chat?.type === "private";

    // Himoya (birinchi): boshqa botlar e'tiborsiz; shaxsiy chatda flood — daqiqasiga 20 tadan
    // ortig'i tashlanadi (bir marta ogohlantiriladi). Support guruhi (operatorlar) cheklanmaydi.
    bot.use(async (ctx, next) => {
      // Guruhda "anonim admin" bo'lib yozgan operator Telegram'da bot ko'rinishida keladi.
      const anonymousAdmin = isSupportChat(ctx) && ctx.message?.sender_chat?.id === supportChatId;
      if (ctx.from?.is_bot && !anonymousAdmin) return;
      if (ctx.from && !isSupportChat(ctx)) {
        const verdict = this.flood.check(ctx.from.id);
        if (verdict === "warn" && isPrivate(ctx)) await ctx.reply(this.tx(ctx).tooManyRequests).catch(() => undefined);
        if (verdict !== "ok") {
          if (ctx.callbackQuery) await ctx.answerCallbackQuery().catch(() => undefined);
          return;
        }
      }
      await next();
    });

    // Botni begona guruh yoki kanalga qo'shishsa — darhol chiqib ketadi (faqat support guruhida qoladi).
    bot.on("my_chat_member", async (ctx) => {
      const chat = ctx.myChatMember.chat;
      const joined = ["member", "administrator"].includes(ctx.myChatMember.new_chat_member.status);
      if (chat.type === "private" || !joined || chat.id === supportChatId) return;
      this.logger.warn(`Bot begona chatga qo'shildi (${chat.type} ${chat.id}) — chiqib ketildi.`);
      await ctx.api.leaveChat(chat.id).catch(() => undefined);
    });

    // Ishtirokchining @username i — Telegram jurnalida ko'rsatish uchun.
    bot.use(async (ctx, next) => {
      if (ctx.from && isPrivate(ctx)) {
        this.log.noteUsername(this.participants.resolve(ctx.from.id), ctx.from.username ?? null);
      }
      await next();
    });

    // "✅ O'qidim": xabar o'qilgan deb belgilanadi, tugma olib tashlanadi.
    bot.callbackQuery(new RegExp(`^${READ_PREFIX}`), async (ctx) => {
      const id = ctx.callbackQuery.data.slice(READ_PREFIX.length);
      const marked = this.log.markRead(id, this.participants.resolve(ctx.from.id));
      await ctx.answerCallbackQuery(marked ? { text: this.tx(ctx).readThanks } : undefined);
      await ctx.editMessageReplyMarkup().catch(() => undefined);
    });
    // Saytga kirish: "Ha, kirish" — faqat so'rovni botda ochgan foydalanuvchi, raqami bor hisob uchun.
    bot.callbackQuery(LOGIN_CALLBACK, async (ctx) => {
      const match = typeof ctx.match === "string" ? null : ctx.match;
      const [action, id] = [match?.[1], match?.[2] ?? ""];
      if (action === "no") {
        const closed = this.botLogin.close(id, ctx.from.id, "DENIED");
        await ctx.answerCallbackQuery();
        await ctx.editMessageText(closed ? this.tx(ctx).loginDenied : this.tx(ctx).loginExpired).catch(() => undefined);
        return;
      }
      const accountId = this.participants.resolve(ctx.from.id);
      // Saytga allaqachon kirilgan hisob — qayta kirish faqat admin ruxsati bilan.
      if (this.participants.get(accountId)?.phone && !this.participants.canStartWebSession(accountId)) {
        const locked = this.botLogin.close(id, ctx.from.id, "LOCKED");
        await ctx.answerCallbackQuery();
        await ctx
          .editMessageText(locked ? this.tx(ctx).loginLocked : this.tx(ctx).loginExpired, {
            reply_markup: locked ? this.supportInline(this.tx(ctx)) : undefined,
          })
          .catch(() => undefined);
        return;
      }
      const confirmed = Boolean(this.participants.get(accountId)?.phone) && this.botLogin.confirm(id, ctx.from.id, accountId);
      await ctx.answerCallbackQuery(confirmed ? { text: this.tx(ctx).loginConfirmedToast } : undefined);
      await ctx.editMessageText(confirmed ? this.tx(ctx).loginDone : this.tx(ctx).loginExpired).catch(() => undefined);
    });
    // Til tanlandi: saqlanadi, savol o'chiriladi va bot shu tilda davom etadi.
    bot.callbackQuery(LANG_CALLBACK, async (ctx) => {
      const match = typeof ctx.match === "string" ? null : ctx.match;
      const lang = chosenLang(match?.[1]) ?? "uz";
      this.participants.setLang(ctx.from.id, lang);
      await ctx.answerCallbackQuery();
      await ctx.deleteMessage().catch(() => ctx.editMessageReplyMarkup().catch(() => undefined));
      if (isPrivate(ctx)) await this.greet(ctx);
    });
    bot.callbackQuery(SUPPORT_CALLBACK, async (ctx) => {
      await ctx.answerCallbackQuery();
      await this.askSupport(ctx);
    });
    // Eski yoki noma'lum tugmalar — Telegram'dagi "yuklanmoqda" belgisi osilib qolmasin.
    bot.on("callback_query", (ctx) => ctx.answerCallbackQuery());

    bot.command("start", async (ctx) => {
      if (!isPrivate(ctx) || !ctx.from) return;
      const p = this.participants.getOrCreate(this.participants.resolve(ctx.from.id));
      p.chatId = ctx.chat.id;
      // Saytdagi "Hisobim bor" (`?start=login_<id>`).
      if (ctx.match.startsWith(BOT_LOGIN_START_PREFIX)) {
        const id = ctx.match.slice(BOT_LOGIN_START_PREFIX.length);
        const claimed = BOT_LOGIN_ID.test(id) ? this.botLogin.claim(id, ctx.from.id) : null;
        if (!claimed) {
          await ctx.reply(this.tx(ctx).loginExpired);
          return;
        }
        // Saytda tanlangan til — bot ham shu tilda.
        if (claimed.lang) this.participants.setLang(ctx.from.id, claimed.lang);
        // Raqam yo'q — avval ulashadi (saytdagi hisob shu yerda Telegram'ga ulanadi), keyin tasdiq.
        if (!p.phone) {
          await ctx.reply(this.tx(ctx).loginShareContact(claimed.code), { reply_markup: this.contactKeyboard(this.tx(ctx)) });
          return;
        }
        await this.askLoginConfirm(ctx, id, claimed.code, p);
        return;
      }
      // Saytdan "Botda raqamni ulashish" (`?start=web`) yoki "Telegram'ga ulash" (`?start=link`):
      // til saytda tanlangan — qayta so'ralmaydi.
      const site = SITE_START.exec(ctx.match);
      if (site) {
        const siteLang = chosenLang(site[2]);
        if (siteLang) this.participants.setLang(ctx.from.id, siteLang);
        this.webStarts.add(ctx.from.id);
        if (!p.phone) {
          const welcome = site[1] === "link" ? this.tx(ctx).welcomeLink : this.tx(ctx).welcomeFromWeb;
          await ctx.reply(welcome, { reply_markup: this.contactKeyboard(this.tx(ctx)) });
          return;
        }
        await this.replyWithMiniApp(ctx, this.tx(ctx).alreadyRegistered);
        return;
      }
      // Oddiy /start — avval til (saytdagidek), keyin shu tilda salomlashish (`greet`).
      await this.askLanguage(ctx);
    });

    bot.command(["lang", "til"], async (ctx) => {
      if (!isPrivate(ctx) || !ctx.from) return;
      this.participants.getOrCreate(this.participants.resolve(ctx.from.id)).chatId = ctx.chat.id;
      await this.askLanguage(ctx);
    });

    bot.on("message:contact", async (ctx) => {
      if (!isPrivate(ctx)) return;
      const contact = ctx.message.contact;
      // Faqat o'z raqami: boshqa odamning kontaktini ulashib bo'lmaydi.
      if (contact.user_id !== ctx.from.id) {
        await ctx.reply(this.tx(ctx).contactNotOwn, { reply_markup: this.contactKeyboard(this.tx(ctx)) });
        return;
      }
      const result = this.participants.setPhone(ctx.from.id, ctx.chat.id, contact.phone_number);
      // Saytga kirish uchun kelgan ("Hisobim bor"): raqam qabul qilinsa — darhol tasdiq so'raladi.
      const login = this.botLogin.claimedBy(ctx.from.id);
      if (login && (result === "TAKEN" || result === "TAKEN_WEB")) {
        this.botLogin.close(login.id, ctx.from.id, "FAILED");
      } else if (login) {
        this.webStarts.delete(ctx.from.id);
        await ctx.reply(result === "LINKED" ? this.tx(ctx).loginContactLinked : this.tx(ctx).loginContactSaved, {
          reply_markup: this.supportKeyboard(this.tx(ctx)),
        });
        const account = this.participants.get(this.participants.resolve(ctx.from.id));
        if (account) await this.askLoginConfirm(ctx, login.id, login.code, account);
        return;
      }
      if (result === "LINKED") {
        this.webStarts.delete(ctx.from.id);
        await ctx.reply(this.tx(ctx).contactLinked, { reply_markup: this.supportKeyboard(this.tx(ctx)) });
        await this.replyWithMiniApp(ctx, this.tx(ctx).openMiniApp);
        return;
      }
      if (result !== "OK") {
        await ctx.reply(result === "TAKEN_WEB" ? this.tx(ctx).contactTakenWeb : this.tx(ctx).contactTaken, {
          reply_markup: { remove_keyboard: true },
        });
        return;
      }
      // Pastdagi "Raqamni ulashish" o'rniga — doimiy "Supportga yozish", keyin Mini App tugmasi.
      const fromWeb = this.webStarts.delete(ctx.from.id);
      await ctx.reply(fromWeb ? this.tx(ctx).contactSavedWeb : this.tx(ctx).contactSaved, {
        reply_markup: this.supportKeyboard(this.tx(ctx)),
      });
      await this.replyWithMiniApp(ctx, this.tx(ctx).openMiniApp);
    });

    // Operator guruhda ishtirokchi xabariga "Reply" qilib javob beradi.
    bot.on("message", async (ctx, next) => {
      if (!isSupportChat(ctx)) return next();
      const replyTo = ctx.message.reply_to_message?.message_id;
      const rawText = ctx.message.text ?? ctx.message.caption;
      if (!replyTo || !rawText) return;
      const quote = { reply_parameters: { message_id: ctx.message.message_id } };
      const telegramId = this.support.ownerOfGroupMessage(replyTo);
      if (telegramId === null) return;
      // Faqat operatorlar (guruh adminlari yoki ruxsat ro'yxati) bot nomidan ishtirokchiga yoza oladi.
      // Guruh nomidan (anonim) faqat adminlar yoza oladi — ruxsat ro'yxati bo'lmasa, qabul qilinadi
      // (ro'yxat bo'lsa, anonim operatorni aniqlab bo'lmaydi — rad etiladi).
      const anonymousAdmin = ctx.message.sender_chat?.id === ctx.chat.id;
      const allowed = anonymousAdmin
        ? this.operatorAllowlist.size === 0
        : isOperator(
            ctx.from.id,
            await this.operators.status(ctx.from.id, async (userId) => {
              const member = await ctx.api.getChatMember(ctx.chat.id, userId);
              return member.status as ChatMemberStatus;
            }),
            this.operatorAllowlist,
          );
      if (!allowed) {
        await ctx.reply(this.tx(ctx).operatorNotAllowed, quote);
        return;
      }
      const text = clip(rawText, OPERATOR_REPLY_MAX);
      const participant = this.participants.get(telegramId);
      if (!participant?.chatId) {
        await ctx.reply(this.tx(ctx).operatorUnknownTarget, quote);
        return;
      }
      // Avval yuboriladi — yetkazilmagan javob yozishmaga tushmaydi.
      try {
        await this.notify(participant.chatId, textsFor(participant.lang).operatorPrefix + text, "SUPPORT_REPLY");
      } catch (err) {
        await ctx.reply(failureReasonOf(err) === "BOT_BLOCKED" ? this.tx(ctx).operatorBlocked : this.tx(ctx).operatorFailed, quote);
        return;
      }
      this.support.addOperatorReply(participant.telegramId, text);
      await ctx.reply(this.tx(ctx).operatorDelivered, quote);
    });

    // Shaxsiy chatdagi qolgan xabarlar — support murojaati.
    bot.on("message", async (ctx) => {
      if (!isPrivate(ctx)) return;
      const p = this.participants.get(this.participants.resolve(ctx.from.id));
      if (!p?.phone) {
        await ctx.reply(this.tx(ctx).supportNeedsContact, { reply_markup: this.contactKeyboard(this.tx(ctx)) });
        return;
      }
      // "💬 Supportga yozish" tugmasi — murojaat emas: nima yozish kerakligini aytamiz.
      if (ctx.message.text && SUPPORT_BUTTON_TEXTS.has(ctx.message.text.trim())) {
        await this.askSupport(ctx);
        return;
      }
      const text = clip((ctx.message.text ?? ctx.message.caption ?? "").trim(), SUPPORT_TEXT_MAX);
      const photo = ctx.message.photo?.at(-1) ?? null;
      if (!text && !photo) return;
      // Support spami: 10 daqiqada 10 tadan ortiq xabar operatorlarga bormaydi va saqlanmaydi.
      if (this.support.recentParticipantMessages(p.telegramId, BOT_SUPPORT_WINDOW_MS) >= BOT_SUPPORT_MAX_IN_WINDOW) {
        if (this.supportLimitNotice.shouldNotify(p.telegramId)) await ctx.reply(this.tx(ctx).supportTooMany);
        return;
      }
      // Murojaat admin panelning "Support" bo'limiga tushadi; operatorlar guruhi ulangan bo'lsa — u yerga ham.
      const ticket = this.support.addParticipantMessage(p.telegramId, text, photo?.file_id ?? null, photo?.file_size);

      if (supportChatId === null) {
        await ctx.reply(this.tx(ctx).supportReceived, { reply_markup: this.supportKeyboard(this.tx(ctx)) });
        return;
      }
      const name = p.firstName ? `${p.firstName} ${p.lastName}` : ctx.from.first_name;
      const header = `🆘 Murojaat #${ticket.id} — ${name}`;
      // Operator aynan shu xabarga "Reply" qiladi.
      // Telegram chegaralari: izoh — 1024, xabar — 4096 belgi (oshsa xabar umuman bormaydi).
      const sent = photo
        ? await ctx.api.sendPhoto(supportChatId, photo.file_id, {
            caption: clip(`${header}\n\n${text}`.trim(), TELEGRAM_CAPTION_MAX),
          })
        : await ctx.api.sendMessage(supportChatId, clip(`${header}\n\n${text}`, TELEGRAM_TEXT_MAX));
      this.support.rememberGroupMessage(sent.message_id, p.telegramId);
      await ctx.reply(this.tx(ctx).supportReceived, { reply_markup: this.supportKeyboard(this.tx(ctx)) });
    });
  }

  /** Saytga kirish tasdig'i: hisob nomi va saytdagi kod — foydalanuvchi solishtiradi. */
  /**
   * Shu foydalanuvchi tilidagi matnlar: botda, ilovada yoki saytda tanlagan tili; tanlamagan bo'lsa —
   * o'zbekcha. Telegram ilovasining tiliga (`language_code`) qaralmaydi: O'zbekistonda ko'pchilikda
   * Telegram ruscha sozlangan, tanlov esa asosan o'zbek tilida.
   */
  private tx(ctx: Context): BotTexts {
    if (!ctx.from) return texts;
    return textsFor(this.participants.get(this.participants.resolve(ctx.from.id))?.lang);
  }

  /** Til so'rovi (ikkala tilda), tugmalar — `lang:uz` / `lang:ru`. */
  private async askLanguage(ctx: Context): Promise<void> {
    await ctx.reply(LANGUAGE_PROMPT, {
      reply_markup: new InlineKeyboard()
        .text(LANGUAGE_BUTTONS.uz, "lang:uz")
        .text(LANGUAGE_BUTTONS.ru, "lang:ru"),
    });
  }

  /**
   * Til tanlangach: raqam ulashilmagan — salomlashish va raqam so'rash; ulashilgan — tanlangan til
   * (pastdagi doimiy "Supportga yozish" tugmasi ham yangi tilda) va tanlov ilovasi tugmasi.
   */
  private async greet(ctx: Context): Promise<void> {
    if (!ctx.from) return;
    const tx = this.tx(ctx);
    if (!this.participants.get(this.participants.resolve(ctx.from.id))?.phone) {
      await ctx.reply(tx.welcome, { reply_markup: this.contactKeyboard(tx) });
      return;
    }
    await ctx.reply(tx.langSaved, { reply_markup: this.supportKeyboard(tx) });
    await this.replyWithMiniApp(ctx, tx.alreadyRegistered);
  }

  private async askLoginConfirm(ctx: Context, id: string, code: string, account: Participant): Promise<void> {
    // Saytga allaqachon kirilgan hisob — tasdiq so'ralmaydi: qayta kirish faqat admin ruxsati bilan.
    if (ctx.from && !this.participants.canStartWebSession(account.telegramId)) {
      this.botLogin.close(id, ctx.from.id, "LOCKED");
      await ctx.reply(this.tx(ctx).loginLocked, { reply_markup: this.supportInline(this.tx(ctx)) });
      return;
    }
    const name = account.firstName ? `${account.firstName} ${account.lastName}`.trim() : (ctx.from?.first_name ?? "");
    await ctx.reply(this.tx(ctx).loginConfirm(name, code), {
      reply_markup: new InlineKeyboard()
        .text(this.tx(ctx).loginConfirmButton, `login:ok:${id}`)
        .text(this.tx(ctx).loginDenyButton, `login:no:${id}`),
    });
  }

  /** Support taklifi: nima yozish kerakligi va pastda doimiy "Supportga yozish" tugmasi. */
  private async askSupport(ctx: Context): Promise<void> {
    await ctx.reply(this.tx(ctx).supportPrompt, { reply_markup: this.supportKeyboard(this.tx(ctx)) });
  }

  /** Pastda doimiy turadigan "💬 Supportga yozish" tugmasi. */
  private supportKeyboard(tx: BotTexts): Keyboard {
    return new Keyboard().text(tx.supportButton).resized().persistent();
  }

  /** Xabar ostidagi "💬 Supportga yozish" tugmasi. */
  private supportInline(tx: BotTexts): InlineKeyboard {
    return new InlineKeyboard().text(tx.supportButton, SUPPORT_CALLBACK);
  }

  private contactKeyboard(tx: BotTexts): Keyboard {
    return new Keyboard().requestContact(tx.shareContactButton).resized().oneTime();
  }

  private async replyWithMiniApp(ctx: Context, text: string): Promise<void> {
    const url = config.telegram.miniAppUrl;
    if (!url) {
      await ctx.reply(this.tx(ctx).miniAppNotConfigured);
      return;
    }
    await ctx.reply(text, {
      reply_markup: new InlineKeyboard()
        .webApp(this.tx(ctx).openMiniApp, url)
        .row()
        .text(this.tx(ctx).supportButton, SUPPORT_CALLBACK),
    });
  }

  /** "/" menyusidagi buyruqlar: /start va /lang (ikkala tilda). */
  private async configureCommands(bot: Bot): Promise<void> {
    try {
      await bot.api.setMyCommands(BOT_COMMANDS);
    } catch (err) {
      this.logger.warn(`Bot buyruqlarini o'rnatib bo'lmadi: ${(err as Error).message}`);
    }
  }

  /** Chat pastidagi doimiy "Tanlov" tugmasi Mini App'ni ochadi. */
  private async configureMenuButton(bot: Bot): Promise<void> {
    const url = config.telegram.miniAppUrl;
    if (!url) return;
    try {
      await bot.api.setChatMenuButton({
        menu_button: { type: "web_app", text: MENU_BUTTON_TEXT, web_app: { url } },
      });
    } catch (err) {
      this.logger.warn(`Menyu tugmasini o'rnatib bo'lmadi: ${(err as Error).message}`);
    }
  }
}

/** Fayl turi boshidagi baytlar bo'yicha (Telegram fayl serveri turini ishonchli bermaydi). */
function sniffMime(data: Buffer): string {
  if (data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return "image/jpeg";
  if (data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (data.toString("latin1", 0, 4) === "RIFF" && data.toString("latin1", 8, 12) === "WEBP") return "image/webp";
  if (data.toString("latin1", 0, 4) === "GIF8") return "image/gif";
  return "application/octet-stream";
}
