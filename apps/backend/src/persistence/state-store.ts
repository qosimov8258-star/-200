import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";

import { Inject, Injectable, Logger, Optional, type OnApplicationShutdown, type OnModuleInit } from "@nestjs/common";

import { contestDay } from "../common/time";
import { decodeState, encodeState } from "./state-codec";

export interface StateStoreOptions {
  /** Holat fayli, zaxiralar va fayllar (skrinshotlar) shu papkada. */
  dir: string;
  /** Necha millisoniyada bir o'zgarishlar diskka yoziladi. */
  saveEveryMs: number;
  /** Nechta kunlik zaxira nusxa saqlanadi (eskilari o'chiriladi). */
  keepBackups: number;
  clock?: () => Date;
}

export const STATE_STORE_OPTIONS = Symbol("STATE_STORE_OPTIONS");

const STATE_FILE = "state.json";
const BACKUP_DIR = "backups";
const BLOB_DIR = "files";
const FORMAT_VERSION = 1;
const BLOB_NAME = /^[A-Za-z0-9._-]{1,120}$/;
const BOOT_BACKUPS = 10;

interface StateFile {
  version: number;
  savedAt: Date;
  parts: Record<string, unknown>;
}

function isStateFile(value: unknown): value is StateFile {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return v.version === FORMAT_VERSION && typeof v.parts === "object" && v.parts !== null;
}

/**
 * Backend holatini diskda saqlash (ma'lumotlar bazasi ulanguncha).
 *
 * Har bir servis konstruktorida `attach(kalit, dump)` chaqiradi: oldin saqlangan qismini oladi
 * (bo'lmasa — null) va o'z holatini qaytaruvchi funksiyani ro'yxatga qo'yadi. Har `saveEveryMs`
 * da hamma qismlar bitta JSON faylga yoziladi — faqat nimadir o'zgargan bo'lsa, vaqtinchalik
 * faylga yozib, so'ng nomini almashtirib (yarim yozilgan fayl qolmaydi). Server to'xtaganda ham
 * (deploy, `docker stop`) oxirgi holat yoziladi.
 *
 * Zaxira: ishga tushganda va har kuni birinchi yozishdan oldin oldingi fayl `backups/` ga
 * ko'chiriladi. Fayl buzilgan bo'lsa — eng yangi zaxiradan o'qiladi; ikkalasi ham bo'lmasa server
 * ishga tushmaydi (bo'sh holat bilan ishlab, yaxshi ma'lumotni ustidan yozib yubormaslik uchun).
 *
 * Katta fayllar (shikoyat skrinshotlari) JSON ichida emas — `files/` papkasida alohida.
 */
@Injectable()
export class StateStore implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(StateStore.name);
  private readonly dir: string;
  private readonly options: StateStoreOptions;
  private readonly now: () => Date;
  private readonly loaded: Record<string, unknown>;
  private readonly dumps = new Map<string, () => unknown>();
  private lastWritten: string | null = null;
  private lastBackupDay: string | null = null;
  private timer: NodeJS.Timeout | null = null;

  constructor(@Optional() @Inject(STATE_STORE_OPTIONS) options: StateStoreOptions | null = null) {
    this.options = options ?? { dir: "data", saveEveryMs: 5_000, keepBackups: 30 };
    this.dir = resolve(this.options.dir);
    this.now = this.options.clock ?? (() => new Date());
    mkdirSync(join(this.dir, BACKUP_DIR), { recursive: true });
    mkdirSync(join(this.dir, BLOB_DIR), { recursive: true });
    this.loaded = this.read();
  }

  /** Saqlangan qismni qaytaradi (bo'lmasa — null) va `dump` ni keyingi yozishlar uchun ro'yxatga oladi. */
  attach<T>(key: string, dump: () => T): T | null {
    if (this.dumps.has(key)) throw new Error(`StateStore: "${key}" kaliti ikki marta ulangan`);
    this.dumps.set(key, dump);
    // Fayl bizniki va versiyali — tuzilishi `dump` qaytargani bilan bir xil.
    return (this.loaded[key] as T | undefined) ?? null;
  }

  onModuleInit(): void {
    const keys = Object.keys(this.loaded);
    this.logger.log(
      keys.length > 0
        ? `Holat o'qildi: ${join(this.dir, STATE_FILE)} (${keys.join(", ")}).`
        : `Saqlangan holat yo'q — yangi holat ${join(this.dir, STATE_FILE)} ga yoziladi.`,
    );
    this.timer = setInterval(() => this.flush(), this.options.saveEveryMs);
    this.timer.unref();
  }

  onApplicationShutdown(): void {
    if (this.timer) clearInterval(this.timer);
    this.flush();
  }

  /** O'zgarish bo'lsa — hoziroq diskka yozadi. */
  flush(): void {
    const parts: Record<string, unknown> = {};
    for (const [key, dump] of this.dumps) parts[key] = dump();
    const body = encodeState(parts);
    if (body === this.lastWritten) return;
    try {
      this.backupOncePerDay();
      // `parts` allaqachon kodlangan — faylni qo'lda yig'amiz, ikki marta kodlamaslik uchun.
      const text = `{"version":${FORMAT_VERSION},"savedAt":${encodeState(this.now())},"parts":${body}}`;
      const target = join(this.dir, STATE_FILE);
      const tmp = `${target}.tmp`;
      writeFileSync(tmp, text);
      renameSync(tmp, target);
      this.lastWritten = body;
    } catch (err) {
      this.logger.error(`Holatni diskka yozib bo'lmadi: ${(err as Error).message}`);
    }
  }

  // --- Fayllar (skrinshotlar) ---------------------------------------------------

  putFile(name: string, data: Buffer): void {
    const path = this.filePath(name);
    writeFileSync(`${path}.tmp`, data);
    renameSync(`${path}.tmp`, path);
  }

  getFile(name: string): Buffer | null {
    const path = this.filePath(name);
    return existsSync(path) ? readFileSync(path) : null;
  }

  private filePath(name: string): string {
    if (!BLOB_NAME.test(name)) throw new Error(`Fayl nomi noto'g'ri: ${name}`);
    return join(this.dir, BLOB_DIR, name);
  }

  // -------------------------------------------------------------------------

  private read(): Record<string, unknown> {
    const target = join(this.dir, STATE_FILE);
    if (!existsSync(target)) return {};
    const parsed = this.parse(target);
    if (parsed) {
      this.copyToBackups(target, "boot");
      this.lastBackupDay = contestDay(this.now());
      return parsed.parts;
    }
    // Asosiy fayl buzilgan: nusxasini chetga olib, eng yangi zaxiradan o'qiymiz.
    const broken = join(this.dir, `state.broken-${stamp(this.now())}.json`);
    copyFileSync(target, broken);
    for (const backup of this.backups()) {
      const fromBackup = this.parse(join(this.dir, BACKUP_DIR, backup));
      if (fromBackup) {
        this.logger.error(`${STATE_FILE} buzilgan (nusxasi: ${broken}) — zaxiradan o'qildi: ${backup}.`);
        return fromBackup.parts;
      }
    }
    throw new Error(
      `${target} buzilgan va yaroqli zaxira topilmadi. Bo'sh holat bilan ishga tushirilmaydi — faylni tekshiring.`,
    );
  }

  private parse(path: string): StateFile | null {
    try {
      const value = decodeState(readFileSync(path, "utf8"));
      return isStateFile(value) ? value : null;
    } catch {
      return null;
    }
  }

  private backupOncePerDay(): void {
    const day = contestDay(this.now());
    if (this.lastBackupDay === day) return;
    const target = join(this.dir, STATE_FILE);
    if (existsSync(target)) this.copyToBackups(target, "daily");
    this.lastBackupDay = day;
  }

  private copyToBackups(source: string, kind: "boot" | "daily"): void {
    try {
      copyFileSync(source, join(this.dir, BACKUP_DIR, `state-${stamp(this.now())}-${kind}.json`));
      // Kunlik nusxalar `keepBackups` ta, ishga tushishdagilar (har deploy) — 10 ta.
      const limit = kind === "daily" ? this.options.keepBackups : BOOT_BACKUPS;
      const sameKind = this.backups().filter((name) => name.endsWith(`-${kind}.json`));
      for (const old of sameKind.slice(limit)) rmSync(join(this.dir, BACKUP_DIR, old), { force: true });
    } catch (err) {
      this.logger.warn(`Zaxira nusxa olinmadi: ${(err as Error).message}`);
    }
  }

  /** Zaxiralar — eng yangisi birinchi (nomida vaqt bor). */
  private backups(): string[] {
    return readdirSync(join(this.dir, BACKUP_DIR))
      .filter((name) => name.startsWith("state-") && name.endsWith(".json"))
      .sort((a, b) => b.localeCompare(a));
  }
}

/** Fayl nomi uchun vaqt: 2026-11-20T08-15-03-120Z. */
const stamp = (at: Date): string => at.toISOString().replace(/[:.]/g, "-");
