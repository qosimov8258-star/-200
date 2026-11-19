# Backend (`apps/backend`)

NestJS: Telegram bot, Mini App API, admin API va Reel ko'rishlarini yig'uvchi worker.

> **Hozirgi holat — skelet.** Ma'lumotlar **xotirada** saqlanadi (server qayta ishga
> tushsa, yo'qoladi). PostgreSQL + Prisma va BullMQ (Redis) navbati hali yo'q.

## Ishga tushirish

```bash
cd apps/backend
npm install
cp ../../.env.example .env   # keyin [backend] bo'limidagi TELEGRAM_* va APIFY_API_TOKEN ni to'ldiring
npm run dev
```

API: <http://localhost:3000/api/v1>

| Buyruq | Vazifa |
|---|---|
| `npm run dev` | Dev server (o'zgarishda qayta yuklanadi) |
| `npm run build` / `npm start` | Production build va ishga tushirish |
| `npm run typecheck` | TypeScript tekshiruvi |
| `npm test` | Testlar (initData imzosi, ishtirokchi qoidalari, Apify klienti, worker) |
| `npx tsx scripts/apify-reels-test.ts reels.txt` | Apify'dan linklar bo'yicha ko'rishlarni qo'lda olish (diagnostika, pullik) |

TypeScript 6 da qoladi: Nest CLI hozircha TypeScript 7 bilan ishlamaydi.

## Sozlamalar

| O'zgaruvchi | Qayerdan |
|---|---|
| `TELEGRAM_BOT_TOKEN` | @BotFather → `/newbot`. **Maxfiy**, faqat `.env` da |
| `TELEGRAM_BOT_USERNAME` | Bot nomi (`@` siz) |
| `TELEGRAM_MINIAPP_URL` | Mini App'ning https manzili |
| `TELEGRAM_SUPPORT_CHAT_ID` | Operatorlar guruhi ID si: botni guruhga qo'shing, guruhda xabar yozing va ID ni oling (odatda `-100…`) |
| `TELEGRAM_MODE` | `polling` (lokal) yoki `off` (faqat API) |
| `APIFY_API_TOKEN` | Apify Console → Settings → API & Integrations. **Maxfiy** |
| `STATS_PROVIDER` | `apify` (haqiqiy) yoki `mock` (lokal sinov — SOXTA ko'rishlar) |
| `STATS_SYNC_TIME` | Ko'rishlar soat nechada yig'iladi, Toshkent vaqti (standart `06:00`) |
| `STATS_SYNC_EVERY_DAYS` | `1` — har kuni, `14` — ikki haftada; `0` — avtomatik yig'ish o'chiq |
| `STATS_VERIFY_DELAY_MS` | Yangi videolar shuncha yig'ilib, bitta so'rovda tekshiriladi (standart `5000`) |
| `ADMIN_API_TOKEN` | VAQTINCHA admin API kaliti (admin login qurilguncha). Bo'sh — admin API yopiq |

Bot tokeni bo'lmasa, bot ishga tushmaydi va Mini App API barcha so'rovlarni rad etadi.
Apify tokeni bo'lmasa, videolar PENDING holida qoladi (soxta ma'lumotga jim o'tilmaydi).

## Bot nima qiladi

- `/start` → salomlashadi, **"Raqamni ulashish"** tugmasini beradi. Faqat foydalanuvchining
  o'z raqami qabul qilinadi; bitta raqam — bitta ishtirokchi.
- Raqamdan keyin → **"Tanlovni ochish"** (Mini App) tugmasi; chat pastida doimiy "Tanlov" menyusi.
- Shaxsiy chatdagi boshqa har qanday xabar (matn yoki rasm) → **support murojaati**: operatorlar
  guruhiga "🆘 Murojaat #N — Ism Familiya" bo'lib boradi.
- Operator guruhda shu xabarga **Reply** qilib yozsa → javob ishtirokchiga bot orqali boradi.
- Video tekshiruvi natijasi (qabul / rad sababi / reytingdan chiqarildi) — bot xabari.

## Ko'rishlar qanday yig'iladi

Meta App Review o'rniga **Apify** ([`apify/instagram-scraper`](https://apify.com/apify/instagram-scraper)):
ishtirokchi faqat Reel linkini yuboradi, Instagram akkaunt ulash yo'q.

1. **Yuborish** → video `PENDING`. Bir necha soniyada kelgan linklar bitta Apify so'rovida
   tekshiriladi ([`src/stats/stats.service.ts`](src/stats/stats.service.ts)):
   - topilmadi (o'chirilgan / yopiq akkaunt) → ikkinchi urinishdan keyin `REJECTED: NOT_FOUND`;
   - rasm yoki karusel → `NOT_A_VIDEO`;
   - shu Instagram akkauntdan boshqa ishtirokchi qatnashyapti → `OWNER_TAKEN`;
   - aks holda `ACCEPTED`, birinchi ko'rishlar yoziladi. Rad etilgan bo'lsa — yangi link yuborish mumkin.
2. **Muntazam yig'ish** — har `STATS_SYNC_EVERY_DAYS` kunda soat `STATS_SYNC_TIME` da barcha
   videolar; har kunga bitta yozuv (tarix → Mini App grafigi). Video ikki marta ketma-ket
   topilmasa — `REMOVED` (reytingdan chiqadi), yana topilsa — qaytadi.
3. **Tanlov tugagach** (`contest.ts` → `endsAt`) — bitta yakuniy yig'ish, keyin to'xtaydi.
4. **Reyting** — oxirgi ko'rishlar bo'yicha; teng bo'lsa, oldinroq yuborgan yuqorida.
   O'rin o'zgarishi — oldingi yig'ishga nisbatan.
5. **Nakrutka belgilari** (faqat admin uchun, avtomatik jazo yo'q): `LOW_ENGAGEMENT`
   (layk/ko'rish < 0.3%), `VIEW_SPIKE` (bir kunda 10 barobardan ko'p o'sish), `VIEW_DROP`
   (ko'rishlar 10% dan ko'p kamaygan — Instagram sun'iy ko'rishlarni tozalaganda).

Ko'rishlarni faqat worker yozadi — qo'lda o'zgartiruvchi endpoint yo'q.
Narx: ≈ $2.7 / 1000 natija (har bir video har yig'ishda bitta natija).

## API

- **Mini App** — `/api/v1/miniapp/...`, `X-Telegram-Init-Data` sarlavhasi bilan (Telegram imzosi
  HMAC bilan tekshiriladi: [`src/telegram/init-data.ts`](src/telegram/init-data.ts)); yo'llar
  `apps/miniapp/src/lib/api.ts` dagi `@endpoint` larga mos.
- **Admin** — `Authorization: Bearer <ADMIN_API_TOKEN>`:

| So'rov | Vazifa |
|---|---|
| `GET /admin/rules`, `PUT /admin/rules` | Tanlov qoidalari |
| `GET /admin/reels` | Barcha videolar: holat, egasi, ko'rishlar tarixi, nakrutka belgilari |
| `GET /admin/stats` | Yig'ish jadvali, oxirgi natija, holatlar bo'yicha soni |
| `POST /admin/stats/sync` | Ko'rishlarni hoziroq yig'ish (fon rejimida) |

## Keyingi qadamlar

- PostgreSQL + Prisma (ma'lumotlar xotiradan bazaga), worker — BullMQ navbatiga
- Admin login + audit log (hozir admin harakatlari faqat server logida)
- Admin panel uchun API: support murojaatlari, botdan xabar yuborish (hammaga/tanlanganlarga),
  bot matnlarini tahrirlash, ishtirokchini chetlatish
- Prod uchun webhook rejimi
