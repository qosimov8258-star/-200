import { Inject, Injectable, Optional } from "@nestjs/common";

import { ApiException } from "../common/api-exception";
import { StateStore } from "../persistence/state-store";

export interface RulesSection {
  title: string;
  body: string;
}

export interface ContestRules {
  /**
   * Rozilik versiyasi. Faqat "muhim o'zgarish" belgilansa oshadi — shunda barcha
   * ishtirokchilar Mini App'da yangilangan qoidalarga qaytadan rozilik beradi.
   * Imlo xatosini tuzatish kabi kichik o'zgarishlarda versiya o'zgarmaydi.
   */
  version: number;
  sections: RulesSection[];
  updatedAt: string | null;
  updatedBy: string | null;
}

export const RULES_LIMITS = {
  minSections: 1,
  maxSections: 20,
  titleMin: 2,
  titleMax: 120,
  bodyMin: 5,
  bodyMax: 3000,
} as const;

/** Namunaviy matn — yakuniy qoidalar yurist tasdig'idan o'tgach admin paneldan kiritiladi. */
const DEFAULT_SECTIONS: RulesSection[] = [
  {
    title: "1. Ishtirok etish",
    body: "Tanlovda zavod mahsulotini sotib olgan, 18 yoshga to'lgan shaxslar qatnashadi. Bitta telefon raqami — bitta ishtirokchi.",
  },
  {
    title: "2. Video talablari",
    body: "Mahsulot haqidagi Reel o'z Instagram akkauntingizda joylanadi, ochiq bo'ladi va unda zavod akkaunti belgilanadi. Reel linki shu ilova orqali yuboriladi. Bitta Instagram akkaunt — bitta ishtirokchi.",
  },
  {
    title: "3. Taqiqlar",
    body: "Pullik reklama (target) va nakrutka (sotib olingan ko'rishlar, botlar) taqiqlanadi. Reyting yetakchilarining akkauntlari Meta reklama kutubxonasida muntazam tekshiriladi. Sovrin topshirilishidan oldin g'olib Instagram ilovasidagi \"Reklama vositalari\" bo'limini tashkilotchilarga ko'rsatadi. Boshqa ishtirokchining reklamasini ko'rsangiz, ilovadagi \"Reklamani ko'rdim\" bo'limi orqali skrinshot yuboring. Target yoki nakrutka aniqlansa, ishtirokchi tanlovdan chetlashtiriladi.",
  },
  {
    title: "4. G'olibni aniqlash",
    body: "Ko'rishlar har kuni avtomatik yig'iladi. Reytingda har bir qabul qilingan video alohida o'rin oladi; ishtirokchining natijasi — eng ko'p ko'rilgan videosi (videolar ko'rishlari qo'shilmaydi). Tanlov yakunida videosi eng ko'p ko'rilgan ishtirokchi tekshiruvdan so'ng g'olib deb e'lon qilinadi.",
  },
  {
    title: "5. Shaxsiy ma'lumotlar",
    body: "Ism va familiyangiz ommaviy reytingda ko'rsatiladi. Telefon raqamingiz boshqa ishtirokchilarga ko'rsatilmaydi.",
  },
];

/**
 * Tanlov qoidalari — admin paneldan tahrirlanadi, Mini App'da ko'rsatiladi.
 * `StateStore` orqali diskka saqlanadi; Faza 1 da `contest_rules` jadvaliga ko'chadi.
 */
@Injectable()
export class RulesService {
  private rules: ContestRules = {
    version: 1,
    sections: DEFAULT_SECTIONS,
    updatedAt: null,
    updatedBy: null,
  };

  constructor(@Optional() @Inject(StateStore) store: StateStore | null = null) {
    const saved = store?.attach("rules", () => this.rules);
    if (saved) this.rules = saved;
  }

  get(): ContestRules {
    return this.rules;
  }

  get version(): number {
    return this.rules.version;
  }

  update(sections: unknown, requireReconsent: boolean, actor: string): ContestRules {
    const clean = validateSections(sections);
    const changed = JSON.stringify(clean) !== JSON.stringify(this.rules.sections);
    if (!changed && !requireReconsent) return this.rules;
    this.rules = {
      version: requireReconsent ? this.rules.version + 1 : this.rules.version,
      sections: clean,
      updatedAt: new Date().toISOString(),
      updatedBy: actor,
    };
    return this.rules;
  }
}

export function validateSections(input: unknown): RulesSection[] {
  if (!Array.isArray(input)) throw new ApiException(400, "SERVER");
  if (input.length < RULES_LIMITS.minSections || input.length > RULES_LIMITS.maxSections) {
    throw new ApiException(422, "SERVER");
  }
  return input.map((raw) => {
    if (typeof raw !== "object" || raw === null) throw new ApiException(400, "SERVER");
    const keys = Object.keys(raw);
    if (keys.some((k) => k !== "title" && k !== "body")) throw new ApiException(400, "SERVER");
    const { title, body } = raw as { title?: unknown; body?: unknown };
    if (typeof title !== "string" || typeof body !== "string") throw new ApiException(400, "SERVER");
    const t = title.trim();
    const b = body.trim();
    if (
      t.length < RULES_LIMITS.titleMin ||
      t.length > RULES_LIMITS.titleMax ||
      b.length < RULES_LIMITS.bodyMin ||
      b.length > RULES_LIMITS.bodyMax
    ) {
      throw new ApiException(422, "SERVER");
    }
    return { title: t, body: b };
  });
}
