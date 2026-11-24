import { HttpException, Inject, Injectable, Optional } from "@nestjs/common";

import { addDays, contestDay, tashkentAt } from "../common/time";
import { config } from "../config/config";
import { contestDefaults } from "../miniapp/contest";
import { StateStore } from "../persistence/state-store";

/** `apps/admin/src/lib/types.ts` → ContestSettings bilan bir xil. */
export interface ContestSettings {
  startsOn: string;
  /** Oxirgi kun (shu kun ham kiradi). */
  endsOn: string;
  /** Ko'rishlar yig'iladigan vaqt, "HH:MM" (Toshkent). */
  syncTime: string;
  minAge: number;
  updatedAt: string | null;
  updatedBy: string | null;
}

export type ContestSettingsUpdate = Pick<ContestSettings, "startsOn" | "endsOn" | "syncTime" | "minAge">;

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const MIN_AGE_RANGE = { min: 14, max: 100 } as const;
const MAX_DURATION_DAYS = 366;

const fail = (message: string) => new HttpException({ message }, 422);
const isRealDay = (day: string) => DAY.test(day) && new Date(`${day}T00:00:00Z`).toISOString().startsWith(day);

/**
 * Tanlov muddati, ko'rishlar yig'iladigan vaqt va minimal yosh (TZ 6-bo'lim). Admin paneldan
 * tahrirlanadi; ko'rishlar yig'ish va target tekshiruvi jadvallari shu qiymatlarni har safar
 * shu yerdan o'qiydi. Tanlov boshlangach boshlanish sanasini o'zgartirib bo'lmaydi.
 */
@Injectable()
export class ContestSettingsService {
  private settings: ContestSettings = {
    startsOn: contestDefaults.startsOn,
    endsOn: contestDefaults.endsOn,
    syncTime: config.stats.syncTime,
    minAge: contestDefaults.minAge,
    updatedAt: null,
    updatedBy: null,
  };

  /** Bir martalik o'zgarishlar (qayta bajarilmasin) — holat faylida saqlanadi. */
  private migrations: string[] = [];

  constructor(@Optional() @Inject(StateStore) store: StateStore | null = null) {
    const saved = store?.attach("contestSettings", () => this.settings);
    if (saved) this.settings = saved;
    const done = store?.attach("contestSettingsMigrations", () => this.migrations);
    if (done) this.migrations = done;
    this.migrate();
    const error = validate(this.settings);
    if (error) throw new Error(`Tanlov sozlamalari noto'g'ri: ${error}`);
  }

  get(): ContestSettings {
    return this.settings;
  }

  /**
   * 2026-11-24: reyting har kuni yarim tunda (00:00) yangilanadi (tashkilotchi qarori). Avvalgi
   * standart 06:00 bo'lib saqlangan bo'lsa — bir marta 00:00 ga o'tkaziladi; admin boshqa vaqt
   * qo'ygan bo'lsa yoki keyin 06:00 ni o'zi tanlasa — tegilmaydi.
   */
  private migrate(): void {
    const id = "sync-time-midnight-2026-11-24";
    if (this.migrations.includes(id)) return;
    if (this.settings.syncTime === "06:00") {
      this.settings = { ...this.settings, syncTime: "00:00", updatedAt: new Date().toISOString(), updatedBy: "Tizim" };
    }
    this.migrations.push(id);
  }

  get prizeName(): string {
    return contestDefaults.prizeName;
  }

  /** Tanlov tugash vaqti: oxirgi kundan keyingi yarim tun (Toshkent). */
  get endsAt(): Date {
    return tashkentAt(addDays(this.settings.endsOn, 1), "00:00");
  }

  started(now: Date = new Date()): boolean {
    return contestDay(now) >= this.settings.startsOn;
  }

  update(input: ContestSettingsUpdate, actor: string, now: Date = new Date()): ContestSettings {
    const next: ContestSettings = { ...input, updatedAt: now.toISOString(), updatedBy: actor };
    const error = validate(next);
    if (error) throw fail(error);
    if (this.started(now) && next.startsOn !== this.settings.startsOn) {
      throw fail("Tanlov boshlangan — boshlanish sanasini o'zgartirib bo'lmaydi.");
    }
    if (!this.started(now) && next.startsOn < contestDay(now)) {
      throw fail("Boshlanish sanasi o'tgan kun bo'lishi mumkin emas.");
    }
    if (next.endsOn < contestDay(now)) throw fail("Tugash sanasi o'tib ketgan kun bo'lishi mumkin emas.");
    this.settings = next;
    return next;
  }
}

function validate(s: ContestSettingsUpdate): string | null {
  if (!isRealDay(s.startsOn) || !isRealDay(s.endsOn)) return "Sana YYYY-MM-DD ko'rinishida bo'lishi kerak.";
  if (s.endsOn <= s.startsOn) return "Tugash sanasi boshlanish sanasidan keyin bo'lishi kerak.";
  if (addDays(s.startsOn, MAX_DURATION_DAYS) < s.endsOn) return "Tanlov bir yildan uzun bo'lishi mumkin emas.";
  if (!TIME.test(s.syncTime)) return "Yig'ish vaqti HH:MM ko'rinishida bo'lishi kerak.";
  if (!Number.isInteger(s.minAge) || s.minAge < MIN_AGE_RANGE.min || s.minAge > MIN_AGE_RANGE.max) {
    return `Minimal yosh ${MIN_AGE_RANGE.min}–${MIN_AGE_RANGE.max} oralig'ida butun son bo'lishi kerak.`;
  }
  return null;
}
