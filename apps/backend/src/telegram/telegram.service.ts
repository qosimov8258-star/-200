import { Injectable, Logger, type OnApplicationBootstrap, type OnApplicationShutdown } from "@nestjs/common";
import { Bot, InlineKeyboard, Keyboard, type Context } from "grammy";

import { config } from "../config/config";
import { ParticipantsService } from "../participants/participants.service";
import type { SupportRelay } from "../support/support-relay";
import { SupportService } from "../support/support.service";
import type { ParticipantNotifier } from "./notifier";
import { texts } from "./texts";

/** Sayt botga shu parametr bilan yuboradi: `https://t.me/<bot>?start=web`. */
const WEB_START_PAYLOAD = "web";

/**
 * Telegram bot:
 * - /start — salomlashadi va raqam ulashishni so'raydi (yoki Mini App tugmasini beradi);
 * - raqam (kontakt) — faqat o'z raqami qabul qilinadi, keyin Mini App tugmasi;
 * - shaxsiy chatdagi boshqa har qanday xabar — support murojaati, operatorlar guruhiga boradi;
 * - operator guruhda ishtirokchi xabariga "Reply" qilsa — javob ishtirokchiga yetkaziladi.
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

    void this.configureMenuButton(bot);
    // `start` bot to'xtaguncha tugamaydi — kutmaymiz.
    void bot
      .start({
        onStart: (me) => this.logger.log(`Bot ishga tushdi: @${me.username}`),
        allowed_updates: ["message"],
      })
      .catch((err: Error) => this.logger.error(`Polling to'xtadi: ${err.message}`));
  }

  async onApplicationShutdown(): Promise<void> {
    await this.bot?.stop();
  }

  /** Ishtirokchiga bot orqali xabar (xabarnomalar, support javoblari). */
  async notify(chatId: number, text: string): Promise<void> {
    // Bot ishlamasa — xato: chaqiruvchi xabarni "yuborildi" deb hisoblamasin.
    if (!this.bot) throw new Error("Telegram bot ishga tushmagan");
    await this.bot.api.sendMessage(chatId, text);
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

  // -------------------------------------------------------------------------

  private register(bot: Bot): void {
    const supportChatId = config.telegram.supportChatId
      ? Number(config.telegram.supportChatId)
      : null;
    const isSupportChat = (ctx: Context) => supportChatId !== null && ctx.chat?.id === supportChatId;
    const isPrivate = (ctx: Context) => ctx.chat?.type === "private";

    bot.command("start", async (ctx) => {
      if (!isPrivate(ctx) || !ctx.from) return;
      const p = this.participants.getOrCreate(ctx.from.id);
      p.chatId = ctx.chat.id;
      // Saytdan "Botda raqamni ulashish" orqali kelgan: t.me/<bot>?start=web
      const fromWeb = ctx.match === WEB_START_PAYLOAD;
      if (fromWeb) this.webStarts.add(ctx.from.id);
      if (!p.phone) {
        await ctx.reply(fromWeb ? texts.welcomeFromWeb : texts.welcome, {
          reply_markup: this.contactKeyboard(),
        });
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
      if (result === "TAKEN") {
        await ctx.reply(texts.contactTaken, { reply_markup: { remove_keyboard: true } });
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
      const telegramId = this.support.ownerOfGroupMessage(replyTo);
      const participant = telegramId === null ? null : this.participants.get(telegramId);
      if (!participant?.chatId) {
        await ctx.reply(texts.operatorUnknownTarget, {
          reply_parameters: { message_id: ctx.message.message_id },
        });
        return;
      }
      this.support.addOperatorReply(participant.telegramId, text);
      await ctx.api.sendMessage(participant.chatId, texts.operatorPrefix + text);
      await ctx.reply(texts.operatorDelivered, {
        reply_parameters: { message_id: ctx.message.message_id },
      });
    });

    // Shaxsiy chatdagi qolgan xabarlar — support murojaati.
    bot.on("message", async (ctx) => {
      if (!isPrivate(ctx)) return;
      const p = this.participants.get(ctx.from.id);
      if (!p?.phone) {
        await ctx.reply(texts.supportNeedsContact, { reply_markup: this.contactKeyboard() });
        return;
      }
      const text = ctx.message.text ?? ctx.message.caption ?? "";
      const photo = ctx.message.photo?.at(-1)?.file_id ?? null;
      if (!text && !photo) return;
      const ticket = this.support.addParticipantMessage(p.telegramId, text, photo);

      if (supportChatId === null) {
        await ctx.reply(texts.supportUnavailable);
        return;
      }
      const name = p.firstName ? `${p.firstName} ${p.lastName}` : ctx.from.first_name;
      const header = `🆘 Murojaat #${ticket.id} — ${name}`;
      // Operator aynan shu xabarga "Reply" qiladi.
      const sent = photo
        ? await ctx.api.sendPhoto(supportChatId, photo, { caption: `${header}\n\n${text}`.trim() })
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
