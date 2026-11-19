import { useQuery, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import {
  ArrowRight,
  ArrowUpDown,
  CheckCircle2,
  ClipboardPaste,
  Copy,
  Eye,
  LoaderCircle,
  Play,
  TrendingUp,
  Trophy,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { Card, ErrorBlock, PageHeader, PillButton, RankDelta, RoundIcon, Spinner } from "../components/ui";
import { ViewsChart } from "../components/ViewsChart";
import { useToast } from "../components/toast-context";
import { t } from "../i18n/uz";
import * as api from "../lib/api";
import { errorCode } from "../lib/api-error";
import { formatCount, formatDateTime, formatSigned } from "../lib/format";
import { parseReelShortcode } from "../lib/reel-url";
import { haptic, openExternal } from "../lib/telegram";
import type { MyReel, ReelStatus } from "../lib/types";

/** Server videoni tekshirayotganda holat shuncha millisoniyada bir so'raladi. */
const PENDING_POLL_MS = 5000;

export function MyReelScreen() {
  const queryClient = useQueryClient();
  const reel = useQuery({
    queryKey: ["reel"],
    queryFn: api.getMyReel,
    refetchInterval: (query) => (query.state.data?.status === "PENDING" ? PENDING_POLL_MS : false),
  });

  // Tekshiruv tugadi (PENDING → qabul/rad): reyting ham yangilansin.
  const status = reel.data?.status;
  const previous = useRef(status);
  useEffect(() => {
    if (previous.current === "PENDING" && status && status !== "PENDING") {
      if (status === "ACCEPTED") haptic.success();
      else haptic.error();
      void queryClient.invalidateQueries({ queryKey: ["rating"] });
    }
    previous.current = status;
  }, [status, queryClient]);

  return (
    <div className="space-y-[18px]">
      <PageHeader title={t.reelTitle} subtitle={t.reelSubtitle} />
      {reel.isPending ? (
        <Spinner />
      ) : reel.isError ? (
        <ErrorBlock onRetry={() => void reel.refetch()} />
      ) : reel.data ? (
        <>
          <ReelStats reel={reel.data} />
          {reel.data.status === "REJECTED" && (
            <>
              <SubmitCard title={t.resubmitTitle} body={t.resubmitBody} />
              <Conditions />
            </>
          )}
        </>
      ) : (
        <>
          <SubmitCard title={t.stepLink} body={t.stepLinkBody} />
          <Conditions />
        </>
      )}
    </div>
  );
}

function SubmitCard({ title, body }: { title: string; body: string }) {
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
      const reel = await api.submitReel(value);
      haptic.tap();
      toast(t.submitted);
      queryClient.setQueryData(["reel"], reel);
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
    <Card>
      <h2 className="text-lg font-bold tracking-tight">{title}</h2>
      <p className="mt-1.5 text-[15px] leading-snug text-muted">{body}</p>
      <div
        className={clsx(
          "mt-4 flex items-center rounded-full border bg-bg pr-1.5 pl-[18px]",
          error ? "border-negative" : "border-transparent",
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
        <RoundIcon label={t.paste} dark size={44} onClick={() => void paste()}>
          <ClipboardPaste className="size-5" />
        </RoundIcon>
      </div>
      {error && <p className="mt-2 px-1.5 text-[13px] text-negative">{error}</p>}
      <PillButton
        className="mt-4"
        loading={submitting}
        onClick={() => void submit()}
        icon={<ArrowRight className="size-5" />}
      >
        {t.submit}
      </PillButton>
    </Card>
  );
}

function Conditions() {
  return (
    <Card>
      <h2 className="font-semibold">{t.rulesHeading}</h2>
      <ul className="mt-2.5 space-y-2.5">
        {[t.ruleTag, t.ruleOwn, t.ruleOneAccount, t.ruleNoTarget, t.ruleNoFakeViews].map((rule) => (
          <li key={rule} className="flex gap-2.5 text-[15px]">
            <CheckCircle2 className="mt-0.5 size-[18px] shrink-0" />
            {rule}
          </li>
        ))}
      </ul>
    </Card>
  );
}

const STATUS: Record<ReelStatus, { label: string; color: string; note: string | null }> = {
  PENDING: { label: t.statusPending, color: "text-muted", note: t.pendingNote },
  ACCEPTED: { label: t.statusAccepted, color: "text-positive", note: null },
  REJECTED: { label: t.statusRejected, color: "text-negative", note: t.rejectedNote },
  REMOVED: { label: t.statusRemoved, color: "text-negative", note: t.removedNote },
};

function ReelStats({ reel }: { reel: MyReel }) {
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
    <>
      <Card className="flex items-center gap-3.5 py-3.5 pr-2.5 pl-3.5">
        <button
          type="button"
          aria-label={t.openInInstagram}
          onClick={() => openExternal(reel.url)}
          className="grid size-16 shrink-0 place-items-center rounded-tile bg-[linear-gradient(180deg,#5b8fa8,#b8674a_60%,#2a2320)] text-white active:scale-95"
        >
          <Play className="size-6 fill-white" />
        </button>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2 text-[13px] whitespace-nowrap">
            <span className="text-muted">{t.reelLink}</span>
            <span className={clsx("flex items-center gap-1 font-semibold", status.color)}>
              {reel.status === "PENDING" ? (
                <LoaderCircle className="size-3 animate-spin" />
              ) : (
                <span className="size-1.5 rounded-full bg-current" />
              )}
              {status.label}
            </span>
          </span>
          <span className="mt-1 line-clamp-2 block text-[15px] font-semibold break-all">
            {reel.url.replace("https://www.", "")}
          </span>
        </span>
        <RoundIcon label={t.copy} size={40} className="bg-transparent" onClick={() => void copy()}>
          <Copy className="size-5" />
        </RoundIcon>
      </Card>

      {!accepted ? (
        <Card>
          <p className="text-[15px] leading-snug">{note}</p>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <StatTile dark icon={<Eye />} label={t.statTotal}>
              {formatCount(reel.totalViews)}
            </StatTile>
            <StatTile icon={<TrendingUp />} label={t.statToday}>
              <span className={reel.todayViews > 0 ? "text-positive" : undefined}>
                {formatSigned(reel.todayViews)}
              </span>
            </StatTile>
            <StatTile icon={<Trophy />} label={t.statRank}>
              {reel.rank ?? "—"}
            </StatTile>
            <StatTile icon={<ArrowUpDown />} label={t.statRankDelta}>
              {reel.rankDelta === 0 ? (
                <span className="text-base font-semibold text-muted">{t.noChange}</span>
              ) : (
                <RankDelta delta={reel.rankDelta} large />
              )}
            </StatTile>
          </div>
          {reel.daily.length > 0 && (
            <Card>
              <h2 className="font-semibold">{t.chartTitle}</h2>
              <p className="text-[13px] text-muted">{t.chartSubtitle}</p>
              <div className="mt-[18px]">
                <ViewsChart days={reel.daily.slice(-7)} />
              </div>
            </Card>
          )}
          {reel.lastSyncedAt && (
            <p className="text-center text-[13px] text-muted">
              {t.lastSynced(formatDateTime(reel.lastSyncedAt))}
            </p>
          )}
        </>
      )}
    </>
  );
}

function StatTile({
  icon,
  label,
  dark = false,
  children,
}: {
  icon: ReactNode;
  label: string;
  dark?: boolean;
  children: ReactNode;
}) {
  return (
    <Card dark={dark} className="flex h-[124px] flex-col p-4">
      <span className={clsx("[&>svg]:size-5", dark ? "text-white/70" : "text-muted")}>{icon}</span>
      <span className="mt-auto truncate text-[26px] font-bold tracking-tight">{children}</span>
      <span className={clsx("truncate text-xs", dark ? "text-white/70" : "text-muted")}>{label}</span>
    </Card>
  );
}
