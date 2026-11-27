import { Badge } from "@/components/ui/badge";
import { formatDateTime, formatNumber } from "@/lib/format";
import type { WinnerOverview } from "@/lib/types";

/**
 * Zaxira nomzodlar — barabandagi navbat tartibida: nomzod rad etilsa, o'rniga navbatdagisi o'tadi.
 * Avtomobil kartasining "Batafsil" bo'limida turadi.
 */
export function RunnersUpList({ runnersUp }: { runnersUp: WinnerOverview["runnersUp"] }) {
  return (
    <section aria-labelledby="winner-runners-up-title" className="min-w-0">
      <h3 id="winner-runners-up-title" className="text-sm font-semibold text-ink">
        Zaxira nomzodlar
      </h3>
      <p className="mt-0.5 text-xs text-muted">Nomzod rad etilsa, o&apos;rniga navbatdagisi o&apos;tadi.</p>
      {runnersUp.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500">Zaxira nomzod yo&apos;q.</p>
      ) : (
        <ol className="mt-2 divide-y divide-slate-100 rounded-xl border border-slate-200">
          {runnersUp.map((entry) => (
            <li key={entry.participantId} className="px-3 py-2.5">
              <p className="flex items-baseline justify-between gap-2 text-sm">
                <span className="font-medium text-slate-900">
                  <span className="text-slate-400 tabular-nums">{entry.rank}.</span> {entry.name}
                </span>
                <span className="text-slate-500 tabular-nums">{formatNumber(entry.views)} ko&apos;rish</span>
              </p>
              <div className="mt-1 flex flex-wrap gap-1">
                {entry.issues.length === 0 ? (
                  <Badge tone="success">Avtomatik tekshiruvda muammo yo&apos;q</Badge>
                ) : (
                  entry.issues.map((issue) => (
                    <Badge key={issue} tone="danger" className="whitespace-normal">
                      {issue}
                    </Badge>
                  ))
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

/** Rad etilgan nomzodlar: kim, nima sababdan, qachon va kim rad etgan. */
export function SkippedList({ skipped }: { skipped: WinnerOverview["skipped"] }) {
  return (
    <section aria-labelledby="winner-skipped-title" className="min-w-0">
      <h3 id="winner-skipped-title" className="text-sm font-semibold text-ink">
        Rad etilgan nomzodlar
      </h3>
      {skipped.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500">Hali hech kim rad etilmagan.</p>
      ) : (
        <ul className="mt-2 divide-y divide-slate-100 rounded-xl border border-slate-200">
          {skipped.map((item) => (
            <li key={`${item.participantId}-${item.at}`} className="px-3 py-2.5 text-sm">
              <p className="font-medium text-slate-900">{item.name}</p>
              <p className="text-slate-600">{item.reason}</p>
              <p className="text-xs text-slate-400">
                {formatDateTime(item.at)} · {item.by}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
