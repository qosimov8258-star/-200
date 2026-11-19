import { Trophy } from "lucide-react";
import type { ReactNode } from "react";

import carUrl from "../assets/hero_car.webp";
import { t } from "../i18n/uz";
import { Snowfall } from "./Snowfall";

/**
 * Bosh sovrin kartasi — avtosalon sahnasi: yuqoridan ikki projektor nuri,
 * oltin hoshiyali podium, mashina va uning podiumdagi xira aksi.
 * Mobil ilovadagi `prize_car_hero.dart` ning veb ko'rinishi.
 */
export function PrizeHero({ prizeName, children }: { prizeName: string; children?: ReactNode }) {
  return (
    <section className="relative isolate flex min-h-[460px] flex-col overflow-hidden rounded-card bg-[linear-gradient(180deg,#0f1922_0%,#1c2b38_50%,#101114_100%)] p-[22px] text-white">
      {/* Projektor nurlari */}
      <div
        aria-hidden
        className="absolute -top-6 left-[-14%] -z-10 h-[62%] w-[70%] origin-top -rotate-[24deg] bg-[linear-gradient(180deg,rgba(255,255,255,0.28),rgba(255,217,168,0.03))] blur-xl [clip-path:polygon(44%_0,56%_0,100%_100%,0_100%)]"
      />
      <div
        aria-hidden
        className="absolute -top-6 right-[-14%] -z-10 h-[62%] w-[70%] origin-top rotate-[24deg] bg-[linear-gradient(180deg,rgba(255,255,255,0.28),rgba(255,217,168,0.03))] blur-xl [clip-path:polygon(44%_0,56%_0,100%_100%,0_100%)]"
      />
      <span aria-hidden className="absolute top-1 left-[9%] size-3 rounded-full bg-white blur-[3px]" />
      <span aria-hidden className="absolute top-1 right-[9%] size-3 rounded-full bg-white blur-[3px]" />
      <Snowfall density={0.7} />

      <div className="flex w-fit items-center gap-2.5 rounded-full border border-white/25 bg-white/10 py-1.5 pr-4 pl-1.5 backdrop-blur">
        <span className="grid size-[34px] place-items-center rounded-full bg-gold text-ink">
          <Trophy className="size-[18px]" />
        </span>
        <span className="leading-tight">
          <span className="block text-[11px] text-white/70">{t.prizeLabel}</span>
          <span className="block text-sm font-bold">{prizeName}</span>
        </span>
      </div>

      {/* Sahna: podium + mashina + aks */}
      <div className="relative mx-auto mt-8 mb-4 w-full max-w-[420px]">
        <div aria-hidden className="absolute inset-x-[2%] bottom-[2%] h-[26%]">
          <div className="absolute inset-0 translate-y-[18%] rounded-[50%] bg-[#ffd9a8]/15 blur-2xl" />
          <div className="absolute inset-0 translate-y-[12%] rounded-[50%] bg-[#0a0d10]" />
          <div className="absolute inset-0 rounded-[50%] bg-[radial-gradient(ellipse_at_center,#4a5766,#151b22_70%)] shadow-[0_0_14px_3px_rgba(232,184,74,0.55)] ring-[1.5px] ring-[#ffe2aa]" />
          <div className="absolute inset-x-[12%] top-[8%] h-[70%] rounded-[50%] bg-black/55 blur-md" />
        </div>
        <img
          src={carUrl}
          alt={prizeName}
          className="relative w-full animate-rise drop-shadow-[0_12px_18px_rgba(0,0,0,0.35)]"
          draggable={false}
        />
        <img
          src={carUrl}
          alt=""
          aria-hidden
          className="absolute top-[86%] left-0 w-full -scale-y-100 opacity-15 [mask-image:linear-gradient(to_top,black,transparent_55%)]"
          draggable={false}
        />
      </div>

      <div className="mt-auto">
        <h2 className="text-[30px] leading-[1.1] font-bold tracking-tight whitespace-pre-line">
          {t.heroTitle}
        </h2>
        <p className="mt-2.5 text-[15px] leading-snug text-white/70">{t.heroBody}</p>
      </div>
      {children}
    </section>
  );
}
