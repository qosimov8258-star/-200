"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Eye, EyeOff, Info } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { getMe, IS_MOCK_API, login } from "@/lib/api";
import { errorMessage } from "@/lib/api-error";
import { canAccess, homePathForRole } from "@/lib/navigation";
import { safeNextPath } from "@/lib/utils";

interface FieldErrors {
  login?: string;
  password?: string;
}

function validate(loginValue: string, password: string): FieldErrors {
  const errors: FieldErrors = {};
  if (!loginValue.trim()) {
    errors.login = "Loginni kiriting.";
  }
  if (!password) {
    errors.password = "Parolni kiriting.";
  }
  return errors;
}

/** Kirish sahifasidagi maydonlar — bayramona qizil urg'u (Olivia brendi). */
const FIELD_CLASS = "h-11 focus:border-[#df3425] focus:ring-[#df3425]/15";

/** Login formasi (karta va bezaklar — `login-screen.tsx` da). */
export function LoginForm() {
  const router = useRouter();
  const [checkingSession, setCheckingSession] = useState(true);
  const [loginValue, setLoginValue] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Sessiya allaqachon bor bo'lsa — login formasini ko'rsatmasdan panelga o'tkazamiz.
  useEffect(() => {
    let cancelled = false;

    getMe()
      .then((admin) => {
        if (!cancelled) router.replace(homePathForRole(admin.role));
      })
      .catch(() => {
        if (!cancelled) setCheckingSession(false);
      });

    return () => {
      cancelled = true;
    };
  }, [router]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const errors = validate(loginValue, password);
    setFieldErrors(errors);
    setFormError(null);
    if (errors.login || errors.password) {
      return;
    }

    setSubmitting(true);
    try {
      const admin = await login({ login: loginValue.trim(), password });
      const next = safeNextPath(new URLSearchParams(window.location.search).get("next"));
      router.replace(next && canAccess(admin.role, next) ? next : homePathForRole(admin.role));
    } catch (error) {
      setFormError(errorMessage(error));
      setSubmitting(false);
    }
  }

  if (checkingSession) {
    return (
      <div className="flex justify-center py-10">
        <Spinner label="Sessiya tekshirilmoqda…" />
      </div>
    );
  }

  return (
    <>
      <div className="text-center">
        <h1 className="text-xl font-semibold text-ink">Xush kelibsiz!</h1>
        <p className="mt-1 text-sm text-muted">Admin panelga kirish uchun login va parolingizni kiriting.</p>
      </div>

      <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-4">
        {formError && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>{formError}</span>
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="login">Login</Label>
          <Input
            id="login"
            name="login"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            autoFocus
            className={FIELD_CLASS}
            value={loginValue}
            onChange={(event) => setLoginValue(event.target.value)}
            aria-invalid={fieldErrors.login ? true : undefined}
            aria-describedby={fieldErrors.login ? "login-error" : undefined}
            disabled={submitting}
          />
          {fieldErrors.login && (
            <p id="login-error" className="text-xs text-red-600">
              {fieldErrors.login}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password">Parol</Label>
          <div className="relative">
            <Input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              className={`${FIELD_CLASS} pr-10`}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              aria-invalid={fieldErrors.password ? true : undefined}
              aria-describedby={fieldErrors.password ? "password-error" : undefined}
              disabled={submitting}
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-slate-400 hover:text-slate-600"
              aria-label={showPassword ? "Parolni yashirish" : "Parolni ko'rsatish"}
              aria-pressed={showPassword}
            >
              {showPassword ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
            </button>
          </div>
          {fieldErrors.password && (
            <p id="password-error" className="text-xs text-red-600">
              {fieldErrors.password}
            </p>
          )}
        </div>

        <Button
          type="submit"
          className="h-11 w-full rounded-xl bg-[#df3425] bg-[repeating-linear-gradient(-45deg,rgba(255,255,255,0.13)_0_10px,transparent_10px_20px)] text-[15px] font-semibold shadow-[0_12px_26px_-12px_rgba(223,52,37,0.95)] hover:bg-[#c92b1d] disabled:bg-[#df3425]/70"
          loading={submitting}
        >
          Kirish
        </Button>
      </form>

      {IS_MOCK_API && (
        <div className="mt-5 flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            Mock rejim: backend hali ulanmagan. Test login ma&apos;lumotlari{" "}
            <code className="font-mono">src/lib/mock/db.ts</code> faylida.
          </span>
        </div>
      )}
    </>
  );
}
