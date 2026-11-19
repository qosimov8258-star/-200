import clsx from "clsx";
import type { LucideIcon } from "lucide-react";
import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent } from "react";

import { haptic } from "../lib/telegram";

export interface GlassNavItem<K extends string> {
  key: K;
  label: string;
  icon: LucideIcon;
}

/** Kapsula ichki chetidan linzagacha bo'lgan masofa. */
const INSET = 5;
/** Bo'lim almashganda linza shuncha vaqt "shisha" holatida suzadi, keyin joyiga qo'nadi. */
const TRAVEL_MS = 520;
/** Sakrashsiz, yumshoq to'xtaydigan egri chiziq (y nazorat nuqtalari 1 dan oshmaydi). */
const SMOOTH = "cubic-bezier(0.25, 1, 0.35, 1)";

type Direction = "left" | "right";

/** Surish paytida har shuncha px yurganda yangi pufakchalar chiqadi. */
const DRAG_FOAM_STEP = 14;
/** Bir vaqtda ekrandagi "surish" pufakchalari soni (eskilari allaqachon yorilgan). */
const DRAG_FOAM_MAX = 28;

/** Bo'lim almashganda linza ortidan chiqadigan sovun ko'piklari. */
interface Foam {
  id: number;
  from: number;
  to: number;
}

interface Bubble {
  x: number;
  y: number;
  size: number;
  dx: number;
  dy: number;
  delay: number;
  duration: number;
}

/** Bir xil `seed` — bir xil ko'pik (render toza qolishi uchun Math.random ishlatilmaydi). */
function seeded(seed: number) {
  let state = (seed * 2654435761) >>> 0 || 1;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

/**
 * Ko'piklar: linza yo'li bo'ylab (o'tib borishi bilan) va yangi joyi atrofida.
 * Koordinatalar menyu kapsulasi ichida, px.
 */
function makeFoam(foam: Foam, itemWidth: number, height: number): Bubble[] {
  const rand = seeded(foam.id + foam.from * 7 + foam.to * 13);
  const between = (a: number, b: number) => a + (b - a) * rand();
  const center = (i: number) => INSET + i * itemWidth + itemWidth / 2;
  const fromX = center(foam.from);
  const toX = center(foam.to);
  const bubbles: Bubble[] = [];

  // Yo'l bo'ylab: linza o'tgan joyda, uning yuqori chetidan (yozuvlar ustiga tushmaydi).
  const trail = Math.min(7, 3 + Math.abs(foam.to - foam.from) * 2);
  for (let k = 0; k < trail; k++) {
    const t = (k + 0.5) / trail;
    bubbles.push({
      x: fromX + (toX - fromX) * t + between(-10, 10),
      y: INSET + between(-6, 4),
      size: between(5, 11),
      dx: between(-8, 8),
      dy: -between(16, 30),
      delay: t * TRAVEL_MS * 0.7,
      duration: between(650, 950),
    });
  }

  // Yangi joyida: linza chetidan atrofga yengil ko'pik.
  const rx = itemWidth / 2 + 2;
  const ry = height / 2 - INSET + 1;
  for (let k = 0; k < 6; k++) {
    const angle = Math.PI * (1.05 + (k / 5) * 0.9) + between(-0.15, 0.15) + (k % 2 ? Math.PI : 0) * 0.15;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    bubbles.push({
      x: toX + cos * rx,
      y: height / 2 + sin * ry,
      size: between(4.5, 9),
      dx: cos * between(4, 10),
      dy: Math.min(sin, -0.2) * between(10, 20),
      delay: TRAVEL_MS * between(0.45, 0.75),
      duration: between(600, 900),
    });
  }
  return bubbles;
}

/**
 * iOS 26 "Liquid Glass" uslubidagi pastki menyu.
 *
 * - Tinch holatda faol bo'lim ostida yumshoq kapsula.
 * - Bo'lim almashganda yoki barmoq bilan surilganda kapsula shisha linzaga aylanadi:
 *   biroz kattalashadi, ostidagi ikonka va yozuvlarni kattalashtirib ko'rsatadi, chetlarida
 *   yorug'lik sinishi (rangli hoshiya) va yaltirash bor. Keyin sakramasdan joyiga qo'nadi.
 *
 * Haqiqiy optik sinish brauzerlarda yo'q — kattalashtirilgan nusxa, soya va gradientlar bilan taqlid.
 */
export function GlassNav<K extends string>({
  items,
  active,
  onSelect,
  onReselect,
  pressed,
}: {
  items: GlassNavItem<K>[];
  active: K;
  onSelect: (key: K) => void;
  /** Faol bo'limga qayta bosilganda (masalan, "Ko'proq" menyusini ochish/yopish). */
  onReselect?: (key: K) => void;
  /** Shu bo'lim ajratib ko'rsatiladi (masalan, ochiq turgan "Ko'proq" menyusi). */
  pressed?: K | null;
}) {
  const barRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [height, setHeight] = useState(0);
  const [dragX, setDragX] = useState<number | null>(null);
  const [travel, setTravel] = useState<{ id: number; dir: Direction } | null>(null);
  const [foam, setFoam] = useState<Foam | null>(null);
  const [dragFoam, setDragFoam] = useState<Array<Bubble & { id: number }>>([]);
  const lastFoamX = useRef<number | null>(null);
  const bubbleSeq = useRef(0);
  const index = Math.max(0, items.findIndex((i) => i.key === active));
  const prevIndex = useRef(index);

  useLayoutEffect(() => {
    const el = barRef.current;
    if (!el) return;
    const measure = () => {
      setWidth(el.clientWidth);
      setHeight(el.clientHeight);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    measure();
    return () => observer.disconnect();
  }, []);

  // Bo'lim almashdi — linza shisha holatida yangi joyga suzadi.
  useLayoutEffect(() => {
    if (index === prevIndex.current) return;
    const dir: Direction = index > prevIndex.current ? "right" : "left";
    const from = prevIndex.current;
    prevIndex.current = index;
    setTravel((t) => ({ id: (t?.id ?? 0) + 1, dir }));
    setFoam((f) => ({ id: (f?.id ?? 0) + 1, from, to: index }));
    const timer = setTimeout(() => setTravel(null), TRAVEL_MS);
    return () => clearTimeout(timer);
  }, [index]);

  const itemWidth = width > 0 ? (width - INSET * 2) / items.length : 0;
  const indexAt = (x: number) =>
    Math.min(items.length - 1, Math.max(0, Math.floor((x - INSET) / itemWidth)));
  const localX = (e: PointerEvent) =>
    e.clientX - (barRef.current?.getBoundingClientRect().left ?? 0);

  const dragging = dragX !== null;
  const glass = dragging || travel !== null;
  const lensX = dragging
    ? Math.min(width - INSET - itemWidth, Math.max(INSET, dragX - itemWidth / 2))
    : INSET + index * itemWidth;
  const highlighted = dragging ? indexAt(dragX) : index;

  const choose = (key: K) => {
    if (key !== active) {
      haptic.select();
      onSelect(key);
    } else {
      onReselect?.(key);
    }
  };

  /** Linza markazi (surishda kapsula chetlariga qisiladi). */
  const lensCenterAt = (x: number) =>
    Math.min(width - INSET - itemWidth, Math.max(INSET, x - itemWidth / 2)) + itemWidth / 2;

  /**
   * Surish paytidagi ko'pik: linzaning orqa chetidan (harakatga teskari tomondan) chiqib,
   * yuqoriga ko'tariladi. `dir` 0 — bosilgan joyda atrofga.
   */
  const spawnFoam = (x: number, dir: -1 | 0 | 1, count: number) => {
    if (itemWidth <= 0) return;
    const center = lensCenterAt(x);
    const next = Array.from({ length: count }, () => {
      const r = Math.random;
      const offset =
        dir === 0 ? (r() - 0.5) * itemWidth * 0.9 : -dir * itemWidth * (0.2 + r() * 0.3);
      bubbleSeq.current += 1;
      return {
        id: bubbleSeq.current,
        x: center + offset,
        y: INSET + (r() * 10 - 6),
        size: 5 + r() * 6,
        dx: -dir * (3 + r() * 8) + (r() - 0.5) * 6,
        dy: -(16 + r() * 16),
        delay: 0,
        duration: 650 + r() * 300,
      };
    });
    setDragFoam((list) => [...list, ...next].slice(-DRAG_FOAM_MAX));
  };

  const commit = (x: number) => {
    const next = indexAt(x);
    setDragX(null);
    choose(items[next].key);
  };

  const bubbles = useMemo(
    () => (foam && itemWidth > 0 && height > 0 ? makeFoam(foam, itemWidth, height) : []),
    [foam, itemWidth, height],
  );

  const row = (magnified: boolean) =>
    items.map((item, i) => (
      <ItemContent
        key={item.key}
        item={item}
        on={i === highlighted || item.key === pressed}
        magnified={magnified}
      />
    ));

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
          const x = localX(e);
          setDragX(x);
          lastFoamX.current = x;
          spawnFoam(x, 0, 4);
        }}
        onPointerMove={(e) => {
          if (dragX === null) return;
          const x = localX(e);
          setDragX(x);
          const last = lastFoamX.current ?? x;
          if (Math.abs(x - last) >= DRAG_FOAM_STEP) {
            spawnFoam(x, x > last ? 1 : -1, 2);
            lastFoamX.current = x;
          }
        }}
        onPointerUp={(e) => {
          lastFoamX.current = null;
          commit(localX(e));
        }}
        onPointerCancel={() => {
          lastFoamX.current = null;
          setDragX(null);
        }}
      >
        {/* Oddiy (kattalashtirilmagan) ikonkalar va yozuvlar */}
        <div className="relative flex h-full px-[5px]">
          {items.map((item, i) => (
            <button
              key={item.key}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={item.label}
              className="flex flex-1 items-center justify-center"
              // Klaviatura va ekran o'quvchilar uchun; sichqoncha/barmoq — konteynerda.
              onClick={(e) => {
                if (e.detail === 0) choose(item.key);
              }}
            >
              <ItemContent item={item} on={i === highlighted || item.key === pressed} magnified={false} />
            </button>
          ))}
        </div>

        {/* Sovun ko'piklari — linza ortida, kapsuladan tashqariga ham chiqadi */}
        {foam && (
          <div key={foam.id} aria-hidden className="pointer-events-none absolute inset-0">
            {bubbles.map((b, i) => (
              <SoapBubble key={i} bubble={b} />
            ))}
          </div>
        )}
        {/* Bosib surishda — linza ortidan uzluksiz ko'pik */}
        <div aria-hidden className="pointer-events-none absolute inset-0">
          {dragFoam.map((b) => (
            <SoapBubble key={b.id} bubble={b} />
          ))}
        </div>

        {itemWidth > 0 && (
          <div
            aria-hidden
            className="pointer-events-none absolute"
            style={{
              left: lensX,
              top: INSET,
              bottom: INSET,
              width: itemWidth,
              transition: dragging ? "none" : `left ${TRAVEL_MS}ms ${SMOOTH}`,
            }}
          >
            {/* Kattalashish: shisha holatida linza biroz ko'tariladi */}
            <div
              className="size-full"
              style={{
                transform: `scale(${dragging ? 1.2 : glass ? 1.12 : 1})`,
                transition: `transform 320ms ${SMOOTH}`,
              }}
            >
              {/* Harakat paytida harakat yo'nalishi bo'yicha yengil cho'zilish (tebranishsiz) */}
              <div
                key={travel?.id ?? 0}
                className={clsx("size-full", travel && !dragging && "animate-lens-travel")}
                style={{ transformOrigin: travel?.dir === "left" ? "right center" : "left center" }}
              >
                <div
                  className={clsx(
                    "relative size-full overflow-hidden rounded-full border transition-[background,box-shadow,border-color] duration-200",
                    glass
                      ? "border-white bg-[linear-gradient(180deg,rgba(255,255,255,0.95),rgba(244,246,249,0.9))] shadow-[inset_0_1px_0_rgba(255,255,255,1),inset_0_-1px_2px_rgba(30,31,34,0.07),inset_5px_0_8px_-5px_rgba(0,190,255,0.45),inset_-5px_0_8px_-5px_rgba(255,60,170,0.4),0_10px_24px_rgba(30,31,34,0.18),0_2px_6px_rgba(30,31,34,0.08)]"
                      : "border-white/70 bg-[linear-gradient(180deg,rgba(30,31,34,0.05),rgba(30,31,34,0.09))] shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]",
                  )}
                >
                  {/* Linza ostidagi ikonkalar — linza bilan birga kattalashgan nusxa */}
                  <div
                    className="absolute flex px-[5px] transition-opacity duration-150"
                    style={{
                      left: -lensX,
                      top: -INSET,
                      width,
                      height,
                      opacity: glass ? 1 : 0,
                    }}
                  >
                    {row(true)}
                  </div>
                  {/* Shishaning qalinligi (chetlari biroz qoramtir) va yuqoridagi yaltirash */}
                  <span
                    className={clsx(
                      "absolute inset-0 rounded-full bg-[radial-gradient(closest-side,transparent_72%,rgba(30,31,34,0.08))] transition-opacity duration-200",
                      glass ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <span
                    className={clsx(
                      "absolute inset-x-[14%] top-[3px] h-[38%] rounded-full bg-[linear-gradient(180deg,rgba(255,255,255,0.9),rgba(255,255,255,0))] transition-opacity duration-200",
                      glass ? "opacity-90" : "opacity-40",
                    )}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}

function SoapBubble({ bubble: b }: { bubble: Bubble }) {
  return (
    <span
      className="absolute animate-soap-bubble rounded-full bg-[radial-gradient(circle_at_34%_30%,rgba(255,255,255,0.98)_0_13%,rgba(255,255,255,0)_24%),radial-gradient(circle,rgba(205,235,255,0.18)_55%,rgba(150,215,255,0.5)_78%,rgba(255,150,215,0.55)_100%)] shadow-[inset_1px_1px_1.5px_rgba(110,205,255,0.7),inset_-1px_-1px_1.5px_rgba(255,120,200,0.6),0_1px_2px_rgba(30,31,34,0.18)]"
      style={
        {
          left: b.x - b.size / 2,
          top: b.y - b.size / 2,
          width: b.size,
          height: b.size,
          animationDelay: `${Math.round(b.delay)}ms`,
          animationDuration: `${Math.round(b.duration)}ms`,
          "--bubble-dx": `${b.dx.toFixed(1)}px`,
          "--bubble-dy": `${b.dy.toFixed(1)}px`,
        } as CSSProperties
      }
    />
  );
}

function ItemContent<K extends string>({
  item,
  on,
  magnified,
}: {
  item: GlassNavItem<K>;
  on: boolean;
  magnified: boolean;
}) {
  const Icon = item.icon;
  return (
    <span
      className={clsx(
        "flex flex-1 flex-col items-center justify-center gap-[3px] transition-colors duration-200",
        on ? "text-ink" : magnified ? "text-ink/60" : "text-ink/50",
      )}
    >
      <Icon className="size-6" strokeWidth={on ? 2.4 : 1.9} />
      <span className={clsx("text-[10.5px] leading-none whitespace-nowrap", on ? "font-bold" : "font-medium")}>
        {item.label}
      </span>
    </span>
  );
}
