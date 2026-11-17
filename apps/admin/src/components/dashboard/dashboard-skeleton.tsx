/** Dashboard birinchi marta yuklanayotganda ko'rinadigan "skelet". */
export function DashboardSkeleton() {
  return (
    <div className="space-y-6" aria-hidden>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="h-34 animate-pulse rounded-lg bg-slate-200/70" />
        ))}
      </div>
      <div className="h-80 animate-pulse rounded-lg bg-slate-200/70" />
    </div>
  );
}
