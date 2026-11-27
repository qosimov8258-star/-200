import { useQuery, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { ArrowLeft, ArrowRight, LoaderCircle, Lock, LogIn, RefreshCw, Send } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { GiftButton } from "../components/GiftButton";
import { Card, Spinner, TextField } from "../components/ui";
import { t } from "../i18n";
import * as api from "../lib/api";
import { errorCode } from "../lib/api-error";
import { confirmDialog, haptic, openTelegram } from "../lib/telegram";
import { ageInput, profileErrors } from "../lib/profile-form";
import type { BotLoginStart, BotLoginStatus, TelegramLoginUser } from "../lib/types";

/** Mock rejimda widget o'rniga — imzo tekshirilmaydi. */
const MOCK_USER: TelegramLoginUser = { id: 1, first_name: "Sinov", auth_date: 0, hash: "" };
/** "Hisobim bor": botdagi tasdiqni shu oraliqda so'raymiz (sahifaga qaytilganda — darhol). */
const BOT_LOGIN_POLL_MS = 2_000;

/**
 * Veb-saytda ro'yxatdan o'tish / kirish bloki (mehmonning "Profil" bo'limida, qizil karta ichida —
 * yozuvlar oq, tugma oq fonda qizil). Asosiy tugma — saytning o'zida ro'yxatdan o'tish (ism,
 * telefon raqam, yosh); ostida "Hisobim bor — kirish": Telegram bot orqali qaytib kirish
 * (saytda ro'yxatdan o'tganlar ham, Telegram'dagilar ham). Kirgach hamma so'rovlar qayta
 * yuklanadi: ilova qolgan qadamlarga (qoidalar) yoki bosh sahifaga o'tadi.
 */
export function WebLoginPanel() {
  const [signup, setSignup] = useState(false);
  const [login, setLogin] = useState(false);

  return (
    <div>
      <h2 className="text-[19px] font-bold tracking-tight">{t.webJoinTitle}</h2>
      <p className="mt-1 text-[14px] leading-snug text-white/85">{t.webJoinVia}</p>
      <button
        type="button"
        onClick={() => setSignup(true)}
        className="mt-4 flex h-14 w-full items-center justify-center gap-2 rounded-full bg-white text-base font-bold text-[#c22a24] shadow-[0_10px_24px_-10px_rgba(0,0,0,0.45)] transition active:scale-[0.98]"
      >
        {t.webSignupCta}
        <ArrowRight className="size-5" />
      </button>
      <button
        type="button"
        onClick={() => setLogin(true)}
        className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-white/12 text-[15px] font-bold text-white ring-1 ring-white/45 transition active:scale-[0.98]"
      >
        <LogIn className="size-[18px]" />
        {t.webHaveAccount}
      </button>
      {signup && (
        <WebSignupScreen
          onClose={() => setSignup(false)}
          onLogin={() => {
            setSignup(false);
            setLogin(true);
          }}
        />
      )}
      {login && <AccountLoginScreen onClose={() => setLogin(false)} />}
    </div>
  );
}

type LoginState =
  | { step: "loading" }
  | { step: "error"; tooMany: boolean }
  | { step: "pending"; request: BotLoginStart }
  | { step: "closed"; status: Exclude<BotLoginStatus, "PENDING" | "CONFIRMED"> };

/**
 * "Hisobim bor" — butun ekran. Ochilishi bilan bot orqali kirish so'rovi yaratiladi: kod ko'rinadi,
 * "Botda tasdiqlash" Telegram botni ochadi (`?start=login_<id>`). Foydalanuvchi botda (kerak bo'lsa
 * raqamini ulashib) "Ha, kirish" ni bosadi — sahifa har 2 soniyada so'rab turadi va tasdiqlangach
 * backend sessiya cookie'sini qo'yadi: ilova o'zi ochiladi (bu oyna mehmon kartasi bilan yopiladi).
 * Muqobil — Telegram Login vidjeti (kompyuterda qulay).
 */
function AccountLoginScreen({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<LoginState>({ step: "loading" });
  const [opened, setOpened] = useState(false);
  /** "Yangi kod olish" — har bosilganda yangi so'rov. */
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let current = true;
    api
      .startBotLogin()
      .then((request) => current && setState({ step: "pending", request }))
      .catch((error: unknown) => current && setState({ step: "error", tooMany: errorCode(error) === "TOO_MANY" }));
    return () => {
      current = false;
    };
  }, [attempt]);

  const retry = () => {
    setOpened(false);
    setState({ step: "loading" });
    setAttempt((n) => n + 1);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Botdagi tasdiqni kutish: muntazam va sahifaga qaytilganda (telefonda Telegram'dan qaytish).
  const request = state.step === "pending" ? state.request : null;
  useEffect(() => {
    if (!request) return;
    let active = true;
    const check = async () => {
      try {
        const { status } = await api.pollBotLogin(request.id);
        if (!active || status === "PENDING") return;
        active = false;
        if (status === "CONFIRMED") {
          haptic.success();
          // Endi kirgan foydalanuvchi — ilova o'zi ochiladi (mehmon kartasi va bu oyna yopiladi).
          await queryClient.invalidateQueries();
          return;
        }
        haptic.error();
        setState({ step: "closed", status });
      } catch {
        // Tarmoq uzildi — keyingi urinishda yana so'raymiz.
      }
    };
    const timer = window.setInterval(() => void check(), BOT_LOGIN_POLL_MS);
    const expiry = window.setTimeout(
      () => {
        if (!active) return;
        active = false;
        setState({ step: "closed", status: "EXPIRED" });
      },
      Math.max(0, new Date(request.expiresAt).getTime() - Date.now()),
    );
    const onVisible = () => {
      if (document.visibilityState === "visible") void check();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.clearTimeout(expiry);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [request, queryClient]);

  const openBot = () => {
    if (!request) return;
    haptic.tap();
    setOpened(true);
    // Mock: havola haqiqiy botni ochmasin — tasdiq birozdan keyin o'zi keladi.
    if (api.mockControls) api.mockControls.confirmBotLogin(request.id);
    else openTelegram(request.botUrl);
  };

  const closedText =
    state.step === "closed"
      ? state.status === "DENIED"
        ? t.webLoginDenied
        : state.status === "FAILED"
          ? t.webLoginTaken
          : t.webLoginExpired
      : null;

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={t.webLoginTitle} className="fixed inset-0 z-[80] overflow-y-auto bg-bg text-ink">
      <main className="mx-auto max-w-[520px] px-5 pt-[calc(var(--safe-top)+16px)] pb-[calc(var(--safe-bottom)+24px)]">
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-10 items-center gap-1.5 rounded-full bg-surface px-4 text-[14px] font-semibold"
        >
          <ArrowLeft className="size-4" />
          {t.webLoginBack}
        </button>
        <h1 className="mt-5 text-[28px] font-bold tracking-tight">{t.webLoginTitle}</h1>
        <p className="mt-1.5 text-muted">{t.webLoginSubtitle}</p>

        <Card className="mt-6 p-5">
          {state.step === "loading" && <Spinner />}

          {state.step === "pending" && (
            <>
              <p className="text-center text-[13px] font-medium text-muted">{t.webLoginCodeLabel}</p>
              <p
                aria-live="polite"
                className="mt-1 text-center text-[40px] leading-none font-bold tracking-[0.3em] text-ink tabular-nums"
              >
                {state.request.code}
              </p>
              <ol className="mt-5 space-y-2.5">
                {t.webLoginSteps.map((step, i) => (
                  <li key={step} className="flex gap-3 text-[14px] leading-snug">
                    <span className="grid size-6 shrink-0 place-items-center rounded-full bg-[#df3425]/10 text-[12.5px] font-bold text-[#c22a24]">
                      {i + 1}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
              <GiftButton onClick={openBot} className="!mt-12" icon={<Send className="size-5" />}>
                {t.webLoginOpenBot}
              </GiftButton>
              {opened && (
                <p className="mt-4 flex items-center justify-center gap-2 text-center text-[13.5px] text-muted">
                  <LoaderCircle className="size-4 shrink-0 animate-spin" />
                  {api.mockControls ? t.webLoginMockNote : t.webLoginWaiting}
                </p>
              )}
            </>
          )}

          {(state.step === "closed" || state.step === "error") && (
            <div className="space-y-4 text-center">
              <p className="text-[15px] leading-snug">
                {closedText ?? (state.step === "error" && state.tooMany ? t.webLoginTooMany : t.webLoginFailed)}
              </p>
              <button
                type="button"
                onClick={retry}
                className="inline-flex h-12 items-center gap-2 rounded-full bg-ink px-6 text-[15px] font-bold text-white transition active:scale-[0.98]"
              >
                <RefreshCw className="size-4" />
                {t.webLoginRetry}
              </button>
            </div>
          )}
        </Card>

        <div className="my-6 flex items-center gap-3 text-[13px] text-muted">
          <span className="h-px flex-1 bg-ink/10" />
          {t.webLoginOr}
          <span className="h-px flex-1 bg-ink/10" />
        </div>
        <TelegramWidgetLogin />
      </main>
    </div>,
    document.body,
  );
}

/**
 * Muqobil kirish — Telegram Login vidjeti (Telegram hisobi bilan, kompyuterda qulay). Skript
 * faqat bosilganda yuklanadi. Mock rejimda — vidjet o'rniga oddiy tugma.
 */
function TelegramWidgetLogin() {
  const queryClient = useQueryClient();
  const [show, setShow] = useState(false);
  const auth = useQuery({ queryKey: ["auth-config"], queryFn: api.getAuthConfig, enabled: show });
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

  if (!show) {
    return (
      <button
        type="button"
        onClick={() => setShow(true)}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-surface text-[14.5px] font-semibold transition active:scale-[0.98]"
      >
        <Send className="size-4 text-[#1d8fcf]" />
        {t.webLoginWidget}
      </button>
    );
  }
  return (
    <div>
      {api.mockControls ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => void login(MOCK_USER)}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-surface text-[15px] font-bold transition active:scale-[0.98] disabled:opacity-70"
        >
          {busy ? <LoaderCircle className="size-5 animate-spin" /> : t.webLoginMock}
          {!busy && <Send className="size-4" />}
        </button>
      ) : auth.isPending ? (
        <Spinner />
      ) : bot ? (
        <div className="rounded-[22px] bg-surface p-2.5">
          <TelegramLoginButton botUsername={bot} onAuth={(user) => void login(user)} />
        </div>
      ) : (
        <p className="rounded-xl bg-surface px-3 py-2 text-[14px]">{t.webLoginNotConfigured}</p>
      )}
      {busy && !api.mockControls && <Spinner />}
      {error && <p className="mt-3 px-1.5 text-[13px] text-negative">{t.webLoginFailed}</p>}
    </div>
  );
}

/** "901234567" → "90 123 45 67" (yozish paytida ham). */
const formatLocalPhone = (digits: string): string =>
  [digits.slice(0, 2), digits.slice(2, 5), digits.slice(5, 7), digits.slice(7, 9)].filter(Boolean).join(" ");

/** Kiritilgan matndan 9 raqam: "+998 90…" yoki "998…" bilan yozilgan/qo'yilgan bo'lsa — kod olib tashlanadi. */
function localDigits(input: string): string {
  const digits = input.replace(/\D/g, "");
  return (digits.length > 9 && digits.startsWith("998") ? digits.slice(3) : digits).slice(0, 9);
}

/**
 * Saytdan (Telegram'siz) ro'yxatdan o'tish: ism, telefon raqam (+998), yosh — butun ekran.
 * Muvaffaqiyatli bo'lsa backend sessiya cookie'sini qo'yadi va ilova qoidalarga rozilik
 * qadamiga o'tadi (bu oyna o'zi yopiladi). Raqam band bo'lsa — "Hisobimga kirish" ("Hisobim bor").
 */
function WebSignupScreen({ onClose, onLogin }: { onClose: () => void; onLogin: () => void }) {
  const queryClient = useQueryClient();
  const contest = useQuery({ queryKey: ["contest"], queryFn: api.getContest });
  const minAge = contest.data?.minAge ?? 18;
  const [form, setForm] = useState({ firstName: "", phone: "", age: "" });
  const [errors, setErrors] = useState<{ firstName?: string; phone?: string; age?: string }>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const firstName = form.firstName.trim();
    const next = {
      ...profileErrors(firstName, form.age, minAge),
      phone: form.phone.length === 9 ? undefined : t.phoneInvalid,
    };
    setErrors(next);
    setServerError(null);
    if (next.firstName || next.phone || next.age) {
      haptic.error();
      return;
    }
    const age = Number.parseInt(form.age, 10);
    (document.activeElement as HTMLElement | null)?.blur();
    if (!(await confirmDialog(t.confirmProfile(firstName, `+998 ${formatLocalPhone(form.phone)}`, age)))) return;

    setLoading(true);
    try {
      await api.webRegister({ firstName, phone: form.phone, age });
      haptic.success();
      // Endi kirgan foydalanuvchi — ilova qoidalarga rozilik qadamiga o'tadi.
      await queryClient.invalidateQueries();
    } catch (error) {
      haptic.error();
      const code = errorCode(error);
      if (code === "PHONE_TAKEN") setErrors({ phone: t.phoneTaken });
      else if (code === "INVALID_PHONE") setErrors({ phone: t.phoneInvalid });
      else if (code === "UNDER_AGE") setErrors({ age: t.ageTooYoung(minAge) });
      else if (code === "INVALID_PROFILE") setErrors({ firstName: t.nameInvalid });
      else setServerError(code === "TOO_MANY" ? t.tooManyAttempts : t.genericError);
      setLoading(false);
    }
  };

  // Portal: mehmon kartasida animatsiya (`transform`) bor — `fixed` oyna uning ichida qolib ketardi.
  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={t.webSignupTitle} className="fixed inset-0 z-[80] overflow-y-auto bg-bg text-ink">
      <main className="mx-auto max-w-[520px] px-5 pt-[calc(var(--safe-top)+16px)] pb-[calc(var(--safe-bottom)+24px)]">
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-10 items-center gap-1.5 rounded-full bg-surface px-4 text-[14px] font-semibold"
        >
          <ArrowLeft className="size-4" />
          {t.webSignupBack}
        </button>
        <h1 className="mt-5 text-[28px] font-bold tracking-tight">{t.webSignupTitle}</h1>
        <p className="mt-1.5 text-muted">{t.webSignupSubtitle}</p>
        <Card dark className="mt-6 flex gap-3 rounded-tile p-4">
          <Lock className="mt-0.5 size-5 shrink-0" />
          <p className="text-[15px] leading-snug">{t.registerWarning}</p>
        </Card>
        <form className="mt-5 space-y-3.5" onSubmit={(e) => void submit(e)} noValidate>
          <TextField
            label={t.firstName}
            value={form.firstName}
            onChange={(e) => {
              setForm((f) => ({ ...f, firstName: e.target.value }));
              setErrors((er) => ({ ...er, firstName: undefined }));
            }}
            error={errors.firstName}
            autoComplete="given-name"
            autoCapitalize="words"
            enterKeyHint="next"
          />
          <label className="block">
            <span className="mb-1.5 ml-1.5 block text-[13px] text-muted">{t.phone}</span>
            <span
              className={clsx(
                "flex h-14 items-center rounded-full border bg-surface pr-3 pl-5 transition focus-within:border-[#df3425]/45 focus-within:ring-4 focus-within:ring-[#df3425]/10",
                errors.phone ? "border-negative" : "border-transparent",
              )}
            >
              <span className="text-base font-semibold text-muted tabular-nums">+998</span>
              <input
                type="tel"
                inputMode="tel"
                autoComplete="tel-national"
                placeholder={t.phonePlaceholder}
                value={formatLocalPhone(form.phone)}
                onChange={(e) => {
                  setForm((f) => ({ ...f, phone: localDigits(e.target.value) }));
                  setErrors((er) => ({ ...er, phone: undefined }));
                }}
                aria-invalid={errors.phone ? true : undefined}
                enterKeyHint="next"
                className="ml-2 h-full min-w-0 flex-1 bg-transparent text-base tabular-nums outline-none placeholder:text-muted"
              />
            </span>
            {errors.phone && <span className="mt-1.5 ml-1.5 block text-[13px] text-negative">{errors.phone}</span>}
          </label>
          {/* Raqam band — qayta ro'yxatdan o'tish o'rniga shu hisobga kirish. */}
          {errors.phone === t.phoneTaken && (
            <button
              type="button"
              onClick={onLogin}
              className="ml-1.5 inline-flex items-center gap-1.5 text-[14px] font-bold text-[#c22a24]"
            >
              <LogIn className="size-4" />
              {t.phoneTakenLogin}
            </button>
          )}
          <TextField
            label={t.age}
            value={form.age}
            onChange={(e) => {
              const age = ageInput(e.target.value);
              setForm((f) => ({ ...f, age }));
              setErrors((er) => ({ ...er, age: undefined }));
            }}
            error={errors.age}
            inputMode="numeric"
            enterKeyHint="done"
          />
          {serverError && <p className="px-1.5 text-[13px] text-negative">{serverError}</p>}
          <GiftButton type="submit" loading={loading} className="!mt-10" icon={<ArrowRight className="size-5" />}>
            {t.continue}
          </GiftButton>
          <p className="px-1.5 text-center text-[12.5px] leading-snug text-muted">{t.webSignupDeviceNote}</p>
        </form>
      </main>
    </div>,
    document.body,
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
