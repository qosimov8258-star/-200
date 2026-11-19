import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { ArrowRight, CalendarDays } from "lucide-react";
import type { CSSProperties } from "react";

import carFallback from "../assets/hero_car.webp";
import { GiftWrap } from "../components/GiftWrap";
import { HomeGreeting } from "../components/HomeGreeting";
import { OliviaFestive } from "../components/OliviaFestive";
import { Snowfall } from "../components/Snowfall";
import { Spinner } from "../components/ui";
import { t } from "../i18n/uz";
import * as api from "../lib/api";
import { daysUntil, formatCount } from "../lib/format";
import type { ContestPrizes, PrizeTier } from "../lib/types";

/**
 * Sovg'alarning haqiqiy rasmlari: `src/assets/prizes/<nom>.<webp|png|jpg>`
 * (car, phone, tablet, voucher). Fayl bo'lmasa — rasm o'rni bo'sh qoladi (mashina uchun eski rasm).
 */
const PHOTOS = import.meta.glob<string>("../assets/prizes/*.{webp,png,jpg,jpeg}", {
  eager: true,
  import: "default",
});

type PhotoKey = "car" | "phone" | "tablet" | "voucher";

function photo(key: PhotoKey): string | null {
  const entry = Object.entries(PHOTOS).find(([path]) => path.split("/").pop()?.split(".")[0] === key);
  return entry ? entry[1] : key === "car" ? carFallback : null;
}

const rise = (i: number): CSSProperties => ({ animationDelay: `${i * 90}ms` });

const viewsRange = (min: number, max: number | null) =>
  max === null
    ? `${formatCount(min)}+ ${t.viewsWord}`
    : `${formatCount(min)} – ${formatCount(max)} ${t.viewsWord}`;

const dmy = (iso: string) => iso.split("-").reverse().join(".");

/** Bosh sahifa ("Asosiy"): "Olivia tanlovi boshlandi" xabari va tanlov sovg'alari. */
export function HomeScreen({
  firstName,
  fullName,
  onOpenPrizes,
  onJoin,
}: {
  firstName: string;
  fullName: string;
  onOpenPrizes: () => void;
  /** Faqat mehmon uchun: bannerda "Ishtirok etish" tugmasi (Profil — ro'yxatdan o'tish). */
  onJoin?: () => void;
}) {
  const contest = useQuery({ queryKey: ["contest"], queryFn: api.getContest });
  const prizes = useQuery({ queryKey: ["prizes"], queryFn: api.getPrizes });

  return (
    <div className="space-y-5">
      <HomeGreeting firstName={firstName} fullName={fullName} />

      <StartedBanner
        daysLeft={contest.data ? daysUntil(contest.data.endsAt) : null}
        period={
          prizes.data && prizes.data.stages.length > 0
            ? `${dmy(prizes.data.stages[0].startsOn)} – ${dmy(prizes.data.stages.at(-1)!.endsOn)}`
            : null
        }
        onJoin={onJoin}
      />

      {prizes.isPending ? <Spinner /> : prizes.data ? <PrizeShowcase prizes={prizes.data} onOpenPrizes={onOpenPrizes} /> : null}
    </div>
  );
}

/**
 * "Olivia tanlovi boshlandi!" — brend qizilidagi bayram kartasi: ichida qor yog'adi (ba'zan
 * shamol uchiradi), "Olivia" yozuvi ustida qor to'planib turadi, kartaning pastida esa qor
 * asta-sekin uyum bo'lib yig'iladi (boshqa bo'limga o'tib qaytilsa — qaytadan boshlanadi).
 */
function StartedBanner({
  daysLeft,
  period,
  onJoin,
}: {
  daysLeft: number | null;
  period: string | null;
  onJoin?: () => void;
}) {
  return (
    <section className="relative isolate animate-rise overflow-hidden rounded-card bg-[linear-gradient(140deg,#f2583f_0%,#df3425_48%,#ad1f2c_100%)] p-[22px] pb-[50px] text-white shadow-[0_18px_40px_-22px_rgba(173,31,44,0.75)]">
      {/* Pastki bo'sh joy (pb) — to'planadigan qor uyumi uchun; u tugmalarni yopmaydi. */}
      {/* Yumshoq nurlar va uchqunlar */}
      <div aria-hidden className="absolute -top-20 -right-16 -z-10 size-60 rounded-full bg-[#ffb36b]/45 blur-3xl" />
      <div aria-hidden className="absolute -bottom-24 -left-16 -z-10 size-64 rounded-full bg-[#ff7aa8]/30 blur-3xl" />
      <div
        aria-hidden
        className="absolute inset-0 -z-10 opacity-[0.12] [background-image:radial-gradient(circle,white_1px,transparent_1.5px)] [background-size:18px_18px] [mask-image:linear-gradient(to_bottom_left,black,transparent_70%)]"
      />
      {[
        { top: "16%", right: "12%", size: 10, delay: "0s" },
        { top: "38%", right: "26%", size: 6, delay: "0.9s" },
        { top: "12%", right: "38%", size: 5, delay: "1.7s" },
      ].map((s) => (
        <span
          key={s.right}
          aria-hidden
          className="absolute block bg-white [clip-path:polygon(50%_0,60%_40%,100%_50%,60%_60%,50%_100%,40%_60%,0_50%,40%_40%)] motion-safe:animate-twinkle"
          style={{ top: s.top, right: s.right, width: s.size, height: s.size, animationDelay: s.delay }}
        />
      ))}
      <Snowfall pile />

      <h2>
        <OliviaFestive variant="snow" className="h-[68px] w-auto drop-shadow-[0_2px_6px_rgba(0,0,0,0.18)]" />
        <span className="mt-1.5 block text-[28px] leading-[1.1] font-bold tracking-tight">{t.homeStartedTitle}</span>
      </h2>
      <p className="mt-2.5 max-w-[30ch] text-[14px] leading-snug text-white/90">{t.homeStartedBody}</p>

      {(period || daysLeft !== null || onJoin) && (
        <div className="mt-4 flex flex-wrap items-center gap-2 text-[13px]">
          {period && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-black/15 px-3 py-1.5 font-medium">
              <CalendarDays className="size-4" aria-hidden />
              {period}
            </span>
          )}
          {/* Qolgan kunlar va (mehmonga) "Ishtirok etish" — bir qatorda, birga ko'chadi. */}
          <span className="inline-flex flex-wrap items-center gap-2">
            {daysLeft !== null && daysLeft > 0 && (
              <span className="rounded-full bg-white px-3 py-1.5 font-semibold text-[#c22a24]">{t.homeDaysLeft(daysLeft)}</span>
            )}
            {onJoin && (
              <button
                type="button"
                onClick={onJoin}
                className="inline-flex items-center gap-1.5 rounded-full bg-ink py-1.5 pr-2.5 pl-3.5 font-semibold text-white shadow-[0_6px_16px_-6px_rgba(0,0,0,0.55)] transition active:scale-[0.97]"
              >
                {t.homeJoin}
                <ArrowRight className="size-4" aria-hidden />
              </button>
            )}
          </span>
        </div>
      )}
    </section>
  );
}

/**
 * Sovg'alar: bosh sovrin (mashina) katta, iPhone va planshet yonma-yon, voucher pastda.
 * Har bir karta sovg'adek o'ralgan: chetida qizil lenta, tepasida tugunli bantik (`GiftWrap`).
 */
function PrizeShowcase({ prizes, onOpenPrizes }: { prizes: ContestPrizes; onOpenPrizes: () => void }) {
  const tier = (kind: PrizeTier["kind"]) => prizes.tiers.find((item) => item.kind === kind) ?? null;
  const car = tier("car");
  const phone = tier("phone");
  const tablet = tier("tablet");

  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between">
        <h2 className="text-[22px] font-bold tracking-tight">{t.homePrizesTitle}</h2>
        <button type="button" onClick={onOpenPrizes} className="inline-flex items-center gap-1 text-[14px] font-semibold text-muted">
          {t.homeAllPrizes}
          <ArrowRight className="size-4" aria-hidden />
        </button>
      </div>

      {car && (
        // Rasm oq "studiya" fonida (ustida bantik bilan) — karta ham oq, rasm u bilan qo'shilib ketadi.
        <GiftWrap className="animate-rise" style={rise(1)} innerClassName="bg-white">
          <article className="p-5">
            <span className="inline-flex rounded-full bg-gold px-2.5 py-1 text-[12px] font-bold text-ink">{t.mainPrize}</span>
            <img
              src={photo("car") ?? carFallback}
              alt={car.title}
              className="mx-auto mt-1 w-full max-w-[420px]"
              draggable={false}
            />
            <h3 className="mt-1 text-[20px] font-bold tracking-tight">{car.title}</h3>
            <p className="mt-0.5 text-[13px] text-muted">{viewsRange(car.minViews, car.maxViews)}</p>
          </article>
        </GiftWrap>
      )}

      <div className="grid grid-cols-2 gap-3">
        {[phone, tablet].map((item, index) =>
          item ? (
            <GiftWrap key={item.kind} bow="sm" className="animate-rise" style={rise(2 + index)}>
              <article className="p-3">
                <PrizePhoto
                  src={photo(item.kind === "phone" ? "phone" : "tablet")}
                  alt={item.title}
                  className="h-32 w-full rounded-tile bg-[radial-gradient(circle_at_50%_40%,#ffffff,#eef0f3)]"
                />
                <h3 className="mt-3 truncate text-[16px] font-bold tracking-tight">{item.title}</h3>
                <p className="text-[13px] font-semibold text-ink/80">{t.pieces(item.quantity, item.unit)}</p>
                <p className="mt-0.5 text-[12px] text-muted">{viewsRange(item.minViews, item.maxViews)}</p>
              </article>
            </GiftWrap>
          ) : null,
        )}
      </div>

      <GiftWrap bow="sm" className="animate-rise" style={rise(4)}>
        <article className="flex items-center gap-4 p-3">
          <PrizePhoto
            src={photo("voucher")}
            alt={prizes.monthly.title}
            className="h-24 w-32 shrink-0 rounded-tile bg-[radial-gradient(circle_at_50%_40%,#fff7ef,#fdeee6)]"
          />
          <div className="min-w-0">
            <h3 className="text-[16px] leading-tight font-bold tracking-tight">{prizes.monthly.title}</h3>
            <p className="mt-0.5 text-[15px] font-bold text-[#c22a24]">
              {formatCount(prizes.monthly.amount)} {t.sum}
            </p>
            <p className="mt-1 text-[12px] text-muted">
              {t.homeVoucherCount(prizes.monthly.perMonth, prizes.monthly.total)}
            </p>
          </div>
        </article>
      </GiftWrap>
    </section>
  );
}

/** Sovg'aning haqiqiy rasmi; rasm hali qo'yilmagan bo'lsa — faqat bo'sh fon. */
function PrizePhoto({ src, alt, className }: { src: string | null; alt: string; className?: string }) {
  return (
    <div className={clsx("overflow-hidden p-2.5", className)}>
      {src && (
        <img
          src={src}
          alt={alt}
          className="size-full object-contain drop-shadow-[0_10px_14px_rgba(30,31,34,0.22)]"
          draggable={false}
        />
      )}
    </div>
  );
}
