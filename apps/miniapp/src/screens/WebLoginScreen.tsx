import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, LoaderCircle, Send } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Spinner } from "../components/ui";
import { t } from "../i18n/uz";
import * as api from "../lib/api";
import { botLink } from "../lib/telegram";
import type { TelegramLoginUser } from "../lib/types";

/** Mock rejimda widget o'rniga — imzo tekshirilmaydi. */
const MOCK_USER: TelegramLoginUser = { id: 1, first_name: "Sinov", auth_date: 0, hash: "" };

/**
 * Veb-saytda ro'yxatdan o'tish / kirish bloki (mehmonning "Profil" bo'limida, qizil karta ichida —
 * yozuvlar oq, asosiy tugma oq fonda qizil).
 * Telegram Login Widget orqali kiriladi — Mini App bilan bir xil akkaunt (telegramId).
 * Kirgandan keyin hamma so'rovlar qayta yuklanadi: ilova ro'yxatdan o'tish qadamlariga
 * (raqam, ism, qoidalar) yoki to'g'ridan-to'g'ri bosh sahifaga o'tadi.
 */
export function WebLoginPanel() {
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
    <div>
      <h2 className="text-[19px] font-bold tracking-tight">{t.guestJoinTitle}</h2>
      <p className="mt-1.5 text-[14px] leading-snug text-white/85">{t.webLoginBody}</p>
      <div className="mt-4">
        {auth.isPending ? (
          <Spinner />
        ) : api.mockControls ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void login(MOCK_USER)}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-full bg-white text-base font-bold text-[#c22a24] shadow-[0_10px_24px_-10px_rgba(0,0,0,0.45)] transition active:scale-[0.98] disabled:opacity-70"
          >
            {busy ? <LoaderCircle className="size-5 animate-spin" /> : t.webLoginMock}
            {!busy && <Send className="size-5" />}
          </button>
        ) : bot ? (
          // Telegram'ning o'z tugmasi (iframe) — oq "taglik" ustida, karta bilan uyg'un.
          <div className="rounded-[22px] bg-white p-2.5 shadow-[0_10px_24px_-10px_rgba(0,0,0,0.45)]">
            <TelegramLoginButton botUsername={bot} onAuth={(user) => void login(user)} />
          </div>
        ) : (
          <p className="rounded-xl bg-black/20 px-3 py-2 text-[14px]">{t.webLoginNotConfigured}</p>
        )}
      </div>
      {busy && !api.mockControls && <Spinner />}
      {error && <p className="mt-3 rounded-xl bg-black/20 px-3 py-2 text-[13px] font-medium">{t.webLoginFailed}</p>}
      {bot && (
        <a
          href={botLink(bot)}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 flex h-12 items-center justify-center gap-2 rounded-full bg-white/15 text-[15px] font-semibold ring-1 ring-white/35 backdrop-blur-sm transition active:scale-[0.98]"
        >
          {t.webOpenBot}
          <ExternalLink className="size-4" aria-hidden />
        </a>
      )}
    </div>
  );
}

/**
 * Rasmiy Telegram Login Widget (`telegram-widget.js`), o'zbek tilida. Faqat @BotFather → /setdomain
 * da ko'rsatilgan domenda ishlaydi; boshqa joyda Telegram "Bot domain invalid" deydi.
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
    // O'zbekcha tugma ("Telegram bilan kirish"). Shu bilan vidjet manzili ham o'zgaradi: domen
    // @BotFather'da yoqilishidan oldin keshlangan "Bot domain invalid" javobi qayta ishlatilmaydi.
    script.setAttribute("data-lang", "uz");
    script.setAttribute("data-onauth", "onTelegramAuth(user)");
    el.appendChild(script);
    return () => {
      el.replaceChildren();
      delete window.onTelegramAuth;
    };
  }, [botUsername]);

  return <div ref={ref} className="flex min-h-11 justify-center" />;
}
