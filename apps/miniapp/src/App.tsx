import { useQuery } from "@tanstack/react-query";
import { BookOpen, Gift, Home, LayoutGrid, PlayCircle, Trophy, User, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { GlassNav } from "./components/GlassNav";
import { MoreMenu } from "./components/MoreMenu";
import { ErrorBlock, PageHeader, Spinner } from "./components/ui";
import { t } from "./i18n/uz";
import * as api from "./lib/api";
import { errorCode } from "./lib/api-error";
import { isInTelegram, showBackButton } from "./lib/telegram";
import type { Me } from "./lib/types";
import { MyReelScreen } from "./screens/MyReelScreen";
import { PrizesScreen } from "./screens/PrizesScreen";
import { ConsentScreen, ContactScreen, RegisterScreen, RulesContent, StatusScreen } from "./screens/onboarding";
import { ProfileScreen, WinnerContent } from "./screens/ProfileScreen";
import { RatingScreen } from "./screens/RatingScreen";
import { WebLoginScreen } from "./screens/WebLoginScreen";

type Tab = "rating" | "reel" | "profile" | "prizes";
/** Pastki menyuga sig'masdan "Ko'proq" ichida turadigan bo'limlar. */
type OverflowTab = Extract<Tab, "prizes">;
type NavKey = Exclude<Tab, OverflowTab> | "more";
type SubPage = "rules" | "winner" | null;

const isOverflow = (tab: Tab): tab is OverflowTab => tab === "prizes";

export default function App() {
  const me = useQuery({ queryKey: ["me"], queryFn: api.getMe });
  const contest = useQuery({ queryKey: ["contest"], queryFn: api.getContest });
  // Veb-sayt (Telegram'dan tashqarida): kirmagan — Telegram orqali kirish sahifasi.
  const needsWebLogin = !isInTelegram && me.isError && errorCode(me.error) === "UNAUTHORIZED";

  return (
    <>
      {api.IS_MOCK_API && <DevBanner />}
      {needsWebLogin ? (
        <WebLoginScreen />
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

function Stage({ me, prizeName, minAge }: { me: Me; prizeName: string; minAge: number }) {
  switch (me.stage) {
    case "NEEDS_CONTACT":
      return <ContactScreen prizeName={prizeName} />;
    case "NEEDS_PROFILE":
      return <RegisterScreen minAge={minAge} />;
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

function MainShell({ me }: { me: Me }) {
  const [tab, setTab] = useState<Tab>("rating");
  const [sub, setSub] = useState<SubPage>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = useCallback(() => setMenuOpen(false), []);

  const open = (next: { tab?: Tab; sub?: SubPage }) => {
    setMenuOpen(false);
    setSub(next.sub ?? null);
    if (next.tab) setTab(next.tab);
  };

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
          <SubPageLayout title={t.rulesTitle} onBack={() => setSub(null)}>
            <RulesContent />
          </SubPageLayout>
        ) : sub === "winner" ? (
          <SubPageLayout title={t.winnerTitle} onBack={() => setSub(null)}>
            <WinnerContent />
          </SubPageLayout>
        ) : tab === "rating" ? (
          <RatingScreen
            firstName={me.profile!.firstName}
            fullName={`${me.profile!.firstName} ${me.profile!.lastName}`}
            onOpenReel={() => setTab("reel")}
            onOpenWinner={() => setSub("winner")}
          />
        ) : tab === "reel" ? (
          <MyReelScreen />
        ) : tab === "prizes" ? (
          <PrizesScreen onOpenReel={() => setTab("reel")} />
        ) : (
          <ProfileScreen
            me={me}
            onOpenRules={() => setSub("rules")}
            onOpenWinner={() => setSub("winner")}
          />
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
        ]}
      />
      <GlassNav<NavKey>
        items={[
          { key: "rating", label: t.navRating, icon: Home },
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
  onBack,
  children,
}: {
  title: string;
  onBack: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-5">
      {/* Telegram ichida "Orqaga" tugmasi Telegram panelida; brauzerda — shu yerda. */}
      {!isInTelegram && (
        <button type="button" onClick={onBack} className="text-sm font-semibold underline">
          ← {t.back}
        </button>
      )}
      <PageHeader title={title} />
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
