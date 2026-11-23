import { useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { Plus, X } from "lucide-react";
import { useRef, type ChangeEvent } from "react";

import { t } from "../i18n/uz";
import { displayName } from "../lib/format";
import { STORY_ACCEPT, STORY_MAX_ACTIVE, hasUnseen, storyFileProblem, type StoryFileProblem } from "../lib/stories";
import {
  dismissStoryUploadError,
  showStoryUploadError,
  startStoryUpload,
  useStoryUpload,
} from "../lib/story-upload";
import { haptic } from "../lib/telegram";
import type { StoryGroup } from "../lib/types";
import type { StoryFeed } from "../lib/use-story-feed";
import { StoryAvatar } from "./StoryAvatar";
import { useToast } from "./toast-context";

const PROBLEM_TEXT: Record<StoryFileProblem, string> = {
  type: t.storyErrorType,
  size: t.storyErrorSize,
  empty: t.storyErrorInvalid,
};

/** Aylana o'lchami (halqa bilan): 58 + 2 × 2,5 (oq oraliq) + 2 × 2,5 (halqa). */
const CIRCLE = 68;

/**
 * Bosh sahifadagi istoriyalar qatori (Instagram kabi): birinchi — "Istoriya qo'shish"
 * (faqat ro'yxatdan o'tgan faol ishtirokchiga), keyin boshqa ishtirokchilar — ko'rilmaganlari
 * oldinda, rangli halqa bilan. O'z istoriyalarim bu qatorda emas — ular salomlashuvdagi avatar
 * orqali ochiladi. Mehmon ham ko'radi, lekin joylay olmaydi. Ko'ruvchi — `HomeScreen` da.
 */
export function StoriesBar({
  canPost,
  feed,
  onOpen,
}: {
  canPost: boolean;
  feed: StoryFeed;
  /** `feed.others` dagi aylana bosildi. */
  onOpen: (index: number) => void;
}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const upload = useStoryUpload();
  const inputRef = useRef<HTMLInputElement>(null);

  const myCount = feed.mine?.stories.length ?? 0;
  const uploading = upload.status === "uploading";

  const pick = () => {
    if (uploading) {
      toast(t.storyBusy);
      return;
    }
    if (myCount >= STORY_MAX_ACTIVE) {
      haptic.error();
      showStoryUploadError(t.storyErrorLimit);
      return;
    }
    dismissStoryUploadError();
    haptic.tap();
    inputRef.current?.click();
  };

  const onFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Bir xil faylni qayta tanlash ham `change` bersin.
    e.target.value = "";
    if (!file) return;
    const problem = storyFileProblem(file);
    if (problem) {
      haptic.error();
      showStoryUploadError(PROBLEM_TEXT[problem]);
      return;
    }
    void startStoryUpload(file, queryClient).then((ok) => {
      if (ok) {
        haptic.success();
        toast(t.storyUploaded);
      } else haptic.error();
    });
  };

  // Mehmon va boshqalarning istoriyasi yo'q — qator umuman ko'rinmaydi.
  if (!canPost && feed.others.length === 0) return null;

  return (
    <section aria-label={t.storiesLabel} className="-mx-5">
      <ul className="flex items-start gap-2 overflow-x-auto px-4 pt-0.5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {canPost && (
          <li className="shrink-0">
            <AddStoryButton progress={upload.status === "uploading" ? upload.progress : null} onClick={pick} />
          </li>
        )}
        {feed.isPending
          ? [0, 1, 2, 3].map((i) => (
              <li key={i} className="flex w-[76px] shrink-0 flex-col items-center gap-1.5" aria-hidden>
                <span className="block animate-pulse rounded-full bg-line" style={{ width: CIRCLE, height: CIRCLE }} />
                <span className="block h-2.5 w-12 animate-pulse rounded-full bg-line" />
              </li>
            ))
          : feed.others.map((group, index) => (
              <li key={group.authorKey} className="shrink-0">
                <StoryCircle
                  group={group}
                  unseen={hasUnseen(feed.seen, group)}
                  onOpen={() => {
                    haptic.tap();
                    onOpen(index);
                  }}
                />
              </li>
            ))}
        {canPost && !feed.isPending && feed.others.length === 0 && !feed.mine && (
          <li className="max-w-[230px] shrink-0 self-center pr-4 text-[13px] leading-snug text-muted">{t.storyAddHint}</li>
        )}
      </ul>

      {upload.status === "error" && (
        <div
          role="alert"
          className="mx-5 mt-2 flex animate-rise items-start gap-2 rounded-[16px] bg-[#fdecea] py-2.5 pr-2 pl-3.5 text-[13.5px] leading-snug text-[#c22a24]"
        >
          <p className="min-w-0 flex-1">{upload.message}</p>
          <button
            type="button"
            aria-label={t.storyDismiss}
            title={t.storyDismiss}
            onClick={dismissStoryUploadError}
            className="-my-1 grid size-7 shrink-0 place-items-center rounded-full transition active:bg-[#df3425]/10"
          >
            <X className="size-4" />
          </button>
        </div>
      )}

      {canPost && (
        <input ref={inputRef} type="file" accept={STORY_ACCEPT} className="hidden" onChange={onFile} tabIndex={-1} />
      )}
    </section>
  );
}

/** Muallif aylanasi: ko'rilmagan istoriya bo'lsa — brend ranglaridagi halqa, aks holda kulrang. */
function StoryCircle({ group, unseen, onOpen }: { group: StoryGroup; unseen: boolean; onOpen: () => void }) {
  const name = displayName(group.fullName);
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={t.storyViewerLabel(name)}
      className="flex w-[76px] flex-col items-center gap-1.5 transition active:scale-95"
    >
      <span
        className={clsx(
          "block rounded-full p-[2.5px]",
          unseen
            ? "bg-[conic-gradient(from_200deg,#f3c656,#f2583f,#df3425,#e2457a,#f3c656)] shadow-[0_6px_16px_-8px_rgba(223,52,37,0.7)]"
            : "bg-[#cfd2d8]",
        )}
      >
        <span className="block rounded-full bg-bg p-[2.5px]">
          <StoryAvatar name={group.fullName} seed={group.authorKey} size={58} />
        </span>
      </span>
      <span className={clsx("w-full truncate text-center text-[12px] leading-tight", unseen ? "font-semibold" : "text-ink/70")}>
        {name.split(" ")[0]}
      </span>
    </button>
  );
}

/** "Istoriya qo'shish": oq aylana, o'rtada qizil "+"; yuklanayotganda — foiz va to'layotgan halqa. */
function AddStoryButton({ progress, onClick }: { progress: number | null; onClick: () => void }) {
  const percent = progress === null ? 0 : Math.round(progress * 100);
  const radius = CIRCLE / 2 - 2;
  const length = 2 * Math.PI * radius;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={progress === null ? t.storyAdd : t.storyUploadingAria(percent)}
      aria-busy={progress !== null}
      className="flex w-[76px] flex-col items-center gap-1.5 transition active:scale-95"
    >
      <span
        className="relative grid place-items-center rounded-full bg-surface shadow-[0_8px_18px_-12px_rgba(30,31,34,0.45)]"
        style={{ width: CIRCLE, height: CIRCLE }}
      >
        {progress === null ? (
          <>
            <span aria-hidden className="absolute inset-[3px] rounded-full border-2 border-dashed border-[#df3425]/35" />
            <span className="grid size-8 place-items-center rounded-full bg-[linear-gradient(140deg,#f2583f,#df3425_55%,#ad1f2c)] text-white shadow-[0_6px_14px_-6px_rgba(223,52,37,0.8)]">
              <Plus className="size-5" strokeWidth={2.8} aria-hidden />
            </span>
          </>
        ) : (
          <>
            <svg aria-hidden viewBox={`0 0 ${CIRCLE} ${CIRCLE}`} className="absolute inset-0 size-full -rotate-90">
              <circle cx={CIRCLE / 2} cy={CIRCLE / 2} r={radius} fill="none" stroke="#e6e7ea" strokeWidth="3" />
              <circle
                cx={CIRCLE / 2}
                cy={CIRCLE / 2}
                r={radius}
                fill="none"
                stroke="#df3425"
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray={length}
                strokeDashoffset={length * (1 - (progress ?? 0))}
                className="transition-[stroke-dashoffset] duration-200"
              />
            </svg>
            <span aria-hidden className="text-[15px] font-bold tabular-nums text-ink">
              {percent}%
            </span>
          </>
        )}
      </span>
      <span className="line-clamp-2 w-full text-center text-[11.5px] leading-tight font-semibold tracking-tight text-[#c22a24]">
        {progress === null ? t.storyAdd : t.storyUploadingLabel}
      </span>
    </button>
  );
}
