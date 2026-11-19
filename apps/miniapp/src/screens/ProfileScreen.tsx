import { useQuery, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { ChevronRight, FileText, Hourglass, Lock, MessageCircle, Trash2, Trophy } from "lucide-react";
import type { ReactNode } from "react";

import { Avatar, Card, ErrorBlock, PageHeader, Spinner } from "../components/ui";
import { useToast } from "../components/toast-context";
import { t } from "../i18n/uz";
import * as api from "../lib/api";
import { daysUntil, formatCount, formatDateTime } from "../lib/format";
import { closeMiniApp, confirmDialog, haptic, isInTelegram } from "../lib/telegram";
import type { Me } from "../lib/types";

export function ProfileScreen({
  me,
  onOpenRules,
  onOpenWinner,
}: {
  me: Me;
  onOpenRules: () => void;
  onOpenWinner: () => void;
}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const profile = me.profile!;
  const fullName = `${profile.firstName} ${profile.lastName}`;

  const openSupport = () => {
    haptic.tap();
    // Support yozishmasi bot chatida: Mini App yopiladi va foydalanuvchi chatga qaytadi.
    toast(t.supportHint);
    if (isInTelegram) window.setTimeout(closeMiniApp, 1400);
  };

  const remove = async () => {
    if (!(await confirmDialog(t.deleteConfirm))) return;
    try {
      await api.deleteAccount();
      haptic.success();
      queryClient.clear();
      await queryClient.invalidateQueries({ queryKey: ["me"] });
    } catch {
      toast(t.genericError);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader title={t.profileTitle} />
      <Card className="flex items-center gap-3.5">
        <Avatar name={fullName} size={60} dark />
        <span className="min-w-0">
          <span className="block truncate text-xl font-bold tracking-tight">{fullName}</span>
          {me.phoneMasked && <span className="text-[13px] text-muted">{me.phoneMasked}</span>}
        </span>
      </Card>
      <Card className="px-[18px] py-1.5">
        {[
          [t.firstName, profile.firstName],
          [t.lastName, profile.lastName],
          [t.age, String(profile.age)],
        ].map(([label, value], i) => (
          <div key={label} className={clsx("flex items-center gap-2 py-3.5", i > 0 && "border-t border-line")}>
            <span className="flex-1 text-muted">{label}</span>
            <span className="font-semibold">{value}</span>
            <Lock className="size-4 text-muted" />
          </div>
        ))}
      </Card>
      <p className="px-1.5 text-[13px] text-muted">{t.profileLocked}</p>

      <Menu
        items={[
          { icon: <MessageCircle />, label: t.menuSupport, onClick: openSupport },
          { icon: <FileText />, label: t.menuRules, onClick: onOpenRules },
          { icon: <Trophy />, label: t.menuWinner, onClick: onOpenWinner },
        ]}
      />
      <Menu
        items={[
          {
            icon: <Trash2 />,
            label: t.deleteAccount,
            onClick: () => void remove(),
            danger: true,
          },
        ]}
      />
    </div>
  );
}

function Menu({
  items,
}: {
  items: { icon: ReactNode; label: string; onClick: () => void; danger?: boolean }[];
}) {
  return (
    <Card className="overflow-hidden p-0">
      {items.map((item, i) => (
        <button
          key={item.label}
          type="button"
          onClick={item.onClick}
          className={clsx(
            "flex w-full items-center gap-3.5 px-[18px] py-4 text-left text-[15px] font-semibold transition active:bg-chip [&>svg]:size-[22px]",
            i > 0 && "border-t border-line",
            item.danger ? "text-negative" : "text-ink",
          )}
        >
          {item.icon}
          <span className="flex-1">{item.label}</span>
          {!item.danger && <ChevronRight className="!size-5 text-muted" />}
        </button>
      ))}
    </Card>
  );
}

export function WinnerContent() {
  const winner = useQuery({ queryKey: ["winner"], queryFn: api.getWinner });
  const contest = useQuery({ queryKey: ["contest"], queryFn: api.getContest });

  if (winner.isPending) return <Spinner />;
  if (winner.isError) return <ErrorBlock onRetry={() => void winner.refetch()} />;

  if (!winner.data) {
    const days = contest.data ? daysUntil(contest.data.endsAt) : 0;
    return (
      <Card className="p-6">
        <span className="grid size-[52px] place-items-center rounded-full bg-chip">
          <Hourglass className="size-6" />
        </span>
        <h2 className="mt-[18px] text-xl font-bold tracking-tight">{t.winnerPendingTitle}</h2>
        <p className="mt-1.5 text-muted">{t.winnerPendingBody}</p>
        {days > 0 && (
          <p className="mt-[18px] inline-block rounded-full bg-ink px-3.5 py-2 font-semibold text-white">
            {t.daysLeft(days)}
          </p>
        )}
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <section className="flex h-[340px] flex-col rounded-card bg-[linear-gradient(180deg,#5b8fa8,#b8674a_60%,#2a2320)] p-6 text-white">
        <span className="grid size-14 place-items-center rounded-full bg-gold text-ink">
          <Trophy className="size-7" />
        </span>
        <p className="mt-auto text-white/70">{t.winnerCongrats}</p>
        <p className="text-3xl leading-tight font-bold tracking-tight">{winner.data.fullName}</p>
        <p className="mt-3 w-fit rounded-full border border-white/50 px-3 py-1.5 font-semibold">
          {t.winnerPrize}
        </p>
      </section>
      <Card className="text-xl font-bold">{t.views(formatCount(winner.data.finalViews))}</Card>
      <p className="text-center text-[13px] text-muted">
        {t.winnerAnnounced(formatDateTime(winner.data.announcedAt))}
      </p>
    </div>
  );
}
