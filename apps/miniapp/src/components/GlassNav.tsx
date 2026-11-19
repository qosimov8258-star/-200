import clsx from "clsx";
import type { LucideIcon } from "lucide-react";
import { useLayoutEffect, useRef, useState, type PointerEvent } from "react";

import { haptic } from "../lib/telegram";

export interface GlassNavItem<K extends string> {
  key: K;
  label: string;
  icon: LucideIcon;
}

const INSET = 5;

/**
 * iOS "liquid glass" uslubidagi pastki menyu: xira shisha kapsula va bo'limlar
 * orasida suzuvchi linza. Linzani barmoq bilan surish mumkin; bo'lim almashganda
 * linza tomchidek cho'zilib, keyin yig'iladi. Mobil ilovadagi glass_nav_bar.dart
 * ning veb ko'rinishi (haqiqiy optik sinish yo'q — blur va yorug'lik bilan taqlid).
 */
export function GlassNav<K extends string>({
  items,
  active,
  onSelect,
}: {
  items: GlassNavItem<K>[];
  active: K;
  onSelect: (key: K) => void;
}) {
  const barRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [dragX, setDragX] = useState<number | null>(null);
  const [drop, setDrop] = useState<{ id: number; dir: "left" | "right" }>({ id: 0, dir: "right" });
  const index = Math.max(0, items.findIndex((i) => i.key === active));
  const prevIndex = useRef(index);

  useLayoutEffect(() => {
    const el = barRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setWidth(el.clientWidth));
    observer.observe(el);
    setWidth(el.clientWidth);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    if (index !== prevIndex.current) {
      setDrop((d) => ({ id: d.id + 1, dir: index > prevIndex.current ? "right" : "left" }));
      prevIndex.current = index;
    }
  }, [index]);

  const itemWidth = width > 0 ? (width - INSET * 2) / items.length : 0;
  const indexAt = (x: number) =>
    Math.min(items.length - 1, Math.max(0, Math.floor((x - INSET) / itemWidth)));
  const localX = (e: PointerEvent) =>
    e.clientX - (barRef.current?.getBoundingClientRect().left ?? 0);

  const lensX =
    dragX === null
      ? INSET + index * itemWidth
      : Math.min(width - INSET - itemWidth, Math.max(INSET, dragX - itemWidth / 2));
  const highlighted = dragX === null ? index : indexAt(dragX);

  const commit = (x: number) => {
    const next = indexAt(x);
    setDragX(null);
    if (items[next].key !== active) {
      haptic.select();
      onSelect(items[next].key);
    }
  };

  return (
    <nav
      className="fixed inset-x-0 z-40 flex justify-center px-7"
      style={{ bottom: "calc(var(--safe-bottom) + 12px)" }}
    >
      <div
        ref={barRef}
        role="tablist"
        className="relative h-[66px] w-full max-w-[420px] touch-none rounded-full border border-white/85 bg-[linear-gradient(180deg,rgba(255,255,255,0.74),rgba(255,255,255,0.5))] shadow-[0_12px_28px_rgba(30,31,34,0.14),0_1px_4px_rgba(30,31,34,0.06)] backdrop-blur-xl backdrop-saturate-150 select-none"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          setDragX(localX(e));
        }}
        onPointerMove={(e) => {
          if (dragX !== null) setDragX(localX(e));
        }}
        onPointerUp={(e) => commit(localX(e))}
        onPointerCancel={() => setDragX(null)}
      >
        {itemWidth > 0 && (
          <div
            aria-hidden
            className={clsx(
              "absolute",
              dragX === null && "transition-[left] duration-[420ms] ease-[cubic-bezier(0.34,1.4,0.5,1)]",
            )}
            style={{ left: lensX, top: INSET, bottom: INSET, width: itemWidth }}
          >
            <div
              key={drop.id}
              className={clsx(
                "size-full rounded-full border transition-[background,box-shadow,scale] duration-200",
                drop.id > 0 && dragX === null && "animate-droplet",
                dragX === null
                  ? "scale-100 border-white/90 bg-[linear-gradient(180deg,rgba(30,31,34,0.05),rgba(30,31,34,0.11))] shadow-[0_1px_6px_rgba(30,31,34,0.06)]"
                  : "scale-[1.14] border-white bg-[linear-gradient(180deg,rgba(255,255,255,0.78),rgba(255,255,255,0.34))] shadow-[0_6px_18px_rgba(30,31,34,0.2)]",
              )}
              style={{ transformOrigin: drop.dir === "right" ? "right center" : "left center" }}
            />
          </div>
        )}
        <div className="relative flex h-full px-[5px]">
          {items.map((item, i) => {
            const Icon = item.icon;
            const on = i === highlighted;
            return (
              <button
                key={item.key}
                type="button"
                role="tab"
                aria-selected={i === index}
                aria-label={item.label}
                className={clsx(
                  "flex flex-1 flex-col items-center justify-center gap-[3px] transition-colors",
                  on ? "text-ink" : "text-ink/50",
                )}
                // Klaviatura va ekran o'quvchilar uchun; sichqoncha/barmoq — konteynerda.
                onClick={(e) => {
                  if (e.detail === 0) onSelect(item.key);
                }}
              >
                <Icon
                  className={clsx("size-6 transition-transform duration-200", on && "scale-110")}
                  strokeWidth={on ? 2.4 : 1.9}
                />
                <span className={clsx("text-[10.5px] leading-none", on ? "font-bold" : "font-medium")}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
