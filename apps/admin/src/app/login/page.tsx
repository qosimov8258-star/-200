import type { Metadata } from "next";

import { Logo } from "@/components/layout/logo";

import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Kirish",
};

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <Logo className="mb-8 justify-center" />
        <LoginForm />
      </div>
    </main>
  );
}
