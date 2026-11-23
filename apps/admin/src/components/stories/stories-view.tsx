"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, CirclePlay, Info, RotateCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { IosIcon } from "@/components/ui/ios-icon";
import { Pagination } from "@/components/ui/pagination";
import { getStories } from "@/lib/api";
import { errorMessage } from "@/lib/api-error";
import { formatNumber } from "@/lib/format";
import type { AdminStoryItem } from "@/lib/types";
import { cn } from "@/lib/utils";

import { StoriesSkeleton, StoryCard } from "./story-card";
import { StoryRemoveDialog } from "./story-remove-dialog";

const PAGE_SIZE = 12;
const NOTICE_TIMEOUT_MS = 5000;
/** Yangi yuklanganlar chiqishi va muddati tugaganlar tushishi uchun ro'yxat qayta so'raladi. */
const REFRESH_MS = 60_000;
/** "N soat oldin" va qolgan vaqt shu oraliqda yangilanadi. */
const CLOCK_TICK_MS = 30_000;

/**
 * Istoriyalar: ishtirokchilar Mini App'dan yuklagan qisqa videolar (24 soat turadi).
 * Faqat faollari, eng yangilari yuqorida; Admin nomaqbulini sabab bilan o'chiradi.
 */
export function StoriesView() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const pageParam = Number.parseInt(searchParams.get("page") ?? "", 10);
  const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;
  const query = { page, pageSize: PAGE_SIZE };

  const { data, error, isPending, isError, isFetching, isPlaceholderData, refetch } = useQuery({
    queryKey: ["stories", query],
    queryFn: () => getStories(query),
    placeholderData: keepPreviousData,
    refetchInterval: REFRESH_MS,
  });

  const now = useNow(CLOCK_TICK_MS);
  const [removing, setRemoving] = useState<AdminStoryItem | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), NOTICE_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [notice]);

  function goToPage(nextPage: number) {
    router.replace(nextPage > 1 ? `${pathname}?page=${nextPage}` : pathname, { scroll: false });
  }

  // O'chirish yoki muddati tugashi bilan sahifa bo'shab qolsa — oxirgi to'la sahifaga.
  const lastPage = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const pageOverflow = data !== undefined && !isPlaceholderData && data.items.length === 0 && page > lastPage;
  useEffect(() => {
    if (pageOverflow) {
      router.replace(lastPage > 1 ? `${pathname}?page=${lastPage}` : pathname, { scroll: false });
    }
  }, [pageOverflow, lastPage, pathname, router]);

  return (
    <div className="space-y-4">
      <p className="flex items-start gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
        <IosIcon icon={Info} tint="blue" size={22} />
        <span>
          Ishtirokchilar Mini App&apos;dan yuklagan qisqa videolar — ularni ilova va saytga kirgan
          hamma ko&apos;radi. Har bir istoriya 24 soat turadi, keyin o&apos;zi o&apos;chadi.
          Istoriyalar tekshiruvdan o&apos;tmaydi va reyting hamda sovg&apos;alarga ta&apos;sir
          qilmaydi. Nomaqbul videoni sababini yozib o&apos;chiring — sabab audit logga yoziladi.
        </span>
      </p>

      <div role="status" aria-live="polite">
        {notice && (
          <div className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
            <CheckCircle2 className="size-4 shrink-0" aria-hidden />
            {notice}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-600">
          {data ? (
            <>
              Faol istoriyalar:{" "}
              <strong className="font-semibold text-ink tabular-nums">{formatNumber(data.total)}</strong> ta
            </>
          ) : (
            " "
          )}
        </p>
        <Button variant="secondary" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RotateCw className={cn("size-4", isFetching && "animate-spin")} aria-hidden />
          Yangilash
        </Button>
      </div>

      {isPending ? (
        <StoriesSkeleton />
      ) : isError && !data ? (
        <Card className="flex flex-col items-center gap-3 px-4 py-12 text-center">
          <IosIcon icon={AlertTriangle} tint="orange" size={48} />
          <p className="text-sm text-slate-600">{errorMessage(error)}</p>
          <Button variant="secondary" onClick={() => refetch()}>
            Qayta urinish
          </Button>
        </Card>
      ) : data && data.items.length === 0 ? (
        <Card className="flex flex-col items-center gap-2 px-4 py-12 text-center">
          <IosIcon icon={CirclePlay} tint="gray" size={48} />
          <p className="text-sm font-medium text-slate-700">Hozircha faol istoriya yo&apos;q.</p>
          <p className="max-w-sm text-sm text-slate-500">
            Ishtirokchilar Mini App&apos;dan video yuklasa, u shu yerda 24 soat davomida ko&apos;rinadi.
          </p>
        </Card>
      ) : data ? (
        <>
          <ul
            className={cn(
              "grid grid-cols-1 gap-4 transition-opacity min-[480px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5",
              isPlaceholderData && "opacity-60",
            )}
            aria-busy={isPlaceholderData}
          >
            {data.items.map((story) => (
              <li key={story.id}>
                <StoryCard story={story} now={now} onRemove={setRemoving} />
              </li>
            ))}
          </ul>

          {data.total > data.pageSize && (
            <Card className="px-4 py-3">
              <Pagination
                page={data.page}
                pageSize={data.pageSize}
                total={data.total}
                onPageChange={(nextPage) => {
                  goToPage(nextPage);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
              />
            </Card>
          )}
        </>
      ) : null}

      {removing && (
        <StoryRemoveDialog
          key={removing.id}
          story={removing}
          onClose={() => setRemoving(null)}
          onDone={(message) => {
            setRemoving(null);
            setNotice(message);
          }}
        />
      )}
    </div>
  );
}

/** Joriy vaqt, `intervalMs` da bir yangilanadi. */
function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}
