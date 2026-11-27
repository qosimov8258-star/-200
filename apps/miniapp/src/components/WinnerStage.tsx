import { Trophy } from "lucide-react";
import type { ReactNode } from "react";

import carUrl from "../assets/hero_car.webp";
import { t } from "../i18n";
import { formatCount, formatDateTime } from "../lib/format";
import { useCountdown } from "../lib/use-countdown";
import type { Winner } from "../lib/types";
import { Snowfall } from "./Snowfall";

/**
 * "G'olib" sahifasi — qishki tun sahnasi: to'q ko'k osmon, qor, aylanayotgan oltin nurlar
 * va o'rtada oltin kubok medali. E'lon qilinmagan bo'lsa — jonli ortga sanoq, e'lon qilingan
 * bo'lsa — g'olib ismi. Pastda bosh sovrin (bantikli BYD Chazor).
 */
function Stage({ children }: { children: ReactNode }) {
  return (
    <section className="relative isolate animate-rise overflow-hidden rounded-card bg-[linear-gradient(165deg,#222a55_0%,#151a39_52%,#0b0d1f_100%)] px-5 pt-7 pb-5 text-center text-white shadow-[0_20px_44px_-24px_rgba(11,13,31,0.9)]">
      {/* Kubok ortidagi oltin shu'la va sekin aylanuvchi nurlar */}
      <div aria-hidden className="absolute top-[-90px] left-1/2 -z-10 size-[340px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(255,214,128,0.42),rgba(255,214,128,0)_62%)]" />
      <div
        aria-hidden
        className="absolute top-[-120px] left-1/2 -z-10 size-[400px] -translate-x-1/2 rounded-full opacity-60 [background:repeating-conic-gradient(from_0deg,rgba(255,226,170,0.16)_0deg_6deg,transparent_6deg_18deg)] [mask-image:radial-gradient(circle,black_10%,transparent_60%)] motion-safe:animate-[spin_60s_linear_infinite]"
      />
      <div aria-hidden className="absolute -bottom-24 -left-20 -z-10 size-64 rounded-full bg-[#df3425]/25 blur-3xl" />
      {[
        { top: "14%", left: "12%", size: 7, delay: "0s" },
        { top: "26%", left: "84%", size: 9, delay: "1.1s" },
        { top: "8%", left: "70%", size: 5, delay: "2s" },
        { top: "40%", left: "8%", size: 5, delay: "0.6s" },
      ].map((s) => (
        <span
          key={s.left}
          aria-hidden
          className="absolute -z-10 block bg-[#ffe9b0] [clip-path:polygon(50%_0,60%_40%,100%_50%,60%_60%,50%_100%,40%_60%,0_50%,40%_40%)] motion-safe:animate-twinkle"
          style={{ top: s.top, left: s.left, width: s.size, height: s.size, animationDelay: s.delay }}
        />
      ))}
      <Snowfall density={0.9} />
      {children}
    </section>
  );
}

/** Oltin kubok medali. */
function TrophyMedal() {
  return (
    <span className="relative mx-auto grid size-[92px] place-items-center rounded-full bg-[radial-gradient(circle_at_35%_28%,#fff4cc,#f3c656_42%,#b47716)] text-[#6b3f07] shadow-[0_0_0_6px_rgba(255,226,170,0.18),0_14px_30px_-10px_rgba(232,184,74,0.75)]">
      <span aria-hidden className="absolute inset-[7px] rounded-full ring-1 ring-[#fff1b8]/70" />
      <Trophy className="size-11" strokeWidth={2} aria-hidden />
    </span>
  );
}

/** Bosh sovrin qatori: bantikli mashina va nomi. */
function PrizeRow({ prizeName }: { prizeName: string }) {
  return (
    <div className="mt-5 flex items-center gap-3 rounded-[22px] bg-white/[0.08] p-3 text-left ring-1 ring-white/15 backdrop-blur-sm">
      <img src={carUrl} alt={prizeName} className="h-14 w-24 shrink-0 object-contain" draggable={false} />
      <span className="min-w-0">
        <span className="block text-[12px] text-white/60">{t.mainPrize}</span>
        <span className="block truncate text-[16px] font-bold">{prizeName}</span>
      </span>
    </div>
  );
}

/** G'olib sahifasida soniyalar ko'rsatilmaydi — har yarim daqiqada yangilash yetarli. */
const TICK_MS = 30_000;

export function WinnerPending({ endsAt, prizeName }: { endsAt: string | null; prizeName: string }) {
  const left = useCountdown(endsAt, TICK_MS);

  return (
    <Stage>
      <TrophyMedal />
      <h2 className="mt-5 text-[24px] leading-tight font-bold tracking-tight">{t.winnerPendingTitle}</h2>
      <p className="mx-auto mt-2 max-w-[30ch] text-[14px] leading-snug text-white/75">{t.winnerPendingBody}</p>

      {left && !left.over && (
        <>
          <p className="mt-5 text-[12px] font-semibold tracking-[0.12em] text-[#ffe2aa] uppercase">{t.winnerCountdown}</p>
          <div className="mt-2.5 grid grid-cols-3 gap-2">
            {[
              { value: left.days, label: t.winnerUnitDays },
              { value: left.hours, label: t.winnerUnitHours },
              { value: left.minutes, label: t.winnerUnitMinutes },
            ].map((unit) => (
              <span key={unit.label} className="rounded-2xl bg-white/[0.09] py-3 ring-1 ring-white/15 backdrop-blur-sm">
                <span className="block text-[28px] leading-none font-bold tabular-nums">{String(unit.value).padStart(2, "0")}</span>
                <span className="mt-1.5 block text-[12px] text-white/65">{unit.label}</span>
              </span>
            ))}
          </div>
        </>
      )}

      {prizeName && <PrizeRow prizeName={prizeName} />}
    </Stage>
  );
}

export function WinnerAnnounced({ winner, prizeName }: { winner: Winner; prizeName: string }) {
  return (
    <Stage>
      <TrophyMedal />
      <p className="mt-5 text-[14px] font-semibold tracking-[0.12em] text-[#ffe2aa] uppercase">{t.winnerCongrats}</p>
      <h2 className="mt-1.5 text-[30px] leading-tight font-bold tracking-tight">{winner.fullName}</h2>
      <p className="mx-auto mt-3 w-fit rounded-full bg-[linear-gradient(90deg,#f3c656,#ffe9b0,#f3c656)] px-3.5 py-1.5 text-[13px] font-bold text-[#6b3f07]">
        {t.winnerPrize}
      </p>
      <p className="mt-4 text-[22px] font-bold tabular-nums">{t.views(formatCount(winner.finalViews))}</p>
      <p className="mt-1 text-[12px] text-white/60">{t.winnerAnnounced(formatDateTime(winner.announcedAt))}</p>
      {prizeName && <PrizeRow prizeName={prizeName} />}
    </Stage>
  );
}
