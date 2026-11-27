import { Inject, Injectable, Optional } from "@nestjs/common";

import { ApiException } from "../common/api-exception";
import { StateStore } from "../persistence/state-store";
import { OFFER_RU, OFFER_UZ } from "./offer-text";

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
  /** O'zbekcha matn (admin paneldan tahrirlanadi). */
  sections: RulesSection[];
  /**
   * Ruscha matn (Mini App rus tilida). Standart — ofertaning ruscha rasmiy matni; eski holat fayllarida
   * yo'q bo'lishi mumkin — unda ham shu standart.
   */
  sectionsRu?: RulesSection[];
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

/**
 * Boshlang'ich qoidalar — «OLIVIA» reklama aksiyasi ommaviy ofertasining rasmiy matni (25.11.2026,
 * `offer-text.ts`). Admin keyin paneldan tahrirlashi mumkin.
 */
const DEFAULT_SECTIONS: RulesSection[] = OFFER_UZ;

/** Bir martalik o'zgarish: saqlangan (eski) qoidalar ommaviy oferta matniga almashtiriladi. */
const OFFER_MIGRATION = "rules-public-offer-2026-11-27";

/**
 * Tanlov qoidalari — admin paneldan tahrirlanadi, Mini App'da ko'rsatiladi.
 * `StateStore` orqali diskka saqlanadi; Faza 1 da `contest_rules` jadvaliga ko'chadi.
 */
@Injectable()
export class RulesService {
  private rules: ContestRules = {
    version: 1,
    sections: DEFAULT_SECTIONS,
    sectionsRu: OFFER_RU,
    updatedAt: null,
    updatedBy: null,
  };

  /** Bir martalik o'zgarishlar (qayta bajarilmasin) — holat faylida saqlanadi. */
  private migrations: string[] = [];

  constructor(@Optional() @Inject(StateStore) store: StateStore | null = null) {
    const saved = store?.attach("rules", () => this.rules);
    if (saved) this.rules = saved;
    const done = store?.attach("rulesMigrations", () => this.migrations);
    if (done) this.migrations = done;
    this.migrate(saved !== null && saved !== undefined);
  }

  /**
   * 2026-11-27: qoidalar — ommaviy oferta matni (ikki tilda). Avval saqlangan qoidalar bir marta oferta
   * bilan almashtiriladi va versiya oshadi: oferta 2.3 bo'yicha barcha ishtirokchilar ofertani qabul
   * qiladi (Mini App'da qaytadan rozilik so'raladi). Yangi o'rnatishda — shunchaki standart.
   */
  private migrate(hadSaved: boolean): void {
    if (this.migrations.includes(OFFER_MIGRATION)) return;
    if (hadSaved) {
      this.rules = {
        version: this.rules.version + 1,
        sections: OFFER_UZ,
        sectionsRu: OFFER_RU,
        updatedAt: new Date().toISOString(),
        updatedBy: "Tizim (ommaviy oferta)",
      };
    }
    this.migrations.push(OFFER_MIGRATION);
  }

  get(): ContestRules {
    return this.rules;
  }

  /** Mini App uchun bo'limlar — tanlangan tilda (ruscha matn bo'lmasa — o'zbekcha). */
  sectionsFor(lang: "uz" | "ru"): RulesSection[] {
    return lang === "ru" ? (this.rules.sectionsRu ?? OFFER_RU) : this.rules.sections;
  }

  get version(): number {
    return this.rules.version;
  }

  update(sections: unknown, requireReconsent: boolean, actor: string): ContestRules {
    const clean = validateSections(sections);
    const changed = JSON.stringify(clean) !== JSON.stringify(this.rules.sections);
    if (!changed && !requireReconsent) return this.rules;
    this.rules = {
      ...this.rules,
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
