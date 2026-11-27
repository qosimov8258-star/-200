import { useQuery, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import {
  ArrowRight,
  Cake,
  CalendarDays,
  ChevronRight,
  Eye,
  FileText,
  IdCard,
  Lock,
  LogOut,
  Medal,
  MessageCircle,
  Phone,
  Send,
  Snowflake,
  Trash2,
  Trophy,
  User,
  UserPlus,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import { Card, ErrorBlock, PageHeader, PillButton, Spinner } from "../components/ui";
import { useToast } from "../components/toast-context";
import { t } from "../i18n/uz";
import * as api from "../lib/api";
import { botLink, confirmDialog, haptic, isInTelegram, openExternal, openTelegram } from "../lib/telegram";
import type { Me } from "../lib/types";
import { FestiveConfirm } from "../components/FestiveConfirm";
import { LockedFieldSheet } from "../components/LockedFieldSheet";
import { OliviaFestive } from "../components/OliviaFestive";
import { HangingOrnament, SnowCap } from "../components/Ornaments";
import { Garland, SantaAvatar } from "../components/ProfileFestive";
import { Snowfall } from "../components/Snowfall";
import { daysUntil, displayName, formatCount } from "../lib/format";
import { WinnerAnnounced, WinnerPending } from "../components/WinnerStage";
import { WebLoginPanel } from "./WebLoginScreen";

/** Ilovani ishlab chiqqan jamoa sayti (profil pastidagi yozuv). */
const DEV_TEAM_URL = "https://orbitech.uz";

export function ProfileScreen({
  me,
  onOpenRules,
  onOpenWinner,
  onOpenSupport,
}: {
  me: Me;
  onOpenRules: () => void;
  onOpenWinner: () => void;
  /** Support yozishmasi; `draft` — oldindan yozilgan matn. */
  onOpenSupport: (draft?: string) => void;
}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const profile = me.profile!;
  /** Bosilgan qulflangan maydon (oyna ochiq); null — yopiq. */
  const [lockedField, setLockedField] = useState<string | null>(null);
  const fullName = `${profile.firstName} ${profile.lastName}`.trim();
  // Saytda (Telegram'siz) ro'yxatdan o'tgan hisob faqat shu brauzer orqali ochiladi — chiqish yo'q.
  const webAccount = me.account === "web";

  const reels = useQuery({ queryKey: ["reels"], queryFn: api.getMyReels });
  const contest = useQuery({ queryKey: ["contest"], queryFn: api.getContest });
  // O'rin va ko'rishlar — eng ko'p ko'rilgan qabul qilingan video bo'yicha (o'rin — shu videoning
  // reytingdagi o'rni; videolar qo'shilmaydi); bunday video yo'q bo'lsa — "—".
  const summary = reels.data?.reels.some((r) => r.status === "ACCEPTED") ? reels.data : null;
  const daysLeft = contest.data ? daysUntil(contest.data.endsAt) : null;

  const [askLogout, setAskLogout] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const signOut = async () => {
    setLeaving(true);
    try {
      await api.logout();
      haptic.tap();
      // `clear()` faol so'rovlarni qayta yuklamaydi — ekran eski holatda qolardi.
      await queryClient.resetQueries();
    } catch {
      setLeaving(false);
      setAskLogout(false);
      toast(t.genericError);
    }
  };

  const remove = async () => {
    if (!(await confirmDialog(t.deleteConfirm))) return;
    try {
      await api.deleteAccount();
      haptic.success();
      // `clear()` faol so'rovlarni qayta yuklamaydi — ekran eski holatda qolardi.
      await queryClient.resetQueries();
    } catch {
      toast(t.genericError);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader title={t.profileTitle} />

      {/* Qishki tun kartasi: gulchambar, archa o'yinchog'i, qor va qorbobo qalpoqli avatar. */}
      <section className="relative isolate animate-rise overflow-hidden rounded-card bg-[linear-gradient(155deg,#2c3874_0%,#1a2050_55%,#10142f_100%)] px-5 pt-12 pb-5 text-white shadow-[0_22px_44px_-24px_rgba(16,20,47,0.9)]">
        <div aria-hidden className="absolute -top-16 -right-10 -z-10 size-48 rounded-full bg-[#7f9cff]/30 blur-3xl" />
        <div aria-hidden className="absolute -bottom-20 -left-12 -z-10 size-56 rounded-full bg-[#df3425]/25 blur-3xl" />
        <Snowfall density={0.6} />
        <Garland className="absolute inset-x-0 top-0 h-10" />
        <HangingOrnament className="absolute top-7 right-5 h-[58px] w-auto" />

        <div className="flex items-center gap-4 pr-10">
          <SantaAvatar name={fullName} />
          <div className="min-w-0 flex-1">
            <span className="inline-flex items-center gap-1 rounded-full bg-white/12 px-2.5 py-0.5 text-[11.5px] font-semibold ring-1 ring-white/20">
              <Snowflake className="size-3.5" aria-hidden />
              {t.profileRole}
            </span>
            <h2 className="mt-1.5 text-[22px] leading-tight font-extrabold tracking-tight [overflow-wrap:anywhere]">
              {displayName(fullName)}
            </h2>
            {me.phoneMasked && <p className="mt-0.5 text-[13px] text-white/65 tabular-nums">{me.phoneMasked}</p>}
          </div>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-2">
          <HeroStat
            icon={<Medal />}
            label={t.profileStatRank}
            value={summary?.rank ? `#${summary.rank}` : "—"}
          />
          <HeroStat
            icon={<Eye />}
            label={t.profileStatViews}
            value={summary ? formatCount(summary.totalViews) : "—"}
          />
          <HeroStat
            icon={<CalendarDays />}
            label={t.profileStatDays}
            value={daysLeft !== null && daysLeft > 0 ? String(daysLeft) : "—"}
          />
        </div>
      </section>

      {webAccount && <LinkTelegramCard />}

      {/* Ma'lumotlar — ustiga qor qo'ngan karta. */}
      <Card className="relative mt-6 px-[18px] py-1.5">
        <SnowCap className="absolute -top-[11px] left-4 h-[18px] w-[calc(100%-2rem)] drop-shadow-[0_1px_1.5px_rgba(60,70,110,0.28)]" />
        {[
          { icon: <User />, label: t.firstName, value: profile.firstName },
          // Eski ishtirokchilarda familiya bor — ko'rsatiladi; yangilarida uning o'rnida telefon raqam.
          ...(profile.lastName ? [{ icon: <IdCard />, label: t.lastName, value: profile.lastName }] : []),
          ...(me.phoneMasked ? [{ icon: <Phone />, label: t.phoneShort, value: me.phoneMasked }] : []),
          { icon: <Cake />, label: t.age, value: String(profile.age) },
        ].map((row, i) => (
          // Bosilsa — o'zgartirib bo'lmasligi va support'ga yozish taklifi.
          <button
            key={row.label}
            type="button"
            onClick={() => {
              haptic.tap();
              setLockedField(row.label);
            }}
            className={clsx(
              "flex w-full items-center gap-3 py-3 text-left transition active:opacity-70",
              i > 0 && "border-t border-line",
            )}
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#fdecea] text-[#df3425] [&>svg]:size-[18px]">
              {row.icon}
            </span>
            <span className="flex-1 text-muted">{row.label}</span>
            <span className="font-semibold">{row.value}</span>
            <Lock className="size-4 text-muted" aria-hidden />
          </button>
        ))}
      </Card>
      <p className="px-1.5 text-[13px] text-muted">{t.profileLocked}</p>

      <Menu
        brand
        items={[
          { icon: <MessageCircle />, label: t.menuSupport, onClick: () => onOpenSupport() },
          { icon: <FileText />, label: t.menuRules, onClick: onOpenRules },
          { icon: <Trophy />, label: t.menuWinner, onClick: onOpenWinner },
        ]}
      />
      <Menu
        brand
        items={[
          // Saytda — chiqish (Telegram ichida kerak emas: u yerda akkaunt Telegram'ning o'zi).
          ...(isInTelegram || webAccount
            ? []
            : [{ icon: <LogOut />, label: t.webLogout, onClick: () => setAskLogout(true) }]),
          {
            icon: <Trash2 />,
            label: t.deleteAccount,
            onClick: () => void remove(),
            danger: true,
          },
        ]}
      />

      <FestiveConfirm
        open={askLogout}
        title={t.logoutConfirmTitle}
        body={t.logoutConfirmBody}
        stayLabel={t.logoutStay}
        confirmLabel={t.logoutLeave}
        busy={leaving}
        onConfirm={() => void signOut()}
        onCancel={() => setAskLogout(false)}
      />

      <LockedFieldSheet
        field={lockedField}
        onClose={() => setLockedField(null)}
        onWriteSupport={(field) => {
          setLockedField(null);
          onOpenSupport(t.supportDraftField(field));
        }}
      />

      {/* Bayram tabrigi */}
      <div className="flex flex-col items-center gap-2 pt-3 text-center">
        <OliviaFestive variant="brand" className="h-12 w-auto" />
        <p className="max-w-[28ch] text-[13px] leading-snug text-muted">{t.profileFooter}</p>
        <p className="text-[12px] text-muted">
          {t.profileDevTeam}{" "}
          <a
            href={DEV_TEAM_URL}
            target="_blank"
            rel="noopener"
            onClick={(e) => {
              // Telegram ichida havola tashqi brauzerda ochilsin.
              e.preventDefault();
              openExternal(DEV_TEAM_URL);
            }}
            className="font-semibold text-[#c22a24] underline-offset-2 hover:underline"
          >
            orbitech.uz
          </a>
        </p>
      </div>
    </div>
  );
}

/** Qishki kartadagi muzli plitka: kichik ikonka, nom va qiymat. */
function HeroStat({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-2xl bg-white/10 px-3 py-2.5 ring-1 ring-white/15 backdrop-blur-sm">
      <span className="flex items-center gap-1 text-[11px] font-medium text-white/65 [&>svg]:size-3.5">
        {icon}
        <span className="truncate">{label}</span>
      </span>
      <span className="mt-0.5 block truncate text-[18px] font-extrabold tracking-tight tabular-nums">{value}</span>
    </div>
  );
}

/**
 * Saytda ro'yxatdan o'tgan hisob: Telegram'ga ulash taklifi. Bot `?start=link` bilan ochiladi,
 * foydalanuvchi saytda yozgan raqamini ulashadi — hisob Telegram'ga ulanadi (boshqa qurilmadan
 * kirish va bot xabarlari). Xavfsizlik uchun shu paytgacha bo'lgan sayt sessiyasi yopiladi —
 * ilova mehmon ko'rinishiga o'tadi va foydalanuvchi "Hisobim bor — kirish" bilan qaytib kiradi.
 */
function LinkTelegramCard() {
  const queryClient = useQueryClient();
  const auth = useQuery({ queryKey: ["auth-config"], queryFn: api.getAuthConfig });
  const [waiting, setWaiting] = useState(false);

  // Ulangach sayt sessiyasi yopiladi — `me` 401 qaytaradi va ilova o'zi kirish sahifasiga o'tadi.
  useEffect(() => {
    if (!waiting) return;
    const id = window.setInterval(() => void queryClient.invalidateQueries({ queryKey: ["me"] }), 3000);
    return () => window.clearInterval(id);
  }, [waiting, queryClient]);

  const link = async () => {
    haptic.tap();
    if (api.mockControls) {
      await api.mockControls.linkTelegram();
      await queryClient.invalidateQueries();
      return;
    }
    const bot = auth.data?.botUsername;
    if (!bot) return;
    openTelegram(botLink(bot, "link"));
    setWaiting(true);
  };

  return (
    <Card className="mt-6 space-y-4 p-5">
      <div className="flex gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-[#2aabee]/12 text-[#1d8fcf]">
          <Send className="size-5" />
        </span>
        <div>
          <h3 className="text-[16px] leading-tight font-bold">{t.linkTelegramTitle}</h3>
          <p className="mt-1 text-[13.5px] leading-snug text-muted">{t.linkTelegramBody}</p>
        </div>
      </div>
      <PillButton onClick={() => void link()} icon={<Send className="size-5" />}>
        {t.linkTelegramCta}
      </PillButton>
      {waiting && <p className="px-1 text-[13px] leading-snug text-muted">{t.linkTelegramWaiting}</p>}
    </Card>
  );
}

/**
 * Veb-saytdagi mehmonning "Profil" bo'limi: shu yerdan ro'yxatdan o'tiladi yoki "Hisobim bor" bilan
 * qaytib kiriladi (Telegram bot orqali tasdiq).
 * Kirgach ilova o'zi ro'yxatdan o'tish qadamlariga yoki bosh sahifaga o'tadi.
 */
export function GuestProfile({ onOpenRules, onOpenWinner }: { onOpenRules: () => void; onOpenWinner: () => void }) {
  return (
    <div className="space-y-4">
      <PageHeader title={t.profileTitle} />
      {/* Mehmon kartasi — bosh sahifadagi "Olivia tanlovi boshlandi" banneri uslubida (qizil, qor bilan). */}
      <section className="relative isolate animate-rise overflow-hidden rounded-card bg-[linear-gradient(140deg,#f2583f_0%,#df3425_48%,#ad1f2c_100%)] p-[22px] text-white shadow-[0_18px_40px_-22px_rgba(173,31,44,0.75)]">
        <div aria-hidden className="absolute -top-20 -right-16 -z-10 size-60 rounded-full bg-[#ffb36b]/45 blur-3xl" />
        <div aria-hidden className="absolute -bottom-24 -left-16 -z-10 size-64 rounded-full bg-[#ff7aa8]/30 blur-3xl" />
        <div
          aria-hidden
          className="absolute inset-0 -z-10 opacity-[0.12] [background-image:radial-gradient(circle,white_1px,transparent_1.5px)] [background-size:18px_18px] [mask-image:linear-gradient(to_bottom_left,black,transparent_70%)]"
        />
        <Snowfall density={0.7} />

        <div className="flex items-center gap-3.5">
          <span className="grid size-[60px] shrink-0 place-items-center rounded-full bg-white text-[24px] font-bold text-[#df3425] shadow-[0_8px_18px_-8px_rgba(0,0,0,0.45)] ring-4 ring-white/25">
            {t.guestName.charAt(0)}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[22px] leading-tight font-bold tracking-tight">{t.guestName}</span>
            <span className="mt-1 inline-flex rounded-full bg-black/15 px-2.5 py-0.5 text-[12px] font-medium">
              {t.guestStatus}
            </span>
          </span>
        </div>
        <div aria-hidden className="my-5 h-px bg-white/20" />
        <WebLoginPanel />
      </section>
      <Menu
        brand
        items={[
          { icon: <FileText />, label: t.menuRules, onClick: onOpenRules },
          { icon: <Trophy />, label: t.menuWinner, onClick: onOpenWinner },
        ]}
      />
    </div>
  );
}

/** Faqat ishtirokchilar uchun bo'lim — mehmonga ro'yxatdan o'tishni taklif qiladi. */
export function GuestGate({ title, body, onJoin }: { title: string; body: string; onJoin: () => void }) {
  return (
    <Card className="p-6">
      <span className="grid size-[52px] place-items-center rounded-full bg-[linear-gradient(135deg,#f2583f,#df3425)] text-white">
        <UserPlus className="size-6" />
      </span>
      <h2 className="mt-[18px] text-xl leading-tight font-bold tracking-tight">{title}</h2>
      <p className="mt-1.5 text-[15px] leading-snug text-muted">{body}</p>
      <PillButton className="mt-10" onClick={onJoin} icon={<ArrowRight className="size-5" />}>
        {t.guestJoinCta}
      </PillButton>
    </Card>
  );
}

function Menu({
  items,
  brand = false,
}: {
  items: { icon: ReactNode; label: string; onClick: () => void; danger?: boolean }[];
  /** Ikonkalar brend qizilidagi plitkada (mehmon profili). */
  brand?: boolean;
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
          {brand ? (
            <span
              className={clsx(
                "grid size-9 shrink-0 place-items-center rounded-xl [&>svg]:size-[18px]",
                item.danger
                  ? "bg-[#fdecea] text-negative"
                  : "bg-[linear-gradient(135deg,#f2583f,#df3425)] text-white shadow-[0_4px_10px_-4px_rgba(223,52,37,0.6)]",
              )}
            >
              {item.icon}
            </span>
          ) : (
            item.icon
          )}
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

  const prizeName = contest.data?.prizeName ?? "";
  return winner.data ? (
    <WinnerAnnounced winner={winner.data} prizeName={prizeName} />
  ) : (
    <WinnerPending endsAt={contest.data?.endsAt ?? null} prizeName={prizeName} />
  );
}
