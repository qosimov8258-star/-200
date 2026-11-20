"use client";

import { useState } from "react";

import { Input } from "@/components/ui/input";
import { errorMessage } from "@/lib/api-error";
import { ownerLogin } from "@/lib/owner-api";
import type { OwnerUser } from "@/lib/owner-types";

interface OwnerLoginProps {
  /** Sessiya ish davomida tugagan (forma faqat qayta ko'rsatiladi). */
  expired: boolean;
  onSuccess: (owner: OwnerUser) => void;
}

/**
 * Ega kirish formasi — atayin hech qanday sarlavha, belgi yoki izohsiz: faqat login va parol.
 * Enter bilan yuboriladi (ko'rinmas submit tugmasi — telefon klaviaturasidagi "O'tish" ham ishlaydi).
 * Xato bo'lsa — ostida bitta qisqa qator.
 */
export function OwnerLogin({ onSuccess }: OwnerLoginProps) {
  const [loginValue, setLoginValue] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting || !loginValue.trim() || !password) return;
    setError(null);
    setSubmitting(true);
    try {
      const owner = await ownerLogin({ login: loginValue.trim(), password });
      onSuccess(owner);
    } catch (err) {
      setError(errorMessage(err));
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <form onSubmit={handleSubmit} noValidate className="w-full max-w-[320px] space-y-3">
        <Input
          name="username"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          autoFocus
          placeholder="Login"
          aria-label="Login"
          className="h-11"
          value={loginValue}
          onChange={(event) => setLoginValue(event.target.value)}
          disabled={submitting}
        />
        <Input
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder="Parol"
          aria-label="Parol"
          className="h-11"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          aria-invalid={error ? true : undefined}
          disabled={submitting}
        />
        <button type="submit" className="sr-only" tabIndex={-1}>
          Kirish
        </button>
        {error && (
          <p role="alert" className="text-center text-xs text-red-600">
            {error}
          </p>
        )}
      </form>
    </main>
  );
}
