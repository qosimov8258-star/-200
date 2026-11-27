import { useCallback, useRef, useState, type ReactNode } from "react";

import { ToastContext } from "./toast-context";

/**
 * Qisqa xabar 2,6 soniya turadi; uzun xabar (masalan, kirish yopiq yoki cookie o'chirilgan) —
 * o'qib ulgurguncha uzoqroq, 9 soniyagacha.
 */
const toastDuration = (text: string): number => Math.min(9_000, Math.max(2_600, text.length * 50));

export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const show = useCallback((text: string) => {
    window.clearTimeout(timer.current);
    setMessage(text);
    timer.current = window.setTimeout(() => setMessage(null), toastDuration(text));
  }, []);
  return (
    <ToastContext value={show}>
      {children}
      {/* Istoriya ko'ruvchisi (z-90) ustida ham ko'rinadi; tasdiqlash oynasi (z-100) undan yuqori. */}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-4 z-[95] flex justify-center"
        style={{ bottom: "calc(var(--safe-bottom) + 104px)" }}
      >
        {message && (
          <div className="animate-rise rounded-2xl bg-ink px-4 py-3 text-sm text-white shadow-lg">
            {message}
          </div>
        )}
      </div>
    </ToastContext>
  );
}
