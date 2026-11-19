"use client";

/*
 * Realistik qor yog'ishi — Mini App'dagi `apps/miniapp/src/components/Snowfall.tsx` nusxasi
 * (umumiy paket hali yo'q). O'zgarsa, ikkalasini birga yangilang.
 */
import { useEffect, useRef } from "react";

interface Flake {
  x: number;
  y: number;
  /** Chuqurlik: 0 — uzoqda (mayda, sekin), 1 — yaqinda (yirik, tez). */
  z: number;
  r: number;
  vx: number;
  vy: number;
  /** Shamolsiz tushish tezligi, px/s. */
  fall: number;
  phase: number;
  swayFreq: number;
  swayAmp: number;
  alpha: number;
}

/** Shamol esishi: karta bo'ylab to'lqin bo'lib o'tadi. */
interface Gust {
  start: number;
  duration: number;
  /** px/s; ishorasi — yo'nalish (musbat — o'ngga). */
  strength: number;
  /** Shamol "fronti" karta bo'ylab shu tezlikda siljiydi, px/s. */
  frontSpeed: number;
}

/**
 * Kartaning pastida to'planadigan qor uyumi: ustunlar bo'yicha balandliklar.
 * `cap` — har bir ustunda qor qayergacha to'planishi mumkin (notekis: do'ngliklar, burchaklarda ko'proq).
 */
interface Pile {
  h: Float32Array;
  cap: Float32Array;
  max: number;
}

/** Silkinishda uyumdan ko'chgan qor parchasi (karta koordinatalarida). */
interface Debris {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  /** Mayda chang (yumshoq, xira) yoki qor bo'lagi (zich). */
  powder: boolean;
  alpha: number;
  age: number;
  life: number;
}

/** Shundan yaqin zarralar matn oldidagi qatlamda chiziladi. */
const FRONT_Z = 0.86;
const MAX_DPR = 2;
const MAX_STEP = 0.05;

/** Uyum ustunining kengligi, px. */
const COL = 3;
/** Uyumning eng baland joyi: karta balandligining shu ulushi, lekin `PILE_MAX_PX` dan oshmaydi. */
const PILE_MAX_RATIO = 0.13;
const PILE_MAX_PX = 38;
/** Qor yonbag'ri bundan tik bo'lolmaydi (px/px) — ortiqchasi pastga sirg'aladi. */
const REPOSE_SLOPE = 0.85;
/** Shamol uyum sirtidagi qorni shu tezlikda suradi (ustun ulushi / (px/s) / s). */
const WIND_CARRY = 0.011;

/** Karta shundan sekin siljisa (px/s) — qor joyida qoladi. */
const SHAKE_MIN_SPEED = 260;
/** Tezlik shunchaga oshganda uyumning deyarli hammasi bir soniyada sochiladi. */
const SHAKE_FULL_SPEED = 2200;
/** Parchalar kartaga nisbatan, uning harakatiga teskari tomonga shu ulushda uchadi. */
const SHAKE_INERTIA = 0.27;
const DEBRIS_GRAVITY = 560;
const MAX_DEBRIS = 260;
/** Bitta parcha uyumning shuncha maydonini (px²) olib ketadi. */
const DEBRIS_AREA = 16;

function makeSprite(core: number): HTMLCanvasElement {
  const size = 48;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const g = canvas.getContext("2d");
  if (g) {
    const half = size / 2;
    const grad = g.createRadialGradient(half, half, 0, half, half, half);
    grad.addColorStop(0, "rgba(255,255,255,1)");
    grad.addColorStop(core, "rgba(255,255,255,0.86)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, size, size);
  }
  return canvas;
}

function spawn(width: number, height: number, atTop: boolean): Flake {
  // Uzoqdagi mayda zarralar ko'proq — chuqurlik hissi shundan.
  const z = Math.pow(Math.random(), 1.7);
  const front = z > FRONT_Z;
  return {
    x: Math.random() * (width + 40) - 20,
    y: atTop ? -8 - Math.random() * 24 : Math.random() * height,
    z,
    r: 0.7 + z * 2.4 + (front ? 1.2 : 0),
    vx: 0,
    vy: 0,
    fall: (15 + z * 42) * (0.85 + Math.random() * 0.3),
    phase: Math.random() * Math.PI * 2,
    swayFreq: 0.6 + Math.random() * 1.1,
    swayAmp: 5 + (1 - z) * 9 + Math.random() * 4,
    alpha: front ? 0.36 + Math.random() * 0.2 : 0.35 + z * 0.55,
  };
}

/** Uyum chegarasi: past asos ustida tasodifiy do'ngliklar; burchaklarda qor ko'proq yig'iladi. */
function makeCap(columns: number, max: number): Float32Array {
  const cap = new Float32Array(columns);
  const width = columns * COL;
  const mounds = [
    // Burchaklarda qor ko'proq yig'iladi.
    { x: Math.random() * 0.08 * width, sigma: 24 + Math.random() * 22, height: (0.55 + Math.random() * 0.3) * max },
    { x: (0.92 + Math.random() * 0.08) * width, sigma: 24 + Math.random() * 22, height: (0.55 + Math.random() * 0.3) * max },
    // O'rtada 2–3 ta har xil do'nglik.
    { x: (0.18 + Math.random() * 0.17) * width, sigma: 18 + Math.random() * 26, height: (0.3 + Math.random() * 0.45) * max },
    { x: (0.45 + Math.random() * 0.15) * width, sigma: 14 + Math.random() * 20, height: (0.15 + Math.random() * 0.35) * max },
    { x: (0.66 + Math.random() * 0.18) * width, sigma: 18 + Math.random() * 26, height: (0.3 + Math.random() * 0.45) * max },
  ];
  const ripple = Math.random() * Math.PI * 2;
  for (let i = 0; i < columns; i++) {
    const x = (i + 0.5) * COL;
    // Past asos + mayda to'lqinlar + do'ngliklar.
    let value = max * 0.2 + max * 0.06 * Math.sin(x * 0.09 + ripple) + max * 0.04 * Math.sin(x * 0.23 + ripple * 2);
    for (const m of mounds) value += m.height * Math.exp(-(((x - m.x) / m.sigma) ** 2));
    cap[i] = Math.min(max, Math.max(max * 0.12, value));
  }
  return cap;
}

/**
 * Realistik qor yog'ishi (canvas). Ota element `relative isolate overflow-hidden` bo'lishi kerak.
 *
 * - Chuqurlik: uzoqdagi zarralar mayda, sekin va tiniq; yaqindagilari yirik, tez va xira.
 *   Eng yaqinlari matn oldidan o'tadi (alohida qatlam), qolganlari matn ortida.
 * - Har bir zarra o'z ritmida chayqaladi; yengil shabada sekin o'zgarib turadi.
 * - Vaqti-vaqti bilan shamol esadi: karta bo'ylab to'lqin bo'lib o'tadi, mayda zarralarni
 *   ko'proq uchiradi, qor bir zum sekinlab, pirpirab ko'tariladi — keyin yana tinchiydi.
 * - `pile` — qor kartaning pastida to'planadi: zarra qayerga tushsa, o'sha yer ko'tariladi.
 *   Uyum notekis (do'ngliklar, burchaklarda ko'proq), tik joyidan qor sirg'alib tushadi, shamol
 *   sirtidagi qorni surib turadi. Balandligi cheklangan — kartani to'ldirib yubormaydi.
 *   Uyum faqat komponent ichida yashaydi: boshqa bo'limga o'tilsa (komponent olib tashlansa)
 *   tozalanadi va qaytilganda qaytadan to'plana boshlaydi.
 * - Sahifa tez aylantirilsa, uyumdagi qor inersiya bilan sochiladi: parchalar kartaning
 *   harakatiga teskari tomonga uchadi, mayda chang havoda suzadi, bo'laklar uyumga qaytib
 *   tushadi yoki kartadan chiqib ketadi. Sekin aylantirishda qor joyida qoladi.
 * - Karta ko'rinmasa yoki tab fonda bo'lsa — to'xtaydi. "Harakatni kamaytirish" yoqilgan
 *   bo'lsa — bitta qo'zg'almas kadr chiziladi.
 */
export function Snowfall({ density = 1, pile: withPile = false }: { density?: number; pile?: boolean }) {
  const backRef = useRef<HTMLCanvasElement>(null);
  const frontRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const backCanvas = backRef.current;
    const frontCanvas = frontRef.current;
    const back = backCanvas?.getContext("2d");
    const front = frontCanvas?.getContext("2d");
    if (!backCanvas || !frontCanvas || !back || !front) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const sharp = makeSprite(0.45);
    const soft = makeSprite(0.14);

    let width = 0;
    let height = 0;
    let flakes: Flake[] = [];
    let pile: Pile | null = null;
    let debris: Debris[] = [];
    /** Kartaning ekrandagi o'rni va tezligi (aylantirilganda) — silkinishni aniqlash uchun. */
    let prevTop: number | null = null;
    let cardVelocity = 0;
    let gust: Gust | null = null;
    let nextGustAt = 2 + Math.random() * 3;
    let clock = 0;
    let last = 0;
    let frame = 0;
    let visible = true;

    const resize = () => {
      const rect = backCanvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      const sizeChanged = Math.abs(rect.width - width) > 1 || Math.abs(rect.height - height) > 1;
      width = rect.width;
      height = rect.height;
      const dpr = Math.min(MAX_DPR, window.devicePixelRatio || 1);
      for (const canvas of [backCanvas, frontCanvas]) {
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
      }
      back.setTransform(dpr, 0, 0, dpr, 0, 0);
      front.setTransform(dpr, 0, 0, dpr, 0, 0);

      if (sizeChanged || flakes.length === 0) {
        const count = Math.round(Math.min(150, Math.max(36, (width * height) / 720)) * density);
        flakes = Array.from({ length: count }, () => spawn(width, height, false));
      }
      if (withPile) {
        const columns = Math.max(8, Math.ceil(width / COL));
        const max = Math.min(PILE_MAX_PX, height * PILE_MAX_RATIO);
        if (!pile || pile.h.length !== columns) {
          const previous = pile;
          pile = { h: new Float32Array(columns), cap: makeCap(columns, max), max };
          // Karta kengligi o'zgarsa — to'plangan qor yangi ustunlarga ko'chiriladi.
          if (previous) {
            for (let i = 0; i < columns; i++) {
              const from = Math.min(previous.h.length - 1, Math.round((i / columns) * previous.h.length));
              pile.h[i] = Math.min(max, previous.h[from]);
            }
          } else if (reducedMotion) {
            for (let i = 0; i < columns; i++) pile.h[i] = pile.cap[i] * 0.7;
          }
        }
      }
      if (reducedMotion) draw();
    };

    const windAt = (x: number, t: number): number => {
      // Yengil shabada: sekin, ikki xil ritmda.
      let wind = 7 * Math.sin(t * 0.21) + 4 * Math.sin(t * 0.53 + 1.3);
      if (gust) {
        const upwind = gust.strength > 0 ? x : width - x;
        const tau = (t - gust.start - upwind / gust.frontSpeed) / gust.duration;
        if (tau > 0 && tau < 1) wind += gust.strength * Math.pow(Math.sin(Math.PI * tau), 1.4);
      }
      return wind;
    };

    /** Zarra uyumga qo'ndi: atrofidagi ustunlar biroz ko'tariladi (chegaraga yaqinlashgan sari kamroq). */
    const deposit = (target: Pile, x: number, r: number) => {
      // Boshida qor tezroq to'planadi — bir necha soniyada pastda yupqa qatlam ko'rinadi.
      const boost = 1 + 2.5 * Math.exp(-clock / 5);
      // Bitta zarra "haqiqiy"dan ko'proq qor qo'shadi — aks holda uyum daqiqalab ko'rinmay qolardi.
      const area = (20 + r * r * 5.5) * boost;
      const sigma = 5 + r * 1.6;
      const center = Math.round(x / COL);
      const span = Math.ceil((sigma * 2.2) / COL);
      let total = 0;
      for (let j = -span; j <= span; j++) total += Math.exp(-(((j * COL) / sigma) ** 2) / 2);
      const lastIndex = target.h.length - 1;
      for (let j = -span; j <= span; j++) {
        const i = Math.min(lastIndex, Math.max(0, center + j));
        const room = 1 - target.h[i] / target.cap[i];
        if (room <= 0) continue;
        const weight = Math.exp(-(((j * COL) / sigma) ** 2) / 2);
        target.h[i] += ((area * weight) / (total * COL)) * room;
      }
    };

    /** Uyumning o'zi: shamol sirtidagi qorni suradi, tik yonbag'irdan qor sirg'alib tushadi. */
    const settle = (target: Pile, dt: number) => {
      const h = target.h;
      const n = h.length;
      const wind = windAt(width / 2, clock);
      const carried = Math.min(0.2, Math.abs(wind) * WIND_CARRY * dt);
      if (carried > 0.0004) {
        // Shamol esayotgan tomondagi chetda qor devorga taqalib yig'iladi (burchakdagi uyum).
        if (wind > 0) {
          for (let i = n - 2; i >= 0; i--) {
            const moved = h[i] * carried;
            h[i] -= moved;
            h[i + 1] += moved;
          }
        } else {
          for (let i = 1; i < n; i++) {
            const moved = h[i] * carried;
            h[i] -= moved;
            h[i - 1] += moved;
          }
        }
      }
      const maxDiff = REPOSE_SLOPE * COL;
      for (let pass = 0; pass < 2; pass++) {
        for (let i = 0; i < n - 1; i++) {
          const diff = h[i] - h[i + 1];
          if (diff > maxDiff) {
            const slide = (diff - maxDiff) / 2;
            h[i] -= slide;
            h[i + 1] += slide;
          } else if (diff < -maxDiff) {
            const slide = (-diff - maxDiff) / 2;
            h[i] += slide;
            h[i + 1] -= slide;
          }
        }
      }
      // Balandlik cheklangan: uyum kartani to'ldirib yubormaydi.
      const limit = target.max * 1.08;
      for (let i = 0; i < n; i++) if (h[i] > limit) h[i] = limit;
    };

    /**
     * Sahifa aylantirildi — karta ekranda siljiyapti. Tez siljisa, uyumdagi qor inersiya bilan
     * joyidan ko'chadi: kartaning harakatiga teskari tomonga sochiladi (tepaga qaytarilganda —
     * yuqoriga otilib, havoda yoyiladi; pastga tushirilganda — kartadan tushib ketadi).
     */
    const shake = (target: Pile, velocity: number, dt: number) => {
      const speed = Math.abs(velocity);
      if (speed < SHAKE_MIN_SPEED || debris.length >= MAX_DEBRIS) return;
      const strength = Math.min(1, (speed - SHAKE_MIN_SPEED) / (SHAKE_FULL_SPEED - SHAKE_MIN_SPEED));
      const fraction = Math.min(0.6, strength * 5.5 * dt);
      const h = target.h;
      const inertiaVy = Math.max(-640, Math.min(640, -velocity * SHAKE_INERTIA));
      let budget = 0;
      for (let i = 0; i < h.length; i++) {
        if (h[i] < 0.6) continue;
        // Cho'qqilardan ko'proq ko'chadi — uyum tekislanib, yo'qolib boradi.
        const take = h[i] * fraction * (0.55 + 0.45 * Math.random()) * (0.6 + 0.4 * (h[i] / target.max));
        h[i] -= take;
        budget += take * COL;
        while (budget >= DEBRIS_AREA && debris.length < MAX_DEBRIS) {
          budget -= DEBRIS_AREA;
          const powder = Math.random() < 0.38;
          const surface = height - h[i] - Math.random() * Math.min(6, take + 2);
          debris.push({
            x: (i + Math.random()) * COL,
            y: surface,
            vx: (Math.random() - 0.5) * (powder ? 150 : 110) + windAt(i * COL, clock) * 0.4,
            vy: inertiaVy * (0.55 + Math.random() * 0.6) - 30 - Math.random() * 70 * strength,
            r: powder ? 2.4 + Math.random() * 2.6 : 1 + Math.random() * 1.9,
            powder,
            alpha: powder ? 0.32 + Math.random() * 0.22 : 0.75 + Math.random() * 0.25,
            age: 0,
            life: 1.6 + Math.random() * 1.6,
          });
        }
      }
    };

    const stepDebris = (dt: number) => {
      if (debris.length === 0) return;
      const next: Debris[] = [];
      const lastColumn = pile ? pile.h.length - 1 : 0;
      for (const d of debris) {
        d.age += dt;
        // Mayda chang havoda uzoqroq suzadi, shamol uni ko'proq olib ketadi.
        const drag = d.powder ? 2.6 : 1.1;
        const wind = windAt(d.x, clock) * (d.powder ? 0.9 : 0.35);
        d.vx += (wind - d.vx) * (1 - Math.exp(-drag * dt));
        d.vy += DEBRIS_GRAVITY * (d.powder ? 0.45 : 1) * dt;
        d.vy *= Math.exp(-(d.powder ? 1.6 : 0.35) * dt);
        d.x += d.vx * dt;
        d.y += d.vy * dt;
        if (d.age > d.life || d.y > height + 10 || d.x < -20 || d.x > width + 20) continue;
        // Pastga tushayotgan bo'lak uyum ustiga qayta qo'nadi.
        if (pile && d.vy > 0 && !d.powder && d.x >= 0 && d.x <= width) {
          const column = Math.min(lastColumn, Math.max(0, Math.floor(d.x / COL)));
          if (d.y >= height - pile.h[column]) {
            const room = 1 - pile.h[column] / pile.cap[column];
            if (room > 0) pile.h[column] += (DEBRIS_AREA / COL) * 0.6 * room;
            continue;
          }
        }
        next.push(d);
      }
      debris = next;
    };

    const step = (dt: number) => {
      clock += dt;
      if (gust && clock > gust.start + gust.duration + width / gust.frontSpeed) gust = null;
      if (!gust && clock >= nextGustAt) {
        // Shamol ko'pincha bir tomondan esadi, ba'zan teskarisidan.
        const direction = Math.random() < 0.72 ? 1 : -1;
        gust = {
          start: clock,
          duration: 1.4 + Math.random() * 1.6,
          strength: direction * (70 + Math.random() * 90),
          // Zarralardan ancha tez: aks holda shamol qorni bir tomonga "supurib", karta chetini bo'shatib qo'yadi.
          frontSpeed: 700 + Math.random() * 400,
        };
        nextGustAt = clock + gust.duration + 3 + Math.random() * 6;
      }

      const lastColumn = pile ? pile.h.length - 1 : 0;
      for (let i = 0; i < flakes.length; i++) {
        const f = flakes[i];
        const wind = windAt(f.x, clock);
        const gustiness = Math.min(1, Math.abs(wind) / 120);
        // Mayda zarralar yengil — shamol ularni ko'proq olib ketadi.
        const targetVx = wind * (1.25 - 0.55 * f.z) + f.swayAmp * Math.sin(clock * f.swayFreq + f.phase);
        const flutter = gustiness * 16 * Math.sin(clock * 2.6 + f.phase * 3);
        const targetVy = f.fall * (1 - 0.3 * gustiness) - flutter;
        const response = 1 - Math.exp(-dt * (2 + (1 - f.z) * 2.5));
        f.vx += (targetVx - f.vx) * response;
        f.vy += (targetVy - f.vy) * response;
        f.x += f.vx * dt;
        f.y += f.vy * dt;

        if (pile && f.x >= 0 && f.x <= width) {
          const column = Math.min(lastColumn, Math.max(0, Math.floor(f.x / COL)));
          if (f.y >= height - pile.h[column]) {
            deposit(pile, f.x, f.r);
            flakes[i] = spawn(width, height, true);
            continue;
          }
        }
        if (f.y > height + 8 || f.y < -48) flakes[i] = spawn(width, height, true);
        else if (f.x < -24) f.x = width + 24;
        else if (f.x > width + 24) f.x = -24;
      }
      if (pile) settle(pile, dt);
      stepDebris(dt);
    };

    /** Uyum sirti bo'ylab silliq kontur; `sink` — konturni shuncha px pastga suradi. */
    const tracePile = (ctx: CanvasRenderingContext2D, target: Pile, sink: number) => {
      const h = target.h;
      const n = h.length;
      ctx.beginPath();
      ctx.moveTo(-4, height + 4);
      ctx.lineTo(-4, height - h[0] + sink);
      for (let i = 0; i < n - 1; i++) {
        const x = (i + 0.5) * COL;
        const y = height - h[i] + sink;
        ctx.quadraticCurveTo(x, y, x + COL / 2, height - (h[i] + h[i + 1]) / 2 + sink);
      }
      ctx.lineTo(width + 4, height - h[n - 1] + sink);
      ctx.lineTo(width + 4, height + 4);
      ctx.closePath();
    };

    const drawPile = (ctx: CanvasRenderingContext2D, target: Pile) => {
      ctx.save();
      ctx.globalAlpha = 1;
      // Yuqori qatlam: oppoq, cheti biroz momiq.
      tracePile(ctx, target, 0);
      ctx.shadowColor = "rgba(255,255,255,0.6)";
      ctx.shadowBlur = 5;
      ctx.fillStyle = "#ffffff";
      ctx.fill();
      // Ichki qismi ko'kimtirroq — sirt bo'ylab oq "po'stloq" qoladi, do'ngliklar hajmli ko'rinadi.
      ctx.clip();
      ctx.shadowColor = "rgba(203,219,242,0.9)";
      ctx.shadowBlur = 6;
      const body = ctx.createLinearGradient(0, height - target.max, 0, height);
      body.addColorStop(0, "#edf3fc");
      body.addColorStop(1, "#d3e0f4");
      ctx.fillStyle = body;
      tracePile(ctx, target, 5);
      ctx.fill();
      ctx.restore();
    };

    function draw() {
      if (!back || !front) return;
      back.clearRect(0, 0, width, height);
      front.clearRect(0, 0, width, height);
      for (const f of flakes) {
        const ctx = f.z > FRONT_Z ? front : back;
        const near = f.z > 0.6;
        const sprite = near ? soft : sharp;
        const size = f.r * (near ? 3.2 : 2.6);
        ctx.globalAlpha = f.alpha;
        ctx.drawImage(sprite, f.x - size / 2, f.y - size / 2, size, size);
        // Shamolda tez uchayotgan zarra ortidan yengil iz qoladi.
        if (Math.hypot(f.vx, f.vy) > 75) {
          ctx.globalAlpha = f.alpha * 0.45;
          ctx.drawImage(sprite, f.x - f.vx * 0.022 - size / 2, f.y - f.vy * 0.022 - size / 2, size, size);
        }
      }
      if (pile) drawPile(back, pile);
      for (const d of debris) {
        const fade = Math.min(1, (d.life - d.age) / 0.5);
        const size = d.r * (d.powder ? 3.4 : 2.6);
        back.globalAlpha = d.alpha * Math.max(0, fade);
        back.drawImage(d.powder ? soft : sharp, d.x - size / 2, d.y - size / 2, size, size);
      }
    }

    const tick = (now: number) => {
      const dt = last === 0 ? 0 : Math.min(MAX_STEP, (now - last) / 1000);
      last = now;
      if (pile) {
        const top = backCanvas.getBoundingClientRect().top;
        if (prevTop !== null && dt > 0) {
          const raw = (top - prevTop) / dt;
          cardVelocity = cardVelocity * 0.5 + raw * 0.5;
          shake(pile, cardVelocity, dt);
        }
        prevTop = top;
      }
      step(dt);
      draw();
      frame = requestAnimationFrame(tick);
    };

    const sync = () => {
      const shouldRun = !reducedMotion && visible && !document.hidden && width > 0;
      if (shouldRun && frame === 0) {
        last = 0;
        // Karta ko'rinmay turgan paytdagi siljish "silkinish" deb hisoblanmasin.
        prevTop = null;
        cardVelocity = 0;
        frame = requestAnimationFrame(tick);
      } else if (!shouldRun && frame !== 0) {
        cancelAnimationFrame(frame);
        frame = 0;
      }
    };

    resize();
    const resizeObserver = new ResizeObserver(() => {
      resize();
      sync();
    });
    resizeObserver.observe(backCanvas);
    const viewObserver = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      sync();
    });
    viewObserver.observe(backCanvas);
    document.addEventListener("visibilitychange", sync);
    sync();

    return () => {
      if (frame !== 0) cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      viewObserver.disconnect();
      document.removeEventListener("visibilitychange", sync);
    };
  }, [density, withPile]);

  return (
    <>
      <canvas ref={backRef} aria-hidden className="pointer-events-none absolute inset-0 -z-10 size-full" />
      <canvas ref={frontRef} aria-hidden className="pointer-events-none absolute inset-0 z-10 size-full" />
    </>
  );
}
