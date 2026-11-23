/**
 * Istoriyalar: cheklovlar (backend bilan bir xil), faylni tekshirish va "ko'rilgan" belgilari.
 * Backend bilan aloqa — faqat `api.ts` da.
 */
import type { StoryGroup, StoryItem } from "./types";

/** Bitta video hajmi chegarasi — 50 MB (backend ham shuni tekshiradi). */
export const STORY_MAX_BYTES = 50 * 1024 * 1024;
/** Bir ishtirokchining faol istoriyalari chegarasi. */
export const STORY_MAX_ACTIVE = 10;

/** Backend qabul qiladigan turlar: MP4, iPhone .mov, WebM. */
export type StoryMime = "video/mp4" | "video/quicktime" | "video/webm";

const MIMES: ReadonlySet<string> = new Set<StoryMime>(["video/mp4", "video/quicktime", "video/webm"]);
const isStoryMime = (value: string): value is StoryMime => MIMES.has(value);

/** Fayl tanlash oynasi uchun (`<input accept>`): galereyadagi videolar ham ko'rinsin. */
export const STORY_ACCEPT = "video/mp4,video/quicktime,video/webm,video/*";

const BY_EXTENSION: Record<string, StoryMime> = {
  mp4: "video/mp4",
  m4v: "video/mp4",
  mov: "video/quicktime",
  qt: "video/quicktime",
  webm: "video/webm",
};

/**
 * Faylning yuboriladigan turi (`Content-Type`). Ba'zi Android fayl menejerlari turni bo'sh
 * beradi — shunda kengaytmaga qaraladi. Qo'llab-quvvatlanmasa — null.
 */
export function storyMime(file: File): StoryMime | null {
  const type = file.type.toLowerCase();
  if (isStoryMime(type)) return type;
  if (type === "video/x-m4v") return "video/mp4";
  if (type !== "" && type !== "application/octet-stream") return null;
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  return BY_EXTENSION[extension] ?? null;
}

export type StoryFileProblem = "type" | "size" | "empty";

/** Yuborishdan oldingi tekshiruv (server baribir o'zi ham tekshiradi). */
export function storyFileProblem(file: File): StoryFileProblem | null {
  if (!storyMime(file)) return "type";
  if (file.size === 0) return "empty";
  if (file.size > STORY_MAX_BYTES) return "size";
  return null;
}

/** Muddati o'tganlar chiqarib tashlanadi (sahifa uzoq ochiq tursa ham eskisi ko'rinmasin). */
export function activeGroups(groups: StoryGroup[], now = Date.now()): StoryGroup[] {
  return groups
    .map((group) => ({ ...group, stories: group.stories.filter((s) => Date.parse(s.expiresAt) > now) }))
    .filter((group) => group.stories.length > 0);
}

// --- "Ko'rilgan" belgilari (faqat shu brauzerda) ------------------------------

const SEEN_KEY = "reels-miniapp:stories-seen";

/** `authorKey/storyId` → istoriya o'chib ketadigan vaqt (ms); eskilari yozishda tozalanadi. */
export type SeenMap = Record<string, number>;

const seenKey = (authorKey: string, storyId: string) => `${authorKey}/${storyId}`;

export function loadSeen(): SeenMap {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: SeenMap = {};
    for (const [key, value] of Object.entries(parsed)) if (typeof value === "number") out[key] = value;
    return out;
  } catch {
    return {};
  }
}

/** Istoriyani ko'rilgan deb belgilaydi; yangi xarita qaytaradi (o'zgarmagan bo'lsa — o'sha). */
export function markSeen(seen: SeenMap, authorKey: string, story: StoryItem): SeenMap {
  const key = seenKey(authorKey, story.id);
  if (key in seen) return seen;
  const now = Date.now();
  const next: SeenMap = {};
  for (const [k, expires] of Object.entries(seen)) if (expires > now) next[k] = expires;
  next[key] = Date.parse(story.expiresAt) || now + 86_400_000;
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify(next));
  } catch {
    // Saqlab bo'lmasa (yashirin rejim, to'lgan xotira) — belgi faqat shu seansda qoladi.
  }
  return next;
}

export const isSeen = (seen: SeenMap, authorKey: string, story: StoryItem) =>
  seenKey(authorKey, story.id) in seen;

/** Guruhda hali ko'rilmagan istoriya bormi (aylana atrofidagi rangli halqa). */
export const hasUnseen = (seen: SeenMap, group: StoryGroup) =>
  group.stories.some((story) => !isSeen(seen, group.authorKey, story));

/** Guruh ochilganda shu istoriyadan boshlanadi: birinchi ko'rilmagani, hammasi ko'rilgan bo'lsa — birinchisi. */
export function firstUnseenIndex(seen: SeenMap, group: StoryGroup): number {
  const index = group.stories.findIndex((story) => !isSeen(seen, group.authorKey, story));
  return index === -1 ? 0 : index;
}
