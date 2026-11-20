import { useQuery, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import {
  ArrowRight,
  ArrowUpDown,
  CalendarClock,
  Check,
  ClipboardPaste,
  Copy,
  Eye,
  LoaderCircle,
  Play,
  RefreshCw,
  Snowflake,
  Star,
  TrendingUp,
  Trophy,
} from "lucide-react";
import { Fragment, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

import { RankOrnament } from "../components/Ornaments";
import { Garland } from "../components/ProfileFestive";
import { Snowfall } from "../components/Snowfall";
import { Card, ErrorBlock, PageHeader, PillButton, RankDelta, Spinner } from "../components/ui";
import { ViewsChart } from "../components/ViewsChart";
import { useToast } from "../components/toast-context";
import { t } from "../i18n/uz";
import * as api from "../lib/api";
import { errorCode } from "../lib/api-error";
import { calendarDaysUntil, formatCount, formatDayMonthTime, formatSigned } from "../lib/format";
import { parseReelShortcode } from "../lib/reel-url";
import { haptic, openExternal } from "../lib/telegram";
import type { MyReelItem, MyReels, ReelStatus } from "../lib/types";

/** Biror video avtomatik tekshiruvda bo'lsa, ro'yxat shuncha millisoniyada bir so'raladi. */
const PENDING_POLL_MS = 5000;
/** Qo'lda tekshiruv soatlab cho'zilishi mumkin — kamroq so'raymiz (natija botga ham keladi). */
const MANUAL_REVIEW_POLL_MS = 60_000;

const WAITING: ReadonlySet<ReelStatus> = new Set(["PENDING", "MANUAL_REVIEW"]);

/** Kartalar ketma-ket ko'tarilib chiqadi. */
const rise = (i: number): CSSProperties => ({ animationDelay: `${i * 80}ms` });

/**
 * "Videom": ishtirokchining barcha videolari (soni cheklanmagan). Yuqorida — reytingda
 * hisoblanadigan natija (eng ko'p ko'rilgan bitta qabul qilingan video; videolar ko'rishlari
 * qo'shilmaydi), keyin yangi link qo'shish va videolar ro'yxati (eng ko'p ko'rilgani tepada).
 */
export function MyReelScreen() {
  const reels = useQuery({
    queryKey: ["reels"],
    queryFn: api.getMyReels,
    refetchInterval: (query) => {
      const list = query.state.data?.reels ?? [];
      if (list.some((r) => r.status === "PENDING")) return PENDING_POLL_MS;
      if (list.some((r) => r.status === "MANUAL_REVIEW")) return MANUAL_REVIEW_POLL_MS;
      return false;
    },
  });
  useVerdicts(reels.data?.reels);

  return (
    <div className="space-y-5">
      <PageHeader title={t.reelTitle} subtitle={t.reelSubtitle} />
      {reels.isPending ? (
        <Spinner />
      ) : reels.isError ? (
        <ErrorBlock onRetry={() => void reels.refetch()} />
      ) : (
        <ReelsContent data={reels.data} />
      )}
    </div>
  );
}

/**
 * Biror videoning tekshiruvi tugadi (kutish → qabul/rad): tebranish beriladi va reyting
 * yangilanadi. Holatlar shortcode bo'yicha oldingi javob bilan solishtiriladi.
 */
function useVerdicts(reels: MyReelItem[] | undefined) {
  const queryClient = useQueryClient();
  const previous = useRef<Map<string, ReelStatus> | null>(null);
  useEffect(() => {
    if (!reels) return;
    const before = previous.current;
    previous.current = new Map(reels.map((r) => [r.shortcode, r.status]));
    if (!before) return;
    const finished = reels.filter((r) => {
      const was = before.get(r.shortcode);
      return was !== undefined && WAITING.has(was) && !WAITING.has(r.status);
    });
    if (finished.length === 0) return;
    if (finished.some((r) => r.status === "ACCEPTED")) haptic.success();
    else haptic.error();
    void queryClient.invalidateQueries({ queryKey: ["rating"] });
  }, [reels, queryClient]);
}

function ReelsContent({ data }: { data: MyReels }) {
  const total = data.reels.length;
  const accepted = data.reels.filter((r) => r.status === "ACCEPTED").length;

  return (
    <>
      {accepted > 0 && <SummaryTiles data={data} />}
      {total === 0 ? (
        <SubmitCard title={t.stepLink} body={t.stepLinkBody} style={rise(1)} />
      ) : (
        <SubmitCard title={t.addReelTitle} body={t.addReelBody} style={rise(accepted > 0 ? 5 : 1)} />
      )}
      {total > 0 && <ReelList reels={data.reels} accepted={accepted} style={rise(accepted > 0 ? 6 : 2)} />}
      {accepted > 0 && data.daily.length > 0 && (
        <Card className="animate-rise" style={rise(7)}>
          <h2 className="font-semibold">{t.chartTitle}</h2>
          <p className="text-[13px] text-muted">{t.chartSubtitle}</p>
          <div className="mt-[18px]">
            <ViewsChart days={data.daily.slice(-7)} />
          </div>
        </Card>
      )}
      {accepted > 0 && (data.lastSyncedAt || data.nextSyncAt) && <SyncCard data={data} />}
      <Conditions style={rise(total === 0 ? 2 : 9)} />
    </>
  );
}

/** Natija — reytingdagi kabi, eng ko'p ko'rilgan qabul qilingan video bo'yicha. */
function SummaryTiles({ data }: { data: MyReels }) {
  const podium = data.rank !== null && data.rank <= 3 ? (data.rank as 1 | 2 | 3) : null;
  return (
    <div className="grid grid-cols-2 gap-3">
      <BestViewsTile views={data.bestViews} />
      <StatTile icon={<TrendingUp />} label={t.statToday} style={rise(2)}>
        <span className={data.todayViews > 0 ? "text-positive" : undefined}>{formatSigned(data.todayViews)}</span>
      </StatTile>
      <StatTile
        icon={podium ? <RankOrnament rank={podium} /> : <Trophy />}
        iconTone="gold"
        bare={podium !== null}
        label={t.statRank}
        style={rise(3)}
      >
        {data.rank ?? "—"}
      </StatTile>
      <StatTile icon={<ArrowUpDown />} label={t.statRankDelta} style={rise(4)}>
        {data.rankDelta === 0 ? (
          <span className="text-base font-semibold text-muted">{t.noChange}</span>
        ) : (
          <RankDelta delta={data.rankDelta} large />
        )}
      </StatTile>
    </div>
  );
}

/** Yangi video linki — har doim ko'rinadi; yuborilgach maydon tozalanadi. */
function SubmitCard({ title, body, style }: { title: string; body: string; style: CSSProperties }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const paste = async () => {
    try {
      const text = (await navigator.clipboard.readText()).trim();
      if (text) {
        setUrl(text);
        setError(null);
      }
    } catch {
      // Ruxsat berilmagan — foydalanuvchi qo'lda qo'yadi.
    }
  };

  const submit = async () => {
    if (submitting) return;
    const value = url.trim();
    if (!value) return setError(t.linkEmpty);
    if (!parseReelShortcode(value)) {
      haptic.error();
      return setError(t.linkInvalid);
    }
    (document.activeElement as HTMLElement | null)?.blur();
    setSubmitting(true);
    setError(null);
    try {
      const reels = await api.submitReel(value);
      haptic.tap();
      toast(t.submitted);
      setUrl("");
      queryClient.setQueryData(["reels"], reels);
    } catch (e) {
      haptic.error();
      const code = errorCode(e);
      setError(
        code === "INVALID_LINK"
          ? t.linkInvalid
          : code === "REEL_TAKEN"
            ? t.linkTaken
            : code === "REEL_ALREADY_SUBMITTED"
              ? t.linkAlready
              : t.genericError,
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="animate-rise" style={style}>
      <h2 className="text-lg font-bold tracking-tight">{title}</h2>
      <p className="mt-1.5 text-[15px] leading-snug text-muted">{body}</p>
      <div
        className={clsx(
          "mt-4 flex items-center rounded-full border bg-bg pr-1.5 pl-[18px] transition focus-within:ring-4 focus-within:ring-[#df3425]/10",
          error ? "border-negative" : "border-transparent focus-within:border-[#df3425]/45",
        )}
      >
        <input
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            setError(null);
          }}
          onKeyDown={(e) => e.key === "Enter" && void submit()}
          placeholder={t.linkPlaceholder}
          inputMode="url"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          disabled={submitting}
          aria-label={title}
          aria-invalid={error ? true : undefined}
          className="h-14 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted"
        />
        <button
          type="button"
          aria-label={t.paste}
          title={t.paste}
          onClick={() => void paste()}
          className="grid size-11 shrink-0 place-items-center rounded-full bg-[#df3425] text-white transition active:scale-95"
        >
          <ClipboardPaste className="size-5" />
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-2 px-1.5 text-[13px] text-negative">
          {error}
        </p>
      )}
      <PillButton
        className="mt-10"
        loading={submitting}
        onClick={() => void submit()}
        icon={<ArrowRight className="size-5" />}
      >
        {t.submit}
      </PillButton>
    </Card>
  );
}

function Conditions({ style }: { style: CSSProperties }) {
  return (
    <Card className="animate-rise" style={style}>
      <h2 className="font-semibold">{t.rulesHeading}</h2>
      <ul className="mt-3 space-y-3">
        {[t.ruleTag, t.ruleOwn, t.ruleOneAccount, t.ruleNoTarget, t.ruleNoFakeViews].map((rule) => (
          <li key={rule} className="flex items-start gap-3 text-[15px] leading-snug">
            <span
              aria-hidden
              className="mt-px grid size-5 shrink-0 place-items-center rounded-full bg-[#fdecea] text-[#df3425]"
            >
              <Check className="size-3" strokeWidth={3} />
            </span>
            {rule}
          </li>
        ))}
      </ul>
    </Card>
  );
}

/** Holat yorlig'i — qorong'i (qishki tun) karta ustida o'qiladigan ranglarda. */
const STATUS: Record<ReelStatus, { label: string; pill: string; note: string | null }> = {
  PENDING: { label: t.statusPending, pill: "bg-white/12 text-white/85 ring-white/20", note: t.pendingNote },
  ACCEPTED: { label: t.statusAccepted, pill: "bg-[#1c9a5b]/25 text-[#8ff0bf] ring-[#8ff0bf]/30", note: null },
  MANUAL_REVIEW: {
    label: t.statusManualReview,
    pill: "bg-[#c27710]/30 text-[#ffd38a] ring-[#ffd38a]/30",
    note: t.manualReviewNote,
  },
  REJECTED: { label: t.statusRejected, pill: "bg-[#d14343]/30 text-[#ffb3aa] ring-[#ffb3aa]/30", note: t.rejectedNote },
};

/**
 * Qishki tun kartasi: gulchambar, yog'ayotgan qor va barcha videolar — server tartibida:
 * eng ko'p ko'rilgani (reytingda hisoblanadigani) tepada, keyin tekshiruvdagilar va rad etilganlar.
 */
function ReelList({ reels, accepted, style }: { reels: MyReelItem[]; accepted: number; style: CSSProperties }) {
  return (
    <section
      className="relative isolate animate-rise overflow-hidden rounded-card bg-[linear-gradient(155deg,#2c3874_0%,#1a2050_55%,#10142f_100%)] px-4 pt-11 pb-1.5 text-white shadow-[0_22px_44px_-24px_rgba(16,20,47,0.9)]"
      style={style}
    >
      <div aria-hidden className="absolute -top-16 -right-10 -z-10 size-48 rounded-full bg-[#7f9cff]/30 blur-3xl" />
      <div aria-hidden className="absolute -bottom-20 -left-12 -z-10 size-56 rounded-full bg-[#df3425]/25 blur-3xl" />
      <Snowfall density={0.5} />
      <Garland className="absolute inset-x-0 top-0 h-10" />

      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 px-0.5">
        <h2 className="text-lg font-bold tracking-tight">{t.myReelsTitle}</h2>
        <span className="text-[13px] text-white/65">{t.myReelsCount(accepted, reels.length)}</span>
      </div>
      <ul className="mt-1 divide-y divide-white/10">
        {reels.map((reel) => (
          <ReelRow key={reel.shortcode} reel={reel} />
        ))}
      </ul>
    </section>
  );
}

function ReelRow({ reel }: { reel: MyReelItem }) {
  const toast = useToast();
  const status = STATUS[reel.status];
  const accepted = reel.status === "ACCEPTED";
  const note = reel.rejectReason ? t.rejectReasons[reel.rejectReason] : status.note;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(reel.url);
      haptic.tap();
      toast(t.copied);
    } catch {
      // Clipboard ruxsati yo'q.
    }
  };

  return (
    <li className="animate-rise py-3.5">
      <div className="flex items-center gap-3">
        {/* Video va linki — bosilsa Instagram'da ochiladi. */}
        <button
          type="button"
          title={t.openInInstagram}
          onClick={() => openExternal(reel.url)}
          className="flex min-w-0 flex-1 items-center gap-3 text-left transition active:opacity-80"
        >
          <span className="relative grid size-12 shrink-0 place-items-center rounded-tile bg-[linear-gradient(150deg,#f45a42,#df3425_55%,#9c1b25)] text-white shadow-[0_10px_20px_-10px_rgba(223,52,37,0.9)] ring-2 ring-[#f3c656]">
            <Play className="size-5 fill-white" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-1.5">
              <span
                className={clsx(
                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[12px] font-semibold ring-1",
                  status.pill,
                )}
              >
                {WAITING.has(reel.status) ? (
                  <LoaderCircle className="size-3 animate-spin" aria-hidden />
                ) : (
                  <span aria-hidden className="size-1.5 rounded-full bg-current" />
                )}
                {status.label}
              </span>
              {/* Reytingda faqat shu video hisoblanadi — archa tepasidagi tilla yulduz kabi ajratiladi. */}
              {reel.best && (
                <span className="inline-flex items-center gap-1 rounded-full bg-[#f3c656]/20 px-2 py-0.5 text-[12px] font-semibold text-[#ffd96b] ring-1 ring-[#f3c656]/45">
                  <Star className="size-3 fill-current" aria-hidden />
                  {t.reelBestBadge}
                </span>
              )}
            </span>
            <span className="mt-1 line-clamp-2 block text-[15px] font-semibold [overflow-wrap:anywhere]">
              <LinkText url={reel.url} />
            </span>
            <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[12.5px] text-white/60">
              {accepted && (
                <span
                  className={clsx(
                    "inline-flex items-center gap-1 font-semibold tabular-nums",
                    reel.best ? "text-[#ffd96b]" : "text-white/90",
                  )}
                >
                  <Eye className="size-3.5" aria-hidden />
                  {t.views(formatCount(reel.views))}
                </span>
              )}
              <span>{t.reelSubmittedAt(formatDayMonthTime(reel.submittedAt))}</span>
            </span>
          </span>
        </button>
        <button
          type="button"
          aria-label={t.copy}
          title={t.copy}
          onClick={() => void copy()}
          className="grid size-10 shrink-0 place-items-center rounded-full bg-white/12 ring-1 ring-white/20 transition active:scale-95"
        >
          <Copy className="size-[18px]" />
        </button>
      </div>

      {!accepted && note && (
        <p className="mt-3 rounded-[16px] bg-white/10 px-3.5 py-2.5 text-[13.5px] leading-snug text-white/90 ring-1 ring-white/15">
          {note}
        </p>
      )}
    </li>
  );
}

/** Link protokolsiz; qator faqat "/" dan keyin bo'linadi — shortcode bir butun qoladi. */
function LinkText({ url }: { url: string }) {
  const parts = url.replace(/^https?:\/\/(www\.)?/, "").split("/");
  return parts.map((part, i) => (
    <Fragment key={i}>
      {i > 0 && (
        <>
          /<wbr />
        </>
      )}
      {part}
    </Fragment>
  ));
}

/**
 * Eng ko'p ko'rilgan videoning ko'rishlari (reytingda shu hisoblanadi, videolar qo'shilmaydi) —
 * brend qizilidagi bayram plitkasi: qor yog'adi, ortida katta qor parchasi.
 */
function BestViewsTile({ views }: { views: number }) {
  return (
    <div
      className="relative isolate flex h-[124px] animate-rise flex-col overflow-hidden rounded-card bg-[linear-gradient(140deg,#f2583f_0%,#df3425_48%,#ad1f2c_100%)] p-4 text-white shadow-[0_18px_34px_-20px_rgba(173,31,44,0.85)]"
      style={rise(1)}
    >
      <div aria-hidden className="absolute -top-12 -right-10 -z-10 size-32 rounded-full bg-[#ffb36b]/45 blur-2xl" />
      <Snowflake
        aria-hidden
        className="absolute -right-5 -bottom-6 -z-10 size-24 text-white/[0.14] motion-safe:animate-[spin_40s_linear_infinite]"
        strokeWidth={1.2}
      />
      <Snowfall density={0.35} />
      <span className="grid size-8 place-items-center rounded-full bg-white/20 [&>svg]:size-[18px]">
        <Eye />
      </span>
      <span className="mt-auto truncate text-[26px] font-bold tracking-tight">{formatCount(views)}</span>
      <span className="truncate text-xs text-white/80">{t.statBest}</span>
    </div>
  );
}

/** Oxirgi va keyingi yangilanish — ishtirokchi ko'rishlar qachon yangilanishini aniq bilsin. */
function SyncCard({ data }: { data: Pick<MyReels, "lastSyncedAt" | "nextSyncAt" | "syncEveryDays"> }) {
  return (
    <Card className="animate-rise space-y-4" style={rise(8)}>
      <SyncRow
        icon={<RefreshCw />}
        label={t.lastSyncedLabel}
        value={data.lastSyncedAt ? formatDayMonthTime(data.lastSyncedAt) : "—"}
      />
      {data.nextSyncAt && (
        <SyncRow
          accent
          icon={<CalendarClock />}
          label={t.nextSyncLabel}
          value={formatDayMonthTime(data.nextSyncAt)}
          badge={t.inDays(calendarDaysUntil(data.nextSyncAt))}
        />
      )}
      {data.syncEveryDays > 0 && (
        <p className="border-t border-line pt-3.5 text-[13px] text-muted">{t.syncEvery(data.syncEveryDays)}</p>
      )}
    </Card>
  );
}

function SyncRow({
  icon,
  label,
  value,
  badge,
  accent = false,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  badge?: string;
  accent?: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <span
        className={clsx(
          "grid size-11 shrink-0 place-items-center rounded-full [&>svg]:size-5",
          accent ? "bg-[#df3425] text-white" : "bg-chip text-ink",
        )}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] text-muted">{label}</span>
        <span className="block text-[18px] leading-snug font-bold tracking-tight">{value}</span>
        {badge && (
          <span className="mt-1 inline-block rounded-full bg-[#fdecea] px-2.5 py-0.5 text-[13px] font-semibold text-[#c22a24]">
            {badge}
          </span>
        )}
      </span>
    </div>
  );
}

function StatTile({
  icon,
  label,
  iconTone = "red",
  bare = false,
  style,
  children,
}: {
  icon: ReactNode;
  label: string;
  /** Belgi doirachasining rangi: qizil yoki tilla. */
  iconTone?: "red" | "gold";
  /** Belgi o'zi bezak (masalan, archa o'yinchog'i-medal) — doirachasiz chiqadi. */
  bare?: boolean;
  style?: CSSProperties;
  children: ReactNode;
}) {
  return (
    <Card className="flex h-[124px] animate-rise flex-col p-4" style={style}>
      {bare ? (
        <span className="h-8">{icon}</span>
      ) : (
        <span
          className={clsx(
            "grid size-8 place-items-center rounded-full [&>svg]:size-[18px]",
            iconTone === "gold" ? "bg-[#fdf3dc] text-[#b47716]" : "bg-[#fdecea] text-[#df3425]",
          )}
        >
          {icon}
        </span>
      )}
      <span className="mt-auto truncate text-[26px] font-bold tracking-tight">{children}</span>
      <span className="truncate text-xs text-muted">{label}</span>
    </Card>
  );
}
