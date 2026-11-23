/**
 * MOCK backend: ishtirokchilar istoriyalari — Mini App'dan yuklangan qisqa videolar, 24 soat
 * turadi. Haqiqiy backendda:
 *   GET  /api/v1/admin/stories?page=&pageSize=
 *   POST /api/v1/admin/stories/:id/remove
 *   GET  /api/v1/miniapp/stories/:id/video
 *
 * Istoriyalar sahifa ochilgan vaqtga nisbatan generatsiya qilinadi (oxirgi 24 soat ichida
 * yuklangan, shuning uchun sahifa ochiq tursa, ba'zilarining muddati tugab, ro'yxatdan
 * tushadi). Id lar barqaror — Admin o'chirganlari `store.ts` da saqlanadi. Bloklangan va
 * diskvalifikatsiya qilinganlarning istoriyalari ko'rinmaydi (backend ham shunday).
 * Videolar o'rniga `public/mock/stories/` dagi kichik namunaviy kliplar ko'rsatiladi.
 */
import { ApiError } from "../api-error";
import type { AdminStoryItem, AdminStoryListQuery, AdminStoryListResponse, AdminUser } from "../types";
import { getContestData, type MockParticipant } from "./contest";
import { createRandom, hashString } from "./random";
import { effectiveStatus, isRankable } from "./ranking";
import { auditId, readStore, writeStore, type MockStore } from "./store";

const DEFAULT_PAGE_SIZE = 12;
const MAX_PAGE_SIZE = 100;
const MIN_REASON_LENGTH = 5;
const MAX_REASON_LENGTH = 500;

/** Istoriya umri (kontrakt: `expiresAt = createdAt + 24h`). */
const STORY_TTL_MS = 24 * 60 * 60 * 1000;
/** Istoriya yuklagan mock ishtirokchilar soni (har birida 1–3 ta). */
const AUTHOR_COUNT = 8;
/** `public/mock/stories/story-N.mp4` — namunaviy kliplar soni. */
const SAMPLE_CLIP_COUNT = 3;

interface MockStory {
  id: string;
  participant: MockParticipant;
  /** Sahifa ochilgan vaqtdan necha millisekund oldin yuklangan. */
  ageMs: number;
  sizeBytes: number;
  mime: string;
}

/**
 * Mock istoriyalar vaqti shu "ochilish" vaqtiga bog'lanadi — sahifa ochiq turganda istoriyalar
 * tabiiy qariydi, sahifa yangilansa yana oxirgi 24 soat ichida bo'ladi.
 */
let anchorMs: number | null = null;
let cachedStories: MockStory[] | null = null;

function anchor(): number {
  anchorMs ??= Date.now();
  return anchorMs;
}

function generateStories(): MockStory[] {
  if (cachedStories) return cachedStories;

  const random = createRandom(hashString("mock-stories"));
  const participants = getContestData().participants;
  const authors = new Set<MockParticipant>();
  while (authors.size < Math.min(AUTHOR_COUNT, participants.length)) {
    authors.add(random.pick(participants));
  }

  const stories: MockStory[] = [];
  for (const participant of authors) {
    const count = random.int(1, 3);
    for (let index = 1; index <= count; index++) {
      // 3 daqiqadan 23 soat 55 daqiqagacha oldin yuklangan.
      const ageMinutes = random.int(3, 24 * 60 - 5);
      const mimeRoll = random.next();
      stories.push({
        id: `st_${participant.id}_${index}`,
        participant,
        ageMs: ageMinutes * 60_000,
        // 0,6–48 MB (cheklov — 50 MB).
        sizeBytes: random.int(600 * 1024, 48 * 1024 * 1024),
        mime: mimeRoll < 0.6 ? "video/mp4" : mimeRoll < 0.9 ? "video/quicktime" : "video/webm",
      });
    }
  }

  cachedStories = stories;
  return stories;
}

function toItem(story: MockStory): AdminStoryItem {
  const created = anchor() - story.ageMs;
  return {
    id: story.id,
    participant: {
      id: story.participant.id,
      fullName: `${story.participant.firstName} ${story.participant.lastName}`,
      phone: story.participant.phone,
    },
    createdAt: new Date(created).toISOString(),
    expiresAt: new Date(created + STORY_TTL_MS).toISOString(),
    sizeBytes: story.sizeBytes,
    mime: story.mime,
  };
}

/** Faol istoriyalar: muddati tugamagan, Admin o'chirmagan, egasi bloklanmagan. */
function activeStories(store: MockStore, now: number): AdminStoryItem[] {
  return generateStories()
    .filter((story) => !store.removedStories[story.id])
    .filter((story) => isRankable(effectiveStatus(story.participant, store)))
    .map(toItem)
    .filter((item) => Date.parse(item.expiresAt) > now);
}

export function listStories(query: AdminStoryListQuery): AdminStoryListResponse {
  const now = Date.now();
  const items = activeStories(readStore(), now)
    // Eng yangilari yuqorida.
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));

  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, query.pageSize ?? DEFAULT_PAGE_SIZE));
  const lastPage = Math.max(1, Math.ceil(items.length / pageSize));
  const page = Math.min(lastPage, Math.max(1, query.page ?? 1));

  return {
    items: items.slice((page - 1) * pageSize, page * pageSize),
    total: items.length,
    page,
    pageSize,
  };
}

export function removeStory(id: string, reason: string, actor: AdminUser): void {
  const trimmedReason = reason.trim();
  if (trimmedReason.length < MIN_REASON_LENGTH || trimmedReason.length > MAX_REASON_LENGTH) {
    throw new ApiError(400, `Sababni yozing (${MIN_REASON_LENGTH}–${MAX_REASON_LENGTH} ta belgi).`);
  }

  const store = readStore();
  const story = activeStories(store, Date.now()).find((item) => item.id === id);
  if (!story) {
    throw new ApiError(404, "Istoriya topilmadi: muddati tugagan yoki allaqachon o'chirilgan.");
  }

  const at = new Date().toISOString();
  writeStore({
    ...store,
    removedStories: {
      ...store.removedStories,
      [id]: { participantId: story.participant.id, reason: trimmedReason, at, by: actor.id },
    },
    audit: [
      ...store.audit,
      {
        id: auditId(),
        at,
        actorId: actor.id,
        actorName: actor.fullName,
        action: "story.remove",
        entity: "story",
        entityId: id,
        // Backend ham shunday yozadi (`admin-stories.controller.ts`).
        before: "Faol",
        after: "O'chirilgan",
        reason: trimmedReason,
      },
    ],
  });
}

/** Audit logdagi nom uchun: istoriya egasining id si (o'chirilgan bo'lsa ham). */
export function storyParticipantId(id: string): string | null {
  return generateStories().find((story) => story.id === id)?.participant.id ?? null;
}

/**
 * Namunaviy klip manzili (`public/mock/stories/`). `public` fayllariga `basePath` (`/admin`)
 * o'zi qo'shilmaydi — `next.config.ts` uni `NEXT_PUBLIC_BASE_PATH` sifatida beradi.
 */
export function mockStoryVideoPath(id: string): string {
  const clip = (hashString(id) % SAMPLE_CLIP_COUNT) + 1;
  return `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/mock/stories/story-${clip}.mp4`;
}
