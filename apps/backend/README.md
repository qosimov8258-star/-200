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
| `npm run worker` / `npm run worker:dev` | AI video tekshiruvi worker'i (build'dan keyin / `tsx` bilan) — [pastda](#ai-video-tekshiruvi) |
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
| `TELEGRAM_SUPPORT_OPERATOR_IDS` | Ishtirokchilarga bot nomidan javob bera oladigan operatorlar (Telegram ID, vergul bilan). Bo'sh — support guruhi egasi va adminlari |
| `APIFY_API_TOKEN` | Apify Console → Settings → API & Integrations. **Maxfiy** |
| `STATS_PROVIDER` | `apify` (haqiqiy) yoki `mock` (lokal sinov — SOXTA ko'rishlar) |
| `STATS_SYNC_TIME` | Ko'rishlar soat nechada yig'iladi, Toshkent vaqti (standart `00:00` — reyting yarim tunda yangilanadi; eski saqlangan `06:00` bir marta avtomatik `00:00` ga o'tadi). Faqat birinchi ishga tushishda — keyin admin panel → Sozlamalar |
| `STATS_SYNC_EVERY_DAYS` | Faqat `0` — avtomatik yig'ish o'chiq (lokal sinov). Davrning o'zi endi admin panel → Sozlamalar → «Yangilanish davri» (standart — haftada bir marta; ilgari env'da `1` bo'lgan serverlar ham bir marta haftalikka o'tadi). Boshqa qiymat e'tiborga olinmaydi |
| `STATS_VERIFY_DELAY_MS` | Yangi videolar shuncha yig'ilib, bitta so'rovda tekshiriladi (standart `1500`; bir vaqtda 3 tagacha tekshiruv parallel) |
| `TARGET_CHECK_TOP` | Reklama kutubxonasida reytingning nechta yetakchisi tekshiriladi (standart `30`) |
| `TARGET_CHECK_EVERY_DAYS` | Tanlov boshidan necha kunda bir tekshiriladi (standart `1` — har kuni; `30` — oyiga bir marta; `0` — faqat qo'lda) |
| `STATS_MOCK_VIDEO_URL` | Faqat `STATS_PROVIDER=mock`: AI tekshiruvini lokal sinash uchun hamma videolarga beriladigan mp4 manzili |
| `AI_WORKER_TOKEN` | AI worker ↔ backend ichki API kaliti (`openssl rand -hex 32`), ikkalasida bir xil. Bo'sh — `/internal/ai/*` yopiq. **Maxfiy** |
| `ANTHROPIC_API_KEY` | Claude API kaliti — **faqat worker'da** (backend'ga kerak emas). **Maxfiy**, log'ga yozilmaydi |
| `AI_ACCEPTANCE_GATE` | `true` — yangi videolar qabul qilinishidan oldin AI'dan o'tadi (pastda). Standart — **o'chiq**: AI hech narsaga ulanmagan, video faqat Apify bo'yicha qabul qilinadi |
| `AI_MODEL`, `AI_FRAME_INTERVAL_SEC`, `AI_FRAME_HEIGHT`, `AI_CONFIDENCE_MIN` | Model (`claude-opus-5-5`), kadr oralig'i (`2` s), kadrning qisqa tomoni (`720` = 720p), SHUBHALI chegarasi (`0.8`). Versiya tasdiqlanganda unga muhrlanadi |
| `AI_PROVIDER`, `AI_BACKEND_URL`, `AI_EFFORT`, `AI_POLL_SECONDS`, `AI_BATCH_SIZE`, `AI_MAX_IN_FLIGHT`, `AI_MAX_FRAMES`, `AI_MAX_BATCH_MB`, `AI_WORK_DIR` | Worker sozlamalari — `.env.example` da izohi bilan (`AI_PROVIDER=mock` — pul sarflamaydigan sinov) |
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

### Bot himoyasi

[`src/telegram/bot-guard.ts`](src/telegram/bot-guard.ts):

- **Flood**: bitta foydalanuvchidan daqiqasiga 20 tadan ortiq xabar/tugma — bir marta ogohlantiriladi, qolgani daqiqa tugaguncha javobsiz tashlanadi. Boshqa botlarning xabarlari e'tiborsiz.
- **Support spami**: botdagi murojaat — 10 daqiqada 10 ta (Mini App'da — 5); ortig'i operatorlarga bormaydi va saqlanmaydi (holat fayli shishmaydi). Matn 1000 belgigacha; guruhga yuborishda Telegram chegaralari (xabar 4096, rasm izohi 1024) hisobga olinadi.
- **Operatorlar**: support guruhida ishtirokchi xabariga javob (bot nomidan ishtirokchiga boradi) faqat guruh egasi/adminlari yoki `TELEGRAM_SUPPORT_OPERATOR_IDS` dagilar beradi — guruh havolasi begona qo'liga tushsa ham, u ishtirokchilarga "rasmiy" xabar yubora olmaydi. Guruhdagi oddiy suhbatga bot javob bermaydi.
- **Begona guruhlar**: botni boshqa guruh yoki kanalga qo'shishsa — darhol chiqib ketadi.
- Raqam faqat o'ziniki (`contact.user_id`) qabul qilinadi; bot tokeni log'ga chiqmaydi; bot polling rejimida (tashqaridan ochiq webhook yo'q — webhook'ga o'tilsa, `secret_token` shart).

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
   - aks holda birinchi ko'rishlar yoziladi va video **darhol `ACCEPTED`** (standart — AI ulanmagan).
     `AI_ACCEPTANCE_GATE=true` va admin AI mezonlarini tasdiqlagan bo'lsa esa video avval
     **AI tekshiruviga** o'tadi (holat `PENDING`, `Reel.aiCheck`; Apify bergan video fayli worker'ga
     beriladi). **Ikkalasi ham o'tsa** — `ACCEPTED`: AI «Tasdiqlandi» (ishonch ≥ `AI_CONFIDENCE_MIN`)
     → video qabul qilinadi va ishtirokchiga xabar boradi; «Rad etildi», «Shubhali» yoki AI videoni ko'ra
     olmasa → **qo'lda tekshiruv** (`AI_CHECK`). AI worker 10 daqiqa ko'rinmasa yoki natija 2 soatda
     kelmasa — video ham adminga o'tadi (cheksiz kutib qolmaydi). AI keyin o'chirilsa — kutib qolganlar
     qabul qilinadi;
   - topilmadi, ko'rishlari kelmadi yoki Apify xato berdi → 2 va 10 daqiqadan keyin qayta urinadi (xatoda —
     2, 4… daqiqa); **3 marta bo'lmasa — qo'lda tekshiruv** (`NEW_REEL`, pastda). Video
     "tekshirilmoqda"da cheksiz qolmaydi.
2. **Muntazam yig'ish** — aksiya boshlangan kundan (27-noyabr) Sozlamalardagi davr bo'yicha (standart — **haftada bir
   marta**, `syncEveryDays`) soat `STATS_SYNC_TIME` da
   rad etilmagan barcha videolar; har kunga bitta yozuv (tarix → Mini App grafigi). Qabul qilingan video topilmasa, 2 va 10
   daqiqadan keyin qayta tekshiriladi; 3 marta topilmasa — uning ko'rishlari reytingda vaqtincha hisobga olinmaydi va
   video **qo'lda tekshiruvga** o'tadi (ishtirokchining boshqa videolari reytingda qoladi). Video topilib,
   ko'rishlari kelmasa yoki ilgari ko'rishi bo'lgan videoda 0 bo'lib kelsa (Apify nosozligi) — 0 yozilmaydi,
   oxirgi ma'lum ko'rishlar qoladi va video qo'lda tekshiruvga yuborilmaydi. Ko'rishlar — `videoPlayCount`
   va `videoViewCount` dan kattasi.
3. **Qo'lda tekshiruv** (`MANUAL_REVIEW`) — avval ishtirokchiga bot orqali xabar boradi, so'ng video
   admin paneldagi "Qo'lda tekshiruv" bo'limida paydo bo'ladi (AI'dan kelganida — AI qarori va izohi
   bilan). Admin linkni ochib:
   - **tasdiqlaydi** → `ACCEPTED`, video reytingga qo'shiladi. Ko'rishlari hali o'qilmagan yangi video
     uchun Apify **darhol** so'raladi (kunlik yig'ish kutilmaydi), topilmasa — 2, 10, 30 daqiqa, 1, 3 va
     6 soatdan keyin qayta; Apify topa olmasa ham qayta-qayta tekshiruvga tushmaydi;
   - **rad etadi** (sabab bilan; AI'dan kelganida odatda `NO_PRODUCT` — "videoda mahsulot ko'rinmadi")
     → `REJECTED`, ishtirokchi sababni oladi.
   Kutish paytida Apify videoni o'zi topsa — holat avtomatik yopiladi (`NEW_REEL`/`LOST_REEL`; AI
   mahsulotni topmagan `AI_CHECK` videoni esa faqat admin hal qiladi).
4. **Tanlov tugagach** (`contest.ts` → `endsAt`) — bitta yakuniy yig'ish, keyin to'xtaydi.
5. **Natija va sovrinlar** — «OLIVIA» aksiyasi ommaviy ofertasi (25.11.2026; to'liq matni
   [`src/rules/offer-text.ts`](src/rules/offer-text.ts), Mini App "Qoidalar" bo'limida ikki tilda):
   - **Ko'rishlar qo'shiladi** (7.1): ishtirokchining natijasi — barcha qabul qilingan videolari oxirgi
     ko'rishlarining yig'indisi (`participantViews`). Reyting (`StatsService.ranking()`, Mini App) —
     ishtirokchilar shu yig'indi bo'yicha, **faqat ma'lumot uchun**: g'oliblar o'rin bo'yicha emas (9.1).
   - **Oylik voucherlar** (6.1): Korzinka 500 000 so'm, oyiga 200 ta (jami 600); bosqichlar 27.11–26.12,
     27.12–26.01, 27.01–27.02. Bosqichda ro'yxatdan o'tkazilgan (ilovaga yuborilgan) videolar ko'rishlari
     yig'indisi 1 000–100 000 bo'lganlar orasida random (`DrawsService`). Bir necha oy yutish mumkin (6.1.5).
   - **Asosiy sovrinlar** (6.2) — aksiya davomidagi umumiy ko'rishlar oralig'ida **random** (zaxira bilan):
     4 000 001+ — BYD Chazor (1), 1 500 001–4 000 000 — Tailandga sayohat (3), 500 001–1 500 000 —
     iPhone 18 Pro (15), 100 001–500 000 — planshet (25). Admin → G'oliblar → "Random tanlov o'tkazish"
     (`prizeId: main-car|main-travel|main-phone|main-tablet`); bitta kishiga bitta asosiy sovrin.
     Avtomobil g'olibi (`WinnerService`) — shu tanlov navbati: g'olib, rad etilsa — navbatdagi zaxira (10.3).
   - Xarid ishtirok sharti emas (2.7) — g'olib tekshiruvida "xarid" bandi yo'q.
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

1. **Meta reklama kutubxonasi** — har kuni (tanlov boshidan har `TARGET_CHECK_EVERY_DAYS` = 1 kunda;
   `30` qilinsa — oyiga bir marta; tanlov tugagach to'xtaydi)
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

## AI video tekshiruvi

Admin panel → **AI**: admin namuna rasmlar ("ko'rinishi shart" / "bo'lmasligi kerak" / "ma'lumot
uchun", izohi bilan) va umumiy mezon matnini yozadi, **Tasdiqlash** bosadi — sozlama yangi
**versiya** sifatida muhrlanadi (keyin o'zgarmaydi; o'zgartirish — "Yangi versiya") va qabul
qilingan videolar navbatga qo'yiladi. **Sinov** rejimida avval 20 ta video (tanlangan yoki eng ko'p
ko'rilgan 20 tasi), natijani ko'rib — "Hammasini ishga tushirish". Hammasi rejimida keyin qabul
qilingan videolar ham o'zi navbatga tushadi. Allaqachon qabul qilingan videolar bo'yicha AI qarori video
holatini **o'zgartirmaydi** — bu moderatsiyaga yordam; SHUBHALI videolarni admin qo'lda tasdiqlaydi yoki
rad etadi (izoh bilan, audit log'ga).

**Yangi videolar — avval AI, keyin qabul** (faqat `AI_ACCEPTANCE_GATE=true` bo'lsa; standart — o'chiq,
AI hech narsaga ulanmagan). Mezonlar tasdiqlangach (faol versiya bor), har bir yangi
yuborilgan video Apify topgach shu navbatga tushadi (`AiReviewService.submitForAcceptance`) va natijasi
qabulni hal qiladi: TASDIQLANDI → `ACCEPTED`; RAD ETILDI / SHUBHALI / FAILED → "Qo'lda tekshiruv"
(`AI_CHECK`). Admin u yerda qaror qilsa, AI bo'limidagi natijaga ham yoziladi. Yangi versiya
tasdiqlansa, navbatdagi yangi videolar yangi mezonlar bilan tekshiriladi. Worker ishlamasa (10 daqiqa
heartbeat yo'q) yoki natija 2 soatda kelmasa — video adminga o'tadi. Shuning uchun mezonlar
tasdiqlangan bo'lsa, **worker doim ishlab turishi kerak** (aks holda hamma yangi video qo'lda tekshiruvga
tushadi).

```text
admin panel ─► backend (navbat, versiyalar, natijalar — StateStore)
                  ▲  │ /internal/ai/* (X-Worker-Token)
                  │  ▼
               ai-worker ─► Instagram CDN (mp4) ─► ffmpeg (har 2 s, 720p JPEG)
                  │
                  └──► Claude Message Batches API (claude-opus-5-5) ─► natija ─► backend
```

- **Worker** — alohida jarayon ([`src/worker/`](src/worker/), `npm run worker`): har `AI_POLL_SECONDS`
  da navbatdan `AI_BATCH_SIZE` ta video oladi (lease 2 soat), videoni yuklab ffmpeg bilan
  kadrlarga ajratadi (uzun videoda oraliq kattalashadi, ko'pi bilan `AI_MAX_FRAMES` ta), bitta batch
  qilib yuboradi va tugagan batch natijalarini backend'ga yozadi. Video manzili (Instagram CDN,
  muddati cheklangan) backend'da Apify'dan olinadi (`videoUrl`, 6 soatdan eskisi yangilanadi;
  `403/404` — qayta olinadi).
- **So'rov** ([`src/worker/prompt.ts`](src/worker/prompt.ts)): tizim ko'rsatmasi → mezon matni →
  namuna rasmlar (oxirgisida `cache_control: 1h` — bitta versiyaning hamma videolari shu qismni
  keshdan arzon o'qiydi) → `[t=12s]` yorlig'i bilan kadrlar. Javob — qat'iy JSON (structured
  outputs): `{ status: APPROVED|REJECTED|UNCERTAIN, confidence, reason, evidence: [{ second, description }] }`.
  `confidence < AI_CONFIDENCE_MIN` (0.8) — **SHUBHALI**; xavfsizlik filtri javob bermasa ham SHUBHALI.
  Dalil kadrlari (`evidence` soniyalari) backend'ga yuklanadi, qolgan vaqtinchalik kadrlar o'chiriladi.
- **Limitlar** (platform.claude.com → Vision, Batches): batch — 100 000 so'rov yoki 256 MB; 1M kontekstli
  modellarda bitta so'rovda 600 tagacha rasm, 20 tadan ko'p bo'lsa har biri ≤ 3000 px, rasm ≤ 10 MB. Worker: so'rov ≤ 24 MB (oshsa JPEG sifati, keyin o'lchami
  pasayadi), batch ≤ `AI_MAX_BATCH_MB` (oshsa bir nechta batch'ga bo'linadi).
- **Namuna rasmlar** soni amalda cheklanmaydi (butun mahsulot katalogi; texnik chegara — 400, chunki
  so'rovda kadrlar bilan birga 600 tagacha rasm). Worker ularni JPEG ga keltiradi, ko'p bo'lsa
  kichikroq (≤ 16 ta — 1568 px, ≤ 40 — 1024, ≤ 100 — 768, ≤ 250 — 512, undan ko'p — 384 px; jami
  ≤ 9 MB), kadrlar soni esa qolgan joyga moslanadi. "Ko'rinishi shart" rasmlardan **kamida bittasi**
  videoda ko'rinsa yetarli (hammasi kerak bo'lsa — mezon matnida yoziladi). Rasmlar har videoga
  qo'shiladi, lekin keshdan o'qiladi: 222 ta rasm (512 px) ≈ 55 000 token ≈ $0.006 / video
  (kesh topilmasa ≈ $0.11).
- **Qayta urinish**: yuklab olish / model xatosi — 3 marta, keyin FAILED. Claude kaliti xato, limit
  yoki tarmoq — urinish hisoblanmaydi, worker 10 daqiqa kutadi. Worker o'chib qolsa — lease
  muddati tugagach ish navbatga qaytadi.
- **Narx** (batch — 50% chegirma; Opus 5.5: kirish $4, chiqish $20, kesh o'qish $0.20 / 1M token):
  2 daqiqalik video ≈ 60 kadr × ~1 200 token ≈ 72 000 token → **≈ $0.15–0.20 / video**,
  1 000 video ≈ $150–200. Har bir natijada tokenlar va $ saqlanadi, admin panelda jami ko'rinadi.

Lokal sinov (pulsiz): backend `STATS_PROVIDER=mock STATS_MOCK_VIDEO_URL=<mp4 manzili>
AI_WORKER_TOKEN=test-token`, worker esa `AI_PROVIDER=mock AI_WORKER_TOKEN=test-token npm run worker:dev`.
Kerak: `ffmpeg` va `ffprobe` (`brew install ffmpeg`). Serverda — [`deploy/README.md`](../../deploy/README.md#ai-worker).

## API

- **Mini App va veb-sayt** — `/api/v1/miniapp/...`; yo'llar `apps/miniapp/src/lib/api.ts` dagi
  `@endpoint` larga mos. Videolar:

| So'rov | Vazifa |
|---|---|
| `POST /miniapp/lang` | Ilova tili: `{ lang: "uz" \| "ru" }` — ishtirokchiga saqlanadi (`Participant.lang`, `GET /miniapp/me` → `lang`), bot xabarlari shu tilda. Mini App har bir so'rovda `X-Lang: uz\|ru` yuboradi: `GET /miniapp/rules` (ommaviy oferta `sectionsFor(lang)`) va `GET /miniapp/prizes` (nomlar va izohlar) shu tilda. Til tanlanmagan bo'lsa bot Telegram tilidan foydalanadi (`language_code` ru… — rus) |
| `GET /miniapp/reels` | "Mening videolarim" — `MyReels`: `totalViews` (barcha qabul qilingan videolar yig'indisi), umumiy o'sish (oxirgi va har yig'ishdagi, 30 tagacha), o'rin (ishtirokchilar reytingida) va uning o'zgarishi, oxirgi va keyingi yig'ish, `reels` (avval qabul qilinganlar ko'rishlar kamayishi bo'yicha, keyin tekshiruvdagilar, keyin rad etilganlar; holat, rad sababi, ko'rishlar). Video bo'lmasa ham obyekt (`reels: []`) |
| `POST /miniapp/reels` | `{ url }` — yangi video (soni cheklanmagan), javob — yangilangan `MyReels`. Xatolar: `422 INVALID_LINK`, `409 REEL_ALREADY_SUBMITTED`, `409 REEL_TAKEN`, `403 UNAUTHORIZED` |
| `GET /miniapp/stories` | Istoriyalar (ochiq, mehmonlarga ham): `StoryGroup[]` — ishtirokchi bo'yicha (`authorKey`, `fullName`, `isMe`, `stories` eskidan yangiga), o'zimniki birinchi, keyin eng yangisi bo'yicha. Bloklangan/chetlatilganlarniki ko'rinmaydi |
| `POST /miniapp/stories` | Yangi istoriya: so'rov tanasi — videoning o'zi (raw), `Content-Type: video/mp4 \| video/quicktime \| video/webm`, 50 MB gacha; faqat ro'yxatdan o'tgan faol ishtirokchi, bir vaqtda 10 tagacha. Javob `201` — yangi ro'yxat. Xatolar: `403 UNAUTHORIZED`, `413 STORY_TOO_LARGE`, `422 STORY_INVALID_FILE`, `429 STORY_LIMIT`. Istoriya 24 soat yashaydi, keyin fayli o'chiriladi |
| `DELETE /miniapp/stories/:id` | O'z istoriyasini o'chirish (`204`; boshqaniki — `404 NOT_FOUND`) |
| `GET /miniapp/stories/:id/video` | Video fayl (ochiq, Range so'rovlari bilan — `<video src>` uchun); muddati o'tgan — `404` |

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
| `POST /auth/web-register` | Saytdan (Telegram'siz) ro'yxatdan o'tish: `{ firstName, phone, age }` — raqam "+998" va 9 raqam (`90 123 45 67` ham bo'ladi). Akkaunt alohida ID oralig'ida (`WEB_ID_BASE`, 9·10¹⁵ dan) yaratiladi, sessiya cookie'si 400 kunlik (boshqa kirish yo'li yo'q — sayt bunday hisobda "chiqish"ni ko'rsatmaydi), keyin — qoidalarga rozilik. Raqam tasdiqlanmaydi (SMS yo'q) — sovrin topshirishda shaxsan tekshiriladi; band raqam — `409 PHONE_TAKEN`. **Telegram'ga ulash**: profildagi "Telegram'ga ulash" botni `?start=link` bilan ochadi; bot orqali shu raqam ulashilsa (Telegram tasdiqlagan), hisob o'sha Telegram foydalanuvchisiga ulanadi (`linkedTelegramId`, bot xabarlari endi keladi, Telegram va istalgan qurilmadagi saytdan "Telegram orqali kirish" bilan kiriladi); ulanishdan oldingi sayt sessiyalari yopiladi (`sessionsFrom` — raqamni begona yozgan bo'lsa, u chiqariladi). Telegram foydalanuvchisining o'z alohida profili bo'lsa — qo'shilmaydi, bot support'ga yo'naltiradi. Xatolar: `422 INVALID_PROFILE \| INVALID_PHONE \| UNDER_AGE`, `429 TOO_MANY` (bitta IP dan soatiga 5 ta, jami soatiga 300 ta) |
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
| `GET` / `PUT` / `DELETE /admin/rules/video` | Qoida videosi (Mini App'dagi "Qoidalar" bo'limida eng tepada): `PUT` tanasi — videoning o'zi (raw), `Content-Type: video/mp4 \| video/quicktime \| video/webm`, 100 MB gacha; eskisi almashtiriladi. Xatolar: `413 RULES_VIDEO_TOO_LARGE`, `422 RULES_VIDEO_INVALID`. Audit: `settings.rules_video`, `settings.rules_video_delete`. Mini App: `GET /miniapp/rules` → `video: { id, mime } \| null`, fayl — `GET /miniapp/rules/video/:id` (ochiq, Range bilan) |
| `GET /admin/participants` | Foydalanuvchilar: `search` (ism, telefon, istalgan Instagram akkaunti), `status`, `reel` (`PENDING`/`ACCEPTED`/`REJECTED` — shu holatda kamida bitta videosi bor; `NONE` — videosi yo'q), `sort`, `order`, `page`, `pageSize`. Qatorda `reels` — videolar soni holatlar bo'yicha, `views` — umumiy tasdiqlangan ko'rishlar (yig'indi) |
| `GET /admin/participants/:id/reels` | Ishtirokchining barcha videolari (`/miniapp/reels` tartibida — eng ko'p ko'rilgani tepada; `totalViews` — yig'indi): holat, qo'lda tekshiruvdami, rad sababi, egasi, ko'rishlar, layklar, sanalar, nakrutka belgilari; `404` — ishtirokchi topilmadi |
| `GET /admin/stories` | Istoriyalar: faol istoriyalar (bloklanganlarniki ham), eng yangisi birinchi — ishtirokchi (id, ism, telefon), sanalar, hajmi; `page`, `pageSize`. Video — `GET /miniapp/stories/:id/video` |
| `POST /admin/stories/:id/remove` | `{ reason }` — istoriyani o'chirish (nomaqbul video), audit log: `story.remove`; `404` — topilmadi yoki muddati o'tgan |
| `POST /admin/participants/:id/{block,unblock,disqualify}` | `{ reason }` — bloklash, blokdan chiqarish, diskvalifikatsiya |
| `GET /admin/reels` | Barcha videolar (har bir ishtirokchining hammasi): holat, egasi, ko'rishlar tarixi, nakrutka belgilari |
| `GET /admin/stats` | Yig'ish jadvali, oxirgi natija, holatlar bo'yicha soni |
| `POST /admin/stats/sync` | Ko'rishlarni hoziroq yig'ish (fon rejimida) |
| `GET /admin/stats/refresh?minViews=&maxViews=&includeNear=`, `POST /admin/stats/refresh` | Faqat oraliqdagi videolarni hoziroq qayta o'qish (sovg'a topshirishdan oldin): nechta video, oxirgi yig'ish / fonda boshlash. `includeNear` — pastki chegaradan 20% pastdagilar ham. Rejadagi jadvalga ta'sir qilmaydi |
| `GET /admin/manual-reviews?status=OPEN\|APPROVED\|REJECTED` | Qo'lda tekshiruv ro'yxati |
| `POST /admin/manual-reviews/:shortcode/decision` | `{ decision: "approve" }` yoki `{ decision: "reject", reason, note? }` |
| `GET /admin/draws/setup` | Random tanlov: bosqichlar, oylik sovg'a, `saved` — bir marta tasdiqlangan doimiy sozlamalar (bo'lmasa — null), `defaults` — saqlangan yoki standart qiymatlar (sana turi standart — Instagram'da joylangan) |
| `PUT /admin/draws/settings` | Doimiy sozlamalarni saqlash/tahrirlash: `{ dateBasis, minViews, maxViews, winnersCount, reservesCount, excludeWarned, excludeTargets, messageTemplate }`, javob — yangi `setup`; audit `draw.settings.update`. Har bir tanlovda faqat bosqich/davr tanlanadi |
| `POST /admin/draws/preview` | Sozlamalar bo'yicha nomzodlar soni va chetda qolganlar sababi. Oferta 7.2: davrga faqat sanasi (`dateBasis`, standart — ilovaga yuborilgan kun) davr ichidagi qabul qilingan videolar kiradi, nomzod ko'rishlari — ularning **yig'indisi**; `totalReels` — barcha yuborilgan videolar. Oylik voucherni bir necha oy yutish mumkin (6.1.5) — oldingi g'oliblar chetlatilmaydi. Asosiy sovrin (`main-*`): davr, oraliq va soni ofertadagi, boshqa asosiy sovrin g'oliblari chetda (`PREVIOUS_WINNER`) |
| `GET /admin/winner/prizes` | Asosiy sovrinlar (avtomobil, sayohat, iPhone, planshet) — oferta 6.2: har birining oralig'idagi ishtirokchilar soni (umumiy ko'rishlar bo'yicha), random tanlov bo'lsa — uning g'oliblari va zaxirasi, bo'lmasa — oraliqdagilar (30 tagacha); target/nakrutka belgilari bilan |
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
| `GET /admin/ai/state` | AI tekshiruvi: qoralama, faol versiya, joriy ish (`TRIAL`/`FULL`), jarayon (navbatda / ishlanmoqda / tayyor / xato, verdiktlar, tokenlar, $), worker holati, sozlamalar |
| `POST /admin/ai/draft`, `PUT /admin/ai/draft` | "Yangi versiya" (faolidan nusxa) / mezon matni `{ criteria }` (≤ 5000 belgi) |
| `POST /admin/ai/draft/references`, `PATCH\|DELETE /admin/ai/draft/references/:id` | Namuna rasm `{ dataUrl, kind: MUST\|MUST_NOT\|INFO, note }` (JPEG/PNG/WebP ≤ 2 MB, 400 tagacha — Claude bitta so'rovda 600 tagacha rasm oladi) / `{ kind?, note? }` / o'chirish |
| `GET /admin/ai/references/:id/image` | Namuna rasm |
| `GET /admin/ai/candidates?search=` | Sinov uchun videolar (qabul qilinganlar, eng ko'p ko'rilgani birinchi, 50 tagacha) |
| `POST /admin/ai/approve` | `{ mode: TRIAL\|FULL, trialShortcodes? }` (≤ 20; bo'sh — eng ko'p ko'rilgan 20 tasi): versiya muhrlanadi, videolar navbatga |
| `POST /admin/ai/run-all` | Sinovdan keyin — hamma videolar |
| `GET /admin/ai/reviews?verdict=&state=&search=&page=&pageSize=` | Natijalar (joriy versiya): holat, AI va yakuniy qaror, ishonch, sabab, dalillar (soniya, tavsif, kadr bormi), qo'lda qaror, tokenlar, $ |
| `GET /admin/ai/reviews/:id/frames/:second` | Dalil kadri (JPEG) |
| `POST /admin/ai/reviews/:id/decision` | `{ decision: APPROVED\|REJECTED, note }` — qo'lda qaror (audit `ai.decision`) |

- **AI worker (ichki)** — `/api/v1/internal/ai/*`, `X-Worker-Token: <AI_WORKER_TOKEN>`; nginx tashqariga
  ochmaydi (`404`), worker backend'ga Docker tarmog'i ichida murojaat qiladi
  ([`src/ai-review/ai-worker.controller.ts`](src/ai-review/ai-worker.controller.ts)): `heartbeat`,
  `lease { limit }`, `release { reviewIds, error }`, `config/:version` (+ `/references/:id`),
  `batches { batchId, reviewIds }`, `batches/open`, `batches/:id/close`, `results { results }`.

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

- PostgreSQL + Prisma (holat faylidan bazaga), worker'lar (ko'rishlar, AI) — BullMQ navbatiga
- Admin 2FA; botdan xabar yuborish (hammaga/tanlanganlarga), bot matnlarini tahrirlash
- Prod uchun webhook rejimi
