# Backend (`apps/backend`)

NestJS: Telegram bot, Mini App API, admin API va Reel ko'rishlarini yig'uvchi worker.

> **Ma'lumotlar** xotirada ishlaydi va har 5 soniyada `DATA_DIR` dagi `state.json` ga yoziladi
> (server to'xtaganda ham) — qayta ishga tushganda o'qiladi. Kunlik va har ishga tushishdagi
> zaxiralar `DATA_DIR/backups/`, shikoyat skrinshotlari `DATA_DIR/files/` da
> ([`src/persistence/state-store.ts`](src/persistence/state-store.ts)). Fayl buzilgan bo'lsa —
> eng yangi zaxiradan o'qiladi; ikkalasi ham yaroqsiz bo'lsa server bo'sh holat bilan ishga
> tushmaydi. PostgreSQL + Prisma va BullMQ (Redis) navbati hali yo'q.

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
| `npm test` | Testlar (initData imzosi, ishtirokchi qoidalari, bir nechta video, holat migratsiyasi, Apify klienti, worker) |
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
| `STATS_SYNC_TIME` | Ko'rishlar soat nechada yig'iladi, Toshkent vaqti (standart `06:00`). Faqat birinchi ishga tushishda — keyin admin panel → Sozlamalar |
| `STATS_SYNC_EVERY_DAYS` | Tanlov boshidan (Sozlamalar → boshlanish sanasi, 25-noyabr) necha kunda bir: `10` (standart) — 5, 15, 25-dekabr…; `1` — har kuni; `0` — o'chiq |
| `STATS_VERIFY_DELAY_MS` | Yangi videolar shuncha yig'ilib, bitta so'rovda tekshiriladi (standart `5000`) |
| `TARGET_CHECK_TOP` | Reklama kutubxonasida reytingning nechta yetakchisi tekshiriladi (standart `30`) |
| `TARGET_CHECK_EVERY_DAYS` | Tanlov boshidan necha kunda bir tekshiriladi (standart `30` — oyiga bir marta; `0` — faqat qo'lda) |
| `DATA_DIR` | Ma'lumotlar papkasi (standart `data`; Docker'da volume — `/app/data`) |
| `ADMIN_USERS` | Admin panel xodimlari: `login\|ROL\|Ism Familiya\|parol`, bir nechta — `;` bilan (ROL: `ADMIN` yoki `SUPPORT`, parol ≥ 10 belgi). **Maxfiy** |
| `ADMIN_SESSION_SECRET` | Sessiya imzosi kaliti (`openssl rand -base64 32`). **Maxfiy** |
| `ADMIN_SESSION_TTL_HOURS` | Sessiya muddati, soat (standart `12`) |
| `ADMIN_COOKIE_SECURE` | Cookie faqat https orqali (production'da standart `true`) |
| `ADMIN_API_TOKEN` | Skriptlar uchun admin API kaliti (`Authorization: Bearer`). Bo'sh — kalit bilan kirish yopiq |
| `OWNER_USERS` | Tashkilot egalari (yashirin bo'lim): `login\|Ism Familiya\|parol`, bir nechta — `;` bilan (parol ≥ 12 belgi; xato yozuv — server ishga tushmaydi). **Maxfiy** |
| `OWNER_SESSION_TTL_MINUTES` | Ega sessiyasi muddati, daqiqa (standart `120`) |

Bot tokeni bo'lmasa, bot ishga tushmaydi va Mini App API barcha so'rovlarni rad etadi.
Apify tokeni bo'lmasa, videolar PENDING holida qoladi (soxta ma'lumotga jim o'tilmaydi).

## Bot nima qiladi

- `/start` → salomlashadi, **"Raqamni ulashish"** tugmasini beradi. Faqat foydalanuvchining
  o'z raqami qabul qilinadi; bitta raqam — bitta ishtirokchi.
- Raqamdan keyin → **"Tanlovni ochish"** (Mini App) tugmasi; chat pastida doimiy "Tanlov" menyusi.
- Shaxsiy chatdagi boshqa har qanday xabar (matn yoki rasm) → **support murojaati**: operatorlar
  guruhiga "🆘 Murojaat #N — Ism Familiya" bo'lib boradi.
- Operator guruhda shu xabarga **Reply** qilib yozsa → javob ishtirokchiga bot orqali boradi.
- Video tekshiruvi natijasi (qabul / rad sababi / qo'lda tekshiruvga o'tdi / admin qarori) — bot xabari;
  ishtirokchida bir nechta video bo'lishi mumkin, shuning uchun xabar oxirida qaysi video ekani (link).

## Ko'rishlar qanday yig'iladi

Meta App Review o'rniga **Apify** ([`apify/instagram-scraper`](https://apify.com/apify/instagram-scraper)):
ishtirokchi faqat Reel linkini yuboradi, Instagram akkaunt ulash yo'q.

Ishtirokchi **cheksiz** video yuborishi mumkin (`Participant.reels`, eskidan yangiga). Har bir video
alohida tekshiriladi, yig'iladi va kerak bo'lsa qo'lda tekshiruvga o'tadi — quyidagi qoidalar har bir
videoga o'zicha qo'llanadi (urinishlar soni ham). Eski holat fayli (`reel` — bitta video) o'qilganda
avtomatik `reels` ga o'tkaziladi.

1. **Yuborish** → video `PENDING`. Bir xil link qayta yuborilmaydi: rad etilmagan (band) link o'zida
   bo'lsa — `409 REEL_ALREADY_SUBMITTED`, boshqa ishtirokchida bo'lsa — `409 REEL_TAKEN`. O'zining
   rad etilgan videosini qayta yuborsa — eski yozuv o'rniga yangisi. Bir necha soniyada kelgan linklar
   bitta Apify so'rovida tekshiriladi ([`src/stats/stats.service.ts`](src/stats/stats.service.ts)):
   - rasm yoki karusel → `REJECTED: NOT_A_VIDEO`;
   - shu Instagram akkauntdan boshqa ishtirokchi qatnashyapti → `REJECTED: OWNER_TAKEN` (o'zining
     bir nechta akkauntidan yuborish mumkin);
   - aks holda `ACCEPTED`, birinchi ko'rishlar yoziladi;
   - topilmadi → 2 va 10 daqiqadan keyin qayta urinadi; **3 marta topilmasa — qo'lda tekshiruv** (pastda).
2. **Muntazam yig'ish** — tanlov boshlangan kundan (25-noyabr) har `STATS_SYNC_EVERY_DAYS` kunda soat `STATS_SYNC_TIME` da
   rad etilmagan barcha videolar; har kunga bitta yozuv (tarix → Mini App grafigi). Qabul qilingan video topilmasa, 2 va 10
   daqiqadan keyin qayta tekshiriladi; 3 marta topilmasa — uning ko'rishlari reytingda vaqtincha hisobga olinmaydi va
   video **qo'lda tekshiruvga** o'tadi (ishtirokchining boshqa videolari reytingda qoladi).
3. **Qo'lda tekshiruv** (`MANUAL_REVIEW`) — avval ishtirokchiga bot orqali xabar boradi, so'ng video
   admin paneldagi "Qo'lda tekshiruv" bo'limida paydo bo'ladi. Admin linkni ochib:
   - **tasdiqlaydi** → `ACCEPTED`, video reytingga qo'shiladi (ko'rishlar Apify topganda yangilanadi);
     Apify topa olmasa ham qayta-qayta tekshiruvga tushmaydi;
   - **rad etadi** (sabab bilan) → `REJECTED`, ishtirokchi sababni oladi.
   Kutish paytida Apify videoni o'zi topsa — holat avtomatik yopiladi.
4. **Tanlov tugagach** (`contest.ts` → `endsAt`) — bitta yakuniy yig'ish, keyin to'xtaydi.
5. **Reyting** (qoidalar 7.1, 7.3) — ishtirokchining **eng ko'p ko'rilgan bitta** qabul qilingan
   (`ACCEPTED`) videosi oxirgi ko'rishlari bo'yicha; videolar ko'rishlari **qo'shilmaydi**. Teng bo'lsa,
   shu videoni oldinroq yuborgan yuqorida. O'rin o'zgarishi — oldingi yig'ishdagi o'ringa nisbatan.
   Oylik random tanlovda (7.2) ham davrga kirgan videolardan eng ko'p ko'rilgani olinadi.
6. **Nakrutka belgilari** (faqat admin uchun, avtomatik jazo yo'q): `LOW_ENGAGEMENT`
   (layk/ko'rish < 0.3%), `VIEW_SPIKE` (bir kunda 10 barobardan ko'p o'sish), `ENGAGEMENT_GAP`
   (kuniga kamida +20 000 va 3 barobar o'sish, shu kungi layk ulushi odatdagidan 4 marta past),
   `VIEW_DROP` (ko'rishlar 10% dan ko'p kamaygan — Instagram sun'iy ko'rishlarni tozalaganda).

Ko'rishlarni faqat worker yozadi — qo'lda o'zgartiruvchi endpoint yo'q.
Narx: ≈ $2.7 / 1000 natija (har bir video har yig'ishda bitta natija; videolar soni cheklanmagani uchun
narx yuborilgan videolar soniga qarab o'sadi).

## Target (pullik reklama) qanday aniqlanadi

Instagram boshqa akkauntning reklama tarixini bermaydi, shuning uchun to'rt qatlam
([`src/targets/targets.service.ts`](src/targets/targets.service.ts)):

1. **Meta reklama kutubxonasi** — oyiga bir marta (tanlov boshidan har `TARGET_CHECK_EVERY_DAYS` = 30
   kunda: 25-dekabr, 24-yanvar, 23-fevral — har oylik bosqich oxirida; tanlov tugagach to'xtaydi)
   oxirgi reyting bo'yicha `TARGET_CHECK_TOP` yetakchining barcha akkauntlari (rad etilmagan videolari
   egalari) Apify'ning
   [`apify/facebook-ads-scraper`](https://apify.com/apify/facebook-ads-scraper) aktori bilan
   tekshiriladi ([`src/instagram/ad-library.ts`](src/instagram/ad-library.ts)). Reklama beruvchining
   Instagram username'i aniq mos kelsa — `AD_LIBRARY` holati ochiladi, dalil havolasi saqlanadi;
   reklama to'xtasa tarixga `OFF`, qayta yoqilsa `ON` yoziladi. Cheklov: kutubxona faqat
   **faol** reklamalarni ko'rsatadi — tekshiruvlar orasida yoqib-o'chirilgan reklamani shikoyatlar,
   o'sish tahlili va yuzma-yuz tekshiruv ushlaydi. Admin istalgan vaqtda "Hozir tekshirish" bosa oladi.
   Narx: pul faqat topilgan reklama uchun (≈ $0.006 / reklama, bitta akkauntdan ko'pi bilan 5 ta);
   reklama topilmasa — deyarli bepul.
2. **O'sish tahlili** — `VIEW_SPIKE` (keskin o'sish) va `ENGAGEMENT_GAP` (ko'rishlar oshgan,
   layklar o'smagan — reklama begona auditoriyaga ko'rsatiladi) belgilari: har bir videoning har bir
   kuni bir marta `GROWTH_ANALYSIS` holatiga aylanadi, bir kunda ikkalasi bo'lsa — dalilda ikkalasi.
3. **Ishtirokchilar shikoyati** — Mini App'dagi "Reklamani ko'rdim": lentada «Reklama» belgisi bilan
   ko'rilgan videoning skrinshoti va akkaunt nomi (yoki Reel linki). Bitta ishtirokchiga ochiq
   `REPORT` holati bitta, yangi shikoyatlar unga qo'shiladi. Cheklovlar: kuniga 5 ta, bir kunda bir
   kishi haqida bitta, o'zi haqida yo'q. Skrinshot Mini App'da JPEG ga siqiladi (≤ 2 MB, EXIF
   olib tashlanadi), server turini baytlar bo'yicha tekshiradi. Diskda — `DATA_DIR/files/` (keyin MinIO).
   Shikoyatchini faqat admin ko'radi.
4. **Yuzma-yuz tekshiruv** — sovrin topshirilishidan oldin g'olib telefonida Instagram →
   Professional panel → "Reklama vositalari" ko'riladi (admin panel → G'olib → tekshiruv ro'yxati).

Tizim faqat signal beradi: ogohlantirish (bot xabari), diskvalifikatsiya (reytingdan chiqadi,
bot xabari) yoki ro'yxatdan chiqarishni Admin hal qiladi.

## API

- **Mini App va veb-sayt** — `/api/v1/miniapp/...`; yo'llar `apps/miniapp/src/lib/api.ts` dagi
  `@endpoint` larga mos. Videolar:

| So'rov | Vazifa |
|---|---|
| `GET /miniapp/reels` | "Mening videolarim" — `MyReels`: `bestViews` (eng ko'p ko'rilgan qabul qilingan video — reytingdagi natija), shu videoning bugungi va kunlik o'sishi (oxirgi 30 kun), o'rin va uning o'zgarishi, oxirgi va keyingi yig'ish, `reels` (avval qabul qilinganlar ko'rishlar kamayishi bo'yicha — birinchisi `best: true`, keyin tekshiruvdagilar, keyin rad etilganlar; holat, rad sababi, ko'rishlar). Video bo'lmasa ham obyekt (`reels: []`) |
| `POST /miniapp/reels` | `{ url }` — yangi video (soni cheklanmagan), javob — yangilangan `MyReels`. Xatolar: `422 INVALID_LINK`, `409 REEL_ALREADY_SUBMITTED`, `409 REEL_TAKEN`, `403 UNAUTHORIZED` |

  Ishtirokchi ikki yo'l bilan tanilgan, ikkalasi ham bitta `telegramId`
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
- **Admin** — admin panel xodimi `POST /admin/auth/login` (`{ login, password }`) bilan kiradi;
  sessiya `reels_admin` cookie'da (HttpOnly, SameSite=Strict, `Path=/api/v1/admin`). 5 marta
  ketma-ket xato parol — login 15 daqiqaga qulflanadi. Rollar: `ADMIN` — hammasi, `SUPPORT` —
  faqat murojaatlar. Skriptlar `Authorization: Bearer <ADMIN_API_TOKEN>` bilan ham kira oladi.
  Har bir o'zgartiruvchi amal audit log'ga yoziladi (kim, nima, qachon, oldin/keyin, sabab).
  Kontrakt — `apps/admin/src/lib/api.ts` dagi `@endpoint` lar va `apps/admin/src/lib/types.ts`.

| So'rov | Vazifa |
|---|---|
| `POST /admin/auth/login`, `POST /admin/auth/logout`, `GET /admin/auth/me` | Kirish, chiqish, joriy xodim |
| `GET /admin/settings`, `PUT /admin/settings` | Tanlov muddati, ko'rishlar yig'ish vaqti, minimal yosh (boshlangach boshlanish sanasi qulflanadi) |
| `GET /admin/audit-log` | Audit log: `search`, `entity`, `actorRole`, `page`, `pageSize` |
| `GET /admin/rules`, `PUT /admin/rules` | Tanlov qoidalari |
| `GET /admin/participants` | Foydalanuvchilar: `search` (ism, telefon, istalgan Instagram akkaunti), `status`, `reel` (`PENDING`/`ACCEPTED`/`REJECTED` — shu holatda kamida bitta videosi bor; `NONE` — videosi yo'q), `sort`, `order`, `page`, `pageSize`. Qatorda `reels` — videolar soni holatlar bo'yicha, `views` — eng ko'p ko'rilgan qabul qilingan videosi |
| `GET /admin/participants/:id/reels` | Ishtirokchining barcha videolari (`/miniapp/reels` tartibida — eng ko'p ko'rilgani tepada, `best: true`; `bestViews`): holat, qo'lda tekshiruvdami, rad sababi, egasi, ko'rishlar, layklar, sanalar, nakrutka belgilari; `404` — ishtirokchi topilmadi |
| `POST /admin/participants/:id/{block,unblock,disqualify}` | `{ reason }` — bloklash, blokdan chiqarish, diskvalifikatsiya |
| `GET /admin/reels` | Barcha videolar (har bir ishtirokchining hammasi): holat, egasi, ko'rishlar tarixi, nakrutka belgilari |
| `GET /admin/stats` | Yig'ish jadvali, oxirgi natija, holatlar bo'yicha soni |
| `POST /admin/stats/sync` | Ko'rishlarni hoziroq yig'ish (fon rejimida) |
| `GET /admin/stats/refresh?minViews=&maxViews=&includeNear=`, `POST /admin/stats/refresh` | Faqat oraliqdagi videolarni hoziroq qayta o'qish (sovg'a topshirishdan oldin): nechta video, oxirgi yig'ish / fonda boshlash. `includeNear` — pastki chegaradan 20% pastdagilar ham. Rejadagi jadvalga ta'sir qilmaydi |
| `GET /admin/manual-reviews?status=OPEN\|APPROVED\|REJECTED` | Qo'lda tekshiruv ro'yxati |
| `POST /admin/manual-reviews/:shortcode/decision` | `{ decision: "approve" }` yoki `{ decision: "reject", reason, note? }` |
| `GET /admin/draws/setup` | Random tanlov: bosqichlar, oylik sovg'a, boshlang'ich sozlamalar |
| `POST /admin/draws/preview` | Sozlamalar bo'yicha nomzodlar soni va chetda qolganlar sababi. Qoidalar 7.2: davrga faqat sanasi (`dateBasis` — Instagram'da joylangan yoki ilovaga yuborilgan kun) davr ichidagi qabul qilingan videolar kiradi, nomzod ko'rishlari — ulardan eng ko'p ko'rilganiniki; `totalReels` — barcha yuborilgan videolar |
| `POST /admin/draws` | Random tanlovni o'tkazish (kriptografik `seed`, natija — qoralama) |
| `GET /admin/draws`, `GET /admin/draws/:id` | Tanlovlar tarixi va natija |
| `GET /admin/draws/stock` | Voucherlar qoldig'i: jami, yuborilgan, tasdiqlangan, qoralamada, qolgan (bosqichlar bo'yicha) |
| `GET\|POST /admin/draws/periods`, `PUT\|DELETE /admin/draws/periods/:periodId` | Admin kalendardan yaratadigan davrlar (`{title, startsOn, endsOn}`, tanlov muddati ichida) |
| `DELETE /admin/draws/stages/:index`, `POST /admin/draws/stages/:index/restore` | Bosqichni o'chirish / tiklash: tanlovda va Mini App'da ko'rinmaydi, voucherlar jami kamayadi (tanlov o'tkazilgan bosqich va oxirgi bosqich o'chirilmaydi) |
| `POST /admin/draws/:id/{replace,confirm,cancel}` | G'olibni zaxira bilan almashtirish, tasdiqlash, bekor qilish |
| `POST /admin/draws/:id/send` | G'oliblarga Telegram bot orqali tabrik (faqat tasdiqlangandan keyin) |
| `GET /admin/targets` | Target holatlari: `status` (`NEW`/`WARNED`/`DISQUALIFIED`/`DISMISSED`/`OPEN`), `search`, `page`, `pageSize` |
| `GET /admin/targets/:id` | Holat: dalil, dalil havolasi, kunlik o'sish, target holati tarixi |
| `POST /admin/targets/:id/resolve` | `{ action: "warn" \| "disqualify" \| "dismiss", reason }` — Admin qarori |
| `GET /admin/targets/check`, `POST /admin/targets/check` | Reklama kutubxonasi: oxirgi tekshiruv va keyingi rejadagi kun (`nextCheckOn`) / hoziroq tekshirish (tugashini kutadi) |
| `GET /admin/targets/:id/attachments/:attachmentId` | Shikoyat skrinshoti (rasm) |

- **Ega (tashkilot egalari, yashirin bo'lim)** — [`src/owner/`](src/owner/). Admin kirishidan alohida:
  `POST /owner/auth/login` (`OWNER_USERS`), sessiya `reels_owner` cookie'da (HttpOnly, SameSite=Strict,
  `Path=/api/v1/owner`, standart 2 soat); imzo `ADMIN_SESSION_SECRET` dan boshqa kontekst bilan olingan
  kalitda — admin sessiyasi va `ADMIN_API_TOKEN` bu yerda yaroqsiz (va aksincha). 5 marta xato parol —
  15 daqiqa qulf. Ega amallari audit log'ga ham, server log'iga ham **yozilmaydi**, bot xabari
  yuborilmaydi, ko'rishlarni o'zgartiruvchi endpoint yo'q. Kontrakt — `apps/admin/src/lib/owner-types.ts`.

| So'rov | Vazifa |
|---|---|
| `POST /owner/auth/login`, `POST /owner/auth/logout`, `GET /owner/auth/me` | Kirish, chiqish (sessiyasiz ham cookie o'chadi), joriy ega |
| `GET /owner/participants?search=&status=&page=&pageSize=` | Barcha ishtirokchilar, ro'yxatdan to'liq o'tmaganlar ham (`status`: `ACTIVE`/`BLOCKED`/`DISQUALIFIED`/`INCOMPLETE`) |
| `PATCH /owner/participants/:id` | `{ firstName?, lastName?, age?, phone?, status? }` — ism, familiya, yosh, telefon, holat (istalgan tomonga). 409 — telefon band |
| `DELETE /owner/participants/:id` | Ishtirokchi va uning videosi butunlay o'chadi |
| `GET /owner/targets`, `PATCH /owner/targets/:id` | Target holatlari: `{ status, note? }` — istalgan holatga (qaytarish ham); DISQUALIFIED bilan ishtirokchi holati ham bog'lanadi |
| `GET /owner/risk?level=&includeSafe=&search=`, `POST /owner/risk/:id/review` | Xavfga yaqin hisoblar (ball — [`src/owner/risk.ts`](src/owner/risk.ts)); belgi `{ verdict: "SAFE" \| "WATCH" \| null }` |

Mini App'dagi shikoyat: `POST /miniapp/target-reports` — `{ target, screenshot, comment? }`,
`screenshot` — `data:image/jpeg;base64,...`; JSON tanasi chegarasi 3 MB.

Support (ilova va veb-sayt): `GET /miniapp/support` — yozishma (`{ messages: [{ from, text, createdAt }] }`),
`POST /miniapp/support` — `{ text }` (1–1000 belgi; 10 daqiqada ko'pi bilan 5 ta xabar).
Xabar botdagidek murojaat bo'lib `TELEGRAM_SUPPORT_CHAT_ID` guruhiga boradi; operator shu xabarga
"Reply" qilsa — javob bot orqali ishtirokchiga yetadi va yozishmada ham ko'rinadi.

## Keyingi qadamlar

- PostgreSQL + Prisma (holat faylidan bazaga), worker — BullMQ navbatiga
- Admin 2FA; botdan xabar yuborish (hammaga/tanlanganlarga), bot matnlarini tahrirlash
- Prod uchun webhook rejimi
