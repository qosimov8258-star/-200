import { ArrowRight, CheckCircle2, ClipboardPaste, ImagePlus, LoaderCircle, Megaphone, ShieldCheck, X } from "lucide-react";
import { useRef, useState } from "react";

import { Snowfall } from "../components/Snowfall";
import { Card, PillButton, RoundIcon } from "../components/ui";
import { t } from "../i18n";
import * as api from "../lib/api";
import { errorCode } from "../lib/api-error";
import { compressScreenshot } from "../lib/image";
import { haptic } from "../lib/telegram";
import type { ApiErrorCode } from "../lib/types";

const MAX_COMMENT = 500;

const ERRORS: Partial<Record<ApiErrorCode, string>> = {
  REPORT_TARGET_INVALID: t.reportTargetInvalid,
  REPORT_NOT_FOUND: t.reportNotFound,
  REPORT_SELF: t.reportSelf,
  REPORT_DUPLICATE: t.reportDuplicate,
  REPORT_LIMIT: t.reportLimit,
  INVALID_IMAGE: t.reportImageInvalid,
};

/**
 * "Reklamani ko'rdim": ishtirokchi boshqa ishtirokchining videosini lentasida «Reklama» belgisi
 * bilan ko'rsa — skrinshot va akkaunt nomini yuboradi. Admin "Target yoqqanlar" bo'limida ko'radi.
 */
export function ReportScreen({ onBack }: { onBack: () => void }) {
  const [sent, setSent] = useState(false);

  return (
    <div className="space-y-4">
      <Hero />
      {sent ? (
        <Card className="animate-fade text-center">
          <span className="mx-auto grid size-14 place-items-center rounded-full bg-positive/10 text-positive">
            <CheckCircle2 className="size-7" />
          </span>
          <h2 className="mt-3 text-lg font-bold tracking-tight">{t.reportDoneTitle}</h2>
          <p className="mt-1.5 text-[15px] leading-snug text-muted">{t.reportDoneBody}</p>
          <PillButton className="mt-10" onClick={onBack}>
            {t.reportBackToRating}
          </PillButton>
          <button
            type="button"
            onClick={() => setSent(false)}
            className="mt-3 h-11 w-full text-[15px] font-semibold underline-offset-4 active:underline"
          >
            {t.reportAnother}
          </button>
        </Card>
      ) : (
        <ReportForm onSent={() => setSent(true)} />
      )}
    </div>
  );
}

function Hero() {
  return (
    <Card dark className="relative isolate overflow-hidden">
      <Snowfall density={0.6} />
      {/* Yengil "signal" halqalari. */}
      <span aria-hidden className="absolute -top-10 -right-10 size-40 rounded-full border border-white/10" />
      <span aria-hidden className="absolute -top-4 -right-4 size-28 rounded-full border border-white/10" />
      <span className="grid size-12 place-items-center rounded-full bg-[linear-gradient(135deg,#ff8a5b,#e2457a)] text-white shadow-[0_8px_20px_-8px_rgba(226,69,122,0.8)]">
        <Megaphone className="size-6" />
      </span>
      <h2 className="mt-4 text-xl leading-tight font-bold tracking-tight">{t.reportHeroTitle}</h2>
      <p className="mt-2 text-[15px] leading-snug text-white/70">{t.reportHeroBody}</p>
      <ol className="mt-4 space-y-2.5">
        {[t.reportStep1, t.reportStep2, t.reportStep3].map((step, i) => (
          <li key={step} className="flex items-start gap-3 text-[14px] leading-snug text-white/85">
            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-white/12 text-[12px] font-bold tabular-nums">
              {i + 1}
            </span>
            {step}
          </li>
        ))}
      </ol>
    </Card>
  );
}

function ReportForm({ onSent }: { onSent: () => void }) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [target, setTarget] = useState("");
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [preparing, setPreparing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const paste = async () => {
    try {
      const text = (await navigator.clipboard.readText()).trim();
      if (text) {
        setTarget(text);
        setError(null);
      }
    } catch {
      // Ruxsat berilmagan — foydalanuvchi qo'lda yozadi.
    }
  };

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setPreparing(true);
    setError(null);
    try {
      setScreenshot(await compressScreenshot(file));
      haptic.select();
    } catch {
      haptic.error();
      setError(t.reportImageInvalid);
    } finally {
      setPreparing(false);
      // Xuddi shu faylni qayta tanlash ham `change` hodisasini chiqarsin.
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  const submit = async () => {
    const value = target.trim();
    if (!value) return setError(t.reportTargetEmpty);
    if (!screenshot) return setError(t.reportScreenshotEmpty);
    (document.activeElement as HTMLElement | null)?.blur();
    setSubmitting(true);
    setError(null);
    try {
      await api.reportTarget({ target: value, screenshot, comment: comment.trim() || undefined });
      haptic.success();
      onSent();
    } catch (e) {
      haptic.error();
      setError(ERRORS[errorCode(e)] ?? t.genericError);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="space-y-5">
      <div>
        <label htmlFor="report-target" className="mb-1.5 ml-1.5 block text-[13px] text-muted">
          {t.reportTargetLabel}
        </label>
        <div className="flex items-center rounded-full bg-bg pr-1.5 pl-[18px]">
          <input
            id="report-target"
            value={target}
            onChange={(e) => {
              setTarget(e.target.value);
              setError(null);
            }}
            placeholder={t.reportTargetPlaceholder}
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            maxLength={300}
            disabled={submitting}
            className="h-14 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted"
          />
          <RoundIcon label={t.paste} dark size={44} onClick={() => void paste()}>
            <ClipboardPaste className="size-5" />
          </RoundIcon>
        </div>
      </div>

      <div>
        <span className="mb-1.5 ml-1.5 block text-[13px] text-muted">{t.reportScreenshotLabel}</span>
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={(e) => void pick(e.target.files?.[0])}
        />
        {screenshot ? (
          <div className="flex items-center gap-3 rounded-[22px] bg-bg p-2.5">
            <img
              src={screenshot}
              alt={t.reportScreenshotLabel}
              className="h-24 w-16 shrink-0 rounded-xl object-cover object-top shadow-sm"
            />
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              disabled={preparing || submitting}
              className="flex-1 text-left text-[15px] font-semibold"
            >
              {preparing ? t.reportPreparing : t.reportReplace}
            </button>
            <RoundIcon label={t.reportRemove} size={40} onClick={() => setScreenshot(null)} disabled={submitting}>
              <X className="size-5" />
            </RoundIcon>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            disabled={preparing || submitting}
            className="flex w-full items-center gap-3.5 rounded-[22px] border-2 border-dashed border-line bg-bg px-4 py-4 text-left transition active:scale-[0.99]"
          >
            <span className="grid size-11 shrink-0 place-items-center rounded-full bg-surface">
              {preparing ? <LoaderCircle className="size-5 animate-spin" /> : <ImagePlus className="size-5" />}
            </span>
            <span>
              <span className="block text-[15px] font-semibold">
                {preparing ? t.reportPreparing : t.reportPickScreenshot}
              </span>
              <span className="block text-[13px] text-muted">{t.reportPickHint}</span>
            </span>
          </button>
        )}
      </div>

      <label className="block">
        <span className="mb-1.5 ml-1.5 block text-[13px] text-muted">{t.reportCommentLabel}</span>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value.slice(0, MAX_COMMENT))}
          placeholder={t.reportCommentPlaceholder}
          rows={3}
          disabled={submitting}
          className="w-full resize-none rounded-[22px] bg-bg px-5 py-4 text-base outline-none placeholder:text-muted"
        />
      </label>

      {error && (
        <p role="alert" className="px-1.5 text-[13px] text-negative">
          {error}
        </p>
      )}

      <PillButton
        className="mt-6"
        loading={submitting}
        disabled={preparing}
        onClick={() => void submit()}
        icon={<ArrowRight className="size-5" />}
      >
        {t.reportSend}
      </PillButton>

      <p className="flex items-start gap-2 px-1 text-[13px] leading-snug text-muted">
        <ShieldCheck className="mt-px size-4 shrink-0" />
        {t.reportPrivacy}
      </p>
    </Card>
  );
}
