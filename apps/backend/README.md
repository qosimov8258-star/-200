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
| `STATS_SYNC_EVERY_DAYS` | Tanlov boshidan (`contest.ts` → `startsOn`, 25-noyabr) necha kunda bir: `10` (standart) — 5, 15, 25-dekabr…; `1` — har kuni; `0` — o'chiq |
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
- Video tekshiruvi natijasi (qabul / rad sababi / qo'lda tekshiruvga o'tdi / admin qarori) — bot xabari.

## Ko'rishlar qanday yig'iladi

Meta App Review o'rniga **Apify** ([`apify/instagram-scraper`](https://apify.com/apify/instagram-scraper)):
ishtirokchi faqat Reel linkini yuboradi, Instagram akkaunt ulash yo'q.

1. **Yuborish** → video `PENDING`. Bir necha soniyada kelgan linklar bitta Apify so'rovida
   tekshiriladi ([`src/stats/stats.service.ts`](src/stats/stats.service.ts)):
   - rasm yoki karusel → `REJECTED: NOT_A_VIDEO`;
   - shu Instagram akkauntdan boshqa ishtirokchi qatnashyapti → `REJECTED: OWNER_TAKEN`;
   - aks holda `ACCEPTED`, birinchi ko'rishlar yoziladi. Rad etilgan bo'lsa — yangi link yuborish mumkin;
   - topilmadi → 2 va 10 daqiqadan keyin qayta urinadi; **3 marta topilmasa — qo'lda tekshiruv** (pastda).
2. **Muntazam yig'ish** — tanlov boshlangan kundan (25-noyabr) har `STATS_SYNC_EVERY_DAYS` kunda soat `STATS_SYNC_TIME` da barcha
   videolar; har kunga bitta yozuv (tarix → Mini App grafigi). Qabul qilingan video topilmasa, 2 va 10
   daqiqadan keyin qayta tekshiriladi; 3 marta topilmasa — reytingdan vaqtincha chiqadi va **qo'lda tekshiruvga** o'tadi.
3. **Qo'lda tekshiruv** (`MANUAL_REVIEW`) — avval ishtirokchiga bot orqali xabar boradi, so'ng video
   admin paneldagi "Qo'lda tekshiruv" bo'limida paydo bo'ladi. Admin linkni ochib:
   - **tasdiqlaydi** → `ACCEPTED`, video reytingga qo'shiladi (ko'rishlar Apify topganda yangilanadi);
     Apify topa olmasa ham qayta-qayta tekshiruvga tushmaydi;
   - **rad etadi** (sabab bilan) → `REJECTED`, ishtirokchi sababni oladi va yangi link yubora oladi.
   Kutish paytida Apify videoni o'zi topsa — holat avtomatik yopiladi.
4. **Tanlov tugagach** (`contest.ts` → `endsAt`) — bitta yakuniy yig'ish, keyin to'xtaydi.
5. **Reyting** — oxirgi ko'rishlar bo'yicha; teng bo'lsa, oldinroq yuborgan yuqorida.
   O'rin o'zgarishi — oldingi yig'ishga nisbatan.
6. **Nakrutka belgilari** (faqat admin uchun, avtomatik jazo yo'q): `LOW_ENGAGEMENT`
   (layk/ko'rish < 0.3%), `VIEW_SPIKE` (bir kunda 10 barobardan ko'p o'sish), `VIEW_DROP`
   (ko'rishlar 10% dan ko'p kamaygan — Instagram sun'iy ko'rishlarni tozalaganda).

Ko'rishlarni faqat worker yozadi — qo'lda o'zgartiruvchi endpoint yo'q.
Narx: ≈ $2.7 / 1000 natija (har bir video har yig'ishda bitta natija).

## API

- **Mini App va veb-sayt** — `/api/v1/miniapp/...`; yo'llar `apps/miniapp/src/lib/api.ts` dagi
  `@endpoint` larga mos. Ishtirokchi ikki yo'l bilan tanilgan, ikkalasi ham bitta `telegramId`
  ([`src/miniapp/telegram-auth.guard.ts`](src/miniapp/telegram-auth.guard.ts)):
  - Telegram ichida — `X-Telegram-Init-Data` sarlavhasi ([`src/telegram/init-data.ts`](src/telegram/init-data.ts));
  - oddiy brauzerda — `reels_session` cookie (HttpOnly, SameSite=Lax, 30 kun), Telegram Login Widget
    orqali kirgandan keyin beriladi ([`src/web/`](src/web/)). Kalit bot tokenidan olinadi.
- **Veb-sayt kirishi** (ochiq):

| So'rov | Vazifa |
|---|---|
| `GET /auth/config` | `{ botUsername, prizeName }` — kirish sahifasi uchun |
| `POST /auth/telegram-login` | Login Widget natijasi; imzo to'g'ri bo'lsa — sessiya cookie'si |
| `POST /auth/logout` | Cookie'ni o'chiradi |

  Widget ishlashi uchun **@BotFather → `/setdomain`** da sayt domeni ko'rsatilishi shart.
  Saytdagi "Botda raqamni ulashish" botni `t.me/<bot>?start=web` bilan ochadi — bot raqamdan
  keyin "saytga qayting" deydi.
- **Admin** — `Authorization: Bearer <ADMIN_API_TOKEN>`:

| So'rov | Vazifa |
|---|---|
| `GET /admin/rules`, `PUT /admin/rules` | Tanlov qoidalari |
| `GET /admin/reels` | Barcha videolar: holat, egasi, ko'rishlar tarixi, nakrutka belgilari |
| `GET /admin/stats` | Yig'ish jadvali, oxirgi natija, holatlar bo'yicha soni |
| `POST /admin/stats/sync` | Ko'rishlarni hoziroq yig'ish (fon rejimida) |
| `GET /admin/manual-reviews?status=OPEN\|APPROVED\|REJECTED` | Qo'lda tekshiruv ro'yxati |
| `POST /admin/manual-reviews/:shortcode/decision` | `{ decision: "approve" }` yoki `{ decision: "reject", reason, note? }` |
| `GET /admin/draws/setup` | Random tanlov: bosqichlar, oylik sovg'a, boshlang'ich sozlamalar |
| `POST /admin/draws/preview` | Sozlamalar bo'yicha nomzodlar soni va chetda qolganlar sababi |
| `POST /admin/draws` | Random tanlovni o'tkazish (kriptografik `seed`, natija — qoralama) |
| `GET /admin/draws`, `GET /admin/draws/:id` | Tanlovlar tarixi va natija |
| `POST /admin/draws/:id/{replace,confirm,cancel}` | G'olibni zaxira bilan almashtirish, tasdiqlash, bekor qilish |
| `POST /admin/draws/:id/send` | G'oliblarga Telegram bot orqali tabrik (faqat tasdiqlangandan keyin) |

## Keyingi qadamlar

- PostgreSQL + Prisma (ma'lumotlar xotiradan bazaga), worker — BullMQ navbatiga
- Admin login + audit log (hozir admin harakatlari faqat server logida)
- Admin panel uchun API: support murojaatlari, botdan xabar yuborish (hammaga/tanlanganlarga),
  bot matnlarini tahrirlash, ishtirokchini chetlatish
- Prod uchun webhook rejimi
