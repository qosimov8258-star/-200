import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime, formatNumber } from "@/lib/format";
import type { WinnerOverview } from "@/lib/types";

/** Zaxira g'oliblar — random tanlovdagi navbat; nomzod rad etilsa navbatdagisi (oferta 10.3). */
export function RunnersUpCard({ runnersUp }: { runnersUp: WinnerOverview["runnersUp"] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Zaxira nomzodlar</CardTitle>
        <p className="mt-0.5 text-xs text-slate-500">Random tanlov zaxirasi — nomzod rad etilsa, navbatdagisi</p>
      </CardHeader>
      <CardContent className="px-0 py-0">
        {runnersUp.length === 0 ? (
          <p className="px-5 py-4 text-sm text-slate-500">Zaxira nomzod yo&apos;q.</p>
        ) : (
          <ol className="divide-y divide-slate-100">
            {runnersUp.map((entry) => (
              <li key={entry.participantId} className="px-5 py-3">
                <p className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="font-medium text-slate-900">
                    <span className="text-slate-400 tabular-nums">{entry.rank}.</span> {entry.name}
                  </span>
                  <span className="text-slate-500 tabular-nums">{formatNumber(entry.views)}</span>
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
      </CardContent>
    </Card>
  );
}

export function SkippedCard({ skipped }: { skipped: WinnerOverview["skipped"] }) {
  if (skipped.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Rad etilgan nomzodlar</CardTitle>
      </CardHeader>
      <CardContent className="px-0 py-0">
        <ul className="divide-y divide-slate-100">
          {skipped.map((item) => (
            <li key={`${item.participantId}-${item.at}`} className="px-5 py-3 text-sm">
              <p className="font-medium text-slate-900">{item.name}</p>
              <p className="text-slate-600">{item.reason}</p>
              <p className="text-xs text-slate-400">
                {formatDateTime(item.at)} · {item.by}
              </p>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
