import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Check, Lock, Phone, Send, Snowflake } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { GiftButton } from "../components/GiftButton";
import { PrizeHero } from "../components/PrizeHero";
import { Card, ErrorBlock, PillButton, Spinner, TextField } from "../components/ui";
import { t } from "../i18n/uz";
import * as api from "../lib/api";
import { errorCode } from "../lib/api-error";
import { ageInput, profileErrors } from "../lib/profile-form";
import {
  botLink,
  confirmDialog,
  haptic,
  isInTelegram,
  openTelegram,
  requestContact,
} from "../lib/telegram";


/**
 * 1-qadam: telefon raqamini ulashish. Telegram raqamni Mini App'ga emas, botga
 * yuboradi; backend uni bot orqali qabul qilib, foydalanuvchiga bog'laydi.
 * Shuning uchun ulashgandan keyin `me` holati o'zgarguncha qayta so'raymiz.
 */
export function ContactScreen({ prizeName }: { prizeName: string }) {
  const queryClient = useQueryClient();
  const [phase, setPhase] = useState<"idle" | "waiting" | "declined" | "unsupported">("idle");

  // Raqam botga yetib borishi bir necha soniya olishi mumkin.
  useEffect(() => {
    if (phase !== "waiting") return;
    const id = window.setInterval(
      () => void queryClient.invalidateQueries({ queryKey: ["me"] }),
      1500,
    );
    return () => window.clearInterval(id);
  }, [phase, queryClient]);

  // Veb-saytda raqam bot chatida ulashiladi: t.me/<bot>?start=web.
  const auth = useQuery({
    queryKey: ["auth-config"],
    queryFn: api.getAuthConfig,
    enabled: !isInTelegram,
  });

  const share = async () => {
    haptic.tap();
    // Mock rejimda bot yo'q — raqam kelganini o'zimiz taqlid qilamiz.
    if (api.mockControls) {
      setPhase("waiting");
      await api.mockControls.shareContact();
      await queryClient.invalidateQueries({ queryKey: ["me"] });
      return;
    }
    if (!isInTelegram) {
      const bot = auth.data?.botUsername;
      if (!bot) {
        setPhase("unsupported");
        return;
      }
      openTelegram(botLink(bot, "web"));
      setPhase("waiting");
      return;
    }
    const result = await requestContact();
    if (result === false) {
      setPhase("declined");
      return;
    }
    if (result === null) {
      setPhase("unsupported");
      return;
    }
    setPhase("waiting");
  };

  const note =
    phase === "declined"
      ? t.contactDeclined
      : phase === "unsupported"
        ? t.contactUnsupported
        : !isInTelegram && phase === "waiting"
          ? t.contactWebWaiting
          : isInTelegram
            ? t.shareContactHint
            : t.shareContactWebHint;

  return (
    <main className="flex min-h-dvh flex-col gap-4 px-5 pt-[calc(var(--safe-top)+12px)] pb-[calc(var(--safe-bottom)+16px)]">
      <PrizeHero prizeName={prizeName} />
      <p className={phase === "declined" ? "px-1 text-sm text-negative" : "px-1 text-sm text-muted"}>
        {note}
      </p>
      <PillButton
        className="mt-6"
        // Vebda kutish paytida ham bosish mumkin — chat yopilib qolsa, qayta ochish uchun.
        loading={phase === "waiting" && isInTelegram}
        onClick={() => void share()}
        icon={isInTelegram ? <Phone className="size-5" /> : <Send className="size-5" />}
      >
        {isInTelegram ? t.shareContact : t.shareContactViaBot}
      </PillButton>
    </main>
  );
}

/**
 * 2-qadam (Telegram): ism va yosh — bir marta, keyin qulflanadi. Familiya so'ralmaydi — uning
 * o'rnida bot orqali ulashilgan (tasdiqlangan) telefon raqam ko'rsatiladi.
 */
export function RegisterScreen({ minAge, phoneMasked }: { minAge: number; phoneMasked: string | null }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ firstName: "", age: "" });
  const [errors, setErrors] = useState<Partial<Record<keyof typeof form, string>>>({});
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    setErrors((er) => ({ ...er, [key]: undefined }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const firstName = form.firstName.trim();
    const next = profileErrors(firstName, form.age, minAge);
    setErrors(next);
    setServerError(null);
    if (next.firstName || next.age) {
      haptic.error();
      return;
    }
    const age = Number.parseInt(form.age, 10);
    (document.activeElement as HTMLElement | null)?.blur();
    if (!(await confirmDialog(t.confirmProfile(firstName, phoneMasked ?? "", age)))) return;

    setLoading(true);
    try {
      await api.register({ firstName, age });
      haptic.success();
      await queryClient.invalidateQueries({ queryKey: ["me"] });
    } catch (error) {
      haptic.error();
      const code = errorCode(error);
      if (code === "UNDER_AGE") setErrors({ age: t.ageTooYoung(minAge) });
      else setServerError(t.genericError);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="px-5 pt-[calc(var(--safe-top)+24px)] pb-[calc(var(--safe-bottom)+24px)]">
      <h1 className="text-[28px] font-bold tracking-tight">{t.registerTitle}</h1>
      <p className="mt-1.5 text-muted">{t.registerSubtitle}</p>
      <Card dark className="mt-6 flex gap-3 rounded-tile p-4">
        <Lock className="mt-0.5 size-5 shrink-0" />
        <p className="text-[15px] leading-snug">{t.registerWarning}</p>
      </Card>
      <form className="mt-5 space-y-3.5" onSubmit={(e) => void submit(e)} noValidate>
        <TextField
          label={t.firstName}
          value={form.firstName}
          onChange={set("firstName")}
          error={errors.firstName}
          autoComplete="given-name"
          autoCapitalize="words"
          enterKeyHint="next"
        />
        {phoneMasked && (
          <div>
            <span className="mb-1.5 ml-1.5 block text-[13px] text-muted">{t.phone}</span>
            <div className="flex h-14 items-center gap-2 rounded-full bg-surface px-5 text-base">
              <Phone className="size-4 text-muted" aria-hidden />
              <span className="min-w-0 flex-1 truncate font-semibold whitespace-nowrap tabular-nums">{phoneMasked}</span>
              <span className="inline-flex shrink-0 items-center gap-1 text-[12px] font-semibold text-positive">
                <Check className="size-3.5" strokeWidth={3} />
                {t.phoneVerified}
              </span>
            </div>
          </div>
        )}
        <TextField
          label={t.age}
          value={form.age}
          onChange={(e) => {
            e.target.value = ageInput(e.target.value);
            set("age")(e);
          }}
          error={errors.age}
          inputMode="numeric"
          enterKeyHint="done"
        />
        {serverError && <p className="px-1.5 text-[13px] text-negative">{serverError}</p>}
        {/* Sovg'a qutisi ko'rinishidagi tugma — tepasidagi bantik uchun ko'proq joy. */}
        <GiftButton type="submit" loading={loading} className="!mt-10" icon={<ArrowRight className="size-5" />}>
          {t.continue}
        </GiftButton>
      </form>
    </main>
  );
}

/** Bo'lim raqami — oltin ilgichli qizil archa o'yinchog'i. */
function Bauble({ label }: { label: string }) {
  return (
    <span
      aria-hidden
      className="relative mt-2 grid size-10 shrink-0 place-items-center rounded-full bg-[radial-gradient(circle_at_35%_30%,#ff9585,#e2372a_55%,#9c1b25)] text-[15px] font-bold text-white shadow-[0_6px_12px_-6px_rgba(173,31,44,0.8)]"
    >
      <span className="absolute -top-[7px] left-1/2 h-[7px] w-3.5 -translate-x-1/2 rounded-t-[3px] bg-[linear-gradient(90deg,#c8922a,#ffe2aa,#c8922a)]" />
      <span className="absolute -top-[13px] left-1/2 size-[8px] -translate-x-1/2 rounded-full border-[1.5px] border-[#c8922a]" />
      <span className="absolute top-[7px] left-[9px] h-2 w-1.5 -rotate-[30deg] rounded-full bg-white/60" />
      {label}
    </span>
  );
}

/** Qoida videosi oynasining balandligi, px — telefon ekranining taxminan uchdan biri. */
const RULES_VIDEO_HEIGHT = 320;
/** O'ynayotganda orqa fon kadri shuncha millisoniyada bir yangilanadi. */
const BACKDROP_REFRESH_MS = 250;

/**
 * Qoidalarni tushuntiruvchi video (admin panelda yuklanadi) — qoidalar ustida, eng tepada.
 * Oyna boshqa kartalar bilan bir xil enda, balandligi 320 px. Tik videoning yon tomonlari qora
 * emas — videoning o'zidan olingan xira (blur) kadr bilan to'ldiriladi (Instagram'dagidek).
 * Brauzer o'zi o'ynatmaydi: foydalanuvchi bosadi (ovozli avtoijro baribir bloklanadi).
 */
function RulesVideo({ id }: { id: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const backdropRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    const ctx = backdropRef.current?.getContext("2d");
    if (!video || !ctx) return;
    let timer = 0;
    const draw = () => {
      if (video.readyState < 2) return;
      try {
        ctx.drawImage(video, 0, 0, ctx.canvas.width, ctx.canvas.height);
      } catch {
        // Kadr hali tayyor emas — keyingisida chiziladi.
      }
    };
    const loop = () => {
      draw();
      timer = window.setTimeout(loop, BACKDROP_REFRESH_MS);
    };
    const onPlay = () => {
      window.clearTimeout(timer);
      loop();
    };
    const onStop = () => {
      window.clearTimeout(timer);
      draw();
    };
    video.addEventListener("loadeddata", draw);
    video.addEventListener("seeked", draw);
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onStop);
    video.addEventListener("ended", onStop);
    draw();
    return () => {
      window.clearTimeout(timer);
      video.removeEventListener("loadeddata", draw);
      video.removeEventListener("seeked", draw);
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onStop);
      video.removeEventListener("ended", onStop);
    };
  }, [id]);

  return (
    <figure className="mb-4 animate-rise overflow-hidden rounded-card bg-ink shadow-[0_18px_40px_-24px_rgba(30,31,34,0.8)]">
      <div className="relative isolate overflow-hidden bg-black" style={{ height: RULES_VIDEO_HEIGHT }}>
        <canvas
          ref={backdropRef}
          width={36}
          height={64}
          aria-hidden
          className="absolute inset-0 -z-10 size-full scale-125 object-cover opacity-75 blur-2xl"
        />
        <video
          ref={videoRef}
          key={id}
          // `#t=0.1` — o'ynatilmaguncha qora to'rtburchak emas, birinchi kadr ko'rinsin (iOS ham).
          src={`${api.rulesVideoUrl(id)}#t=0.1`}
          controls
          playsInline
          preload="metadata"
          className="block size-full object-contain"
          aria-label={t.rulesVideoLabel}
        />
      </div>
      <figcaption className="px-4 py-2.5 text-[13px] font-semibold text-white/80">{t.rulesVideoLabel}</figcaption>
    </figure>
  );
}

/** Tanlov qoidalari. `requireConsent` — ro'yxatdan o'tishdagi majburiy rozilik qadami. */
export function RulesContent({ requireConsent = false }: { requireConsent?: boolean }) {
  const queryClient = useQueryClient();
  const rules = useQuery({ queryKey: ["rules"], queryFn: api.getRules });
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const accept = async () => {
    if (!rules.data) return;
    setLoading(true);
    setError(null);
    try {
      await api.acceptRules(rules.data.version);
      haptic.success();
      await queryClient.invalidateQueries({ queryKey: ["me"] });
    } catch (e) {
      haptic.error();
      setLoading(false);
      // 409 — admin shu orada qoidalarni yana yangilagan: yangi matnni ko'rsatamiz.
      if (errorCode(e) === "RULES_OUTDATED") {
        setAgreed(false);
        await rules.refetch();
        setError(t.rulesStale);
      } else {
        setError(t.genericError);
      }
    }
  };

  return (
    <div className={requireConsent ? "pb-44" : undefined}>
      {rules.isPending ? (
        <Spinner />
      ) : rules.isError ? (
        <ErrorBlock onRetry={() => void rules.refetch()} />
      ) : (
        <>
          {rules.data.video && <RulesVideo id={rules.data.video.id} />}
          <ol className="space-y-3">
            {rules.data.sections.map((s, i) => {
              // Sarlavha "1. Atamalar…" ko'rinishida keladi — raqam archa o'yinchog'iga chiqadi. Kichik bo'lim
              // ("6.1. Oylik sovrinlar", "6.3–6.4. …") — o'yinchoqda bob raqami, sarlavhada to'liq raqami.
              // Raqamsiz kirish qismi (oferta preambulasi) — "§".
              const sub = /^(\d+)\.\d/.exec(s.title);
              const match = sub ? null : /^(\d+)[.)]\s*(.+)$/.exec(s.title);
              const number = sub ? sub[1] : match ? match[1] : "§";
              const title = match ? match[2] : s.title;
              return (
                <li
                  key={s.title}
                  className="relative isolate animate-rise overflow-hidden rounded-card bg-surface p-5"
                  style={{ animationDelay: `${i * 70}ms` }}
                >
                  <Snowflake
                    aria-hidden
                    className="absolute -top-5 -right-5 -z-10 size-28 text-[#df3425]/[0.07]"
                    strokeWidth={1.3}
                  />
                  <div className="flex items-start gap-3.5">
                    <Bauble label={number} />
                    <div className="min-w-0 pt-1">
                      <h2 className="text-[17px] leading-snug font-bold tracking-tight">{title}</h2>
                      <p className="mt-1.5 text-[15px] leading-relaxed whitespace-pre-line text-ink/85">{s.body}</p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        </>
      )}

      {requireConsent && (
        <div className="fixed inset-x-0 bottom-0 bg-gradient-to-t from-bg via-bg to-bg/0 px-5 pt-10 pb-[calc(var(--safe-bottom)+12px)]">
          <label className="mb-3 flex cursor-pointer items-center gap-3 px-1">
            <button
              type="button"
              role="checkbox"
              aria-checked={agreed}
              disabled={!rules.data || loading}
              onClick={() => {
                haptic.select();
                setAgreed((a) => !a);
              }}
              className={
                agreed
                  ? "grid size-6 shrink-0 place-items-center rounded-md bg-ink text-white"
                  : "size-6 shrink-0 rounded-md border-2 border-ink/70 bg-surface"
              }
            >
              {agreed && <Check className="size-4" strokeWidth={3} />}
            </button>
            {/* Yozuvga bosish — `label` tugmani o'zi bosadi. Bu yerga alohida `onClick` qo'yilmaydi:
                aks holda belgi ikki marta almashib, umuman qo'yilmasdi. */}
            <span className="text-[15px]">{t.rulesAgree}</span>
          </label>
          {error && <p className="mb-2 px-1 text-[13px] text-negative">{error}</p>}
          <PillButton
            className="mt-8"
            disabled={!agreed || !rules.data}
            loading={loading}
            onClick={() => void accept()}
            icon={<ArrowRight className="size-5" />}
          >
            {t.continue}
          </PillButton>
        </div>
      )}
    </div>
  );
}

export function ConsentScreen({ rulesUpdated }: { rulesUpdated: boolean }) {
  return (
    <main className="px-5 pt-[calc(var(--safe-top)+24px)]">
      <h1 className="text-[28px] font-bold tracking-tight">
        {rulesUpdated ? t.rulesUpdatedTitle : t.rulesTitle}
      </h1>
      {rulesUpdated && <p className="mt-1.5 text-muted">{t.rulesUpdatedBody}</p>}
      <div className="mb-5" />
      <RulesContent requireConsent />
    </main>
  );
}

export function StatusScreen({ title, body }: { title: string; body: string }) {
  return (
    <main className="grid min-h-dvh place-items-center px-6 text-center">
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="mt-3 text-muted">{body}</p>
      </div>
    </main>
  );
}
