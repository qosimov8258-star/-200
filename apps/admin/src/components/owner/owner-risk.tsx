"use client";

import { useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  Ban,
  ExternalLink,
  Eye,
  RotateCcw,
  ShieldCheck,
  UserX,
  X,
  type LucideIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Pagination } from "@/components/ui/pagination";
import { SearchInput } from "@/components/ui/search-input";
import { Segmented } from "@/components/ui/segmented";
import { Spinner } from "@/components/ui/spinner";
import { errorMessage } from "@/lib/api-error";
import { formatDate, formatDayTime, formatNumber } from "@/lib/format";
import { getRiskAccounts, reviewRiskAccount, updateOwnerParticipant } from "@/lib/owner-api";
import {
  OWNER_STATUS_LABELS,
  OWNER_STATUS_TONES,
  RISK_LEVEL_LABELS,
  RISK_LEVEL_SHORT,
  RISK_POINTS_HINT,
  RISK_SIGNAL_LABELS,
} from "@/lib/owner-labels";
import type { OwnerParticipantStatus, RiskAccount, RiskLevel, RiskVerdict } from "@/lib/owner-types";
import { cn } from "@/lib/utils";

import {
  EmptyState,
  ErrorState,
  formatOwnerPhone,
  NoticeBanner,
  OWNER_QUERY_KEY,
  ownerFullName,
  useNotice,
} from "./owner-common";

type LevelFilter = RiskLevel | "ALL";

const PAGE_SIZE = 20;
const LEVELS: LevelFilter[] = ["ALL", "HIGH", "MEDIUM", "LOW"];

/** Daraja ranglari: yuqori — qizil, o'rta — to'q sariq, past — lavanda. */
const LEVEL_STYLES: Record<RiskLevel, { bar: string; score: string }> = {
  HIGH: { bar: "bg-[#e0583f]", score: "bg-[#fdecea] text-[#c2412b] ring-[#f3b4a8]" },
  MEDIUM: { bar: "bg-[#f0a43a]", score: "bg-[#fdf3e2] text-[#a7650f] ring-[#f3d29d]" },
  LOW: { bar: "bg-brand-400", score: "bg-brand-50 text-brand-700 ring-brand-200" },
};

const LEVEL_BADGE: Record<RiskLevel, string> = {
  HIGH: "bg-[#fdecea] text-[#c2412b]",
  MEDIUM: "bg-[#fdf3e2] text-[#a7650f]",
  LOW: "bg-brand-100 text-brand-700",
};

type StatusAction = "block" | "activate" | "disqualify";

const STATUS_ACTIONS: Record<
  StatusAction,
  { to: OwnerParticipantStatus; title: string; confirm: string; variant: "primary" | "danger"; describe: (name: string) => React.ReactNode; done: (name: string) => string }
> = {
  block: {
    to: "BLOCKED",
    title: "Ishtirokchini bloklash",
    confirm: "Bloklash",
    variant: "danger",
    describe: (name) => (
      <>
        <strong className="font-medium text-slate-900">{name}</strong> bloklanadi va reytingdan chiqadi. Keyin
        faollashtirish mumkin.
      </>
    ),
    done: (name) => `${name} bloklandi.`,
  },
  activate: {
    to: "ACTIVE",
    title: "Faollashtirish",
    confirm: "Faollashtirish",
    variant: "primary",
    describe: (name) => (
      <>
        <strong className="font-medium text-slate-900">{name}</strong> yana faol bo&apos;ladi, videosi reytingda
        hisobga olinadi.
      </>
    ),
    done: (name) => `${name} faollashtirildi.`,
  },
  disqualify: {
    to: "DISQUALIFIED",
    title: "Tanlovdan chetlatish",
    confirm: "Chetlatish",
    variant: "danger",
    describe: (name) => (
      <>
        <strong className="font-medium text-slate-900">{name}</strong> tanlovdan chetlatiladi: reytingdan chiqadi va
        g&apos;olib bo&apos;la olmaydi. Chetlatilganlar bu ro&apos;yxatda ko&apos;rinmaydi — holatni keyin
        «Ishtirokchilar» bo&apos;limidan qaytarish mumkin.
      </>
    ),
    done: (name) => `${name} tanlovdan chetlatildi.`,
  },
};

/** "Xavfli hisoblar" bo'limi: ball bo'yicha kartalar, ega belgisi va holatni o'zgartirish. */
export function OwnerRisk() {
  const queryClient = useQueryClient();
  const [level, setLevel] = useState<LevelFilter>("ALL");
  const [includeSafe, setIncludeSafe] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [action, setAction] = useState<{ account: RiskAccount; action: StatusAction } | null>(null);
  const [notice, setNotice] = useNotice();

  const query = {
    level: level === "ALL" ? undefined : level,
    includeSafe: includeSafe || undefined,
    search: search || undefined,
    page,
    pageSize: PAGE_SIZE,
  };

  const { data, error, isPending, isError, isFetching, refetch } = useQuery({
    queryKey: [OWNER_QUERY_KEY, "risk", query],
    queryFn: () => getRiskAccounts(query),
    placeholderData: keepPreviousData,
  });

  function done(message: string) {
    setNotice(message);
    void queryClient.invalidateQueries({ queryKey: [OWNER_QUERY_KEY] });
  }

  return (
    <div className="space-y-4">
      <NoticeBanner message={notice} />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3">
          <SearchInput
            value={search}
            onDebouncedChange={(value) => {
              setSearch(value);
              setPage(1);
            }}
            placeholder="Ism, telefon, @instagram yoki Telegram ID"
            label="Xavfli hisoblarni qidirish"
            className="w-full sm:w-96"
          />
          <div className="flex flex-wrap items-center gap-3">
            <Segmented
              label="Xavf darajasi bo'yicha filtr"
              value={level}
              onChange={(value) => {
                setLevel(value);
                setPage(1);
              }}
              options={LEVELS.map((value) => ({
                value,
                label: value === "ALL" ? "Hammasi" : RISK_LEVEL_SHORT[value],
                count: data?.counts[value],
                attention: value === "HIGH",
              }))}
            />
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-line bg-white px-3.5 py-1.5 text-sm text-ink transition hover:border-brand-200">
              <input
                type="checkbox"
                checked={includeSafe}
                onChange={(event) => {
                  setIncludeSafe(event.target.checked);
                  setPage(1);
                }}
                className="size-4 accent-brand-600"
              />
              Xavfsiz belgilanganlarni ko&apos;rsatish
              {data && <span className="text-slate-400 tabular-nums">{formatNumber(data.counts.SAFE)}</span>}
            </label>
          </div>
        </div>

        <details className="group rounded-2xl border border-line bg-white px-4 py-3 text-sm lg:max-w-sm">
          <summary className="cursor-pointer font-medium text-ink marker:text-slate-400">Ball qanday hisoblanadi?</summary>
          <ul className="mt-2 space-y-1 text-xs text-slate-600">
            {RISK_POINTS_HINT.map((hint) => (
              <li key={hint.kind} className="flex justify-between gap-3">
                <span>{RISK_SIGNAL_LABELS[hint.kind]}</span>
                <span className="shrink-0 font-medium text-ink tabular-nums">{hint.points}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-slate-500">
            60 va undan yuqori — yuqori xavf, 30 dan — o&apos;rta, qolgani — past. Chetlatilganlar ko&apos;rsatilmaydi.
            «Xavfsiz» belgisidan keyin yangi signal chiqsa, hisob ro&apos;yxatga qaytadi.
          </p>
        </details>
      </div>

      {isPending ? (
        <Card className="flex justify-center py-12">
          <Spinner />
        </Card>
      ) : isError && !data ? (
        <Card>
          <ErrorState error={error} onRetry={() => void refetch()} />
        </Card>
      ) : data && data.items.length === 0 ? (
        <Card>
          <EmptyState icon={ShieldCheck} tint="green" text="Bu darajada xavfli hisob yo'q." />
        </Card>
      ) : data ? (
        <>
          <div
            className={cn("grid gap-4 lg:grid-cols-2", isFetching && "opacity-60 transition-opacity")}
            aria-busy={isFetching}
          >
            {data.items.map((account) => (
              <RiskCard
                key={account.participant.id}
                account={account}
                onDone={done}
                onStatusAction={(next) => setAction({ account, action: next })}
              />
            ))}
          </div>
          {data.total > data.pageSize && (
            <Card className="px-4 py-3">
              <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPageChange={setPage} />
            </Card>
          )}
        </>
      ) : null}

      {action && (
        <ConfirmDialog
          key={`${action.account.participant.id}:${action.action}`}
          title={STATUS_ACTIONS[action.action].title}
          description={STATUS_ACTIONS[action.action].describe(ownerFullName(action.account.participant))}
          confirmLabel={STATUS_ACTIONS[action.action].confirm}
          variant={STATUS_ACTIONS[action.action].variant}
          onConfirm={() =>
            updateOwnerParticipant(action.account.participant.id, { status: STATUS_ACTIONS[action.action].to })
          }
          onClose={() => setAction(null)}
          onDone={() => {
            setAction(null);
            done(STATUS_ACTIONS[action.action].done(ownerFullName(action.account.participant)));
          }}
        />
      )}
    </div>
  );
}

interface RiskCardProps {
  account: RiskAccount;
  onDone: (message: string) => void;
  onStatusAction: (action: StatusAction) => void;
}

function RiskCard({ account, onDone, onStatusAction }: RiskCardProps) {
  const { participant, review } = account;
  const name = ownerFullName(participant);
  const styles = LEVEL_STYLES[account.level];

  const verdict = useMutation({
    mutationFn: (next: RiskVerdict | null) => reviewRiskAccount(participant.id, next),
    onSuccess: (_, next) =>
      onDone(
        next === "SAFE"
          ? `${name} xavfsiz deb belgilandi va ro'yxatdan yashirildi.`
          : next === "WATCH"
            ? `${name} kuzatuvga olindi.`
            : `${name}: belgi olib tashlandi.`,
      ),
  });
  const pending = verdict.isPending ? verdict.variables : undefined;

  return (
    <Card className="relative flex flex-col overflow-hidden">
      <div aria-hidden className={cn("h-1 w-full", styles.bar)} />

      <div className="flex items-start gap-4 px-5 pt-4">
        <div
          className={cn("grid size-14 shrink-0 place-items-center rounded-2xl ring-2", styles.score)}
          title={`Xavf balli: ${account.score}`}
        >
          <span className="text-xl leading-none font-semibold tabular-nums">{account.score}</span>
          <span className="-mt-2 text-[10px] font-medium opacity-70">ball</span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h3 className="truncate text-[15px] font-semibold text-ink">{name}</h3>
            <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", LEVEL_BADGE[account.level])}>
              {RISK_LEVEL_LABELS[account.level]}
            </span>
          </div>
          <p className="mt-0.5 truncate text-xs text-slate-500">
            {participant.instagramUsername ? `@${participant.instagramUsername}` : "Instagram ulanmagan"}
            {" · "}
            <span className="tabular-nums">{participant.phone ? formatOwnerPhone(participant.phone) : "telefon yo'q"}</span>
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <Badge tone={OWNER_STATUS_TONES[participant.status]}>{OWNER_STATUS_LABELS[participant.status]}</Badge>
            {review && (
              <Badge tone={review.verdict === "SAFE" ? "success" : "warning"}>
                {review.verdict === "SAFE" ? "Xavfsiz deb belgilangan" : "Kuzatuvda"}
              </Badge>
            )}
            <span className="font-mono text-[11px] text-slate-400">ID {participant.id}</span>
          </div>
        </div>
      </div>

      <ul className="mx-5 mt-4 divide-y divide-slate-100 rounded-xl border border-line">
        {account.signals.map((signal) => (
          <li key={signal.kind} className="flex items-start gap-3 px-3 py-2">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-ink">{RISK_SIGNAL_LABELS[signal.kind]}</p>
              <p className="text-xs text-slate-500">
                {signal.detail}
                {signal.at && <span className="text-slate-400"> · {formatDate(signal.at)}</span>}
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700 tabular-nums">
              +{signal.points}
            </span>
          </li>
        ))}
      </ul>

      <div className="mx-5 mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
        <span className="tabular-nums">
          <strong className="font-semibold text-ink">{formatNumber(participant.views)}</strong> ko&apos;rish
        </span>
        <span>{participant.rank !== null ? `${participant.rank}-o'rin` : "reytingda yo'q"}</span>
        {participant.openTargetCases > 0 && (
          <span className="text-red-700">{participant.openTargetCases} ta ochiq target</span>
        )}
        {participant.reel && (
          <a
            href={participant.reel.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-brand-700 hover:underline"
          >
            Reel
            <ExternalLink className="size-3" aria-hidden />
            <span className="sr-only">({name}, yangi oynada)</span>
          </a>
        )}
      </div>

      {review && (
        <p className="mx-5 mt-2 text-xs text-slate-500">
          {review.verdict === "SAFE" ? "Xavfsiz deb belgilagan" : "Kuzatuvga olgan"}: {review.by},{" "}
          <span className="tabular-nums">{formatDayTime(review.at)}</span>
        </p>
      )}

      {verdict.isError && (
        <div
          role="alert"
          className="mx-5 mt-3 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{errorMessage(verdict.error)}</span>
        </div>
      )}

      <div aria-hidden className="min-h-4 flex-1" />
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-5 py-3">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label={`${name}: ega belgisi`}>
          <VerdictButton
            label="Xavfsiz"
            icon={ShieldCheck}
            active={review?.verdict === "SAFE"}
            activeClass="border-green-300 bg-green-50 text-green-800 disabled:text-green-800"
            loading={pending === "SAFE"}
            disabled={verdict.isPending}
            onClick={() => verdict.mutate("SAFE")}
          />
          <VerdictButton
            label="Kuzatuvda"
            icon={Eye}
            active={review?.verdict === "WATCH"}
            activeClass="border-amber-300 bg-amber-50 text-amber-800 disabled:text-amber-800"
            loading={pending === "WATCH"}
            disabled={verdict.isPending}
            onClick={() => verdict.mutate("WATCH")}
          />
          {review && (
            <Button
              variant="ghost"
              size="sm"
              loading={pending === null}
              disabled={verdict.isPending}
              onClick={() => verdict.mutate(null)}
            >
              {pending !== null && <X className="size-4" aria-hidden />}
              Belgini olib tashlash
            </Button>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {participant.status === "BLOCKED" ? (
            <Button variant="secondary" size="sm" onClick={() => onStatusAction("activate")}>
              <RotateCcw className="size-4" aria-hidden />
              Faollashtirish
            </Button>
          ) : (
            <Button variant="secondary" size="sm" onClick={() => onStatusAction("block")}>
              <Ban className="size-4" aria-hidden />
              Bloklash
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="text-red-700 hover:bg-red-50 hover:text-red-800"
            onClick={() => onStatusAction("disqualify")}
          >
            <UserX className="size-4" aria-hidden />
            Chetlatish
          </Button>
        </div>
      </div>
    </Card>
  );
}

interface VerdictButtonProps {
  label: string;
  icon: LucideIcon;
  active: boolean;
  activeClass: string;
  loading: boolean;
  disabled: boolean;
  onClick: () => void;
}

function VerdictButton({ label, icon: Icon, active, activeClass, loading, disabled, onClick }: VerdictButtonProps) {
  return (
    <Button
      variant="secondary"
      size="sm"
      aria-pressed={active}
      loading={loading}
      disabled={disabled || active}
      onClick={onClick}
      className={cn(active && activeClass, active && "disabled:cursor-default")}
    >
      {!loading && <Icon className="size-4" aria-hidden />}
      {label}
    </Button>
  );
}
