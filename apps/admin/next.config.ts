import type { NextConfig } from "next";
import { PHASE_PRODUCTION_BUILD } from "next/constants";

/**
 * Admin panel sozlamalari.
 *
 * - `next build` — statik eksport (`out/`): server kerak emas, nginx beradi.
 *   Serverda `https://konkurs-olivia.uz/admin/` ostida turadi (`ADMIN_BASE_PATH=/admin`,
 *   `deploy/Dockerfile.web`), API esa shu domenda `/api/v1`.
 * - `next dev` — oddiy Next.js dev server. `NEXT_PUBLIC_API_MODE=http` bo'lsa,
 *   `/api/v1/*` so'rovlari `BACKEND_URL` (standart: http://localhost:3000) ga uzatiladi —
 *   brauzer uchun API shu domenda bo'ladi va sessiya cookie'si ishlaydi.
 *
 * Env:
 *   ADMIN_BASE_PATH       — panel yo'li, masalan `/admin` (lokal dev'da bo'sh).
 *   NEXT_PUBLIC_API_MODE  — `http` | `mock` (`src/lib/api.ts`).
 *   BACKEND_URL           — faqat dev rewrites uchun.
 */

/** `/admin`, `/admin/` → `/admin`; bo'sh → "" (ildiz). */
function normalizeBasePath(value: string | undefined): string {
  const trimmed = (value ?? "").trim().replace(/\/+$/, "");
  if (trimmed === "") {
    return "";
  }
  const path = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  if (!/^(\/[A-Za-z0-9._-]+)+$/.test(path)) {
    throw new Error(`ADMIN_BASE_PATH noto'g'ri: "${value}". Masalan: /admin`);
  }
  return path;
}

function normalizeOrigin(value: string | undefined): string {
  return (value ?? "").trim().replace(/\/+$/, "") || "http://localhost:3000";
}

export default function config(phase: string): NextConfig {
  const isExport = phase === PHASE_PRODUCTION_BUILD;
  const basePath = normalizeBasePath(process.env.ADMIN_BASE_PATH);

  const apiMode = process.env.NEXT_PUBLIC_API_MODE ?? (isExport ? "http" : "mock");

  const base: NextConfig = {
    reactStrictMode: true,
    poweredByHeader: false,
    basePath,
    // `NEXT_PUBLIC_BASE_PATH` — `public/` dagi fayllar manzili uchun (masalan, mock istoriya
    // kliplari): `next/link` dan tashqaridagi `src` larga `basePath` o'zi qo'shilmaydi.
    env: { NEXT_PUBLIC_API_MODE: apiMode, NEXT_PUBLIC_BASE_PATH: basePath },
  };

  if (isExport) {
    return {
      ...base,
      output: "export",
      // `/admin/dashboard/` → `dashboard/index.html` — nginx qo'shimcha qoidasiz topadi.
      trailingSlash: true,
      // Statik eksportda Next.js rasm optimizatsiya serveri yo'q.
      images: { unoptimized: true },
    };
  }

  if (process.env.NEXT_PUBLIC_API_MODE === "http") {
    const backendUrl = normalizeOrigin(process.env.BACKEND_URL);
    return {
      ...base,
      async rewrites() {
        return [
          {
            source: "/api/v1/:path*",
            destination: `${backendUrl}/api/v1/:path*`,
            // API domen ildizida — `basePath` qo'shilmaydi.
            basePath: false,
          },
        ];
      },
    };
  }

  return base;
}
