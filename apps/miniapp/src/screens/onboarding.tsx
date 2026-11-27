import { useQuery, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { ArrowRight, Check, ChevronDown, Download, FileText, Lock, Phone, Send, Snowflake } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { GiftButton } from "../components/GiftButton";
import { PrizeHero } from "../components/PrizeHero";
import { Card, ErrorBlock, PillButton, Spinner, TextField } from "../components/ui";
import { lang, langPicked, t } from "../i18n";
import * as api from "../lib/api";
import { errorCode } from "../lib/api-error";
import { profileErrors } from "../lib/profile-form";
import {
  botLink,
  confirmDialog,
  haptic,
  isInTelegram,
  openTelegram,
  requestContact,
  telegramDownload,
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

  // Veb-saytda raqam bot chatida ulashiladi: t.me/<bot>?start=web_<til> — bot saytda tanlangan tilda
  // gapiradi (til tanlanmagan bo'lsa — `web`, bot o'zbekcha).
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
      openTelegram(botLink(bot, langPicked ? `web_${lang}` : "web"));
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
export function RegisterScreen({ phoneMasked }: { phoneMasked: string | null }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ firstName: "" });
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
    const next = profileErrors(firstName);
    setErrors(next);
    setServerError(null);
    if (next.firstName) {
      haptic.error();
      return;
    }
    (document.activeElement as HTMLElement | null)?.blur();
    if (!(await confirmDialog(t.confirmProfile(firstName, phoneMasked ?? "")))) return;

    setLoading(true);
    try {
      await api.register({ firstName });
      haptic.success();
      await queryClient.invalidateQueries({ queryKey: ["me"] });
    } catch (error) {
      haptic.error();
      if (errorCode(error) === "INVALID_PROFILE") setErrors({ firstName: t.nameInvalid });
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
          enterKeyHint="done"
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

/**
 * Oferta bo'limining matni: "2.1." kabi bandlar — raqami qalin; "— " bilan boshlanadigan qatorlar —
 * ro'yxat; "Nomi: qiymat" (rekvizitlar) — nomi xira. Qolganlari — oddiy xatboshi.
 */
function OfferBody({ text }: { text: string }) {
  const blocks: ({ kind: "line"; text: string } | { kind: "list"; items: string[] })[] = [];
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    if (line.startsWith("— ")) {
      const last = blocks.at(-1);
      if (last?.kind === "list") last.items.push(line.slice(2));
      else blocks.push({ kind: "list", items: [line.slice(2)] });
    } else {
      blocks.push({ kind: "line", text: line });
    }
  }
  return (
    <div className="mt-3 space-y-2.5 text-[15px] leading-relaxed text-ink/85">
      {blocks.map((block, i) =>
        block.kind === "list" ? (
          <ul key={i} className="space-y-1.5">
            {block.items.map((item, j) => (
              <li key={j} className="relative pl-5">
                <span aria-hidden className="absolute top-[0.62em] left-1.5 size-1.5 rounded-full bg-[#df3425]/70" />
                {item}
              </li>
            ))}
          </ul>
        ) : (
          <OfferLine key={i} text={block.text} />
        ),
      )}
    </div>
  );
}

function OfferLine({ text }: { text: string }) {
  const clause = /^(\d+(?:\.\d+)+\.?)\s+(.*)$/.exec(text);
  if (clause) {
    return (
      <p>
        <span className="font-semibold text-ink tabular-nums">{clause[1]}</span> {clause[2]}
      </p>
    );
  }
  const field = /^([^:—«»]{2,40}):\s+(.+)$/.exec(text);
  if (field) {
    return (
      <p>
        <span className="text-muted">{field[1]}:</span> <span className="break-words text-ink">{field[2]}</span>
      </p>
    );
  }
  return <p>{text}</p>;
}

/** Ommaviy ofertaning imzolangan asl nusxasi (skaner, PDF) — tanlangan tilda (`public/offer/`). */
const OFFER_PDF = { uz: "offer/oferta-uz.pdf", ru: "offer/oferta-ru.pdf" } as const;

/** Oferta matni ostida: asl PDF'ni yuklab olish (saytda — oddiy yuklab olish, Telegram'da — uning oynasi). */
function OfferPdfDownload() {
  const url = `${import.meta.env.BASE_URL}${OFFER_PDF[lang]}`;
  return (
    <a
      href={url}
      download={t.offerPdfFileName}
      onClick={(e) => {
        haptic.select();
        if (!isInTelegram) return;
        e.preventDefault();
        telegramDownload(url, t.offerPdfFileName);
      }}
      className="mt-3 flex items-center gap-3.5 rounded-card bg-surface p-4 transition active:scale-[0.99]"
    >
      <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#df3425]/10 text-[#df3425]">
        <FileText className="size-[22px]" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[16px] leading-snug font-semibold">{t.offerPdfTitle}</span>
        <span className="mt-0.5 block text-[13px] text-muted">{t.offerPdfHint}</span>
      </span>
      <Download aria-hidden className="size-5 shrink-0 text-muted" />
    </a>
  );
}

/**
 * O'ng pastdagi "oxiriga tushish" tugmasi (iPhone'dagidek): bir bosishda sahifa oxiriga silliq
 * tushadi. Oxiri ko'ringanda yashirinadi. `bottom` — pastki menyu bo'lsa, uning ustida turadi.
 */
function ScrollDownButton({ hidden, bottom }: { hidden: boolean; bottom: string }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 z-30 mx-auto flex max-w-[520px] justify-end px-4" style={{ bottom }}>
      <button
        type="button"
        aria-label={t.scrollToEnd}
        aria-hidden={hidden || undefined}
        tabIndex={hidden ? -1 : undefined}
        onClick={() => {
          haptic.select();
          window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "smooth" });
        }}
        className={clsx(
          "grid size-12 place-items-center rounded-full bg-surface/90 text-ink shadow-[0_10px_24px_-10px_rgba(30,31,34,0.55)] ring-1 ring-black/5 backdrop-blur transition duration-300 active:scale-95",
          hidden ? "pointer-events-none translate-y-3 opacity-0" : "pointer-events-auto opacity-100",
        )}
      >
        <ChevronDown className="size-6" strokeWidth={2.4} />
      </button>
    </div>
  );
}

/** Tanlov qoidalari. `requireConsent` — ro'yxatdan o'tishdagi majburiy rozilik qadami. */
export function RulesContent({ requireConsent = false }: { requireConsent?: boolean }) {
  const queryClient = useQueryClient();
  const rules = useQuery({ queryKey: ["rules"], queryFn: api.getRules });
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Sahifa oxiri ko'rindimi (o'ng pastdagi strelka yashirinadi) va bir marta bo'lsa ham oxirigacha
  // tushildimi — "roziman" bloki shundan keyin chiqadi.
  const endRef = useRef<HTMLDivElement>(null);
  const [atEnd, setAtEnd] = useState(false);
  const [reachedEnd, setReachedEnd] = useState(false);
  const loaded = rules.data !== undefined;

  useEffect(() => {
    const end = endRef.current;
    if (!loaded || !end) return;
    const observer = new IntersectionObserver(([entry]) => {
      setAtEnd(entry.isIntersecting);
      if (entry.isIntersecting) setReachedEnd(true);
    });
    observer.observe(end);
    return () => observer.disconnect();
  }, [loaded]);

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
    <div className={requireConsent ? "pb-[calc(var(--safe-bottom)+24px)]" : undefined}>
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
                  // Oferta uzun (20 bo'lim) — pastdagilar kechikib chiqmasin.
                  style={{ animationDelay: `${Math.min(i, 6) * 70}ms` }}
                >
                  <Snowflake
                    aria-hidden
                    className="absolute -top-5 -right-5 -z-10 size-28 text-[#df3425]/[0.07]"
                    strokeWidth={1.3}
                  />
                  <div className="flex items-start gap-3.5">
                    <Bauble label={number} />
                    <h2 className="min-w-0 pt-3 text-[17px] leading-snug font-bold tracking-tight">{title}</h2>
                  </div>
                  {/* Matn kartaning to'liq enida — uzun huquqiy matn telefonda ham qulay o'qiladi. */}
                  <OfferBody text={s.body} />
                </li>
              );
            })}
          </ol>
          <OfferPdfDownload />
        </>
      )}

      {/* Rozilik — ofertaning eng oxirida: foydalanuvchi matnni oxirigacha tushgach chiqadi va shu
          yerda "roziman" deydi (ustida suzib turuvchi panel yo'q — matn bilan aralashmaydi). */}
      {requireConsent && rules.data && (
        <div
          inert={!reachedEnd}
          className={clsx(
            "mt-5 transition duration-500 ease-out",
            reachedEnd ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0",
          )}
        >
          <label className="flex cursor-pointer items-center gap-3 rounded-card bg-surface px-5 py-4">
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
            <span className="text-[15px] leading-snug font-medium">{t.rulesAgree}</span>
          </label>
          {error && <p className="mt-2 px-1 text-[13px] text-negative">{error}</p>}
          <PillButton
            className="mt-9"
            disabled={!agreed || !rules.data}
            loading={loading}
            onClick={() => void accept()}
            icon={<ArrowRight className="size-5" />}
          >
            {t.continue}
          </PillButton>
        </div>
      )}
      <div ref={endRef} aria-hidden className="h-px" />
      {loaded && (
        <ScrollDownButton
          hidden={atEnd}
          // Ilova ichida pastki menyu (66px, pastdan 12px) bor — strelka uning ustida.
          bottom={requireConsent ? "calc(var(--safe-bottom) + 20px)" : "calc(var(--safe-bottom) + 92px)"}
        />
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
      <p className="mt-1.5 mb-5 text-[15px] leading-snug text-muted">{t.rulesReadToEnd}</p>
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
