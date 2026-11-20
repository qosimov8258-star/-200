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
4. Asosiy ekranlar: Reyting · Videom · Profil.

Raqamni Mini App ichidan ham so'rash mumkin (`requestContact`) — Telegram uni baribir botga
yuboradi, Mini App esa holat o'zgarguncha `GET /me` ni qayta so'raydi.

## Videolar ("Videom")

Ishtirokchi **xohlagancha** Reel linki yuboradi (`GET`/`POST /miniapp/reels`). Har bir video
alohida tekshiriladi va ko'rishlari alohida yig'iladi; reyting, o'rin va asosiy sovrinlar uchun
**qabul qilingan** videolar ko'rishlari qo'shiladi. Ekranda: umumiy natija (jami ko'rishlar,
o'rin va uning o'zgarishi, kunlik o'sish grafigi — barcha qabul qilingan videolar bo'yicha),
har doim ko'rinadigan "Yangi video qo'shing" maydoni va barcha videolar ro'yxati (yangisi
tepada: holati, rad etilgan bo'lsa — sababi, ko'rishlari, Instagram'da ochiladigan link).
Biror video tekshiruvda bo'lsa, ro'yxat har 5 soniyada (qo'lda tekshiruvda — har daqiqada)
qayta so'raladi.

Takror yuborish: o'zingizning hali rad etilmagan videongiz — `REEL_ALREADY_SUBMITTED`,
boshqa ishtirokchiniki — `REEL_TAKEN`. Rad etilgan videoni qayta yuborish mumkin (eski yozuv
almashtiriladi).

## Backend bilan aloqa

- Barcha so'rovlar faqat [`src/lib/api.ts`](src/lib/api.ts) da.
- `VITE_API_URL` bo'sh → mock rejim ([`src/lib/mock/store.ts`](src/lib/mock/store.ts),
  holat `localStorage` da, "Boshidan boshlash" tugmasi bilan tozalanadi; eski — bitta videoli
  holat o'zi ro'yxatga ko'chiriladi). Har bir yuborilgan video 4 soniya "Tekshirilmoqda"
  bo'ladi, keyin qabul qilinadi. Shortcode `notfound` bilan boshlansa (masalan,
  `https://www.instagram.com/reel/notfound1/`) — "Qo'lda tekshirilmoqda", `photo` bilan —
  "Reel emas" deb rad etiladi, `taken` bilan — "boshqa ishtirokchi yuborgan" xatosi
  (`REEL_TAKEN`). O'zingiz yuborgan (rad etilmagan) linkni qayta yuborish —
  `REEL_ALREADY_SUBMITTED`.
- `VITE_API_URL=http://localhost:3000/api/v1` → haqiqiy backend. Telegram ichida har bir so'rov
  `X-Telegram-Init-Data` sarlavhasi bilan ketadi; backend uni bot tokeni bilan tekshiradi.

## Veb-sayt (oddiy brauzerda)

Xuddi shu ilova — bot bilan bir xil vazifa va bir xil akkaunt:

- **Kirish** — "Telegram orqali kirish" (rasmiy Telegram Login Widget). Backend imzoni tekshirib,
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
