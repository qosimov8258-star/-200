import { Card } from "@/components/ui/card";

/**
 * Yuklanayotganda — haqiqiy joylashuv shaklidagi xira bloklar: ishlar ro'yxati, 4 ta ko'rsatkich va
 * 2 ta bo'lim. `withTodo={false}` — ishlar ro'yxati allaqachon ko'rinib turibdi (u alohida yuklanadi).
 */
export function DashboardSkeleton({ withTodo = true }: { withTodo?: boolean }) {
  return (
    <div className="space-y-6" role="status" aria-busy="true" aria-label="Yuklanmoqda">
      {withTodo && (
        <Card className="space-y-3 p-5">
          <div className="h-4 w-48 animate-pulse rounded-full bg-[#ecebf1]" />
          <div className="h-9 animate-pulse rounded-xl bg-[#f5f4f8]" />
        </Card>
      )}
      <Card className="overflow-hidden">
        <div className="grid grid-cols-1 gap-px bg-line sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="space-y-3 bg-[#fbfbfd] px-5 py-4">
              <div className="h-3 w-24 animate-pulse rounded-full bg-[#ecebf1]" />
              <div className="h-6 w-32 animate-pulse rounded-full bg-[#ecebf1]" />
              <div className="h-3 w-28 animate-pulse rounded-full bg-[#ecebf1]" />
            </div>
          ))}
        </div>
        <div className="grid border-t border-line lg:grid-cols-2">
          {Array.from({ length: 2 }, (_, i) => (
            <div key={i} className="space-y-4 border-line p-6 [&:nth-child(2)]:border-t lg:[&:nth-child(2)]:border-t-0 lg:[&:nth-child(2)]:border-l">
              <div className="h-4 w-40 animate-pulse rounded-full bg-[#ecebf1]" />
              <div className="h-40 animate-pulse rounded-2xl bg-[#f5f4f8]" />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
