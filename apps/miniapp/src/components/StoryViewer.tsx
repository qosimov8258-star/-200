import { useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { CircleAlert, LoaderCircle, Trash2, Volume2, VolumeX, X } from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode, type Ref } from "react";
import { createPortal } from "react-dom";

import { t } from "../i18n/uz";
import * as api from "../lib/api";
import { errorCode } from "../lib/api-error";
import { displayName, formatAgo } from "../lib/format";
import { firstUnseenIndex, type SeenMap } from "../lib/stories";
import { confirmDialog, haptic, showBackButton } from "../lib/telegram";
import type { StoryGroup, StoryItem } from "../lib/types";
import { StoryAvatar } from "./StoryAvatar";
import { useToast } from "./toast-context";

/** Shuncha ushlab turilsa — pauza (qo'yib yuborilganda davom etadi), keyingisiga o'tmaydi. */
const HOLD_MS = 220;
/** Barmoq shuncha siljisa — bosish emas, surish. */
const MOVE_PX = 10;
/** Pastga shuncha surilsa — yopiladi. */
const SWIPE_CLOSE_PX = 90;
/** Yonga shuncha surilsa — keyingi/oldingi muallif. */
const SWIPE_GROUP_PX = 60;
/** Ekranning chap qismi (ulushi) — oldingi istoriya, qolgani — keyingisi. */
const PREV_ZONE = 0.3;
/** Ochilmagan (muddati tugagan, o'chirilgan) istoriyada xabar shuncha turadi, keyin o'tkaziladi. */
const SKIP_ERROR_MS = 1500;

/** Ovoz tanlovi ko'ruvchi qayta ochilganda ham saqlanadi (sahifa yangilanguncha). */
let mutedPreference = true;

type MediaStatus = "loading" | "playing" | "error";

interface Gesture {
  pointerId: number;
  x: number;
  y: number;
  moved: boolean;
  held: boolean;
  holdTimer: number;
}

/**
 * To'liq ekranli istoriya ko'ruvchi (Instagram kabi): tepada har bir istoriya uchun chiziq,
 * muallif va "N soat oldin"; video ovozsiz o'zi boshlanadi (brauzerlar ovozli avtoijroni
 * bloklaydi) — tugma bilan ovoz yoqiladi. O'ngga bosish — keyingisi, chapga — oldingisi, tugagach
 * o'zi keyingisiga o'tadi, oxirgisidan keyin — keyingi muallif. Ushlab turish — pauza, pastga
 * surish yoki ✕ — yopish, yonga surish — boshqa muallif. O'z istoriyasini o'chirish mumkin.
 */
export function StoryViewer({
  groups: initialGroups,
  startGroup,
  startStory,
  seen,
  onSeen,
  onClose,
}: {
  /** Ochilgan paytdagi ro'yxat (aylanalar tartibi) — ko'rish davomida o'zgarmaydi. */
  groups: StoryGroup[];
  startGroup: number;
  startStory: number;
  seen: SeenMap;
  onSeen: (authorKey: string, story: StoryItem) => void;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [groups, setGroups] = useState(initialGroups);
  const [pos, setPos] = useState({ g: startGroup, s: startStory });
  const [muted, setMuted] = useState(mutedPreference);
  /** Barmoq bilan ushlab turilgan yoki surilmoqda — video to'xtaydi. */
  const [held, setHeld] = useState(false);
  /** O'chirish tasdig'i yoki so'rovi — video to'xtaydi. */
  const [busy, setBusy] = useState(false);
  const [hidden, setHidden] = useState(() => document.hidden);
  const [dragY, setDragY] = useState(0);
  /** Joriy videoning holati; boshqa istoriyaga o'tilganda o'zi "loading" ga qaytadi (id solishtiriladi). */
  const [media, setMedia] = useState<{ id: string; status: MediaStatus; cover: boolean } | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const barRef = useRef<HTMLSpanElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const gesture = useRef<Gesture | null>(null);

  const group = groups[pos.g] as StoryGroup | undefined;
  const story = group?.stories[pos.s];
  const status: MediaStatus = media && story && media.id === story.id ? media.status : "loading";
  const cover = media && story && media.id === story.id ? media.cover : true;
  const paused = held || busy || hidden || status === "error";

  // --- Navigatsiya -----------------------------------------------------------
  const restart = () => {
    const video = videoRef.current;
    if (video) video.currentTime = 0;
  };
  const nextGroup = () => {
    if (pos.g < groups.length - 1) setPos({ g: pos.g + 1, s: firstUnseenIndex(seen, groups[pos.g + 1]) });
    else onClose();
  };
  const prevGroup = () => {
    if (pos.g > 0) setPos({ g: pos.g - 1, s: 0 });
    else restart();
  };
  const next = () => {
    if (group && pos.s < group.stories.length - 1) setPos({ g: pos.g, s: pos.s + 1 });
    else nextGroup();
  };
  const prev = () => {
    if (pos.s > 0) setPos({ g: pos.g, s: pos.s - 1 });
    else prevGroup();
  };

  // Effekt va taymerlar eng so'nggi holatdagi funksiyalarni chaqirsin.
  const latest = useRef({ next, prev, onClose });
  useEffect(() => {
    latest.current = { next, prev, onClose };
  });

  // Ro'yxat bo'shab qolsa (masalan, oxirgi istoriya o'chirildi) — yopiladi.
  useEffect(() => {
    if (!story) latest.current.onClose();
  }, [story]);

  // Ochilganda: sahifa aylanmaydi, fokus — "Yopish" da, Telegram "Orqaga" — yopadi, klaviatura.
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const hideBack = showBackButton(() => latest.current.onClose());
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") latest.current.onClose();
      else if (e.key === "ArrowRight") latest.current.next();
      else if (e.key === "ArrowLeft") latest.current.prev();
    };
    const onVisibility = () => setHidden(document.hidden);
    window.addEventListener("keydown", onKey);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("visibilitychange", onVisibility);
      hideBack();
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, []);

  // Ijro: bitta <video> elementi (iOS ovozli ijroga ruxsatni element bo'yicha eslab qoladi).
  const storyId = story?.id;
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !storyId) return;
    video.muted = muted;
    if (paused) {
      video.pause();
      return;
    }
    video.play().catch((error: unknown) => {
      // Ovozli avtoijro bloklandi — ovozsiz davom etamiz (tugma bilan qayta yoqiladi).
      if (error instanceof DOMException && error.name === "NotAllowedError" && !video.muted) {
        mutedPreference = true;
        setMuted(true);
      }
      // AbortError — yangi istoriya yuklanishi yoki pauza ijroni to'xtatdi; bu xato emas.
    });
  }, [storyId, paused, muted]);

  // Faol chiziq har kadrda videodagi joyga qarab to'ladi (React qayta chizmaydi).
  useEffect(() => {
    let frame = 0;
    const tick = () => {
      const video = videoRef.current;
      const bar = barRef.current;
      if (video && bar) {
        const duration = video.duration;
        const progress = Number.isFinite(duration) && duration > 0 ? Math.min(1, video.currentTime / duration) : 0;
        bar.style.setProperty("--story-progress", String(progress));
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  // Muddati tugagan yoki o'chirilgan istoriya: qisqa xabar, keyin keyingisiga; ro'yxat yangilanadi.
  useEffect(() => {
    if (status !== "error") return;
    void queryClient.invalidateQueries({ queryKey: ["stories"] });
    const timer = window.setTimeout(() => latest.current.next(), SKIP_ERROR_MS);
    return () => window.clearTimeout(timer);
  }, [status, storyId, queryClient]);

  if (!group || !story) return null;

  const setStatus = (next: MediaStatus, video?: HTMLVideoElement) =>
    setMedia((prevMedia) => ({
      id: story.id,
      status: next,
      cover: video
        ? video.videoHeight >= video.videoWidth * 1.3
        : prevMedia && prevMedia.id === story.id
          ? prevMedia.cover
          : true,
    }));

  const toggleMute = () => {
    const nextMuted = !muted;
    mutedPreference = nextMuted;
    setMuted(nextMuted);
    // Foydalanuvchi bosishi ichida — brauzer ovozli ijroga ruxsat beradi.
    const video = videoRef.current;
    if (video) {
      video.muted = nextMuted;
      if (!paused) void video.play().catch(() => {});
    }
  };

  const remove = async () => {
    if (!group.isMe || busy) return;
    setBusy(true);
    // Brauzerdagi `confirm` sahifani to'xtatadi, lekin video o'ynayverishi mumkin — oldin pauza.
    videoRef.current?.pause();
    try {
      if (!(await confirmDialog(t.storyDeleteConfirm))) return;
      try {
        await api.deleteStory(story.id);
        haptic.success();
        toast(t.storyDeleted);
      } catch (e) {
        // Server topmadi — muddati tugagan yoki allaqachon o'chirilgan: ro'yxatdan baribir olib tashlaymiz.
        if (errorCode(e) !== "NOT_FOUND") {
          haptic.error();
          toast(t.storyDeleteFailed);
          return;
        }
        toast(t.storyUnavailable);
      }
      queryClient.setQueryData<StoryGroup[]>(["stories"], (old) =>
        old?.map((g) => ({ ...g, stories: g.stories.filter((s) => s.id !== story.id) })).filter((g) => g.stories.length > 0),
      );
      void queryClient.invalidateQueries({ queryKey: ["stories"] });
      const remaining = group.stories.filter((s) => s.id !== story.id);
      if (remaining.length === 0) {
        onClose();
        return;
      }
      setGroups((list) => list.map((g, i) => (i === pos.g ? { ...g, stories: remaining } : g)));
      setPos({ g: pos.g, s: Math.min(pos.s, remaining.length - 1) });
    } finally {
      setBusy(false);
    }
  };

  // --- Bosish, ushlab turish va surish ---------------------------------------
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    try {
      // Barmoq ekrandan chiqib ketsa ham `pointerup` shu qatlamga kelsin.
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Ba'zi WebView'larda qo'llab-quvvatlanmaydi — surish baribir ishlaydi.
    }
    const holdTimer = window.setTimeout(() => {
      if (!gesture.current) return;
      gesture.current.held = true;
      setHeld(true);
    }, HOLD_MS);
    gesture.current = { pointerId: e.pointerId, x: e.clientX, y: e.clientY, moved: false, held: false, holdTimer };
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    if (!g || g.pointerId !== e.pointerId) return;
    const dx = e.clientX - g.x;
    const dy = e.clientY - g.y;
    if (!g.moved && Math.hypot(dx, dy) > MOVE_PX) {
      g.moved = true;
      window.clearTimeout(g.holdTimer);
      setHeld(true);
    }
    if (g.moved) setDragY(dy > 0 && dy > Math.abs(dx) ? dy : 0);
  };

  const endGesture = (e: PointerEvent<HTMLDivElement>, cancelled: boolean) => {
    const g = gesture.current;
    if (!g || g.pointerId !== e.pointerId) return;
    gesture.current = null;
    window.clearTimeout(g.holdTimer);
    setHeld(false);
    setDragY(0);
    if (cancelled || (g.held && !g.moved)) return;
    const dx = e.clientX - g.x;
    const dy = e.clientY - g.y;
    if (g.moved) {
      if (dy > SWIPE_CLOSE_PX && dy > Math.abs(dx)) onClose();
      else if (Math.abs(dx) > SWIPE_GROUP_PX && Math.abs(dx) > Math.abs(dy)) {
        if (dx < 0) nextGroup();
        else prevGroup();
      }
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    haptic.select();
    if (e.clientX - rect.left < rect.width * PREV_ZONE) prev();
    else next();
  };

  const name = displayName(group.fullName);
  const dragScale = 1 - Math.min(dragY, 400) / 2000;
  // Ushlab turilganda (surmasdan) — Instagram kabi tugmalar yashirinadi, faqat video qoladi.
  const chromeHidden = held && dragY === 0;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t.storyViewerLabel(name)}
      className="fixed inset-0 z-[90] animate-fade bg-black select-none"
      style={{ backgroundColor: `rgba(0,0,0,${1 - Math.min(dragY, 300) / 500})` }}
    >
      <div
        className={clsx(
          "relative mx-auto h-full w-full max-w-[min(520px,56.25dvh)] overflow-hidden bg-[#0b0d1f]",
          dragY === 0 && "transition-transform duration-200",
          dragY > 0 && "rounded-[24px]",
        )}
        style={{ transform: dragY > 0 ? `translateY(${dragY}px) scale(${dragScale})` : undefined }}
      >
        <video
          ref={videoRef}
          src={api.storyVideoUrl(story.id)}
          playsInline
          muted={muted}
          preload="auto"
          disablePictureInPicture
          controlsList="nodownload noplaybackrate"
          onLoadedMetadata={(e) => setStatus("loading", e.currentTarget)}
          onPlaying={(e) => {
            setStatus("playing", e.currentTarget);
            onSeen(group.authorKey, story);
          }}
          onWaiting={() => setStatus("loading")}
          onEnded={() => latest.current.next()}
          onError={() => setStatus("error")}
          className={clsx("absolute inset-0 size-full", cover ? "object-cover" : "object-contain")}
        />

        {/* Bosish va surish qatlami (butun ekran; tugmalar ustida turadi). */}
        <div
          className="absolute inset-0 touch-none"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={(e) => endGesture(e, false)}
          onPointerCancel={(e) => endGesture(e, true)}
          onContextMenu={(e) => e.preventDefault()}
        />

        {/* Ekran o'quvchi va klaviatura uchun (ko'rinmaydi): oldingi / keyingi istoriya. */}
        <button type="button" className="sr-only" onClick={prev}>
          {t.storyPrev}
        </button>
        <button type="button" className="sr-only" onClick={next}>
          {t.storyNext}
        </button>

        {status !== "playing" && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center px-8 text-center">
            {status === "error" ? (
              <p className="flex flex-col items-center gap-2 text-[15px] font-semibold text-white/90" role="status">
                <CircleAlert className="size-8 text-white/80" aria-hidden />
                {t.storyUnavailable}
              </p>
            ) : (
              <LoaderCircle className="size-9 animate-spin text-white/85" role="status" aria-label={t.loading} />
            )}
          </div>
        )}

        <div
          className={clsx(
            "pointer-events-none absolute inset-x-0 top-0 bg-[linear-gradient(to_bottom,rgba(0,0,0,0.55),rgba(0,0,0,0.18)_70%,transparent)] px-3 pt-[calc(var(--safe-top)+10px)] pb-10 text-white transition-opacity duration-200",
            chromeHidden && "opacity-0",
          )}
        >
          <div className="flex gap-1" aria-hidden>
            {group.stories.map((item, i) => (
              <span key={item.id} className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/35">
                <span
                  ref={i === pos.s ? barRef : undefined}
                  className="block h-full origin-left rounded-full bg-white [transform:scaleX(var(--story-progress,0))]"
                  style={i === pos.s ? undefined : ({ "--story-progress": i < pos.s ? 1 : 0 } as CSSProperties)}
                />
              </span>
            ))}
          </div>

          <div className="mt-3 flex items-center gap-2.5">
            <StoryAvatar name={group.fullName} seed={group.authorKey} size={38} className="ring-2 ring-white/70" />
            <div className="min-w-0 flex-1 leading-tight [text-shadow:0_1px_2px_rgba(0,0,0,0.35)]">
              <p className="flex items-center gap-1.5 text-[15px] font-semibold">
                <span className="truncate">{name}</span>
                {group.isMe && (
                  <span className="shrink-0 rounded-full bg-white/20 px-1.5 py-px text-[11px] font-semibold">{t.you}</span>
                )}
              </p>
              <p className="mt-0.5 text-[12.5px] text-white/75">{formatAgo(story.createdAt)}</p>
            </div>
            <ViewerButton label={muted ? t.storyUnmute : t.storyMute} onClick={toggleMute}>
              {muted ? <VolumeX /> : <Volume2 />}
            </ViewerButton>
            {group.isMe && (
              <ViewerButton label={t.storyDelete} onClick={() => void remove()} disabled={busy}>
                {busy ? <LoaderCircle className="animate-spin" /> : <Trash2 />}
              </ViewerButton>
            )}
            <ViewerButton ref={closeRef} label={t.storyClose} onClick={onClose}>
              <X />
            </ViewerButton>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function ViewerButton({
  label,
  onClick,
  disabled,
  ref,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  ref?: Ref<HTMLButtonElement>;
  children: ReactNode;
}) {
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="pointer-events-auto grid size-10 shrink-0 place-items-center rounded-full bg-black/25 text-white backdrop-blur-sm transition active:scale-95 disabled:opacity-60 [&>svg]:size-[21px]"
    >
      {children}
    </button>
  );
}
