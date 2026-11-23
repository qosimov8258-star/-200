import clsx from "clsx";
import { useEffect, useState } from "react";

import { t } from "../i18n/uz";
import { displayName } from "../lib/format";
import { OliviaFestive } from "./OliviaFestive";
import { Avatar } from "./ui";

/** Tagdagi satrlar shuncha vaqtda almashadi (CSS'dagi `tagline` animatsiyasi bilan bir xil). */
const TAGLINE_MS = 3800;

type DayPart = keyof typeof t.greetingByTime;

function dayPart(hour: number): DayPart {
  if (hour >= 5 && hour < 11) return "morning";
  if (hour >= 11 && hour < 17) return "day";
  return "evening";
}

/**
 * Bosh sahifa salomlashuvi: bayramona logo, kun vaqtiga qarab salom ("Xayrli tong / kun / kech")
 * qo'l silkitish bilan, ism brend ranglarida, ostida almashib turadigan satrlar. O'ngdagi avatar —
 * o'z istoriyalarim: istoriya bo'lsa, bosilganda ko'ruvchi ochiladi (Instagram'dagidek).
 */
export function HomeGreeting({
  firstName,
  fullName,
  myStory = null,
  onOpenMyStory,
}: {
  firstName: string;
  fullName: string;
  /** Faol istoriyalarim bo'lsa — `unseen`: hali ko'rilmagani bormi; bo'lmasa — null. */
  myStory?: { unseen: boolean } | null;
  onOpenMyStory?: () => void;
}) {
  const [part] = useState(() => dayPart(new Date().getHours()));

  return (
    <header className="flex items-end gap-3">
      <div className="min-w-0 flex-1">
        {/* Pompon chapga osilib turadi — "O" matn bilan bir chiziqda tursin. */}
        <OliviaFestive variant="brand" className="-ml-[9px] h-[68px] w-auto drop-shadow-[0_2px_3px_rgba(60,70,110,0.16)]" />
        <p className="mt-2.5 flex animate-rise items-center gap-1.5 text-[15px] font-semibold text-ink/65">
          {t.greetingByTime[part]}
          <span aria-hidden className="inline-block origin-[70%_75%] text-[17px] motion-safe:animate-wave">
            👋
          </span>
        </p>
        {/* Rang `h1` da ham bor — ism sig'may qisqarsa, "…" ham brend rangida chiqadi. */}
        <h1
          className="animate-rise truncate pb-0.5 text-[31px] leading-[1.15] font-extrabold tracking-tight text-[#df3425]"
          style={{ animationDelay: "90ms" }}
        >
          <span className="bg-[linear-gradient(100deg,#df3425_0%,#f0612e_38%,#eda32f_62%,#df3425_100%)] bg-[length:220%_100%] bg-clip-text text-transparent motion-safe:animate-name-sheen">
            {displayName(firstName)}
          </span>
        </h1>
        <Tagline />
      </div>
      <FestiveAvatar name={fullName} story={myStory} onOpen={onOpenMyStory} />
    </header>
  );
}

/** Ism ostidagi satr: bir necha soniyada yumshoq almashib turadi. */
function Tagline() {
  const lines = t.homeTaglines;
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => setIndex((i) => (i + 1) % lines.length), TAGLINE_MS);
    return () => window.clearInterval(timer);
  }, [lines.length]);

  return (
    <p className="mt-1 h-[18px] overflow-hidden text-[13px] text-muted" aria-live="off">
      <span key={index} className="block truncate motion-safe:animate-tagline">
        {lines[index]}
      </span>
    </p>
  );
}

/**
 * Avatar: brend ranglaridagi halqa va ustiga qo'ngan qor. Istoriyam bo'lsa — tugma, halqa esa
 * istoriya qatoridagidek: ko'rilmagani bo'lsa rangli, hammasi ko'rilgan bo'lsa kulrang.
 */
function FestiveAvatar({
  name,
  story,
  onOpen,
}: {
  name: string;
  story: { unseen: boolean } | null;
  onOpen?: () => void;
}) {
  const ring = (
    <span
      className={clsx(
        "block rounded-full p-[2.5px]",
        !story
          ? "bg-[linear-gradient(140deg,#f2583f,#df3425_45%,#eda32f)]"
          : story.unseen
            ? "bg-[conic-gradient(from_200deg,#f3c656,#f2583f,#df3425,#e2457a,#f3c656)] shadow-[0_6px_16px_-8px_rgba(223,52,37,0.7)]"
            : "bg-[#cfd2d8]",
      )}
    >
      <span className="block rounded-full bg-bg p-[2px]">
        <Avatar name={name} dark size={46} />
      </span>
    </span>
  );
  return (
    <span className="relative mb-1 shrink-0">
      {story && onOpen ? (
        <button
          type="button"
          onClick={onOpen}
          aria-label={t.storyMineOpen}
          title={t.storyMineOpen}
          className="block rounded-full transition active:scale-95"
        >
          {ring}
        </button>
      ) : (
        ring
      )}
      <svg
        viewBox="0 0 44 44"
        aria-hidden
        className="pointer-events-none absolute inset-0 size-full overflow-visible drop-shadow-[0_1px_1.5px_rgba(60,70,110,0.25)]"
      >
        <g className="origin-bottom [transform-box:fill-box] motion-safe:animate-snow-settle" style={{ animationDelay: "700ms" }}>
          <path
            d="M2.6 11.4C2 7.6 5.6 5.4 8.4 4.6C11.8-.4 17.6-3 23-2.6C29-3.2 34.4 0 36.8 4.2C40 5.2 42.8 8 41.6 11.6C41 13.6 39.2 13.5 38.6 11.7A19.5 19.5 0 0 0 5.4 11.7C4.8 13.5 3.2 13.6 2.6 11.4Z"
            fill="#b4cdec"
            transform="translate(0 0.9)"
          />
          <path
            d="M2.6 11.4C2 7.6 5.6 5.4 8.4 4.6C11.8-.4 17.6-3 23-2.6C29-3.2 34.4 0 36.8 4.2C40 5.2 42.8 8 41.6 11.6C41 13.6 39.2 13.5 38.6 11.7A19.5 19.5 0 0 0 5.4 11.7C4.8 13.5 3.2 13.6 2.6 11.4Z"
            fill="#ffffff"
          />
        </g>
      </svg>
    </span>
  );
}
