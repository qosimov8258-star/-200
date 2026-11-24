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
  holatlari, target bo'yicha qarorlar, istoriyani o'chirish) va ularning audit yozuvlari ham `localStorage` da
  (`reels-admin:mock-store` kaliti). Mock ma'lumotlarni boshlang'ich holatga qaytarish uchun
  shu kalitni o'chiring.
- Istoriyalar ([`src/lib/mock/stories.ts`](src/lib/mock/stories.ts)) — 8 ta ishtirokchining 1–3 tadan
  istoriyasi, sahifa ochilgan vaqtga nisbatan oxirgi 24 soat ichida yuklangan (sahifa ochiq tursa,
  muddati tugaganlari ro'yxatdan tushadi). Video o'rniga
  [`public/mock/stories/`](public/mock/stories/) dagi kichik namunaviy kliplar (9:16, 4 soniya,
  ffmpeg'da yasalgan) ko'rsatiladi. Ular statik eksportga ham tushadi (~60 KB), lekin `http`
  rejimda ishlatilmaydi.
- Random tanlov sozlamalari va o'tkazilgan tanlovlar ham shu `localStorage` kalitida
  (`drawSettings`, `draws`). Asosiy sovrinlar (`GET /admin/winner/prizes`) mock reytingdan
  hisoblanadi ([`src/lib/mock/rating-prizes.ts`](src/lib/mock/rating-prizes.ts)) — mock'da
  ko'rishlar kam, shuning uchun odatda faqat "Planshet" oralig'ida ishtirokchi bo'ladi.

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

## Istoriyalar

Ishtirokchilar Mini App'dan o'z qisqa videosini (istoriya) yuklaydi — uni Mini App va saytga
kirgan hamma (mehmonlar ham) ko'radi. Istoriya 24 soat turadi (`expiresAt = createdAt + 24h`),
keyin server faylni o'chiradi. Tekshiruvdan o'tmaydi, reyting va sovg'alarga ta'sir qilmaydi.
Cheklovlar (backend): `video/mp4`, `video/quicktime` (iPhone .mov), `video/webm`, ko'pi bilan
50 MB, bir ishtirokchida ko'pi bilan 10 ta faol istoriya. Bloklangan va diskvalifikatsiya
qilinganlarning istoriyalari ko'rinmaydi.

"Istoriyalar" sahifasi (`/stories`, faqat `ADMIN`):

- faol istoriyalar kartalarda, eng yangisi birinchi, 12 tadan sahifalab; ro'yxat har daqiqada
  o'zi yangilanadi;
- har bir kartada video (ovozsiz, boshqaruvlar bilan, `preload="metadata"` — faqat metadata
  oldindan yuklanadi), ishtirokchi ismi va telefoni, yuklangan vaqt ("3 soat oldin"),
  yo'qolishiga qolgan vaqt ("5 soat 20 daqiqa qoldi", tepadagi chiziq ham shuni ko'rsatadi),
  hajmi va formati (MP4 / MOV / WebM);
- **O'chirish** — sabab majburiy (5–500 belgi), audit logga `story.remove` bo'lib yoziladi
  (obyekt turi — "Istoriya"). Karta qayta so'rovni kutmasdan darhol yo'qoladi.

| Funksiya (`src/lib/api.ts`) | Endpoint |
|---|---|
| `getStories({ page, pageSize })` | `GET /api/v1/admin/stories?page=&pageSize=` → `Page<AdminStoryItem>` |
| `removeStory(id, reason)` | `POST /api/v1/admin/stories/:id/remove`, body `{ reason }` → `204`; `404` — muddati tugagan yoki o'chirilgan |
| `storyVideoUrl(id)` | `GET /api/v1/miniapp/stories/:id/video` — ochiq endpoint, HTTP Range bilan (`<video src>`) |

`AdminStoryItem` — [`src/lib/types.ts`](src/lib/types.ts): `id`, `participant { id, fullName, phone }`
(`id` — telegramId), `createdAt`, `expiresAt`, `sizeBytes`, `mime`.

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

## G'oliblar va Random tanlov

Tepadagi menyuda ikkita alohida bo'lim (kompyuterda ikkalasi ham doim ko'rinadi):

- **Random tanlov** (`/draws`) — tepada sovg'a tanlanadi. **Faqat 500 000 so'mlik Korzinka voucheri
  random**; avtomobil, sayohat, iPhone va planshet — random emas, reyting bo'yicha (kartalardagi
  "Random" / "Reyting bo'yicha" belgilari).
  - *Voucher:* "Sozlamalar" bir marta tasdiqlanadi (`PUT /api/v1/admin/draws/settings`), keyin
    qisqa xulosa ko'rinadi va "Tahrirlash" bilan o'zgartiriladi — har tanlovda qayta kiritilmaydi.
    Har tanlovda faqat bosqich (1-, 2-, 3-bosqich) yoki admin yaratgan davr tanlanadi. **"Tanlash"
    bitta bosishda** tanlovni o'tkazadi (`POST /api/v1/admin/draws`: saqlangan sozlamalar + davr) va
    natijani darhol ochadi (qoralama → tasdiqlash → botda yuborish, almashtirish, bekor qilish —
    avvalgidek). Nomzodlar soni (`POST /admin/draws/preview`) faqat ma'lumot uchun, alohida qadam emas.
  - **Voucher olganlar qatnashmaydi** — bir kishiga aksiya davomida bir marta. Bu qoida o'chirilmaydi
    (sozlamalarda qulf bilan ko'rsatiladi): bekor qilinmagan istalgan tanlovning (qoralama,
    tasdiqlangan, yuborilgan) faol g'oliblari keyingi tanlovlarga kirmaydi; "Chetda qolganlar"da
    "Voucher olgan (qayta berilmaydi)" bo'lib sanaladi.
  - *Asosiy sovrin* tanlansa: qoida va "G'oliblarni ko'rsatish" tugmasi — bir bosishda
    `GET /api/v1/admin/winner/prizes` dan shu sovrin g'oliblari (o'rin, ism, telefon, Instagram,
    ko'rishlar, Reel, target / nakrutka belgilari) va "Navbatdagilar".
  - URL: `?id=` — tanlov natijasi, `?prize=car|travel|phone|tablet` — asosiy sovrin.
- **G'oliblar** (`/winner`), ikki tab (`?tab=vouchers`):
  - *Asosiy sovrinlar* — "Bosh sovrin — BYD Chazor": g'olibni aniqlash oqimi (joriy yetakchi,
    tekshiruvlar, tasdiqlash, e'lon); ostida Tailand sayohati, iPhone, Planshet ro'yxatlari (reyting bo'yicha).
  - *Voucher g'oliblari* — bekor qilinmagan barcha random tanlovlar g'oliblari, tanlov bo'yicha
    (holati, ism, telefon, ko'rishlar, qidiruv), har biridan Random tanlovdagi natijaga havola.

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
│   ├── (panel)/          # sessiya talab qiladigan sahifalar + umumiy layout
│   │   ├── dashboard/
│   │   ├── users/
│   │   ├── ratings/
│   │   ├── stories/
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
│   ├── draws/            # random tanlov: sovg'a tanlash, sozlamalar, bosqich, natija, tarix
│   ├── prizes/           # asosiy sovrinlar (reyting bo'yicha) jadvali — draws va winner uchun umumiy
│   ├── winner/           # g'oliblar: bosh sovrin oqimi, asosiy sovrinlar, voucher g'oliblari
│   ├── settings/         # tanlov muddati, yangilanish vaqti, minimal yosh, qoidalar, qoida videosi
│   ├── stories/          # istoriyalar: video kartalar, o'chirish oynasi
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
    ├── labels.ts         # holatlar nomlari va ranglari
    ├── navigation.ts     # menyu, rollar
    ├── period.ts         # dashboard davri (URL bilan)
    ├── users-filters.ts  # Foydalanuvchilar filtrlari (URL bilan)
    ├── types.ts          # API tiplari
    └── mock/             # mock backend: ma'lumotlar, reyting, amallar, audit
public/
└── mock/stories/         # mock rejimdagi namunaviy istoriya kliplari
```
