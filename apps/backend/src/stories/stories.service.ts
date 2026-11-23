import { randomBytes } from "node:crypto";

import { Inject, Injectable, Logger, Optional, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";

import { ApiException } from "../common/api-exception";
import { ParticipantsService, type Participant } from "../participants/participants.service";
import { StateStore } from "../persistence/state-store";
import {
  looksLikeVideo,
  MAX_STORY_BYTES,
  MIN_STORY_BYTES,
  storyExtension,
  storyMimeOf,
  type StoryMime,
} from "./story-file";

/** Istoriya shuncha vaqt ko'rinadi (Instagram'dagidek — 24 soat), keyin fayli o'chiriladi. */
export const STORY_TTL_MS = 24 * 60 * 60 * 1000;
/** Bitta ishtirokchining bir vaqtda ko'pi bilan shuncha faol istoriyasi. */
export const MAX_ACTIVE_STORIES = 10;
/** Muddati o'tganlarni tozalash oralig'i. */
const CLEANUP_EVERY_MS = 10 * 60 * 1000;

export interface Story {
  id: string;
  telegramId: number;
  mime: StoryMime;
  sizeBytes: number;
  createdAt: Date;
  expiresAt: Date;
}

/** Mini App (`apps/miniapp/src/lib/types.ts` → StoryItem). */
export interface StoryItem {
  id: string;
  createdAt: string;
  expiresAt: string;
}

/** Bitta ishtirokchining istoriyalari (`apps/miniapp/src/lib/types.ts` → StoryGroup). */
export interface StoryGroup {
  /** Ishtirokchining doimiy, ochiq bo'lmagan kaliti (Telegram ID emas). */
  authorKey: string;
  fullName: string;
  isMe: boolean;
  /** Eskidan yangiga (ko'rsatish tartibi). */
  stories: StoryItem[];
}

/** Admin panel → Istoriyalar (`apps/admin/src/lib/types.ts` → AdminStoryItem). */
export interface AdminStoryItem {
  id: string;
  participant: { id: string; fullName: string; phone: string };
  createdAt: string;
  expiresAt: string;
  sizeBytes: number;
  mime: StoryMime;
}

/** Videoni berish: diskdagi fayl (Range bilan) yoki xotiradagi nusxa (holat ombori yo'q — testlar). */
export type StoryVideo = { mime: StoryMime } & ({ path: string } | { data: Buffer });

export const STORIES_OPTIONS = Symbol("STORIES_OPTIONS");

export interface StoriesOptions {
  clock?: () => Date;
}

interface SavedStories {
  stories: Story[];
  authorKeys: [number, string][];
}

const fileName = (story: Pick<Story, "id" | "mime">): string => `story-${story.id}.${storyExtension(story.mime)}`;

const fullNameOf = (p: Participant): string => `${p.firstName ?? ""} ${p.lastName ?? ""}`.trim();

/**
 * Ishtirokchilar istoriyalari (Instagram'dagidek): ro'yxatdan o'tgan faol ishtirokchi qisqa video
 * joylaydi, uni Mini App va saytni ochgan hamma (mehmonlar ham) 24 soat ko'radi. Tekshiruv yo'q,
 * reyting va sovrinlarga ta'sir qilmaydi. Admin istalgan istoriyani sabab bilan o'chiradi.
 *
 * Ro'yxat `StateStore` orqali diskka saqlanadi, video fayllar — uning `files/` papkasida.
 */
@Injectable()
export class StoriesService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(StoriesService.name);
  private readonly now: () => Date;
  private stories: Story[] = [];
  private authorKeys = new Map<number, string>();
  /** Holat ombori ulanmagan bo'lsa (testlar) — fayllar xotirada. */
  private readonly memoryFiles = new Map<string, Buffer>();
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly participants: ParticipantsService,
    @Optional() @Inject(StateStore) private readonly store: StateStore | null = null,
    @Optional() @Inject(STORIES_OPTIONS) options: StoriesOptions | null = null,
  ) {
    this.now = options?.clock ?? (() => new Date());
    const saved = store?.attach<SavedStories>("stories", () => ({
      stories: this.stories,
      authorKeys: [...this.authorKeys],
    }));
    if (saved) {
      this.stories = saved.stories;
      this.authorKeys = new Map(saved.authorKeys);
    }
  }

  onModuleInit(): void {
    this.cleanup();
    this.timer = setInterval(() => this.cleanup(), CLEANUP_EVERY_MS);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  /**
   * Mini App: faol istoriyalar ishtirokchilar bo'yicha. Avval o'zimniki, keyin boshqalar — eng
   * yangi istoriyasi bo'yicha (yangisi oldin). Bloklangan va chetlatilganlarniki ko'rinmaydi.
   */
  groups(viewerId: number | null): StoryGroup[] {
    const byAuthor = new Map<number, Story[]>();
    for (const story of this.visible()) {
      const list = byAuthor.get(story.telegramId) ?? [];
      list.push(story);
      byAuthor.set(story.telegramId, list);
    }
    const groups = [...byAuthor.entries()].flatMap(([telegramId, stories]) => {
      const p = this.participants.get(telegramId);
      if (!p) return [];
      const sorted = [...stories].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
      return [
        {
          latest: sorted[sorted.length - 1].createdAt.getTime(),
          group: {
            authorKey: this.authorKey(telegramId),
            fullName: fullNameOf(p),
            isMe: telegramId === viewerId,
            stories: sorted.map(toItem),
          },
        },
      ];
    });
    groups.sort((a, b) => Number(b.group.isMe) - Number(a.group.isMe) || b.latest - a.latest);
    return groups.map((g) => g.group);
  }

  /**
   * Yangi istoriya. `contentType` — so'rovning `Content-Type` sarlavhasi, `data` — fayl baytlari.
   * Xatolar: 403 UNAUTHORIZED, 413 STORY_TOO_LARGE, 422 STORY_INVALID_FILE, 429 STORY_LIMIT.
   */
  add(telegramId: number, contentType: string | undefined, data: unknown): Story {
    const p = this.participants.get(telegramId);
    if (!p || this.participants.stage(p) !== "ACTIVE") throw new ApiException(403, "UNAUTHORIZED");
    const mime = storyMimeOf(contentType);
    if (!mime || !Buffer.isBuffer(data)) throw new ApiException(422, "STORY_INVALID_FILE");
    if (data.length > MAX_STORY_BYTES) throw new ApiException(413, "STORY_TOO_LARGE");
    if (data.length < MIN_STORY_BYTES || !looksLikeVideo(data, mime)) {
      throw new ApiException(422, "STORY_INVALID_FILE");
    }
    const active = this.active().filter((s) => s.telegramId === telegramId).length;
    if (active >= MAX_ACTIVE_STORIES) throw new ApiException(429, "STORY_LIMIT");

    const createdAt = this.now();
    const story: Story = {
      id: randomBytes(12).toString("hex"),
      telegramId,
      mime,
      sizeBytes: data.length,
      createdAt,
      expiresAt: new Date(createdAt.getTime() + STORY_TTL_MS),
    };
    if (this.store) this.store.putFile(fileName(story), data);
    else this.memoryFiles.set(story.id, data);
    this.authorKey(telegramId);
    this.stories.push(story);
    return story;
  }

  /** Ishtirokchi o'z istoriyasini o'chiradi; boshqaniki yoki yo'q — 404 NOT_FOUND. */
  removeOwn(telegramId: number, id: string): void {
    const story = this.active().find((s) => s.id === id && s.telegramId === telegramId);
    if (!story) throw new ApiException(404, "NOT_FOUND");
    this.drop(story);
  }

  /** Video fayli (Mini App va admin `<video>` uchun); muddati o'tgan yoki o'chirilgan — null. */
  video(id: string): StoryVideo | null {
    const story = this.visible().find((s) => s.id === id);
    if (!story) return null;
    if (!this.store) {
      const data = this.memoryFiles.get(story.id);
      return data ? { mime: story.mime, data } : null;
    }
    const path = this.store.fileLocation(fileName(story));
    return path ? { mime: story.mime, path } : null;
  }

  /** Admin: barcha faol istoriyalar (bloklanganlarniki ham), eng yangisi birinchi. */
  adminList(): AdminStoryItem[] {
    return [...this.active()]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map((s) => {
        const p = this.participants.get(s.telegramId);
        return {
          id: s.id,
          participant: { id: String(s.telegramId), fullName: p ? fullNameOf(p) : "", phone: p?.phone ?? "" },
          createdAt: s.createdAt.toISOString(),
          expiresAt: s.expiresAt.toISOString(),
          sizeBytes: s.sizeBytes,
          mime: s.mime,
        };
      });
  }

  /** Admin o'chiradi (audit — controller'da). Faol istoriya topilmasa — null. */
  adminRemove(id: string): { story: Story; fullName: string } | null {
    const story = this.active().find((s) => s.id === id);
    if (!story) return null;
    this.drop(story);
    const p = this.participants.get(story.telegramId);
    return { story, fullName: p ? fullNameOf(p) : "" };
  }

  /** Muddati o'tgan istoriyalar va ularning fayllari o'chiriladi. */
  cleanup(): number {
    const now = this.now().getTime();
    const expired = this.stories.filter((s) => s.expiresAt.getTime() <= now);
    for (const story of expired) this.drop(story);
    if (expired.length > 0) this.logger.log(`${expired.length} ta muddati o'tgan istoriya o'chirildi.`);
    return expired.length;
  }

  /** Muddati o'tmagan istoriyalar. */
  private active(): Story[] {
    const now = this.now().getTime();
    return this.stories.filter((s) => s.expiresAt.getTime() > now);
  }

  /** Hammaga ko'rinadiganlar: muddati o'tmagan va muallifi faol (bloklanmagan, chetlatilmagan). */
  private visible(): Story[] {
    return this.active().filter((s) => this.participants.get(s.telegramId)?.status === "ACTIVE");
  }

  private drop(story: Story): void {
    this.stories = this.stories.filter((s) => s !== story);
    if (this.store) this.store.deleteFile(fileName(story));
    else this.memoryFiles.delete(story.id);
  }

  private authorKey(telegramId: number): string {
    let key = this.authorKeys.get(telegramId);
    if (!key) {
      key = randomBytes(8).toString("hex");
      this.authorKeys.set(telegramId, key);
    }
    return key;
  }
}

const toItem = (s: Story): StoryItem => ({
  id: s.id,
  createdAt: s.createdAt.toISOString(),
  expiresAt: s.expiresAt.toISOString(),
});
