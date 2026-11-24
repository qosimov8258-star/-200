# Admin panel (`apps/admin`)

Reels tanlov ilovasining zavod xodimlari uchun veb admin paneli (TZ, 6-bo'lim).
Stek: Next.js (App Router, statik eksport), TypeScript (strict), Tailwind CSS, TanStack Query,
lucide-react ikonkalari.

Serverda: **<https://konkurs-olivia.uz/admin/>** (nginx statik fayllar sifatida beradi,
API — shu domendagi `/api/v1`). Deploy — [`deploy/README.md`](../../deploy/README.md).

## Ishga tushirish

Node.js 20.9 yoki undan yangi versiya kerak.

```bash
cd apps/admin
npm install
npm run dev
```

Panel: <http://localhost:3001> (3000-port backend uchun band qilingan).

| Buyruq | Vazifa |
|---|---|
| `npm run dev` | Dev server (3001-port), mock ma'lumotlar bilan |
| `npm run dev:http` | Dev server lokal backend bilan (`/api/v1` → `BACKEND_URL`, standart `http://localhost:3000`) |
| `npm run build` | Statik eksport → `out/` |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript tekshiruvi |

> Hozircha panel alohida npm loyihasi. Repo ildizida pnpm workspace sozlangach
> (PLAN.md, Faza 0) buyruqlar `pnpm --filter admin <buyruq>` ga o'tadi.

### Env o'zgaruvchilar

| O'zgaruvchi | Qayerda | Qiymat |
|---|---|---|
| `NEXT_PUBLIC_API_MODE` | build / dev | `http` — haqiqiy backend, `mock` — soxta ma'lumotlar. Berilmasa: `next build` da `http`, `next dev` da `mock` |
| `ADMIN_BASE_PATH` | build / dev | Panel yo'li: serverda `/admin`, lokal — bo'sh |
| `BACKEND_URL` | faqat `next dev` (`http` rejim) | `/api/v1/*` uzatiladigan backend, standart `http://localhost:3000` |

### Production build

`next build` har doim **statik eksport** qiladi (`output: "export"`, `trailingSlash: true`):
natija `out/` papkasida, Node.js server kerak emas. Server uchun:

```bash
ADMIN_BASE_PATH=/admin NEXT_PUBLIC_API_MODE=http npm run build
```

Bu buyruqni [`deploy/Dockerfile.web`](../../deploy/Dockerfile.web) bajaradi va `out/` ni nginx'ga
`/usr/share/nginx/html/admin` qilib qo'yadi. `next start` statik eksportda ishlamaydi; `out/` ni
ko'rish uchun istalgan statik server yetadi (masalan, `npx serve out` — `ADMIN_BASE_PATH` bo'sh bo'lsa).

`basePath` bilan ishlash qoidalari:

- ichki havolalar — faqat `next/link` va `router.push/replace` (ular `/admin` ni o'zi qo'shadi);
  `window.location` ga yoki `<a href="/...">` ga yo'l qo'lda yozilmaydi;
- `public/` dagi fayllarga (`<video src>`, `<img src>`) `basePath` o'zi qo'shilmaydi — oldiga
  `process.env.NEXT_PUBLIC_BASE_PATH` qo'yiladi (`next.config.ts` uni `ADMIN_BASE_PATH` dan o'zi
  beradi, alohida sozlanmaydi);
- server funksiyalari (`redirect()`, route handler, `cookies()`) ishlatilmaydi — statik eksport;
- API manzillari (`/api/v1/...`) domen ildizida — ularga `basePath` qo'shilmaydi.

## API qatlami

Komponentlar backendga to'g'ridan-to'g'ri `fetch` qilmaydi — faqat [`src/lib/api.ts`](src/lib/api.ts)
orqali. U ikki implementatsiyadan birini tanlaydi:

- [`src/lib/api.http.ts`](src/lib/api.http.ts) — haqiqiy backend. So'rovlar nisbiy `/api/v1/...`,
  `credentials: "same-origin"`; sessiya — backend qo'yadigan `HttpOnly` cookie (JavaScript uni
  ko'rmaydi). Xato javoblari (`{ message }`, `{ code }`, Nest `{ statusCode, message }`)
  `ApiError(status, message)` ga aylanadi; tushunarli matn bo'lmasa — status bo'yicha o'zbekcha matn.
- [`src/lib/api.mock.ts`](src/lib/api.mock.ts) — soxta ma'lumotlar ([`src/lib/mock/`](src/lib/mock/)).

Ikkala faylda funksiyalar nomi va imzosi bir xil (buni `api.ts` dagi tip tekshiradi), har bir
funksiyaning JSDoc idagi `@endpoint` — backend manzili (kontrakt). Tiplar —
[`src/lib/types.ts`](src/lib/types.ts), xatolar — [`src/lib/api-error.ts`](src/lib/api-error.ts).
`NEXT_PUBLIC_API_MODE` build vaqtida kodga yoziladi, shuning uchun `http` build'ga mock kod va
mock parollar kirmaydi.

Sessiya tugasa (istalgan so'rov yoki amal 401 qaytarsa) panel login sahifasiga o'tadi va kirgandan
keyin o'sha bo'limga qaytaradi.

## Mock rejim

Backendsiz ishlash uchun (`npm run dev` da standart):

- Test login ma'lumotlari [`src/lib/mock/db.ts`](src/lib/mock/db.ts) da (faqat lokal mock uchun);
  login sahifasida yo'riqnoma faqat mock rejimda ko'rinadi.
- Tanlov ma'lumotlari ([`src/lib/mock/contest.ts`](src/lib/mock/contest.ts)) deterministik
  generatsiya qilinadi va bugungi sanaga bog'lanadi: tanlov 24 kun oldin boshlangan,
  140 ta o'ylab topilgan ishtirokchi, har birida 0–6 ta video (turli holatlarda, ba'zilari
  ikkinchi Instagram akkauntdan), kunlik ko'rishlar, target va murojaatlar. Reytingda har bir
  qabul qilingan video alohida qator; ishtirokchi natijasi va o'rni — eng ko'p ko'rilgan bitta
  qabul qilingan videosi bo'yicha, videolar ko'rishlari qo'shilmaydi (g'olib, ega bo'limi va
  random tanlov ham shunday hisoblaydi).
- Mock sessiya brauzerning `localStorage` ida saqlanadi.
- Admin amallari (bloklash, blokdan chiqarish, diskvalifikatsiya, support javoblari va
  holatlari, target bo'yicha qarorlar) va ularning audit yozuvlari ham `localStorage` da
  (`reels-admin:mock-store` kaliti). Mock ma'lumotlarni boshlang'ich holatga qaytarish uchun
  shu kalitni o'chiring.
- Voucher random tanlovi sozlamalari va o'tkazilgan tanlovlar ham shu `localStorage` kalitida
  (`drawSettings`, `draws`). Asosiy sovrinlar (`GET /admin/winner/prizes`) mock reytingdan
  hisoblanadi ([`src/lib/mock/rating-prizes.ts`](src/lib/mock/rating-prizes.ts)) — mock'da
  ko'rishlar kam, shuning uchun odatda faqat "Planshet" oralig'ida ishtirokchi bo'ladi.
- AI tekshiruvi ([`src/lib/mock/ai.ts`](src/lib/mock/ai.ts)) alohida kalitlarda: `reels-admin:mock-ai`
  (versiyalar, navbat, qo'lda qarorlar) va `reels-admin:mock-ai-images` (namuna rasmlar); uning audit
  yozuvlari — umumiy `reels-admin:mock-store` da.

**Mock boshqaruvlari:** G'oliblar sahifasida "Tanlovni tugagan deb ko'rish" tugmasi bor — mock'da
tanlov hali tugamagan, oqimni sinash uchun. U faqat `mockControls` bo'lsa (mock rejimda) ko'rinadi.

## Qabul qilingan qarorlar (17.11.2026)

Jamoa tasdiqlagan, backend ham shu qoidalar bo'yicha ishlashi kerak:

- **Diskvalifikatsiya** panel orqali bekor qilinmaydi (bloklashdan farqli o'laroq).
- **Ko'rishlar teng bo'lsa**, oldinroq yuborilgan Reel reytingda yuqorida turadi.
- **Support:** "Yangi" murojaatga birinchi javob yozilganda u avtomatik "Ko'rilmoqda" holatiga o'tadi.
- **Collab videolar alohida aniqlanmaydi** — Instagramda boshqa akkaunt bilan hamkorlikda (Collab)
  joylangan Reel oddiy Reel kabi qabul qilinadi, chunki muhimi — ko'rishlar soni. Bitta Reel
  (bitta link) faqat bitta ishtirokchiga hisoblanadi: linkni birinchi yuborganga.

Panelda shunday qilingan, lekin hali jamoa bilan kelishilishi kerak (PLAN.md Q11, Q12):

- **Telegram "o'qildi"** — bot o'qilganlikni bilmaydi, shuning uchun xabar ostida "✅ O'qidim"
  tugmasi bo'ladi; yetkazilganiga 24 soatdan oshib bosilmasa — "o'qilmadi".
- **Telegramni ulamaganlarga** xabarnomalar faqat ilovada boradi.

## Foydalanuvchilar va videolar

Ishtirokchi cheklovsiz Reel yuboradi. **Reytingda har bir qabul qilingan video alohida qator:**
4 ta qabul qilingan videosi bor ishtirokchi reytingda 4 marta uchraydi, har qatorda — shu videoning
ko'rishlari va o'rni. Tartib: ko'rishlar kamayishi bo'yicha; teng bo'lsa — oldinroq yuborilgan video,
keyin ishtirokchi id, keyin shortcode. Bloklangan va diskvalifikatsiya qilinganlarning videolari
reytingda yo'q.

Ishtirokchining natijasi — qabul qilingan videolari ichida eng ko'p ko'rilgan **bittasining**
ko'rishlari (videolar ko'rishlari qo'shilmaydi; qabul qilingan video bo'lmasa — 0), o'rni — shu
videoning reytingdagi o'rni. Shuning uchun ishtirokchilar o'rinlari oralab ketishi mumkin (1, 4, 5…).
Sovg'alar esa ishtirokchi bo'yicha: g'olib — 1-o'rindagi video egasi, u rad etilsa — keyingi boshqa
ishtirokchi; random tanlov va target tekshiruvi ham ishtirokchi bo'yicha.

- Jadvaldagi "O'rin" va "Ko'rishlar" ustunlari, g'olib va ega bo'limi — shu qiymatlar.
- Kunlik reyting (`GET /api/v1/admin/ratings/daily`): qator — video (kaliti `shortcode`, havolasi
  "Video" ustunida). "Kunlik o'sish" — shu videoning shu kungi ko'rishlari minus oldingi kungisi
  (oldingi kungacha yig'ilmagan bo'lsa — hammasi), o'rin o'zgarishi — shu videoning oldingi kundagi
  o'rniga nisbatan (oldingi kuni reytingda bo'lmagan video — "Yangi"). Xulosada: turli ishtirokchilar
  soni, videolar (qatorlar) soni, "Jami ko'rishlar" (qatorlar yig'indisi), kunlik o'sish va yangi
  kirgan videolar. Dashboarddagi "Jami ko'rishlar" (barcha videolar) — umumiy ko'rsatkich.
- Dashboarddagi "Eng ko'p ko'rilgan videolar" — reyting boshi: bir ishtirokchi bir necha kartada
  bo'lishi mumkin.
- Oylik random tanlov (Aksiya qoidalari 7.2): davrga tushgan qabul qilingan videolari ichida eng
  ko'p ko'rilgani; ko'rishlar chegarasi ham shunga qo'llanadi.

- Jadvaldagi "Videolar" ustuni: jami video soni va holatlar bo'yicha belgilar (qabul qilingan,
  kutilmoqda — qo'lda tekshiruvdagilar bilan, rad etilgan); video bo'lmasa — "—".
- Ism, video soni yoki qatorning bo'sh joyi bosilsa — "Videolar" oynasi
  (`GET /api/v1/admin/participants/:id/reels`): Instagram akkaunt(lar), "Eng ko'p ko'rilgan video"
  (`bestViews` — jadvaldagi "Ko'rishlar" bilan bir xil, ostida ishtirokchi o'rni) va barcha videolar —
  link, reytingdagi o'rni (qabul qilinganlarda, masalan «12-o'rin»; `rank`), holat ("Qo'lda
  tekshiruvda" ham), rad etish sababi, akkaunt, ko'rishlar, layklar, yuborilgan / joylangan / oxirgi
  yangilangan vaqt va shubha belgilari. Tartib backenddan keladi: avval qabul qilinganlar ko'rishlar
  kamayishi bo'yicha — birinchisi eng ko'p ko'rilgani («Eng ko'p ko'rilgan» belgisi, `best: true`;
  ishtirokchi o'rni shu bo'yicha), keyin tekshiruvdagilar, keyin rad etilgan / o'chirilganlar (oxirgi
  ikkalasida eng yangisi yuqorida).
- Video filtri (`reel` URL parametri): "shu holatdagi videosi bor" yoki "Video yo'q".

## Istoriyalar (olib tashlangan)

"Istoriyalar" bo'limi (`/stories`) paneldan olib tashlangan (24.11.2026) — menyu, sahifa, komponentlar,
mock va API qatlamidagi funksiyalar yo'q; backend o'zgarmagan. Audit logdagi eski yozuvlar o'qilishi
uchun obyekt turi `story` ("Istoriya") va amal `story.remove` ("Istoriyani o'chirdi") nomlari qolgan.

## Qoida videosi

Mini App'dagi "Qoidalar" bo'limida eng tepada (qoidalar matnidan oldin) bitta tushuntirish videosi
turadi. U **Sozlamalar → Tanlov qoidalari** dagi "Qoida videosi" kartasida (bo'limlar muharriri
ustida, faqat `ADMIN`) boshqariladi. Video yuklanmagan bo'lsa Mini App'da faqat matn ko'rinadi.

- **Video yuklash** / **Almashtirish** — fayl tanlanadi (`video/mp4`, `video/quicktime` — iPhone .mov,
  `video/webm`; ko'pi bilan 100 MB). Tur va hajm yuborishdan oldin brauzerda tekshiriladi
  ([`src/lib/rules-video.ts`](src/lib/rules-video.ts)): brauzer turini bermasa — kengaytma bo'yicha
  (.mp4/.m4v, .mov, .webm). Yuklash jarayoni foizda ko'rsatiladi (`XMLHttpRequest`, sessiya cookie'si
  bilan). Almashtirilganda yangi `id` beriladi, eskisi serverda o'chiriladi.
- Video bor bo'lsa — ko'rish oynasi (`<video controls preload="metadata" playsInline>`), hajmi va
  formati, kim va qachon yuklagani; **O'chirish** — tasdiqlash oynasi bilan.
- Xatolar: har qanday `413` (backend yoki nginx'ning HTML sahifasi) — "Video juda katta", `422`
  (`RULES_VIDEO_INVALID`: video emas, bo'sh yoki buzilgan) — "Faylni video sifatida o'qib bo'lmadi".
- Audit: obyekt turi `settings` ("Qoida videosi"), amallar `settings.rules_video` (yuklash /
  almashtirish, oldin–keyin: tur va hajm) va `settings.rules_video_delete`.
- Telefon ko'rinishida ("Ilovada ko'rinishi") video bo'lsa, qoidalar ustida uning o'rni ko'rsatiladi.

| Funksiya (`src/lib/api.ts`) | Endpoint |
|---|---|
| `getRulesVideo()` | `GET /api/v1/admin/rules/video` → `RulesVideo \| null` (bo'sh tana ham `null`) |
| `uploadRulesVideo(file, onProgress)` | `PUT /api/v1/admin/rules/video` — tana faylning o'zi (multipart emas), `Content-Type` — video turi → `RulesVideo`; `onProgress(0–1)` |
| `deleteRulesVideo()` | `DELETE /api/v1/admin/rules/video` → `204` (video bo'lmasa ham) |
| `rulesVideoUrl(id)` | `GET /api/v1/miniapp/rules/video/:id` — ochiq endpoint, HTTP Range bilan (`<video src>`); eski `id` — 404 |

`RulesVideo` — [`src/lib/types.ts`](src/lib/types.ts): `id`, `mime`, `sizeBytes`, `updatedAt`, `updatedBy`
(xodimning to'liq ismi). Cheklovlar — `RULES_VIDEO_LIMITS` (backend bilan bir xil).

Mock rejimda video faqat sahifa xotirasida (`URL.createObjectURL`) — sahifa yangilansa yo'qoladi;
audit yozuvlari esa boshqa mock amallar kabi `localStorage` da qoladi. Mock ham backend kabi fayl
boshidagi baytlarni tekshiradi (video bo'lmasa — `422`).

## AI tekshiruvi

Menyuda **AI** (`/ai`, faqat `ADMIN`; kompyuterda "Yana" ichida). Admin konkurs videolarida nima
ko'rinishi (yoki ko'rinmasligi) kerakligini namuna rasmlar va mezonlar bilan beradi; worker har bir
videoni yuklab, kadrlarga ajratib (har 2 soniyada, 720p) Claude'dan xulosa so'raydi. **AI xulosasi
videoning tanlovdagi holatini o'zi o'zgartirmaydi** — bu moderatsiyaga yordam, sahifada ham shunday
yozilgan.

Sahifa ([`src/components/ai/`](src/components/ai/)):

1. **Sarlavha** va worker holati: "Worker ishlayapti" yoki "Worker o'chiq — videolar navbatda kutadi"
   (oxirgi signal vaqti bilan). Pastida — model, kadr oralig'i va ishonch chegarasi (backend `settings`).
2. **Sozlamalar (versiya N)**:
   - qoralama bo'lsa — namuna rasmlar (soni cheklanmaydi, texnik chegara — 400; kartada rasm, turi: "Ko'rinishi shart" /
     "Bo'lmasligi kerak" / "Ma'lumot uchun" — darhol saqlanadi, izoh — maydondan chiqqanda saqlanadi,
     o'chirish — tasdiqlash oynasi bilan), "Umumiy mezonlar" (0–5000 belgi, maydondan chiqqanda yoki
     "Saqlash" bilan) va tasdiqlash bloki: "Sinov (20 ta video)" (standart — eng ko'p ko'rilgan 20 ta,
     "Videolarni tanlash" oynasida o'zgartiriladi) yoki "Hammasi", **"Tasdiqlash"** — versiya
     qulflanishini tushuntiruvchi oyna bilan. Saqlanmagan mezon matni tasdiqlashdan oldin saqlanadi;
   - qoralama bo'lmasa — tasdiqlangan versiya (faqat ko'rish) va **"Yangi versiya"** (faol versiyadan
     nusxa); hech narsa bo'lmasa — "Sozlashni boshlash".
3. **Jarayon** (ishga tushirilgandan keyin): progress, tayyor / navbatda / ishlanmoqda / xato, xulosalar
   (qo'lda qaror yutadi), tokenlar va "$ sarflandi" (1 video o'rtacha narxi bilan). Navbat bo'lsa holat
   va natijalar har 3 soniyada yangilanadi. Sinov tugagach — **"Hammasini ishga tushirish"**.
4. **Natijalar**: yakuniy xulosa va holat bo'yicha filtr (sonlar `progress` dan), qidiruv (URL da:
   `verdict`, `state`, `q`, `page`), har bir video — ishtirokchi, Reel havolasi, belgi (TASDIQLANDI /
   RAD ETILDI / SHUBHALI), ishonch %, sabab, dalil kadrlari ("12-soniya", bosilsa kattalashadi) va qo'lda
   qaror: "Tasdiqlash" / "Rad etish" — izoh majburiy (3–500 belgi), belgi "Qo'lda: …" bo'ladi.

**Namuna rasm brauzerda tayyorlanadi** ([`src/lib/ai-image.ts`](src/lib/ai-image.ts)): rasm bo'lmagan
fayl va 100 MB dan kattasi rad etiladi, qolgani `canvas` da uzun tomoni ≤ 1600 px qilib JPEG (sifat
0,85; shaffof joylar oq) `data:` URL ga aylantiriladi. Kamdan-kam holatda 2 MB dan oshsa — bir marta 0,7
sifat bilan; baribir oshsa — xato. Ochilmaydigan format (masalan, Chrome'da HEIC) — tushunarli xato.

| Funksiya (`src/lib/api.ts`) | Endpoint |
|---|---|
| `getAiState()` | `GET /api/v1/admin/ai/state` → `AiState` |
| `createAiDraft()` | `POST /api/v1/admin/ai/draft` → `AiState` (qoralama bo'lsa — o'zgarmaydi) |
| `updateAiDraft({ criteria })` | `PUT /api/v1/admin/ai/draft` → `AiState`; audit `ai.draft.update` |
| `addAiReference({ dataUrl, kind, note })` | `POST /api/v1/admin/ai/draft/references` → `AiState`; audit `ai.reference.add` |
| `updateAiReference(id, { kind?, note? })` | `PATCH /api/v1/admin/ai/draft/references/:id` → `AiState` |
| `deleteAiReference(id)` | `DELETE /api/v1/admin/ai/draft/references/:id` → `AiState`; audit `ai.reference.remove` |
| `aiReferenceImageUrl(id)` | `GET /api/v1/admin/ai/references/:id/image` (`<img src>`, cookie bilan) |
| `getAiCandidates(search?)` | `GET /api/v1/admin/ai/candidates?search=` → `AiCandidate[]` (50 tagacha) |
| `approveAiDraft({ mode, trialShortcodes? })` | `POST /api/v1/admin/ai/approve` → `AiState`; audit `ai.approve`. Sinov ro'yxati faqat admin o'zgartirgan bo'lsa yuboriladi |
| `runAiForAll()` | `POST /api/v1/admin/ai/run-all` → `AiState`; audit `ai.run_all` |
| `getAiReviews(query)` | `GET /api/v1/admin/ai/reviews?verdict=&state=&search=&page=&pageSize=` → `AiReviewListResponse` |
| `aiFrameUrl(id, second)` | `GET /api/v1/admin/ai/reviews/:id/frames/:second` (`<img src>`; `hasFrame: false` da so'ralmaydi) |
| `decideAiReview(id, { decision, note })` | `POST /api/v1/admin/ai/reviews/:id/decision` → `AiReviewItem`; audit `ai.decision` (obyekt `reel`) |

Tiplar va cheklovlar (`AI_LIMITS`) — [`src/lib/types.ts`](src/lib/types.ts). Audit log'da amallar
o'zbekcha nomlanadi ([`src/lib/labels.ts`](src/lib/labels.ts)), `ai.decision` dagi qiymatlar ham
("Shubhali" → "Tasdiqlangan").

**Mock rejimda** worker vaqt bo'yicha taqlid qilinadi ([`src/lib/mock/ai.ts`](src/lib/mock/ai.ts)): 5 ta
parallel "yo'lak", har video 2,5–5,5 soniya; QUEUED → PROCESSING → DONE, ~6% — FAILED. Xulosa, ishonch
(0,8 dan past — SHUBHALI), sabab, dalillar va sarf (~$0,16 / video) shortcode bo'yicha deterministik;
kadrlar — chizilgan SVG ("mock kadr"). Worker doim "ishlayapti". "Hammasi" ishga tushgach keyin qabul
qilingan videolar ham navbatga qo'shiladi. Rasmlar brauzer xotirasida — to'lsa, `413` va tushunarli xato.

## G'oliblar

Tepadagi menyuda bitta bo'lim — **G'oliblar** (`/winner`), ikki tab. Alohida "Random tanlov" bo'limi
yo'q: voucher random tanlovi "Voucher" tabining ichida.

- *Asosiy sovrinlar* (`/winner`) — "Bosh sovrin — BYD Chazor": g'olibni aniqlash oqimi (joriy yetakchi,
  tekshiruvlar, tasdiqlash, e'lon); ostida "Boshqa asosiy sovrinlar" — Tailand sayohati, iPhone,
  Planshet kartalari (eni 350, bo'yi 400 px, yonma-yon; ro'yxat karta ichida aylanadi, tor telefonda
  karta ekranga sig'adigan qilib qisqaradi). Bular **random emas** — reyting bo'yicha
  (`GET /api/v1/admin/winner/prizes`).
- *Voucher* (`/winner?tab=voucher`) — **faqat 500 000 so'mlik Korzinka voucheri random**:
  - tepada — voucherlar qoldig'i (jami / yuborilgan / tasdiqlangan / qoralamada, bosqichlar bo'yicha);
  - "Yangi tanlov": "Sozlamalar" bir marta tasdiqlanadi (`PUT /api/v1/admin/draws/settings`), keyin
    qisqa xulosa ko'rinadi va "Tahrirlash" bilan o'zgartiriladi — har tanlovda qayta kiritilmaydi.
    Har tanlovda faqat bosqich (1-, 2-, 3-bosqich) yoki admin yaratgan davr tanlanadi. **"Tanlash"
    bitta bosishda** tanlovni o'tkazadi (`POST /api/v1/admin/draws`: saqlangan sozlamalar + davr) va
    natijani shu tabning o'zida, "Yangi tanlov" o'rnida ochadi: xulosa, uch qadam (o'tkazildi →
    tasdiqlash → botda yuborish), texnik ma'lumot va g'oliblar ro'yxati (almashtirish, bekor qilish —
    avvalgidek). "Yangi tanlov" tugmasi formaga qaytaradi. Nomzodlar soni (`POST /admin/draws/preview`)
    faqat ma'lumot uchun, alohida qadam emas;
  - o'ng ustunda (1280px dan; torroq ekranda — pastda) "Tanlovlar tarixi" — bosilsa, o'sha tanlov
    natijasi ochiladi — va adolatli tanlov izohi;
  - pastda — "Voucher g'oliblari": bekor qilinmagan barcha tanlovlar g'oliblari, tanlov bo'yicha
    (holati, ism, telefon, ko'rishlar, qidiruv), har biridan "Natijani ochish".
  - **Voucher olganlar qatnashmaydi** — bir kishiga aksiya davomida bir marta. Bu qoida o'chirilmaydi
    (sozlamalarda qulf bilan ko'rsatiladi): bekor qilinmagan istalgan tanlovning (qoralama,
    tasdiqlangan, yuborilgan) faol g'oliblari keyingi tanlovlarga kirmaydi; "Chetda qolganlar"da
    "Voucher olgan (qayta berilmaydi)" bo'lib sanaladi.
- URL ([`src/lib/winner-links.ts`](src/lib/winner-links.ts)): `?tab=voucher`, ochiq tanlov —
  `&draw=<id>` (brauzerning "Orqaga" tugmasi ishlaydi); eski `?tab=vouchers` ham "Voucher" tabini
  ochadi. Eski "Random tanlov" havolalari brauzerda yo'naltiriladi ([`src/app/draws/`](src/app/draws/),
  panel layout'idan tashqarida): `/draws` → `/winner?tab=voucher`, `/draws?id=X` →
  `/winner?tab=voucher&draw=X`, `/draws?prize=…` → `/winner`.

| Funksiya (`src/lib/api.ts`) | Endpoint |
|---|---|
| `getDrawSetup()` | `GET /api/v1/admin/draws/setup` → `DrawSetup` (`saved: SavedDrawSettings \| null`) |
| `saveDrawSettings(input)` | `PUT /api/v1/admin/draws/settings`, body `DrawSettingsInput` → `DrawSetup`; audit `draw.settings.update` |
| `runDraw(settings)` | `POST /api/v1/admin/draws` → `VoucherDraw` (`excludePreviousWinners` har doim `true`) |
| `getRatingPrizes()` | `GET /api/v1/admin/winner/prizes` → `RatingPrizes` |

## Rollar

| Rol | Ko'radigan bo'limlar |
|---|---|
| `ADMIN` | Hammasi |
| `SUPPORT` | Faqat Support |

Menyu va sahifalarga kirish [`src/lib/navigation.ts`](src/lib/navigation.ts) da sozlanadi.
Bu faqat UI darajasidagi cheklov — haqiqiy himoya backend RBAC'da bo'ladi.

## Tuzilma

```text
src/
├── app/
│   ├── login/            # login sahifasi
│   ├── draws/            # eski /draws havolalari → /winner?tab=voucher (brauzerda yo'naltirish)
│   ├── (panel)/          # sessiya talab qiladigan sahifalar + umumiy layout
│   │   ├── dashboard/
│   │   ├── users/
│   │   ├── ratings/
│   │   ├── winner/       # G'oliblar: "Asosiy sovrinlar" va "Voucher" tablari
│   │   ├── ai/           # AI tekshiruvi: namuna rasmlar, mezonlar, jarayon, natijalar
│   │   └── support/
│   ├── layout.tsx        # ildiz layout
│   └── globals.css       # Tailwind va dizayn tokenlari
├── components/
│   ├── dashboard/        # davr filtri, ko'rsatkich kartalari, kunlik grafik
│   ├── layout/           # yon menyu, sarlavha, logotip
│   ├── providers/        # TanStack Query provayderi
│   ├── ratings/          # kunlik reyting: sana tanlash, jadval, o'rin o'zgarishi
│   ├── support/          # murojaatlar ro'yxati, yozishma, javob va holat
│   ├── targets/          # target yoqqanlar: ro'yxat, dalil oynasi, qarorlar
│   ├── telegram/         # xabarlar holati (yuborildi/yetkazildi/o'qildi), qayta yuborish
│   ├── draws/            # voucher random tanlovi qismlari: sozlamalar, bosqich, nomzodlar, natija, qoldiq
│   ├── prizes/           # asosiy sovrinlar (reyting bo'yicha): ikonkalar, soni
│   ├── winner/           # g'oliblar: bosh sovrin oqimi, asosiy sovrinlar, "Voucher" tabi (tanlov, tarix, g'oliblar)
│   ├── settings/         # tanlov muddati, yangilanish vaqti, minimal yosh, qoidalar, qoida videosi
│   ├── ai/               # AI tekshiruvi: sozlamalar (versiya), rasm kartalari, sinov videolari, jarayon, natijalar
│   ├── audit/            # audit log (faqat o'qish)
│   ├── users/            # ishtirokchilar jadvali, filtrlar, amal oynasi, "Videolar" oynasi
│   └── ui/               # tugma, input, select, dialog, amallar menyusi, sahifalash...
└── lib/
    ├── api.ts            # YAGONA API qatlami: http yoki mock implementatsiyani tanlaydi
    ├── api.http.ts       # haqiqiy backend (fetch, cookie sessiya)
    ├── api.mock.ts       # mock implementatsiya
    ├── api-error.ts
    ├── auth-context.tsx  # joriy xodim, chiqish, 401 da login sahifasiga
    ├── dates.ts          # tanlov kunlari (Asia/Tashkent)
    ├── format.ts         # raqam va sana formatlari
    ├── rules-video.ts    # qoida videosi: format aniqlash, yuklashdan oldingi tekshiruv
    ├── ai-image.ts       # AI namuna rasmi: tekshiruv va kichraytirish (canvas → JPEG data URL)
    ├── labels.ts         # holatlar nomlari va ranglari
    ├── navigation.ts     # menyu, rollar
    ├── period.ts         # dashboard davri (URL bilan)
    ├── users-filters.ts  # Foydalanuvchilar filtrlari (URL bilan)
    ├── winner-links.ts   # G'oliblar tablari va ochiq tanlov manzillari
    ├── types.ts          # API tiplari
    └── mock/             # mock backend: ma'lumotlar, reyting, amallar, audit
```
