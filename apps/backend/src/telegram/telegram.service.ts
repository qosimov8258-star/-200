import { Injectable, Logger, type OnApplicationBootstrap, type OnApplicationShutdown } from "@nestjs/common";
import { Bot, InlineKeyboard, Keyboard, type Context } from "grammy";

import { config } from "../config/config";
import { ParticipantsService } from "../participants/participants.service";
import type { SupportRelay } from "../support/support-relay";
import { SupportService } from "../support/support.service";
import { failureReasonOf, MessageLogService } from "./message-log.service";
import type { ParticipantNotifier, TelegramMessageKind } from "./notifier";
import { texts } from "./texts";

/** Saytdagi hisobni Telegram'ga ulash: `https://t.me/<bot>?start=link`. */
const LINK_START_PAYLOAD = "link";
/** Sayt botga shu parametr bilan yuboradi: `https://t.me/<bot>?start=web`. */
const WEB_START_PAYLOAD = "web";
/** Xabarnoma ostidagi "✅ O'qidim" tugmasi: `read:<jurnal yozuvi ID si>`. */
const READ_PREFIX = "read:";
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
 * - /start — salomlashadi va raqam ulashishni so'raydi (yoki Mini App tugmasini beradi);
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

  constructor(
    private readonly participants: ParticipantsService,
    private readonly support: SupportService,
    private readonly log: MessageLogService,
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
    bot.catch((err) => this.logger.error(`Bot xatosi: ${err.message}`, err.stack));
    this.bot = bot;
    this.log.setMessenger({
      send: async (chatId, text, logId) => {
        await bot.api.sendMessage(chatId, text, {
          reply_markup: new InlineKeyboard().text(texts.readButton, `${READ_PREFIX}${logId}`),
        });
      },
    });

    void this.configureMenuButton(bot);
    // `start` bot to'xtaguncha tugamaydi — kutmaymiz.
    void bot
      .start({
        onStart: (me) => this.logger.log(`Bot ishga tushdi: @${me.username}`),
        allowed_updates: ["message", "callback_query"],
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
    const sent = await this.bot.api.sendMessage(supportChatId, `${header}\n\n${text}`);
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
      await ctx.answerCallbackQuery(marked ? { text: texts.readThanks } : undefined);
      await ctx.editMessageReplyMarkup().catch(() => undefined);
    });
    // Eski yoki noma'lum tugmalar — Telegram'dagi "yuklanmoqda" belgisi osilib qolmasin.
    bot.on("callback_query", (ctx) => ctx.answerCallbackQuery());

    bot.command("start", async (ctx) => {
      if (!isPrivate(ctx) || !ctx.from) return;
      const p = this.participants.getOrCreate(this.participants.resolve(ctx.from.id));
      p.chatId = ctx.chat.id;
      // Saytdan "Botda raqamni ulashish" (`?start=web`) yoki "Telegram'ga ulash" (`?start=link`).
      const fromWeb = ctx.match === WEB_START_PAYLOAD || ctx.match === LINK_START_PAYLOAD;
      if (fromWeb) this.webStarts.add(ctx.from.id);
      if (!p.phone) {
        const welcome =
          ctx.match === LINK_START_PAYLOAD ? texts.welcomeLink : fromWeb ? texts.welcomeFromWeb : texts.welcome;
        await ctx.reply(welcome, { reply_markup: this.contactKeyboard() });
        return;
      }
      await this.replyWithMiniApp(ctx, texts.alreadyRegistered);
    });

    bot.on("message:contact", async (ctx) => {
      if (!isPrivate(ctx)) return;
      const contact = ctx.message.contact;
      // Faqat o'z raqami: boshqa odamning kontaktini ulashib bo'lmaydi.
      if (contact.user_id !== ctx.from.id) {
        await ctx.reply(texts.contactNotOwn, { reply_markup: this.contactKeyboard() });
        return;
      }
      const result = this.participants.setPhone(ctx.from.id, ctx.chat.id, contact.phone_number);
      if (result === "LINKED") {
        this.webStarts.delete(ctx.from.id);
        await ctx.reply(texts.contactLinked, { reply_markup: { remove_keyboard: true } });
        await this.replyWithMiniApp(ctx, texts.openMiniApp);
        return;
      }
      if (result !== "OK") {
        await ctx.reply(result === "TAKEN_WEB" ? texts.contactTakenWeb : texts.contactTaken, {
          reply_markup: { remove_keyboard: true },
        });
        return;
      }
      // Pastdagi "Raqamni ulashish" klaviaturasini yopamiz, keyin Mini App tugmasi.
      const fromWeb = this.webStarts.delete(ctx.from.id);
      await ctx.reply(fromWeb ? texts.contactSavedWeb : texts.contactSaved, {
        reply_markup: { remove_keyboard: true },
      });
      await this.replyWithMiniApp(ctx, texts.openMiniApp);
    });

    // Operator guruhda ishtirokchi xabariga "Reply" qilib javob beradi.
    bot.on("message", async (ctx, next) => {
      if (!isSupportChat(ctx)) return next();
      const replyTo = ctx.message.reply_to_message?.message_id;
      const text = ctx.message.text ?? ctx.message.caption;
      if (!replyTo || !text) return;
      const quote = { reply_parameters: { message_id: ctx.message.message_id } };
      const telegramId = this.support.ownerOfGroupMessage(replyTo);
      const participant = telegramId === null ? null : this.participants.get(telegramId);
      if (!participant?.chatId) {
        await ctx.reply(texts.operatorUnknownTarget, quote);
        return;
      }
      // Avval yuboriladi — yetkazilmagan javob yozishmaga tushmaydi.
      try {
        await this.notify(participant.chatId, texts.operatorPrefix + text, "SUPPORT_REPLY");
      } catch (err) {
        await ctx.reply(failureReasonOf(err) === "BOT_BLOCKED" ? texts.operatorBlocked : texts.operatorFailed, quote);
        return;
      }
      this.support.addOperatorReply(participant.telegramId, text);
      await ctx.reply(texts.operatorDelivered, quote);
    });

    // Shaxsiy chatdagi qolgan xabarlar — support murojaati.
    bot.on("message", async (ctx) => {
      if (!isPrivate(ctx)) return;
      const p = this.participants.get(this.participants.resolve(ctx.from.id));
      if (!p?.phone) {
        await ctx.reply(texts.supportNeedsContact, { reply_markup: this.contactKeyboard() });
        return;
      }
      const text = ctx.message.text ?? ctx.message.caption ?? "";
      const photo = ctx.message.photo?.at(-1) ?? null;
      if (!text && !photo) return;
      const ticket = this.support.addParticipantMessage(p.telegramId, text, photo?.file_id ?? null, photo?.file_size);

      if (supportChatId === null) {
        await ctx.reply(texts.supportUnavailable);
        return;
      }
      const name = p.firstName ? `${p.firstName} ${p.lastName}` : ctx.from.first_name;
      const header = `🆘 Murojaat #${ticket.id} — ${name}`;
      // Operator aynan shu xabarga "Reply" qiladi.
      const sent = photo
        ? await ctx.api.sendPhoto(supportChatId, photo.file_id, { caption: `${header}\n\n${text}`.trim() })
        : await ctx.api.sendMessage(supportChatId, `${header}\n\n${text}`);
      this.support.rememberGroupMessage(sent.message_id, p.telegramId);
      await ctx.reply(texts.supportReceived);
    });
  }

  private contactKeyboard(): Keyboard {
    return new Keyboard().requestContact(texts.shareContactButton).resized().oneTime();
  }

  private async replyWithMiniApp(ctx: Context, text: string): Promise<void> {
    const url = config.telegram.miniAppUrl;
    if (!url) {
      await ctx.reply(texts.miniAppNotConfigured);
      return;
    }
    await ctx.reply(text, { reply_markup: new InlineKeyboard().webApp(texts.openMiniApp, url) });
  }

  /** Chat pastidagi doimiy "Tanlov" tugmasi Mini App'ni ochadi. */
  private async configureMenuButton(bot: Bot): Promise<void> {
    const url = config.telegram.miniAppUrl;
    if (!url) return;
    try {
      await bot.api.setChatMenuButton({
        menu_button: { type: "web_app", text: texts.menuButton, web_app: { url } },
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
