import { randomBytes } from "node:crypto";

import { Inject, Injectable, Optional } from "@nestjs/common";

import { StateStore } from "../persistence/state-store";
import { looksLikeVideo, MIN_STORY_BYTES, storyExtension, storyMimeOf, type StoryMime } from "../stories/story-file";

/** Qoida videosi ko'pi bilan 100 MB (tushuntirish videosi istoriyadan uzunroq bo'lishi mumkin). */
export const MAX_RULES_VIDEO_BYTES = 100 * 1024 * 1024;

/** Admin panel va Mini App (`apps/admin/src/lib/types.ts` → RulesVideo). */
export interface RulesVideo {
  /** Har yuklashda yangi — Mini App va brauzer keshi eskisini ko'rsatmasin. */
  id: string;
  mime: StoryMime;
  sizeBytes: number;
  updatedAt: string;
  updatedBy: string;
}

export type RulesVideoProblem = "TOO_LARGE" | "INVALID";

/** Videoni berish: diskdagi fayl (Range bilan) yoki xotiradagi nusxa (holat ombori yo'q — testlar). */
export type RulesVideoFile = { mime: StoryMime } & ({ path: string } | { data: Buffer });

const fileName = (v: Pick<RulesVideo, "id" | "mime">) => `rules-video-${v.id}.${storyExtension(v.mime)}`;

/**
 * Qoidalar videosi: admin paneldan yuklanadi (Sozlamalar → Tanlov qoidalari), Mini App'dagi
 * "Qoidalar" bo'limida eng tepada ko'rsatiladi. Bitta video; almashtirilsa eskisi o'chiriladi.
 * Ma'lumot `StateStore` da (`rulesVideo`), fayl — uning `files/` papkasida.
 */
@Injectable()
export class RulesVideoService {
  private video: RulesVideo | null = null;
  /** Holat ombori ulanmagan bo'lsa (testlar) — fayl xotirada. */
  private memory: Buffer | null = null;

  constructor(@Optional() @Inject(StateStore) private readonly store: StateStore | null = null) {
    const saved = store?.attach<RulesVideo | null>("rulesVideo", () => this.video);
    if (saved) this.video = saved;
  }

  get(): RulesVideo | null {
    return this.video;
  }

  /** Faylni tekshiradi: turi (`Content-Type`), hajmi va fayl boshidagi baytlar. */
  check(contentType: string | undefined, data: unknown): { mime: StoryMime; data: Buffer } | RulesVideoProblem {
    const mime = storyMimeOf(contentType);
    if (!mime || !Buffer.isBuffer(data)) return "INVALID";
    if (data.length > MAX_RULES_VIDEO_BYTES) return "TOO_LARGE";
    if (data.length < MIN_STORY_BYTES || !looksLikeVideo(data, mime)) return "INVALID";
    return { mime, data };
  }

  /** Yangi videoni saqlaydi (eskisi o'chiriladi). Fayl avval `check` dan o'tgan bo'lishi kerak. */
  set(file: { mime: StoryMime; data: Buffer }, actor: string, now = new Date()): RulesVideo {
    const previous = this.video;
    const video: RulesVideo = {
      id: randomBytes(12).toString("hex"),
      mime: file.mime,
      sizeBytes: file.data.length,
      updatedAt: now.toISOString(),
      updatedBy: actor,
    };
    if (this.store) this.store.putFile(fileName(video), file.data);
    else this.memory = file.data;
    this.video = video;
    if (previous && this.store) this.store.deleteFile(fileName(previous));
    return video;
  }

  /** Videoni o'chiradi; o'chirilganini qaytaradi (bo'lmasa — null). */
  remove(): RulesVideo | null {
    const previous = this.video;
    if (!previous) return null;
    if (this.store) this.store.deleteFile(fileName(previous));
    this.memory = null;
    this.video = null;
    return previous;
  }

  /** Joriy videoning fayli; `id` eskirgan yoki video yo'q — null. */
  file(id: string): RulesVideoFile | null {
    const video = this.video;
    if (!video || video.id !== id) return null;
    if (!this.store) return this.memory ? { mime: video.mime, data: this.memory } : null;
    const path = this.store.fileLocation(fileName(video));
    return path ? { mime: video.mime, path } : null;
  }
}
