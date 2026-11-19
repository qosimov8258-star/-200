"use client";

import { useEffect, useMemo, useState } from "react";
import { Dices, PartyPopper } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { formatNumber } from "@/lib/format";
import type { VoucherDraw } from "@/lib/types";

/** Animatsiya kamida shuncha davom etadi (natija tezroq kelsa ham). */
const MIN_ROLL_MS = 2600;
const TICK_MS = 80;
const CONFETTI_COLORS = ["#2563eb", "#7c3aed", "#f59e0b", "#10b981", "#ef4444", "#06b6d4"];

interface DrawRollingDialogProps {
  /** Aylanadigan ismlar (natija kelguncha — nomzodlar namunasi). */
  names: string[];
  /** Server natijasi; kelmaguncha — null. */
  result: VoucherDraw | null;
  onOpen: (draw: VoucherDraw) => void;
}

/** Tanlov paytidagi "baraban": ismlar aylanadi, keyin g'oliblar soni va konfetti. */
export function DrawRollingDialog({ names, result, onOpen }: DrawRollingDialogProps) {
  const [started] = useState(() => Date.now());
  const [tick, setTick] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const done = result !== null && elapsed >= MIN_ROLL_MS;

  const pool = useMemo(() => {
    const winners = result?.winnerEntries.map((e) => `${e.candidate.firstName} ${e.candidate.lastName}`) ?? [];
    const all = [...names, ...winners];
    return all.length > 0 ? all : ["…"];
  }, [names, result]);

  useEffect(() => {
    if (done) return;
    const timer = setInterval(() => {
      setTick((t) => t + 1);
      setElapsed(Date.now() - started);
    }, TICK_MS);
    return () => clearInterval(timer);
  }, [done, started]);

  const confetti = useMemo(
    () =>
      Array.from({ length: 28 }, (_, i) => ({
        left: `${(i * 37) % 100}%`,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        dx: `${((i * 53) % 120) - 60}px`,
        dy: `${140 + ((i * 29) % 120)}px`,
        rot: `${(i * 67) % 540}deg`,
        delay: `${(i % 7) * 40}ms`,
      })),
    [],
  );

  const firstWinner = result?.winnerEntries[0]?.candidate;
  const shown = done && firstWinner ? `${firstWinner.firstName} ${firstWinner.lastName}` : pool[tick % pool.length];

  return (
    <Dialog open onClose={() => result && onOpen(result)} busy={!done} title="Random tanlov" className="max-w-lg">
      <div className="relative overflow-hidden rounded-xl bg-[linear-gradient(160deg,#0f172a,#1e1b4b_60%,#312e81)] px-6 py-8 text-center text-white">
        {done &&
          confetti.map((c, i) => (
            <span
              key={i}
              aria-hidden
              className="absolute top-0 size-2 animate-confetti rounded-[2px]"
              style={
                {
                  left: c.left,
                  background: c.color,
                  animationDelay: c.delay,
                  "--dx": c.dx,
                  "--dy": c.dy,
                  "--rot": c.rot,
                } as React.CSSProperties
              }
            />
          ))}

        <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-white/10">
          {done ? (
            <PartyPopper className="size-7 text-amber-300" aria-hidden />
          ) : (
            <Dices className="size-7 animate-spin text-white [animation-duration:1.2s]" aria-hidden />
          )}
        </div>
        <p className="mt-4 text-xs font-medium tracking-[0.2em] text-white/60 uppercase">
          {done ? "1-g'olib" : "Nomzodlar aralashtirilmoqda"}
        </p>
        <div className="mt-2 flex h-12 items-center justify-center overflow-hidden" aria-live="polite">
          <p key={done ? "done" : tick} className="animate-draw-flip truncate text-3xl font-black tracking-tight">
            {shown}
          </p>
        </div>

        {done && result ? (
          <>
            <p className="mt-4 text-sm text-white/80">
              <span className="text-lg font-bold text-white tabular-nums">{formatNumber(result.winners)}</span> g&apos;olib
              va <span className="font-bold text-white tabular-nums">{formatNumber(result.reserves)}</span> zaxira{" "}
              {formatNumber(result.poolSize)} nomzod orasidan aniqlandi
            </p>
            <Button className="mt-5" onClick={() => onOpen(result)} data-autofocus>
              Natijani ko&apos;rish
            </Button>
          </>
        ) : (
          <div className="mx-auto mt-5 h-1.5 w-48 overflow-hidden rounded-full bg-white/15">
            <div
              className="h-full rounded-full bg-white transition-[width] duration-100"
              style={{ width: `${Math.min(100, (elapsed / MIN_ROLL_MS) * 100)}%` }}
            />
          </div>
        )}
      </div>
    </Dialog>
  );
}
