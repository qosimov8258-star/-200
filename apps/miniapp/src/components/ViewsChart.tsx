import clsx from "clsx";

import { formatCount, formatDayMonth, formatShort } from "../lib/format";
import type { DailyViews } from "../lib/types";

const BAR_AREA = 120;

/** Kunlik ko'rishlar ustunli diagrammasi; oxirgi kun (bugun) ajratilgan. */
export function ViewsChart({ days }: { days: DailyViews[] }) {
  const max = Math.max(1, ...days.map((d) => d.views));
  return (
    <div className="flex items-end" role="list">
      {days.map((d, i) => {
        const last = i === days.length - 1;
        return (
          <div
            key={d.date}
            role="listitem"
            aria-label={`${formatDayMonth(d.date)}: ${formatCount(d.views)}`}
            className="flex flex-1 flex-col items-center px-[3px]"
          >
            <span className={clsx("text-[11px] font-semibold", last ? "text-ink" : "text-muted")}>
              {formatShort(d.views)}
            </span>
            <div
              className={clsx("mt-1 w-full rounded-[10px]", last ? "bg-ink" : "bg-line")}
              style={{ height: Math.max(6, (BAR_AREA * d.views) / max) }}
            />
            <span className="mt-1.5 text-[10px] text-muted">{formatDayMonth(d.date)}</span>
          </div>
        );
      })}
    </div>
  );
}
