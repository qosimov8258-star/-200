"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, AlertTriangle, SearchX } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { IosIcon } from "@/components/ui/ios-icon";
import { MoreDetails } from "@/components/ui/more-details";
import { Pagination } from "@/components/ui/pagination";
import { ReasonDialog } from "@/components/ui/reason-dialog";
import { SearchInput } from "@/components/ui/search-input";
import { Segmented } from "@/components/ui/segmented";
import { TableSkeleton } from "@/components/ui/table-skeleton";
import { decideAiReview, getAiReviews } from "@/lib/api";
import { errorMessage } from "@/lib/api-error";
import { formatNumber } from "@/lib/format";
import { AI_MANUAL_DECISION_LABELS, AI_REVIEW_STATE_LABELS, AI_VERDICT_FILTER_LABELS } from "@/lib/labels";
import {
  AI_LIMITS,
  type AiManualDecision,
  type AiProgress,
  type AiReviewItem,
  type AiReviewState,
  type AiRun,
  type AiVerdict,
} from "@/lib/types";
import { cn } from "@/lib/utils";

import { AI_POLL_MS, AI_REVIEWS_KEY, AI_SECTION_IDS, AI_STATE_KEY } from "./ai-common";
import { ReviewCard } from "./ai-review-card";

const PAGE_SIZE = 20;
/** Filtrdagi tartib: ko'rib chiqish kerak bo'lganlar birinchi. */
const VERDICTS: AiVerdict[] = ["UNCERTAIN", "REJECTED", "APPROVED"];
const STATES: AiReviewState[] = ["DONE", "QUEUED", "PROCESSING", "FAILED"];

type VerdictFilter = AiVerdict | "ALL";
type StateFilter = AiReviewState | "ALL";

interface ResultsProps {
  run: AiRun;
  progress: AiProgress;
  /** Worker ishlayapti — ro'yxat ham tez-tez yangilanadi. */
  polling: boolean;
  /** Yangi videolar AI'dan o'tadimi — izoh matni shunga qarab. */
  acceptanceGate: boolean;
  /** Bundan past ishonch — "Shubhali" (kartadagi "AI aniq / deyarli aniq / ishonchsiz" uchun). */
  confidenceMin: number;
  onNotice: (message: string) => void;
}

/**
 * "Natijalar": AI xulosasi bo'yicha filtr (holat bo'yicha — "Batafsil filtr" ichida), qidiruv, videolar
 * ro'yxati va "Mos / Mos emas" belgisi. Belgi faqat AI natijasini to'g'rilaydi — video holati o'zgarmaydi.
 */
export function Results({ run, progress, polling, acceptanceGate, confidenceMin, onNotice }: ResultsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  const verdict = VERDICTS.find((value) => value === searchParams.get("verdict")) ?? "ALL";
  const state = STATES.find((value) => value === searchParams.get("state")) ?? "ALL";
  const search = (searchParams.get("q") ?? "").slice(0, 100);
  const pageParam = Number.parseInt(searchParams.get("page") ?? "", 10);
  const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;

  // Faqat birinchi ochilishda: havolada holat filtri bo'lsa — "Batafsil filtr" ochiq turadi. Keyin
  // foydalanuvchi o'zi ochib-yopadi (filtr o'zgarganda bo'lim yopilib qolmasin).
  const [stateFilterOpen] = useState(state !== "ALL");

  const query = {
    verdict: verdict === "ALL" ? undefined : verdict,
    state: state === "ALL" ? undefined : state,
    search: search || undefined,
    page,
    pageSize: PAGE_SIZE,
  };

  const { data, error, isPending, isError, isFetching, refetch } = useQuery({
    queryKey: [...AI_REVIEWS_KEY, run.version, query],
    queryFn: () => getAiReviews(query),
    placeholderData: keepPreviousData,
    refetchInterval: polling ? AI_POLL_MS : false,
  });

  // Jarayon sonlari o'zgarsa (oxirgi videolar tugadi, qo'lda belgi) — ro'yxat ham yangilansin:
  // ish tugashi bilan davriy yangilash to'xtaydi va oxirgi natijalar ko'rinmay qolardi.
  const progressKey = [progress.queued, progress.processing, progress.done, progress.failed, progress.manual].join(":");
  const lastProgressKey = useRef(progressKey);
  useEffect(() => {
    if (lastProgressKey.current === progressKey) return;
    lastProgressKey.current = progressKey;
    void queryClient.invalidateQueries({ queryKey: AI_REVIEWS_KEY });
  }, [progressKey, queryClient]);

  const [deciding, setDeciding] = useState<{ item: AiReviewItem; decision: AiManualDecision } | null>(null);

  function navigate(patch: { verdict?: VerdictFilter; state?: StateFilter; search?: string; page?: number }) {
    const next = { verdict, state, search, page: 1, ...patch };
    const params = new URLSearchParams(searchParams.toString());
    for (const key of ["verdict", "state", "q", "page"]) params.delete(key);
    if (next.verdict !== "ALL") params.set("verdict", next.verdict);
    if (next.state !== "ALL") params.set("state", next.state);
    if (next.search) params.set("q", next.search);
    if (next.page > 1) params.set("page", String(next.page));
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  const verdictCounts: Record<VerdictFilter, number> = {
    ALL: progress.total,
    APPROVED: progress.approved,
    REJECTED: progress.rejected,
    UNCERTAIN: progress.uncertain,
  };
  const stateCounts: Record<StateFilter, number> = {
    ALL: progress.total,
    DONE: progress.done,
    QUEUED: progress.queued,
    PROCESSING: progress.processing,
    FAILED: progress.failed,
  };
  const filtered = verdict !== "ALL" || state !== "ALL" || search !== "";
  const onlyUncertain = verdict === "UNCERTAIN" && state === "ALL" && search === "";

  const emptyText = !filtered
    ? progress.total === 0
      ? "Hali tekshiriladigan video yo'q."
      : "Hali natija yo'q — videolar navbatda, sahifa o'zi yangilanadi."
    : onlyUncertain
      ? progress.queued + progress.processing > 0
        ? "Hozircha shubhali video yo'q — tekshiruv davom etmoqda."
        : "Shubhali video yo'q."
      : "Bu filtr bo'yicha video yo'q.";

  const linkClass = "font-medium text-brand-700 hover:underline";

  return (
    <Card id={AI_SECTION_IDS.results} className="scroll-mt-28">
      <CardHeader className="space-y-1">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <CardTitle>Natijalar</CardTitle>
          <p className="text-sm text-slate-500 tabular-nums">
            {formatNumber(progress.total)} ta video
            {progress.manual > 0 && <> · siz belgilagan: {formatNumber(progress.manual)}</>}
          </p>
        </div>
        {/* Belgi videoning tanlovdagi holatini o'zgartirmaydi (backend faqat AI natijasiga yozadi). */}
        <p className="text-xs text-slate-500">
          «Mos / Mos emas» faqat AI natijasini to&apos;g&apos;rilaydi — videoning tanlovdagi holati o&apos;zgarmaydi.{" "}
          {acceptanceGate && (
            <>
              AI o&apos;tkazmagan yangi videolar bo&apos;yicha qaror —{" "}
              <Link href="/manual-review" className={linkClass}>
                «Qo&apos;lda tekshiruv»
              </Link>
              da.{" "}
            </>
          )}
          Qoidani buzgan ishtirokchini{" "}
          <Link href="/users" className={linkClass}>
            «Ishtirokchilar»
          </Link>{" "}
          bo&apos;limida tanlovdan chetlatish mumkin.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          <SearchInput
            value={search}
            onDebouncedChange={(value) => navigate({ search: value })}
            placeholder="Ism yoki telefon"
            label="Natijalarni qidirish"
            className="w-full sm:w-80"
          />
          <div className="flex flex-wrap items-center gap-2">
            <Segmented
              label="AI xulosasi bo'yicha filtr"
              value={verdict}
              onChange={(value) => navigate({ verdict: value })}
              options={[
                ...VERDICTS.map((value) => ({
                  value,
                  label: AI_VERDICT_FILTER_LABELS[value],
                  count: verdictCounts[value],
                  attention: value === "UNCERTAIN",
                })),
                { value: "ALL" as const, label: "Hammasi", count: verdictCounts.ALL },
              ]}
            />
            {progress.failed > 0 && (
              <button
                type="button"
                aria-pressed={state === "FAILED"}
                onClick={() => navigate({ state: state === "FAILED" ? "ALL" : "FAILED" })}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500",
                  state === "FAILED"
                    ? "border-red-600 bg-red-600 text-white hover:bg-red-700"
                    : "border-red-200 bg-red-50 text-red-700 hover:bg-red-100",
                )}
              >
                <AlertCircle className="size-4" aria-hidden />
                {AI_REVIEW_STATE_LABELS.FAILED}{" "}
                <span className="tabular-nums">({formatNumber(progress.failed)})</span>
              </button>
            )}
          </div>
          <MoreDetails
            title="Batafsil filtr"
            meta={state !== "ALL" ? `holat: ${AI_REVIEW_STATE_LABELS[state]}` : "tekshiruv holati bo'yicha"}
            defaultOpen={stateFilterOpen}
          >
            <Segmented
              size="sm"
              label="Tekshiruv holati bo'yicha filtr"
              value={state}
              onChange={(value) => navigate({ state: value })}
              options={[
                { value: "ALL" as const, label: "Har qanday holat", count: stateCounts.ALL },
                ...STATES.map((value) => ({
                  value,
                  label: AI_REVIEW_STATE_LABELS[value],
                  count: stateCounts[value],
                  attention: value === "FAILED",
                })),
              ]}
            />
          </MoreDetails>
        </div>

        {isPending ? (
          <div className="overflow-hidden rounded-2xl border border-line">
            <TableSkeleton rows={4} />
          </div>
        ) : isError && !data ? (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <IosIcon icon={AlertTriangle} tint="orange" size={44} />
            <p className="text-sm text-slate-600">{errorMessage(error)}</p>
            <Button variant="secondary" onClick={() => refetch()}>
              Qayta urinish
            </Button>
          </div>
        ) : data && data.items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <IosIcon icon={SearchX} tint="gray" size={44} />
            <p className="text-sm text-slate-600">{emptyText}</p>
          </div>
        ) : data ? (
          <>
            <ul
              className={cn("space-y-3 transition-opacity", isFetching && !polling && "opacity-60")}
              aria-busy={isFetching}
            >
              {data.items.map((item) => (
                <ReviewCard
                  key={item.id}
                  item={item}
                  confidenceMin={confidenceMin}
                  onDecide={(target, decision) => setDeciding({ item: target, decision })}
                />
              ))}
            </ul>
            {data.total > data.pageSize && (
              <Pagination
                page={data.page}
                pageSize={data.pageSize}
                total={data.total}
                onPageChange={(nextPage) => navigate({ page: nextPage })}
              />
            )}
          </>
        ) : null}
      </CardContent>

      {deciding && (
        <ReasonDialog
          key={`${deciding.item.id}:${deciding.decision}`}
          title={`AI natijasini to'g'rilash: «${AI_MANUAL_DECISION_LABELS[deciding.decision]}» deb belgilansinmi?`}
          description={
            <div className="space-y-1.5">
              <p>
                <span className="font-medium text-ink">{deciding.item.participant.fullName}</span>
                {deciding.item.verdict && <> — AI: {AI_VERDICT_FILTER_LABELS[deciding.item.verdict]}</>}
              </p>
              <p>
                Belgingiz AI xulosasi o&apos;rniga hisobga olinadi. Videoning tanlovdagi holati o&apos;zgarmaydi.
              </p>
            </div>
          }
          fieldLabel="Izoh"
          minLength={AI_LIMITS.decisionNoteMin}
          placeholder={
            deciding.decision === "APPROVED"
              ? "Masalan: mahsulot 0:45 da aniq ko'rinadi"
              : "Masalan: videoda mahsulot umuman yo'q"
          }
          confirmLabel={deciding.decision === "APPROVED" ? "«Mos» deb belgilash" : "«Mos emas» deb belgilash"}
          variant={deciding.decision === "APPROVED" ? "primary" : "danger"}
          onConfirm={(note) => decideAiReview(deciding.item.id, { decision: deciding.decision, note })}
          onClose={() => setDeciding(null)}
          onDone={async () => {
            const { item, decision } = deciding;
            setDeciding(null);
            onNotice(`Belgi saqlandi: ${item.participant.fullName} — ${AI_MANUAL_DECISION_LABELS[decision]}.`);
            await Promise.all([
              queryClient.invalidateQueries({ queryKey: AI_REVIEWS_KEY }),
              queryClient.invalidateQueries({ queryKey: AI_STATE_KEY }),
              queryClient.invalidateQueries({ queryKey: ["audit-log"] }),
            ]);
          }}
        />
      )}
    </Card>
  );
}
