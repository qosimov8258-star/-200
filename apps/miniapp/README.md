# Telegram Mini App (`apps/miniapp`)

Ishtirokchilar uchun ilova — Telegram bot ichida ochiladi. Ro'yxatdan o'tish, Instagram
ulash, Reel linkini yuborish, reyting va video statistikasi shu yerda. Support yozishmasi
Mini App'da emas, bot chatida.

Stek: React 19, Vite, TypeScript (strict), Tailwind CSS 4, TanStack Query, lucide-react.

## Ishga tushirish

```bash
cd apps/miniapp
npm install
npm run dev
```

Brauzerda: <http://localhost:3002>. Telegram'dan tashqarida ochilganda yuqorida sariq
"Dev rejim" yozuvi chiqadi va soxta ma'lumotlar ishlatiladi.

| Buyruq | Vazifa |
|---|---|
| `npm run dev` | Dev server (3002-port) |
| `npm run build` | Production build (`dist/`) |
| `npm run typecheck` | TypeScript tekshiruvi |
| `npm run lint` | oxlint |

## Ro'yxatdan o'tish oqimi

1. Foydalanuvchi botda `/start` bosadi → **raqamini ulashadi** (bot faqat o'z raqamini qabul qiladi).
2. Mini App ochiladi → **ism, familiya, yosh** (bir marta, keyin qulflanadi).
3. **Qoidalarga rozilik**.
4. Asosiy ekranlar: Asosiy (istoriyalar) · Reyting · Video · Profil.

Raqamni Mini App ichidan ham so'rash mumkin (`requestContact`) — Telegram uni baribir botga
yuboradi, Mini App esa holat o'zgarguncha `GET /me` ni qayta so'raydi.

## Qoidalar videosi

Admin panelda (Sozlamalar → Tanlov qoidalari) yuklangan tushuntirish videosi "Tanlov qoidalari"
ekranida (ro'yxatdan o'tishdagi rozilik qadami ham) qoidalar ustida, eng tepada ko'rsatiladi:
`GET /miniapp/rules` → `video: { id, mime } | null`, fayl — `rulesVideoUrl(id)`
(`GET /miniapp/rules/video/:id`). Video yo'q bo'lsa — hech narsa qo'shilmaydi. Mock rejimda —
namunaviy klip (`public/stories/sample-3.mp4`).

## Videolar ("Video" bo'limi)

Ishtirokchi **xohlagancha** Reel linki yuboradi (`GET`/`POST /miniapp/reels`). Har bir video
alohida tekshiriladi va ko'rishlari alohida yig'iladi. Reytingda **har bir qabul qilingan video —
alohida qator** (pastda, "Reyting"). Ishtirokchining o'rni va asosiy sovrinlar uchun esa uning
**eng ko'p ko'rilgan bitta qabul qilingan** videosi hisoblanadi — videolar ko'rishlari
**qo'shilmaydi** (`MyReels.bestViews`; bunday video yo'q bo'lsa — 0; `MyReels.rank` — shu
videoning reytingdagi o'rni). Ikki video teng bo'lsa, oldinroq yuborilgani hisoblanadi.

Ekranda: natija (eng ko'p ko'rilgan video ko'rishlari, o'rin va uning o'zgarishi, oxirgi o'sish
va kunlik o'sish grafigi — shu video bo'yicha), har doim ko'rinadigan "Yangi video qo'shing"
maydoni va barcha videolar ro'yxati (holati, rad etilgan bo'lsa — sababi, ko'rishlari, qabul
qilinganida — reytingdagi o'z o'rni, masalan "12-o'rin" (`MyReelItem.rank`), Instagram'da
ochiladigan link). Ro'yxat tartibi serverdan keladi:

1. qabul qilinganlar — ko'rishlar bo'yicha kamayib (teng bo'lsa — oldinroq yuborilgani);
   birinchisi — eng yaxshi natija (`best: true`, o'rningiz shu bo'yicha) va "Eng yaxshi natija"
   belgisi bilan ajratiladi;
2. hali hal qilinmaganlar (tekshirilmoqda, qo'lda tekshirilmoqda) — yangisi tepada;
3. rad etilganlar — yangisi tepada.

Tekshiruvni kutayotgan har bir video ("Tekshirilmoqda", "Qo'lda tekshirilmoqda") ostida izoh
chiqadi: "Videolar haftada bir marta tekshiriladi — tekshiruvdan so'ng reytingdagi o'rningiz
aniqlanadi." Davr `MyReels.syncEveryDays` dan: 7 — "haftada bir marta", 1 — "har kuni", boshqasi —
"har N kunda" (0 — jadval yo'q, izoh chiqmaydi). Shu so'z "Ko'rishlar … yangilanadi" satrida ham.

Yangi yuborilgan video (10 daqiqagacha) tekshiruvda bo'lsa, ro'yxat har 5 soniyada, eskiroq
kutayotgan yoki qo'lda tekshiruvdagi video bo'lsa — har daqiqada qayta so'raladi.

Takror yuborish: o'zingizning hali rad etilmagan videongiz — `REEL_ALREADY_SUBMITTED`,
boshqa ishtirokchiniki — `REEL_TAKEN`. Rad etilgan videoni qayta yuborish mumkin (eski yozuv
almashtiriladi).

## Istoriyalar (Istoriya)

Instagram istoriyalari kabi: ishtirokchi o'zi haqidagi qisqa **videoni** joylaydi, Mini App yoki
saytni ochgan har kim (kirmagan mehmon ham) uni ko'radi. Tekshirilmaydi, reyting va sovrinlarga
kirmaydi — shunchaki kontent.

- **Asosiy** ekranda, salomlashuv ostida — aylanalar qatori (bosh harflar, rangi muallifga qarab).
  Ko'rilmagan istoriyasi bor aylana — brend ranglaridagi halqa, hammasi ko'rilgan — kulrang va
  qator oxiriga suriladi. "Ko'rilgan" belgisi faqat shu brauzerda: `localStorage`
  (`reels-miniapp:stories-seen`, kalit — `authorKey/storyId`), muddati o'tganlari o'zi tozalanadi.
- Birinchi aylana — **"Istoriya qo'shish"** (faqat ro'yxatdan o'tgan faol ishtirokchiga): galereyadan
  video tanlanadi (`accept="video/mp4,video/quicktime,video/webm,video/*"`). Tur (MP4, MOV, WebM;
  tur bo'sh bo'lsa — kengaytmaga qaraladi) va hajm (≤ 50 MB) shu yerning o'zida tekshiriladi.
  Yuklanayotganda aylanada foiz va to'layotgan halqa; boshqa bo'limga o'tib qaytilsa ham saqlanadi
  (`src/lib/story-upload.ts`). Xatolar qator ostida o'zbekcha.
- **O'z istoriyalarim** qatorda alohida aylana bo'lib chiqmaydi — ular salomlashuvdagi avatar
  (o'ng tomondagi bosh harflar) orqali ochiladi: istoriya bo'lsa, avatar halqasi istoriya ranglarida
  (hammasi ko'rilgan bo'lsa — kulrang) va bosilganda ko'ruvchi ochiladi, keyin boshqalarniki davom
  etadi. Holat (`src/lib/use-story-feed.ts`) va ko'ruvchi — `HomeScreen` da.
- Cheklovlar (backend bilan bir xil): 24 soat yashaydi; bir vaqtda ko'pi bilan 10 ta faol istoriya;
  o'z istoriyasini o'chirish mumkin.
- **Ko'ruvchi** (to'liq ekran): tepada har bir istoriya uchun chiziq, muallif va "N soat oldin".
  Video ovozsiz o'zi boshlanadi (brauzerlar ovozli avtoijroni bloklaydi), tugma bilan ovoz yoqiladi
  (tanlov sahifa yangilanguncha eslab qolinadi). O'ngga bosish — keyingisi, chapga (ekranning 30 %)
  — oldingisi; tugagach o'zi keyingisiga, oxirgisidan keyin — keyingi muallifga o'tadi. Ushlab
  turish — pauza, yonga surish — boshqa muallif, pastga surish, ✕, Escape yoki Telegram "Orqaga" —
  yopish. O'z istoriyasida — o'chirish (tasdiqlash bilan). Video ochilmasa (muddati tugagan yoki
  o'chirilgan — 404) qisqa xabar chiqadi va keyingisiga o'tiladi.

Endpointlar (`src/lib/api.ts`):

| Funksiya | So'rov |
|---|---|
| `getStories()` | `GET /miniapp/stories` — ochiq; `StoryGroup[]` (o'z guruhim birinchi, keyin eng yangisi bo'yicha) |
| `uploadStory(file, onProgress)` | `POST /miniapp/stories` — tana **videoning o'zi** (multipart emas), `Content-Type` — fayl turi; XMLHttpRequest (foiz uchun). Xatolar: 403 `UNAUTHORIZED`, har qanday 413 → `STORY_TOO_LARGE`, 422 `STORY_INVALID_FILE`, 429 `STORY_LIMIT` |
| `deleteStory(id)` | `DELETE /miniapp/stories/:id` — 204; 404 `NOT_FOUND` |
| `storyVideoUrl(id)` | `GET /miniapp/stories/:id/video` — ochiq, Range bilan; `<video src>` uchun manzil |

Mock rejimda: bir nechta soxta ishtirokchining namunaviy istoriyalari — `public/stories/sample-*.mp4`
(ffmpeg bilan yasalgan, 360×640, 4 soniya, ~50 KB). O'zingiz yuklaganlar faqat xotirada
(`URL.createObjectURL`), sahifa yangilansa yo'qoladi; 10 ta chegara va 24 soat muddat ham
taqlid qilinadi, yuklanish foizi ~1,5 soniyada o'sadi.

> Serverda nginx yuklash manzili uchun alohida chegara qo'yadi (`deploy/web.conf`,
> `location = /api/v1/miniapp/stories`); undan oshsa nginx HTML bilan 413 qaytaradi — ilova uni
> ham "juda katta" deb ko'rsatadi.

## Reyting

`GET /miniapp/rating` — **har bir qabul qilingan video alohida qator** (`RatingEntry`: o'rin,
egasining ismi, shu videoning ko'rishlari va o'rin o'zgarishi). Shuning uchun bir ism bir necha
marta chiqishi, o'zingizning har bir videongiz alohida "Siz" qatori bo'lishi mumkin; video
linklari ommaviy reytingda berilmaydi. Qator kaliti — `rank` (ism takrorlanadi). Ekranda bu
haqda izoh bor, har bir qatorda video belgisi.

- "Mening o'rnim" va "Men atrofimda" — birinchi `isMe` qatori, ya'ni eng ko'p ko'rilgan videongiz.
- Ishtirokchilarning o'rinlari orasida raqamlar tushib qolishi mumkin (masalan, 1, 4, 5…) —
  bu kutilgan holat. Sovrinlar va g'olib baribir ishtirokchi bo'yicha (bitta ishtirokchi —
  bitta asosiy sovrin).

## Backend bilan aloqa

- Barcha so'rovlar faqat [`src/lib/api.ts`](src/lib/api.ts) da.
- `VITE_API_URL` bo'sh → mock rejim ([`src/lib/mock/store.ts`](src/lib/mock/store.ts),
  holat `localStorage` da, "Boshidan boshlash" tugmasi bilan tozalanadi; eski — bitta videoli
  holat o'zi ro'yxatga ko'chiriladi). Har bir yuborilgan video 4 soniya "Tekshirilmoqda"
  bo'ladi, keyin qabul qilinadi. Shortcode `notfound` bilan boshlansa (masalan,
  `https://www.instagram.com/reel/notfound1/`) — "Qo'lda tekshirilmoqda", `photo` bilan —
  "Reel emas" deb rad etiladi, `taken` bilan — "boshqa ishtirokchi yuborgan" xatosi
  (`REEL_TAKEN`). O'zingiz yuborgan (rad etilmagan) linkni qayta yuborish —
  `REEL_ALREADY_SUBMITTED`. Mock reytingda ba'zi soxta ishtirokchilarning 2–3 ta videosi bor,
  o'zingizning har bir qabul qilingan videongiz esa ko'rishlariga qarab alohida qator bo'lib qo'shiladi.
  Ko'rishlar jadvali — haftada bir marta (`syncEveryDays: 7`). Istoriyalar mock'i — yuqorida,
  "Istoriyalar" bo'limida.
- `VITE_API_URL=http://localhost:3000/api/v1` → haqiqiy backend. Telegram ichida har bir so'rov
  `X-Telegram-Init-Data` sarlavhasi bilan ketadi; backend uni bot tokeni bilan tekshiradi.

## Veb-sayt (oddiy brauzerda)

Xuddi shu ilova — bot bilan bir xil vazifa va bir xil akkaunt:

- **Kirish** — mehmonning "Profil" kartasi: "Saytdan ro'yxatdan o'tish", ostida "Telegram bot orqali"
  va bitta tugma — rasmiy Telegram Login Widget (boshqa havola yo'q). Backend imzoni tekshirib,
  `HttpOnly` sessiya cookie'sini qo'yadi (30 kun). Mock rejimda widget o'rniga sinov tugmasi.
- **Raqam** — "Botda raqamni ulashish": bot chati `t.me/<bot>?start=web` bilan ochiladi, raqam
  o'sha yerda ulashiladi, sayt o'zi yangilanadi.
- **Support** — bot chatini ochadi; **Profil → Saytdan chiqish** — sessiyani yopadi.
- Widget faqat @BotFather → `/setdomain` da ko'rsatilgan domenda ishlaydi (localhost'da emas).

## Telegram ichida sinash

Telegram Mini App faqat **https** manzilni ochadi. Lokal sinov uchun:

1. `npm run dev` va tunnel (masalan, cloudflared yoki ngrok) orqali 3002-portga https manzil oling.
2. Backend `.env` ida `TELEGRAM_MINIAPP_URL` ga shu manzilni yozing.
3. Botda `/start` — "Tanlovni ochish" tugmasi Mini App'ni ochadi.

## Dizayn

Ranglar va o'lchamlar [`src/index.css`](src/index.css) dagi `@theme` tokenlarida — Flutter
ilovadagi `app_theme.dart` bilan bir xil. Sovrin kartasidagi avtomobil rasmi
`src/assets/hero_car.png` — foydalanish huquqi hali tasdiqlanmagan.
