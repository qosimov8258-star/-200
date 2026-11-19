import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Send } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { PrizeHero } from "../components/PrizeHero";
import { Card, PillButton, Spinner } from "../components/ui";
import { t } from "../i18n/uz";
import * as api from "../lib/api";
import { botLink } from "../lib/telegram";
import type { TelegramLoginUser } from "../lib/types";

/** Mock rejimda widget o'rniga — imzo tekshirilmaydi. */
const MOCK_USER: TelegramLoginUser = { id: 1, first_name: "Sinov", auth_date: 0, hash: "" };

/**
 * Veb-saytning kirish sahifasi (Telegram'dan tashqarida, kirmagan foydalanuvchi).
 * Telegram Login Widget orqali kiriladi — Mini App bilan bir xil akkaunt (telegramId).
 */
export function WebLoginScreen() {
  const queryClient = useQueryClient();
  const auth = useQuery({ queryKey: ["auth-config"], queryFn: api.getAuthConfig });
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  const login = async (user: TelegramLoginUser) => {
    setBusy(true);
    setError(false);
    try {
      await api.telegramLogin(user);
      await queryClient.invalidateQueries();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };

  const bot = auth.data?.botUsername ?? null;

  return (
    <main className="flex min-h-dvh flex-col gap-4 px-5 pt-[calc(var(--safe-top)+12px)] pb-[calc(var(--safe-bottom)+16px)]">
      <PrizeHero prizeName={auth.data?.prizeName ?? ""} />
      <Card>
        <h1 className="text-lg font-bold tracking-tight">{t.webLoginTitle}</h1>
        <p className="mt-1.5 text-[15px] leading-snug text-muted">{t.webLoginBody}</p>
        <div className="mt-4">
          {auth.isPending ? (
            <Spinner />
          ) : api.mockControls ? (
            <PillButton loading={busy} onClick={() => void login(MOCK_USER)} icon={<Send className="size-5" />}>
              {t.webLoginMock}
            </PillButton>
          ) : bot ? (
            <TelegramLoginButton botUsername={bot} onAuth={(user) => void login(user)} />
          ) : (
            <p className="text-[15px] text-negative">{t.webLoginNotConfigured}</p>
          )}
        </div>
        {busy && !api.mockControls && <Spinner />}
        {error && <p className="mt-3 text-[13px] text-negative">{t.webLoginFailed}</p>}
      </Card>
      {bot && (
        <a
          href={botLink(bot)}
          target="_blank"
          rel="noopener noreferrer"
          className="px-1 text-center text-[15px] font-semibold underline"
        >
          {t.webOpenBot}
        </a>
      )}
    </main>
  );
}

/**
 * Rasmiy Telegram Login Widget (`telegram-widget.js`). Faqat @BotFather → /setdomain da
 * ko'rsatilgan domenda ishlaydi; boshqa joyda Telegram "Bot domain invalid" deydi.
 */
function TelegramLoginButton({
  botUsername,
  onAuth,
}: {
  botUsername: string;
  onAuth: (user: TelegramLoginUser) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const onAuthRef = useRef(onAuth);
  useEffect(() => {
    onAuthRef.current = onAuth;
  }, [onAuth]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    window.onTelegramAuth = (user) => onAuthRef.current(user);
    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.async = true;
    script.setAttribute("data-telegram-login", botUsername);
    script.setAttribute("data-size", "large");
    script.setAttribute("data-radius", "20");
    script.setAttribute("data-request-access", "write");
    script.setAttribute("data-onauth", "onTelegramAuth(user)");
    el.appendChild(script);
    return () => {
      el.replaceChildren();
      delete window.onTelegramAuth;
    };
  }, [botUsername]);

  return <div ref={ref} className="flex min-h-11 justify-center" />;
}
