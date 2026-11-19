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

## Backend bilan aloqa

- Barcha so'rovlar faqat [`src/lib/api.ts`](src/lib/api.ts) da.
- `VITE_API_URL` bo'sh → mock rejim ([`src/lib/mock/store.ts`](src/lib/mock/store.ts),
  holat `localStorage` da, "Boshidan boshlash" tugmasi bilan tozalanadi). Yuborilgan video
  4 soniya "Tekshirilmoqda" bo'ladi, keyin qabul qilinadi; shortcode `notfound` bilan
  boshlansa (masalan, `https://www.instagram.com/reel/notfound1/`) — rad etiladi.
- `VITE_API_URL=http://localhost:3000/api/v1` → haqiqiy backend. Har bir so'rov
  `X-Telegram-Init-Data` sarlavhasi bilan ketadi; backend uni bot tokeni bilan tekshiradi.
  Shuning uchun haqiqiy rejim faqat Telegram ichida ishlaydi.

## Telegram ichida sinash

Telegram Mini App faqat **https** manzilni ochadi. Lokal sinov uchun:

1. `npm run dev` va tunnel (masalan, cloudflared yoki ngrok) orqali 3002-portga https manzil oling.
2. Backend `.env` ida `TELEGRAM_MINIAPP_URL` ga shu manzilni yozing.
3. Botda `/start` — "Tanlovni ochish" tugmasi Mini App'ni ochadi.

## Dizayn

Ranglar va o'lchamlar [`src/index.css`](src/index.css) dagi `@theme` tokenlarida — Flutter
ilovadagi `app_theme.dart` bilan bir xil. Sovrin kartasidagi avtomobil rasmi
`src/assets/hero_car.png` — foydalanish huquqi hali tasdiqlanmagan.
