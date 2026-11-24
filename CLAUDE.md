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
  (React, Vite, Tailwind) — ro'yxatdan o'tish, link yuborish va support shu orqali.
  Xuddi shu ilova oddiy brauzerda **veb-sayt** sifatida ham ishlaydi (Telegram Login orqali kirish)
- **Mobil (Flutter): to'xtatilgan** (19.11.2026) — kod `apps/mobile` da qoldi
- **Monorepo:** pnpm workspaces + Turborepo — faqat TypeScript qismlari uchun
  (taklif, PLAN.md 3-bo'lim); `apps/mobile` workspace'ga kirmaydi

## Papka tuzilmasi

```text
apps/backend   NestJS: Mini App API + admin API + Telegram bot + ko'rishlar worker'i (Apify;
               ma'lumotlar xotirada, `DATA_DIR/state.json` ga saqlanadi); `src/worker/` — AI video
               tekshiruvi worker'i (alohida jarayon: ffmpeg + Claude Message Batches API)
apps/miniapp   Telegram Mini App (React + Vite)
apps/admin     Next.js admin panel (statik eksport, serverda /admin)
apps/mobile    Flutter ilova — to'xtatilgan
packages/      backend va admin uchun umumiy kod: shared, api-client, config (rejada)
docs/          tz.pdf va boshqa hujjatlar
deploy/        serverdagi Docker Compose, Dockerfile'lar va nginx sozlamasi (deploy/README.md)
```

Hozircha bor: `apps/admin` (backend bilan yoki mock), `apps/miniapp` (mock yoki backend bilan),
`apps/backend` (bot, Mini App va admin API; bazasiz — holat fayli), `apps/mobile` (to'xtatilgan).
`packages/` va pnpm workspace keyin.

Admin panel backend bilan faqat `apps/admin/src/lib/api.ts` orqali gaplashadi (`api.http.ts` —
haqiqiy, `api.mock.ts` — soxta; `NEXT_PUBLIC_API_MODE`). Xodimlar login/parol bilan kiradi
(`ADMIN_USERS`), sessiya — `HttpOnly` cookie, har bir amal audit log'ga yoziladi;
Mini App va veb-sayt esa faqat `apps/miniapp/src/lib/api.ts` orqali. Ishtirokchi parol/SMS'siz
tanilgan: Telegram ichida — `X-Telegram-Init-Data` imzosi, saytda — Telegram Login Widget'dan
keyingi `HttpOnly` sessiya cookie'si (ikkalasi ham bitta `telegramId`) yoki saytning o'zida
ro'yxatdan o'tgan hisob (ism, telefon raqam, yosh; `POST /auth/web-register`, ID — `WEB_ID_BASE`
oralig'ida, shu brauzer sessiyasi bilan; bot orqali shu raqamni ulashib Telegram'ga ulanadi —
`ParticipantsService.resolve` Telegram ID ni o'sha hisobga olib boradi). Familiya endi so'ralmaydi
(o'rnida — telefon raqam). Saytga qaytib kirish — "Hisobim bor": Telegram bot orqali tasdiq
(`POST /auth/bot-login` → bot `?start=login_<id>` → "Ha, kirish" → `POST /auth/bot-login/poll`;
`BotLoginService`). Faqat telefon raqam bilan kirish yo'q — raqam egasini Telegram tasdiqlaydi.

Mobil ilovada Material vidjetlari `package:material_ui/material_ui.dart` dan import qilinadi
(Flutter 3.50 da `flutter/material.dart` alohida paketga ko'chgan). Backend bilan aloqa faqat
`lib/features/contest/contest_repository.dart` dagi `ContestRepository` orqali — hozir u mock.

## Buyruqlar

Admin panel, backend va Mini App alohida npm loyihalari (pnpm workspace hali yo'q;
admin uchun batafsil — `apps/admin/README.md`):

| Vazifa | Buyruq | Holat |
|---|---|---|
| Admin panel (3001-port) | `cd apps/admin`, `npm install`, `npm run dev` (mock) yoki `npm run dev:http` (backend bilan) | ✅ |
| Admin: statik eksport | `ADMIN_BASE_PATH=/admin npm run build` → `out/` | ✅ |
| Admin: tekshiruv | `npm run lint`, `npm run typecheck`, `npm run build` | ✅ |
| Bog'liqliklarni o'rnatish | `pnpm install` | TODO |
| Lokal DB, Redis, MinIO | `docker compose up -d` | TODO |
| Hammasini ishga tushirish | `pnpm dev` | TODO |
| Bitta app ni ishga tushirish | `pnpm --filter <app> dev` | TODO |
| Mini App (3002-port) | `cd apps/miniapp && npm install && npm run dev` | Ishlaydi (mock) |
| Mini App: tekshiruv | `npm run typecheck`, `npm run lint`, `npm run build` | Ishlaydi |
| Backend + bot (3000-port) | `cd apps/backend && npm install && npm run dev` | Ishlaydi (`.env` da bot tokeni va `APIFY_API_TOKEN`; Apify'siz sinov: `STATS_PROVIDER=mock`) |
| Backend: tekshiruv | `npm run typecheck`, `npm test` | Ishlaydi |
| AI video tekshiruvi worker'i | `cd apps/backend && npm run worker:dev` (yoki build'dan keyin `npm run worker`) | Ishlaydi (`ffmpeg` kerak; `.env` da `AI_WORKER_TOKEN` va `ANTHROPIC_API_KEY`; pulsiz sinov: `AI_PROVIDER=mock`) |
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
- Ism, familiya va yoshni ishtirokchi ham, Admin/Support ham **serverda ham** o'zgartira olmaydi:
  ular uchun yangilovchi endpoint yo'q. Faqat UI da bloklash yetarli emas. Yagona istisno —
  tashkilot egalarining yashirin bo'limi (`apps/backend/src/owner/`, alohida `OWNER_USERS` hisoblari):
  shu bo'limdagi metoddan boshqa joyda foydalanilmaydi.
- Instagram ko'rishlarini qo'lda o'zgartiruvchi endpoint yo'q — ularni faqat worker yozadi.
- Instagram tokenlari shifrlangan holda saqlanadi; Admin/Support harakatlari audit logga yoziladi.
  Ega (yashirin bo'lim) amallari egalar qarori bilan audit logga ham, server logiga ham yozilmaydi.
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
