/**
 * MOCK backend: tanlov sozlamalari (TZ 6-bo'lim, `contest_settings` jadvali). Haqiqiy backendda:
 *   GET /api/v1/admin/settings
 *   PUT /api/v1/admin/settings
 */
import { ApiError } from "../api-error";
import { addDays, isIsoDate } from "../dates";
import type {
  AdminUser,
  ContestSettings,
  ContestSettingsResponse,
  ContestSettingsUpdate,
  IsoDate,
} from "../types";
import { getContestData } from "./contest";
import { auditId, readStore, writeStore, type MockStore } from "./store";

const DEFAULT_SYNC_TIME = "00:00";
/** Backend `DEFAULT_SYNC_EVERY_DAYS` — haftada bir marta. */
const DEFAULT_SYNC_EVERY_DAYS = 7;
const SYNC_EVERY_DAYS_RANGE = { min: 1, max: 30 } as const;
const DEFAULT_MIN_AGE = 18;
const SYNC_TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
/** Oferta 3.1: 18 yoshga to'lganlar. */
const MIN_AGE_RANGE = { min: 18, max: 100 } as const;

/**
 * Aksiya muddati — ommaviy oferta 2.5 (backend `contestDefaults` bilan bir xil): 27.11.2026 – 27.02.2027;
 * oylik bosqichlar shundan hisoblanadi (6.1.2). Grafiklar uchun soxta tarix (`getContestData`) alohida.
 */
const OFFER_STARTS_ON = "2026-11-27";
const OFFER_ENDS_ON = "2027-02-27";

/** Boshlang'ich qiymatlar + admin o'zgartirganlari. */
export function effectiveSettings(store: MockStore = readStore()): ContestSettings {
  const override = store.settings;
  return {
    startsOn: override?.startsOn ?? OFFER_STARTS_ON,
    endsOn: override?.endsOn ?? OFFER_ENDS_ON,
    syncTime: override?.syncTime ?? DEFAULT_SYNC_TIME,
    syncEveryDays: override?.syncEveryDays ?? DEFAULT_SYNC_EVERY_DAYS,
    minAge: override?.minAge ?? DEFAULT_MIN_AGE,
    updatedAt: override?.updatedAt ?? null,
    updatedBy: override?.updatedBy ?? null,
  };
}

/** Oxirgi yig'ish vaqti: bugungi yig'ish vaqti hali kelmagan bo'lsa — kechagi. */
export function lastSyncAt(today: IsoDate, syncTime: string, now: Date = new Date()): string {
  const todaySync = new Date(`${today}T${syncTime}:00+05:00`);
  const sync = todaySync.getTime() <= now.getTime() ? todaySync : new Date(`${addDays(today, -1)}T${syncTime}:00+05:00`);
  return sync.toISOString();
}

export function getContestSettings(): ContestSettingsResponse {
  const data = getContestData();
  const settings = effectiveSettings();
  return { settings, contestStarted: settings.startsOn <= data.today, today: data.today };
}

function validate(update: ContestSettingsUpdate, current: ContestSettings, today: IsoDate): ContestSettingsUpdate {
  if (!isIsoDate(update.startsOn) || !isIsoDate(update.endsOn)) {
    throw new ApiError(400, "Sana noto'g'ri formatda.");
  }
  if (update.startsOn !== current.startsOn && current.startsOn <= today) {
    throw new ApiError(400, "Tanlov boshlangan — boshlanish sanasini o'zgartirib bo'lmaydi.");
  }
  if (update.endsOn <= update.startsOn) {
    throw new ApiError(400, "Tugash sanasi boshlanish sanasidan keyin bo'lishi kerak.");
  }
  if (update.endsOn !== current.endsOn && update.endsOn < today) {
    throw new ApiError(400, "Tugash sanasini o'tgan kunga qo'yib bo'lmaydi.");
  }
  if (!SYNC_TIME_PATTERN.test(update.syncTime)) {
    throw new ApiError(400, "Yangilanish vaqti SS:DD ko'rinishida bo'lishi kerak.");
  }
  if (
    !Number.isInteger(update.syncEveryDays) ||
    update.syncEveryDays < SYNC_EVERY_DAYS_RANGE.min ||
    update.syncEveryDays > SYNC_EVERY_DAYS_RANGE.max
  ) {
    throw new ApiError(
      400,
      `Yangilanish davri ${SYNC_EVERY_DAYS_RANGE.min}–${SYNC_EVERY_DAYS_RANGE.max} kun oralig'ida bo'lishi kerak.`,
    );
  }
  if (
    !Number.isInteger(update.minAge) ||
    update.minAge < MIN_AGE_RANGE.min ||
    update.minAge > MIN_AGE_RANGE.max
  ) {
    throw new ApiError(400, `Minimal yosh ${MIN_AGE_RANGE.min}–${MIN_AGE_RANGE.max} oralig'ida bo'lishi kerak.`);
  }
  return update;
}

const FIELD_LABELS: Record<keyof ContestSettingsUpdate, string> = {
  startsOn: "boshlanish",
  endsOn: "tugash",
  syncTime: "yangilanish vaqti",
  syncEveryDays: "yangilanish davri (kun)",
  minAge: "minimal yosh",
};

export function updateContestSettings(update: ContestSettingsUpdate, actor: AdminUser): ContestSettingsResponse {
  const store = readStore();
  const current = effectiveSettings(store);
  const clean = validate(update, current, getContestData().today);

  const changed = (Object.keys(FIELD_LABELS) as Array<keyof ContestSettingsUpdate>).filter(
    (key) => clean[key] !== current[key],
  );
  if (changed.length === 0) {
    return getContestSettings();
  }

  const at = new Date().toISOString();
  /** Audit uchun faqat o'zgargan maydonlar. */
  const describe = (settings: ContestSettingsUpdate) =>
    changed.map((key) => `${FIELD_LABELS[key]}: ${settings[key]}`).join("; ");

  const nextStore: MockStore = {
    ...store,
    settings: { ...clean, updatedAt: at, updatedBy: actor.fullName },
    audit: [
      ...store.audit,
      {
        id: auditId(),
        at,
        actorId: actor.id,
        actorName: actor.fullName,
        action: "settings.update",
        entity: "settings",
        entityId: "contest",
        before: describe(current),
        after: describe(clean),
        reason: "",
      },
    ],
  };
  writeStore(nextStore);
  return getContestSettings();
}
