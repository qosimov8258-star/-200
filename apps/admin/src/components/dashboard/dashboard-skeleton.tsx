import { Card } from "@/components/ui/card";

/** Yuklanayotganda — haqiqiy joylashuv shaklidagi xira bloklar. */
export function DashboardSkeleton() {
  return (
    <Card className="overflow-hidden" aria-busy="true" aria-label="Yuklanmoqda">
      <div className="grid grid-cols-1 gap-px bg-line sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="space-y-3 bg-[#fbfbfd] px-5 py-4">
            <div className="h-3 w-24 animate-pulse rounded-full bg-[#ecebf1]" />
            <div className="h-6 w-32 animate-pulse rounded-full bg-[#ecebf1]" />
            <div className="h-3 w-28 animate-pulse rounded-full bg-[#ecebf1]" />
          </div>
        ))}
      </div>
      <div className="grid border-t border-line lg:grid-cols-2">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="space-y-4 border-line p-6 even:lg:border-l [&:nth-child(n+2)]:border-t lg:[&:nth-child(2)]:border-t-0">
            <div className="h-4 w-40 animate-pulse rounded-full bg-[#ecebf1]" />
            <div className="h-40 animate-pulse rounded-2xl bg-[#f5f4f8]" />
          </div>
        ))}
      </div>
    </Card>
  );
}
