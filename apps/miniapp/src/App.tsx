import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, Gift, Home, LayoutGrid, Medal, Megaphone, PlayCircle, Trophy, User, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { BackButton } from "./components/BackButton";
import { GlassNav } from "./components/GlassNav";
import { MoreMenu } from "./components/MoreMenu";
import { RulesHero } from "./components/RulesHero";
import { SupportScreen } from "./screens/SupportScreen";
import { useToast } from "./components/toast-context";
import { ErrorBlock, PageHeader, Spinner } from "./components/ui";
import { t } from "./i18n/uz";
import * as api from "./lib/api";
import { errorCode } from "./lib/api-error";
import { hideSplash } from "./lib/splash";
import { takeTelegramAuthResult } from "./lib/telegram-login-return";
import { isInTelegram, showBackButton } from "./lib/telegram";
import type { Me } from "./lib/types";
import { MyReelScreen } from "./screens/MyReelScreen";
import { PrizesScreen } from "./screens/PrizesScreen";
import { HomeScreen } from "./screens/HomeScreen";
import { ConsentScreen, ContactScreen, RegisterScreen, RulesContent, StatusScreen } from "./screens/onboarding";
import { GuestGate, GuestProfile, ProfileScreen, WinnerContent } from "./screens/ProfileScreen";
import { RatingScreen } from "./screens/RatingScreen";
import { ReportScreen } from "./screens/ReportScreen";

type Tab = "home" | "rating" | "reel" | "profile" | "prizes";
/** Pastki menyuga sig'masdan "Ko'proq" ichida turadigan bo'limlar. */
type OverflowTab = Extract<Tab, "prizes">;
type NavKey = Exclude<Tab, OverflowTab> | "more";
type SubPage = "rules" | "winner" | "report" | "support" | null;

const isOverflow = (tab: Tab): tab is OverflowTab => tab === "prizes";

export default function App() {
  const me = useQuery({ queryKey: ["me"], queryFn: api.getMe });
  const contest = useQuery({ queryKey: ["contest"], queryFn: api.getContest });
  // Veb-sayt (Telegram'dan tashqarida), kirmagan: mehmon sifatida bosh sahifaga kiradi,
  // ro'yxatdan o'tishni "Profil" da boshlaydi.
  const isGuest = !isInTelegram && me.isError && errorCode(me.error) === "UNAUTHORIZED";
  const loading = (me.isPending || contest.isPending) && !isGuest;
  useTelegramLoginReturn();

  // Birinchi ekran tayyor (yoki xato) — "Olivia" yuklanish sahifasi yopiladi.
  useEffect(() => {
    if (!loading) hideSplash();
  }, [loading]);

  return (
    <>
      {api.IS_MOCK_API && <DevBanner />}
      {isGuest ? (
        <MainShell me={null} />
      ) : me.isPending || contest.isPending ? (
        <div className="grid min-h-dvh place-items-center">
          <Spinner />
        </div>
      ) : me.isError || contest.isError ? (
        <div className="grid min-h-dvh place-items-center">
          <ErrorBlock onRetry={() => void Promise.all([me.refetch(), contest.refetch()])} />
        </div>
      ) : (
        <Stage me={me.data} prizeName={contest.data.prizeName} minAge={contest.data.minAge} />
      )}
    </>
  );
}

/**
 * Saytda "Telegram bilan kirish" telefonda bosilganda Telegram tasdiqdan keyin sahifani
 * `#tgAuthResult=…` bilan qayta ochadi — kirishni shu yerda yakunlaymiz (qaysi bo'lim ochiq
 * bo'lishidan qat'i nazar). Kompyuterda vidjet natijani o'zi qaytaradi (WebLoginPanel).
 */
function useTelegramLoginReturn() {
  const queryClient = useQueryClient();
  const toast = useToast();
  useEffect(() => {
    if (isInTelegram) return;
    const user = takeTelegramAuthResult();
    if (!user) return;
    api
      .telegramLogin(user)
      .then(() => queryClient.invalidateQueries())
      .catch(() => toast(t.webLoginFailed));
  }, [queryClient, toast]);
}

function Stage({ me, prizeName, minAge }: { me: Me; prizeName: string; minAge: number }) {
  switch (me.stage) {
    case "NEEDS_CONTACT":
      return <ContactScreen prizeName={prizeName} />;
    case "NEEDS_PROFILE":
      return <RegisterScreen minAge={minAge} phoneMasked={me.phoneMasked} />;
    case "NEEDS_CONSENT":
      return <ConsentScreen rulesUpdated={me.rulesUpdated} />;
    case "BLOCKED":
      return <StatusScreen title={t.blockedTitle} body={t.blockedBody} />;
    case "DISQUALIFIED":
      return <StatusScreen title={t.disqualifiedTitle} body={t.disqualifiedBody} />;
    case "ACTIVE":
      return <MainShell me={me} />;
  }
}

/** `me === null` — veb-saytdagi mehmon: ochiq bo'limlarni ko'radi, qolganlarida ro'yxatdan o'tish taklifi. */
function MainShell({ me }: { me: Me | null }) {
  const firstName = me?.profile?.firstName ?? t.guestName;
  const fullName = me?.profile ? `${me.profile.firstName} ${me.profile.lastName}`.trim() : t.guestName;

  const [tab, setTab] = useState<Tab>("home");
  const [sub, setSub] = useState<SubPage>(null);
  /** Support sahifasiga oldindan yozilgan matn (masalan, profil maydonini o'zgartirish so'rovi). */
  const [supportDraft, setSupportDraft] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = useCallback(() => setMenuOpen(false), []);

  const open = (next: { tab?: Tab; sub?: SubPage }) => {
    setMenuOpen(false);
    setSub(next.sub ?? null);
    if (next.tab) setTab(next.tab);
  };
  /** Mehmon yopiq bo'limga kirdi — ro'yxatdan o'tish "Profil" da. */
  const toProfile = () => open({ tab: "profile" });

  // Ichki sahifada Telegram'ning "Orqaga" tugmasi ko'rinadi.
  useEffect(() => {
    if (!sub) return;
    return showBackButton(() => setSub(null));
  }, [sub]);
  useEffect(() => {
    // `scrollTo` ba'zi muhitlarda Promise qaytaradi — effektdan qaytarmaymiz.
    window.scrollTo(0, 0);
  }, [tab, sub]);

  return (
    <>
      <main className="px-5 pt-[calc(var(--safe-top)+12px)] pb-[calc(var(--safe-bottom)+120px)]">
        {sub === "rules" ? (
          <SubPageLayout title={t.rulesTitle} header={<RulesHero />} onBack={() => setSub(null)}>
            <RulesContent />
          </SubPageLayout>
        ) : sub === "support" ? (
          <SubPageLayout title={t.supportTitle} onBack={() => setSub(null)}>
            <SupportScreen key={supportDraft} draft={supportDraft} />
          </SubPageLayout>
        ) : sub === "winner" ? (
          <SubPageLayout title={t.winnerTitle} onBack={() => setSub(null)}>
            <WinnerContent />
          </SubPageLayout>
        ) : sub === "report" ? (
          <SubPageLayout title={t.reportTitle} onBack={() => setSub(null)}>
            {me ? (
              <ReportScreen onBack={() => open({ tab: "rating" })} />
            ) : (
              <GuestGate title={t.guestReportTitle} body={t.guestReportBody} onJoin={toProfile} />
            )}
          </SubPageLayout>
        ) : tab === "home" ? (
          <HomeScreen
            firstName={firstName}
            fullName={fullName}
            canPostStory={me?.stage === "ACTIVE"}
            onOpenPrizes={() => open({ tab: "prizes" })}
            onJoin={me ? undefined : toProfile}
          />
        ) : tab === "rating" ? (
          <RatingScreen onOpenReel={() => setTab("reel")} />
        ) : tab === "reel" ? (
          me ? (
            <MyReelScreen />
          ) : (
            <div className="space-y-5">
              <PageHeader title={t.navReel} />
              <GuestGate title={t.guestReelTitle} body={t.guestReelBody} onJoin={toProfile} />
            </div>
          )
        ) : tab === "prizes" ? (
          <PrizesScreen onOpenReel={() => setTab("reel")} guest={!me} />
        ) : me ? (
          <ProfileScreen
            me={me}
            onOpenRules={() => setSub("rules")}
            onOpenWinner={() => setSub("winner")}
            onOpenSupport={(draft) => {
              setSupportDraft(draft ?? "");
              setSub("support");
            }}
          />
        ) : (
          <GuestProfile onOpenRules={() => setSub("rules")} onOpenWinner={() => setSub("winner")} />
        )}
      </main>
      <MoreMenu
        open={menuOpen}
        onClose={closeMenu}
        items={[
          {
            key: "prizes",
            label: t.navPrizes,
            hint: t.morePrizesHint,
            icon: Gift,
            tone: "bg-[linear-gradient(135deg,#ff9a5a,#e2457a_55%,#7b4dff)]",
            active: tab === "prizes" && !sub,
            onSelect: () => open({ tab: "prizes" }),
          },
          {
            key: "rules",
            label: t.menuRules,
            hint: t.moreRulesHint,
            icon: BookOpen,
            tone: "bg-ink",
            active: sub === "rules",
            onSelect: () => open({ sub: "rules" }),
          },
          {
            key: "winner",
            label: t.menuWinner,
            hint: t.moreWinnerHint,
            icon: Trophy,
            tone: "bg-[linear-gradient(135deg,#f3cf6b,#c8922a)]",
            active: sub === "winner",
            onSelect: () => open({ sub: "winner" }),
          },
          {
            key: "report",
            label: t.menuReport,
            hint: t.moreReportHint,
            icon: Megaphone,
            tone: "bg-[linear-gradient(135deg,#ff8a5b,#e2457a)]",
            active: sub === "report",
            onSelect: () => open({ sub: "report" }),
          },
        ]}
      />
      <GlassNav<NavKey>
        items={[
          { key: "home", label: t.navHome, icon: Home },
          { key: "rating", label: t.navRating, icon: Medal },
          { key: "reel", label: t.navReel, icon: PlayCircle },
          { key: "profile", label: t.navProfile, icon: User },
          // Sig'magan bo'lim ochiq bo'lsa — tugma o'sha bo'lim nomi va belgisini oladi.
          {
            key: "more",
            label: isOverflow(tab) ? t.navPrizes : t.navMore,
            icon: menuOpen ? X : isOverflow(tab) ? Gift : LayoutGrid,
          },
        ]}
        active={isOverflow(tab) ? "more" : tab}
        pressed={menuOpen ? "more" : null}
        onSelect={(next) => {
          if (next === "more") setMenuOpen((o) => !o);
          else open({ tab: next });
        }}
        onReselect={(key) => {
          if (key === "more") setMenuOpen((o) => !o);
          else open({ tab: key });
        }}
      />
    </>
  );
}

function SubPageLayout({
  title,
  header,
  onBack,
  children,
}: {
  title: string;
  /** Oddiy sarlavha o'rniga (masalan, qoidalar sahifasining bayram kartasi). */
  header?: React.ReactNode;
  onBack: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-5">
      {/* Telegram ichida "Orqaga" tugmasi Telegram panelida; brauzerda — shu yerda. */}
      {!isInTelegram && <BackButton onClick={onBack} />}
      {header ?? <PageHeader title={title} />}
      {children}
    </div>
  );
}

function DevBanner() {
  return (
    <div className="sticky top-0 z-50 flex items-center justify-between gap-3 bg-gold px-4 py-1.5 text-xs font-semibold text-ink">
      <span>{t.devBanner}</span>
      {api.mockControls && (
        <button
          type="button"
          className="shrink-0 underline"
          onClick={() => {
            api.mockControls!.reset();
            window.location.reload();
          }}
        >
          {t.devReset}
        </button>
      )}
    </div>
  );
}
