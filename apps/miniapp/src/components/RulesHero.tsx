import { useQuery } from "@tanstack/react-query";
import { CalendarDays, ScrollText, Snowflake } from "lucide-react";

import { t } from "../i18n/uz";
import * as api from "../lib/api";
import { Snowfall } from "./Snowfall";

const dmy = (iso: string) => iso.split("-").reverse().join(".");

/**
 * "Tanlov qoidalari" sahifasining sarlavhasi — qishki bayram kartasi (bosh sahifadagi
 * "Olivia tanlovi boshlandi" banneri uslubida): qizil fon, yog'ayotgan qor, katta qor parchasi,
 * bo'limlar soni va tanlov muddati.
 */
export function RulesHero() {
  const rules = useQuery({ queryKey: ["rules"], queryFn: api.getRules });
  const prizes = useQuery({ queryKey: ["prizes"], queryFn: api.getPrizes });
  const stages = prizes.data?.stages ?? [];
  const period = stages.length > 0 ? `${dmy(stages[0].startsOn)} – ${dmy(stages.at(-1)!.endsOn)}` : null;

  return (
    <section className="relative isolate animate-rise overflow-hidden rounded-card bg-[linear-gradient(140deg,#f2583f_0%,#df3425_48%,#ad1f2c_100%)] p-[22px] text-white shadow-[0_18px_40px_-22px_rgba(173,31,44,0.75)]">
      <div aria-hidden className="absolute -top-20 -right-16 -z-10 size-60 rounded-full bg-[#ffb36b]/45 blur-3xl" />
      <div aria-hidden className="absolute -bottom-24 -left-16 -z-10 size-64 rounded-full bg-[#ff7aa8]/30 blur-3xl" />
      <div
        aria-hidden
        className="absolute inset-0 -z-10 opacity-[0.12] [background-image:radial-gradient(circle,white_1px,transparent_1.5px)] [background-size:18px_18px] [mask-image:linear-gradient(to_bottom_left,black,transparent_70%)]"
      />
      <Snowflake
        aria-hidden
        className="absolute -right-8 -bottom-10 -z-10 size-44 text-white/[0.13] motion-safe:animate-[spin_40s_linear_infinite]"
        strokeWidth={1.1}
      />
      <Snowfall density={0.8} />

      <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-2.5 py-1 text-[12px] font-semibold backdrop-blur-sm">
        <ScrollText className="size-3.5" aria-hidden />
        {t.rulesHeroBadge}
      </span>
      <h1 className="mt-3 text-[30px] leading-[1.1] font-bold tracking-tight">{t.rulesTitle} ❄️</h1>
      <p className="mt-2 max-w-[32ch] text-[14px] leading-snug text-white/90">{t.rulesHeroBody}</p>

      {(rules.data || period) && (
        <div className="mt-4 flex flex-wrap items-center gap-2 text-[13px]">
          {rules.data && (
            <span className="rounded-full bg-white px-3 py-1.5 font-semibold text-[#c22a24]">
              {t.rulesSectionsCount(rules.data.sections.length)}
            </span>
          )}
          {period && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-black/15 px-3 py-1.5 font-medium">
              <CalendarDays className="size-4" aria-hidden />
              {period}
            </span>
          )}
        </div>
      )}
    </section>
  );
}
