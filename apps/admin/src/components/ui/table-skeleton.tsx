/** Jadval birinchi marta yuklanayotganda ko'rinadigan "skelet". */
export function TableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="divide-y divide-slate-100" aria-hidden>
      <div className="h-10 bg-slate-50" />
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="flex items-center gap-4 px-4 py-4">
          <div className="h-4 w-8 animate-pulse rounded bg-slate-200" />
          <div className="h-4 w-40 animate-pulse rounded bg-slate-200" />
          <div className="h-4 w-32 animate-pulse rounded bg-slate-200" />
          <div className="hidden h-4 w-28 animate-pulse rounded bg-slate-200 md:block" />
          <div className="ml-auto h-4 w-16 animate-pulse rounded bg-slate-200" />
        </div>
      ))}
    </div>
  );
}
