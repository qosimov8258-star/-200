import { useQuery, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { Headset, Send } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Snowfall } from "../components/Snowfall";
import { Card, ErrorBlock, PillButton, Spinner } from "../components/ui";
import { t } from "../i18n/uz";
import * as api from "../lib/api";
import { errorCode } from "../lib/api-error";
import { formatDayMonthTime } from "../lib/format";
import { haptic } from "../lib/telegram";
import type { SupportThread } from "../lib/types";

/** Yozishma har 20 soniyada yangilanadi — operator javobi o'zi chiqadi. */
const REFRESH_MS = 20_000;
/** Xabar yuborilgach darhol kelgan operator javobi shuncha "yozilib" turadi (ms). */
const TYPING_MIN_MS = 2000;
const TYPING_MAX_MS = 3000;

/**
 * Support yozishmasi — Telegram ichida ham, veb-saytda ham shu yerdan yoziladi. Xabar botdagidek
 * murojaat bo'lib operatorlarga boradi; javob shu yerda va Telegram botda ko'rinadi.
 * `draft` — oldindan yozilgan matn (masalan, profil ma'lumotini o'zgartirish so'rovi).
 */
export function SupportScreen({ draft = "" }: { draft?: string }) {
  const queryClient = useQueryClient();
  // Operator "yozayotgan" paytda yozishma qayta so'ralmaydi — javob muddatidan oldin chiqib qolmasin.
  const [typing, setTyping] = useState(false);
  const thread = useQuery({
    queryKey: ["support"],
    queryFn: api.getSupport,
    refetchInterval: typing ? false : REFRESH_MS,
  });
  const [text, setText] = useState(draft);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const typingTimer = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (typingTimer.current !== null) window.clearTimeout(typingTimer.current);
    },
    [],
  );

  /**
   * Yuborilgandan keyin darhol kelgan operator javobi (avtomatik javob) birdan chiqmaydi:
   * 2–3 soniya "Operator yozmoqda…" ko'rsatiladi, keyin javob paydo bo'ladi.
   */
  const showWithTyping = (previous: SupportThread | undefined, next: SupportThread) => {
    const before = previous?.messages.length ?? 0;
    const firstNewOperator = next.messages.findIndex((m, i) => i >= before && m.from === "OPERATOR");
    if (firstNewOperator < 0) {
      queryClient.setQueryData(["support"], next);
      return;
    }
    queryClient.setQueryData<SupportThread>(["support"], { messages: next.messages.slice(0, firstNewOperator) });
    setTyping(true);
    const delay = TYPING_MIN_MS + Math.random() * (TYPING_MAX_MS - TYPING_MIN_MS);
    typingTimer.current = window.setTimeout(() => {
      typingTimer.current = null;
      queryClient.setQueryData(["support"], next);
      setTyping(false);
      haptic.tap();
    }, delay);
  };

  const send = async () => {
    if (!text.trim()) return;
    setSending(true);
    setError(null);
    try {
      const previous = queryClient.getQueryData<SupportThread>(["support"]);
      const next = await api.sendSupport(text);
      showWithTyping(previous, next);
      setText("");
      haptic.success();
    } catch (e) {
      haptic.error();
      const code = errorCode(e);
      setError(
        code === "SUPPORT_LIMIT" ? t.supportErrorLimit : code === "SUPPORT_INVALID" ? t.supportErrorInvalid : t.genericError,
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card dark className="relative isolate overflow-hidden">
        <Snowfall density={0.5} />
        <span className="grid size-12 place-items-center rounded-full bg-[linear-gradient(135deg,#f2583f,#df3425)] text-white shadow-[0_8px_20px_-8px_rgba(223,52,37,0.8)]">
          <Headset className="size-6" aria-hidden />
        </span>
        <h2 className="mt-4 text-xl leading-tight font-bold tracking-tight">{t.supportIntroTitle}</h2>
        <p className="mt-2 text-[15px] leading-snug text-white/75">{t.supportIntroBody}</p>
      </Card>

      {thread.isPending ? (
        <Spinner />
      ) : thread.isError ? (
        <ErrorBlock onRetry={() => void thread.refetch()} />
      ) : thread.data.messages.length === 0 && !typing ? (
        <p className="px-2 text-center text-[14px] text-muted">{t.supportEmpty}</p>
      ) : (
        <ol className="space-y-2.5" aria-label={t.supportTitle}>
          {thread.data.messages.map((m) => {
            const mine = m.from === "PARTICIPANT";
            return (
              <li key={`${m.createdAt}-${m.from}`} className={clsx("flex", mine ? "justify-end" : "justify-start")}>
                <div
                  className={clsx(
                    "max-w-[84%] rounded-[20px] px-4 py-2.5 text-[15px] leading-snug whitespace-pre-line shadow-[0_2px_8px_-4px_rgba(30,31,34,0.25)]",
                    mine
                      ? "rounded-br-md bg-[linear-gradient(180deg,#ea4632,#c8262a)] text-white"
                      : "rounded-bl-md bg-surface text-ink",
                  )}
                >
                  {!mine && <span className="mb-0.5 block text-[12px] font-semibold text-[#df3425]">{t.supportOperator}</span>}
                  {m.text}
                  <span className={clsx("mt-1 block text-right text-[11px]", mine ? "text-white/75" : "text-muted")}>
                    {formatDayMonthTime(m.createdAt)}
                  </span>
                </div>
              </li>
            );
          })}
          {typing && (
            <li className="flex justify-start motion-safe:animate-rise">
              <div className="rounded-[20px] rounded-bl-md bg-surface px-4 py-2.5 shadow-[0_2px_8px_-4px_rgba(30,31,34,0.25)]">
                <span className="mb-1 block text-[12px] font-semibold text-[#df3425]">{t.supportOperator}</span>
                <span className="flex items-center gap-2" role="status" aria-label={`${t.supportOperator} ${t.supportTyping}`}>
                  <span className="flex items-center gap-1" aria-hidden>
                    {[0, 160, 320].map((delay) => (
                      <span
                        key={delay}
                        className="size-2 rounded-full bg-muted/70 motion-safe:animate-bounce"
                        style={{ animationDelay: `${delay}ms` }}
                      />
                    ))}
                  </span>
                  <span className="text-[13px] text-muted">{t.supportTyping}</span>
                </span>
              </div>
            </li>
          )}
        </ol>
      )}

      <Card className="p-3">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={1000}
          rows={4}
          placeholder={t.supportPlaceholder}
          aria-label={t.supportPlaceholder}
          className="w-full resize-none rounded-[20px] bg-chip px-4 py-3 text-[15px] leading-snug outline-none transition placeholder:text-muted focus:ring-4 focus:ring-[#df3425]/10"
        />
        {error && (
          <p role="alert" className="mt-2 px-1.5 text-[13px] text-negative">
            {error}
          </p>
        )}
        <PillButton
          className="mt-10"
          loading={sending}
          disabled={!text.trim()}
          onClick={() => void send()}
          icon={<Send className="size-5" />}
        >
          {t.supportSend}
        </PillButton>
      </Card>
    </div>
  );
}
