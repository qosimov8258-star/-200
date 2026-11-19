# CLAUDE.md

## Loyiha

**Reels tanlov ilovasi.** Zavod mahsulotini sotib olgan mijozlar mahsulot haqida Instagram Reel
joylaydi va linkini ilovaga yuboradi. Tizim har kuni ko'rishlarni yig'ib reyting tuzadi;
eng ko'p ko'rish yig'gan ishtirokchi avtomobil yutadi (g'olibni Admin tasdiqlaydi).

- Texnik topshiriq: [docs/tz.pdf](docs/tz.pdf)
- Ish rejasi, fazalar, ochiq savollar: [PLAN.md](PLAN.md)

## Stek

- **Backend:** NestJS, TypeScript, Prisma, PostgreSQL
- **Navbat / cron:** BullMQ + Redis (kunlik ko'rishlar sync, reyting)
- **Admin panel:** Next.js
- **Ishtirokchilar uchun:** Telegram bot (grammY, backend ichida) + Telegram Mini App
  (React, Vite, Tailwind) — ro'yxatdan o'tish, link yuborish va support shu orqali
- **Mobil (Flutter): to'xtatilgan** (19.11.2026) — kod `apps/mobile` da qoldi
- **Monorepo:** pnpm workspaces + Turborepo — faqat TypeScript qismlari uchun
  (taklif, PLAN.md 3-bo'lim); `apps/mobile` workspace'ga kirmaydi

## Papka tuzilmasi

```text
apps/backend   NestJS: Mini App API + Telegram bot + ko'rishlar worker'i (Apify; ma'lumotlar xotirada)
apps/miniapp   Telegram Mini App (React + Vite)
apps/admin     Next.js admin panel
apps/mobile    Flutter ilova — to'xtatilgan
packages/      backend va admin uchun umumiy kod: shared, api-client, config (rejada)
docs/          tz.pdf va boshqa hujjatlar
```

Hozircha bor: `apps/admin` (mock API bilan), `apps/miniapp` (mock yoki backend bilan),
`apps/backend` (bot va Mini App API, bazasiz), `apps/mobile` (to'xtatilgan). `packages/` va
pnpm workspace keyin.

Admin panel backend bilan faqat `apps/admin/src/lib/api.ts` orqali gaplashadi (hozir mock);
Mini App esa faqat `apps/miniapp/src/lib/api.ts` orqali; foydalanuvchi
`X-Telegram-Init-Data` imzosi bilan tanilgan (parol/SMS yo'q).

Mobil ilovada Material vidjetlari `package:material_ui/material_ui.dart` dan import qilinadi
(Flutter 3.50 da `flutter/material.dart` alohida paketga ko'chgan). Backend bilan aloqa faqat
`lib/features/contest/contest_repository.dart` dagi `ContestRepository` orqali — hozir u mock.

## Buyruqlar

Admin panel, backend va Mini App alohida npm loyihalari (pnpm workspace hali yo'q;
admin uchun batafsil — `apps/admin/README.md`):

| Vazifa | Buyruq | Holat |
|---|---|---|
| Admin panel (3001-port) | `cd apps/admin`, `npm install`, `npm run dev` | ✅ |
| Admin: tekshiruv | `npm run lint`, `npm run typecheck`, `npm run build` | ✅ |
| Bog'liqliklarni o'rnatish | `pnpm install` | TODO |
| Lokal DB, Redis, MinIO | `docker compose up -d` | TODO |
| Hammasini ishga tushirish | `pnpm dev` | TODO |
| Bitta app ni ishga tushirish | `pnpm --filter <app> dev` | TODO |
| Mini App (3002-port) | `cd apps/miniapp && npm install && npm run dev` | Ishlaydi (mock) |
| Mini App: tekshiruv | `npm run typecheck`, `npm run lint`, `npm run build` | Ishlaydi |
| Backend + bot (3000-port) | `cd apps/backend && npm install && npm run dev` | Ishlaydi (`.env` da bot tokeni va `APIFY_API_TOKEN`; Apify'siz sinov: `STATS_PROVIDER=mock`) |
| Backend: tekshiruv | `npm run typecheck`, `npm test` | Ishlaydi |
| Mobil ilovani ishga tushirish | `cd apps/mobile && flutter run` | Ishlaydi (mock ma'lumotlar bilan; API ulanganda `--dart-define-from-file=.env` qo'shiladi) |
| Mobil test va tahlil | `cd apps/mobile && flutter analyze && flutter test` | Ishlaydi |
| Mobil matnlarni qayta generatsiya | `cd apps/mobile && flutter gen-l10n` | Ishlaydi (`lib/l10n/app_uz.arb` o'zgarganda) |
| Prisma migratsiya | `pnpm --filter backend exec prisma migrate dev` | TODO |
| Testlar | `pnpm test` | TODO |
| Lint va typecheck | `pnpm lint`, `pnpm typecheck` | TODO |

Buyruq paydo bo'lganda shu jadvalni yangilang (TODO o'rniga haqiqiy holat).

## Kod qoidalari

- TypeScript `strict: true` backend, admin va paketlarda; `any` ishlatilmaydi.
- Dart (mobil): `flutter analyze` ogohlantirishsiz o'tadi; `dynamic` ishlatilmaydi;
  foydalanuvchiga ko'rinadigan matnlar faqat ARB fayllarida.
- Har bir DTO validatsiya qilinadi (class-validator yoki zod — Faza 0 da tanlanadi);
  noma'lum maydonlar rad etiladi, validatsiyasiz kiruvchi ma'lumot qabul qilinmaydi.
- Ism, familiya va yoshni **serverda ham** o'zgartirib bo'lmaydi: ro'yxatdan o'tgandan keyin
  ularni yangilovchi endpoint ham, servis metodi ham bo'lmaydi. Faqat UI da bloklash yetarli emas.
- Instagram ko'rishlarini qo'lda o'zgartiruvchi endpoint yo'q — ularni faqat worker yozadi.
- Instagram tokenlari shifrlangan holda saqlanadi; Admin/Support harakatlari audit logga yoziladi.
- Vaqt DB da UTC; "tanlov kuni" `Asia/Tashkent` bo'yicha hisoblanadi.
- Yangi env o'zgaruvchi qo'shilsa — [.env.example](.env.example) ham yangilanadi.

## Git qoidalari

- `main` ga to'g'ridan-to'g'ri push qilinmaydi.
- Har kim o'z feature branch'ida ishlaydi: `feature/...`, `fix/...`, `chore/...`, `docs/...`.
- O'zgarishlar faqat PR orqali, review va yashil CI dan keyin qo'shiladi.
- `.env` fayllar va maxfiy kalitlar (tokenlar, parollar, sertifikatlar) **hech qachon** commit qilinmaydi.
- Commit xabarlari: Conventional Commits (`feat(backend): ...`, `fix(mobile): ...`).

## Claude uchun

- Javoblar o'zbek tilida.
- Fayllar har doim to'liq holda yoziladi.
