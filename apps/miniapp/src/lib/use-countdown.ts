import { useEffect, useState } from "react";

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export interface Countdown {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  /** Muddat tugagan (qolgan vaqt 0). */
  over: boolean;
}

/**
 * Berilgan vaqtgacha qolgan muddat: kun / soat / daqiqa / soniya. `tickMs` — qanchada bir
 * yangilanadi (soniyalar ko'rsatilsa — 1 soniya). `endsAt` bo'lmasa — `null`.
 */
export function useCountdown(endsAt: string | null, tickMs = SECOND): Countdown | null {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!endsAt) return;
    const timer = window.setInterval(() => setNow(Date.now()), tickMs);
    return () => window.clearInterval(timer);
  }, [endsAt, tickMs]);

  if (!endsAt) return null;
  const left = Math.max(0, new Date(endsAt).getTime() - now);
  return {
    days: Math.floor(left / DAY),
    hours: Math.floor(left / HOUR) % 24,
    minutes: Math.floor(left / MINUTE) % 60,
    seconds: Math.floor(left / SECOND) % 60,
    over: left === 0,
  };
}
