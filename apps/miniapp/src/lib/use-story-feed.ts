import { useQuery } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";

import * as api from "./api";
import { activeGroups, hasUnseen, loadSeen, markSeen, type SeenMap } from "./stories";
import type { StoryGroup, StoryItem } from "./types";

/** Ro'yxat sahifa ochiq turganda ham yangilanib tursin (yangi istoriyalar, muddati tugaganlari). */
const REFRESH_MS = 2 * 60_000;

export interface StoryFeed {
  isPending: boolean;
  /** O'z istoriyalarim (bo'lmasa — null) — bosh sahifadagi avatar orqali ochiladi. */
  mine: StoryGroup | null;
  /** Boshqalar — qatordagi aylanalar: ko'rilmaganlari oldinda, server tartibi saqlanadi. */
  others: StoryGroup[];
  seen: SeenMap;
  onSeen: (authorKey: string, story: StoryItem) => void;
}

/** Bosh sahifadagi istoriyalar: ro'yxat (muddati o'tganlarsiz) va "ko'rilgan" belgilari. */
export function useStoryFeed(): StoryFeed {
  const stories = useQuery({ queryKey: ["stories"], queryFn: api.getStories, refetchInterval: REFRESH_MS });
  const [seen, setSeen] = useState<SeenMap>(loadSeen);

  const { mine, others } = useMemo(() => {
    const live = activeGroups(stories.data ?? []);
    const rest = live.filter((g) => !g.isMe);
    return {
      mine: live.find((g) => g.isMe) ?? null,
      others: [...rest.filter((g) => hasUnseen(seen, g)), ...rest.filter((g) => !hasUnseen(seen, g))],
    };
  }, [stories.data, seen]);

  const onSeen = useCallback((authorKey: string, story: StoryItem) => {
    setSeen((prev) => markSeen(prev, authorKey, story));
  }, []);

  return { isPending: stories.isPending, mine, others, seen, onSeen };
}
