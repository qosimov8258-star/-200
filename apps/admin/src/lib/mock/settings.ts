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
const DEFAULT_MIN_AGE = 18;
const SYNC_TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const MIN_AGE_RANGE = { min: 14, max: 100 } as const;

/** Boshlang'ich qiymatlar + admin o'zgartirganlari. */
export function effectiveSettings(store: MockStore = readStore()): ContestSettings {
  const data = getContestData();
  const override = store.settings;
  return {
    startsOn: override?.startsOn ?? data.startsOn,
    endsOn: override?.endsOn ?? data.endsOn,
    syncTime: override?.syncTime ?? DEFAULT_SYNC_TIME,
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
