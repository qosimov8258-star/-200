/**
 * Istoriya yuklanishi holati — komponentdan tashqarida: foydalanuvchi yuklanish paytida boshqa
 * bo'limga o'tib qaytsa ham foiz va xato yo'qolmaydi (katta video telefonda bir necha daqiqa
 * yuklanishi mumkin). Bir vaqtda faqat bitta yuklanish.
 */
import type { QueryClient } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";

import { t } from "../i18n/uz";
import * as api from "./api";
import { errorCode } from "./api-error";
import type { ApiErrorCode, StoryGroup } from "./types";

export type StoryUploadState =
  | { status: "idle" }
  /** `progress` — 0..1. */
  | { status: "uploading"; progress: number }
  | { status: "error"; message: string };

const IDLE: StoryUploadState = { status: "idle" };

let current: StoryUploadState = IDLE;
const listeners = new Set<() => void>();

function set(next: StoryUploadState): void {
  current = next;
  for (const listener of listeners) listener();
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const useStoryUpload = (): StoryUploadState => useSyncExternalStore(subscribe, () => current);

/** Server xato kodi → ekrandagi matn. */
export function storyErrorText(code: ApiErrorCode): string {
  switch (code) {
    case "STORY_TOO_LARGE":
      return t.storyErrorSize;
    case "STORY_INVALID_FILE":
      return t.storyErrorInvalid;
    case "STORY_LIMIT":
      return t.storyErrorLimit;
    case "UNAUTHORIZED":
      return t.storyErrorUnauthorized;
    default:
      return t.storyErrorNetwork;
  }
}

/** Mijoz tomonidagi tekshiruv xatosi (yuborilmagan fayl) yoki boshqa ogohlantirish. */
export const showStoryUploadError = (message: string) => set({ status: "error", message });

export const dismissStoryUploadError = () => {
  if (current.status === "error") set(IDLE);
};

/**
 * Videoni yuklaydi va istoriyalar ro'yxatini (`["stories"]`) server javobi bilan yangilaydi.
 * Natija: true — joylandi; false — xato (matni holatda) yoki boshqa yuklanish davom etmoqda.
 */
export async function startStoryUpload(file: File, queryClient: QueryClient): Promise<boolean> {
  if (current.status === "uploading") return false;
  set({ status: "uploading", progress: 0 });
  try {
    const groups = await api.uploadStory(file, (progress) => {
      if (current.status === "uploading") set({ status: "uploading", progress });
    });
    queryClient.setQueryData<StoryGroup[]>(["stories"], groups);
    set(IDLE);
    return true;
  } catch (e) {
    set({ status: "error", message: storyErrorText(errorCode(e)) });
    return false;
  }
}
