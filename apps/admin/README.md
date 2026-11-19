# Admin panel (`apps/admin`)

Reels tanlov ilovasining zavod xodimlari uchun veb admin paneli (TZ, 6-bo'lim).
Stek: Next.js (App Router), TypeScript (strict), Tailwind CSS, TanStack Query,
lucide-react ikonkalari.

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
| `npm run dev` | Dev server (3001-port) |
| `npm run build` | Production build |
| `npm run start` | Build'ni ishga tushirish (3001-port) |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript tekshiruvi |

> Hozircha panel alohida npm loyihasi. Repo ildizida pnpm workspace sozlangach
> (PLAN.md, Faza 0) buyruqlar `pnpm --filter admin <buyruq>` ga o'tadi.

## Mock rejim

Backend hali tayyor emas, shuning uchun panel **mock (soxta) ma'lumotlar** bilan ishlaydi.

- Barcha API chaqiruvlari faqat [`src/lib/api.ts`](src/lib/api.ts) da. Komponentlar
  backendga to'g'ridan-to'g'ri `fetch` qilmaydi.
- Mock ma'lumotlar [`src/lib/mock/`](src/lib/mock/) da. Test login ma'lumotlari
  [`src/lib/mock/db.ts`](src/lib/mock/db.ts) da (faqat lokal mock uchun).
- Tanlov ma'lumotlari ([`src/lib/mock/contest.ts`](src/lib/mock/contest.ts)) deterministik
  generatsiya qilinadi va bugungi sanaga bog'lanadi: tanlov 24 kun oldin boshlangan,
  140 ta o'ylab topilgan ishtirokchi, Reellar, kunlik ko'rishlar, target va murojaatlar.
- Mock sessiya brauzerning `localStorage` ida saqlanadi.
- Admin amallari (bloklash, blokdan chiqarish, diskvalifikatsiya, support javoblari va
  holatlari, target bo'yicha qarorlar) va ularning audit yozuvlari ham `localStorage` da
  (`reels-admin:mock-store` kaliti). Mock ma'lumotlarni boshlang'ich holatga qaytarish uchun
  shu kalitni o'chiring.

**Backend tayyor bo'lganda:** faqat `src/lib/api.ts` almashtiriladi — funksiya nomlari va
imzolari saqlanadi, har bir funksiya ustidagi `@endpoint` backend manzilini ko'rsatadi.
Keyin `IS_MOCK_API = false`, `mockControls = null` qilinadi va `src/lib/mock/` papkasi o'chiriladi.

**Mock boshqaruvlari:** G'olib sahifasida "Tanlovni tugagan deb ko'rish" tugmasi bor — mock'da
tanlov hali tugamagan, oqimni sinash uchun. U faqat `mockControls` bo'lsa ko'rinadi.
Tiplar ([`src/lib/types.ts`](src/lib/types.ts)) va xatolar
([`src/lib/api-error.ts`](src/lib/api-error.ts)) umumiy qoladi.

## Qabul qilingan qarorlar (17.11.2026)

Jamoa tasdiqlagan, backend ham shu qoidalar bo'yicha ishlashi kerak:

- **Diskvalifikatsiya** panel orqali bekor qilinmaydi (bloklashdan farqli o'laroq).
- **Ko'rishlar teng bo'lsa**, Reelni oldinroq yuborgan ishtirokchi reytingda yuqorida turadi.
- **Support:** "Yangi" murojaatga birinchi javob yozilganda u avtomatik "Ko'rilmoqda" holatiga o'tadi.
- **Collab videolar ruxsat etiladi** — Instagramda boshqa akkaunt bilan hamkorlikda (Collab)
  joylangan Reel ham qabul qilinadi, chunki muhimi — ko'rishlar soni. Bitta Reel (bitta link)
  faqat bitta ishtirokchiga hisoblanadi: linkni birinchi yuborganga. Panelda bunday Reellar
  "Collab: @hamkor" belgisi bilan ko'rinadi.

Panelda shunday qilingan, lekin hali jamoa bilan kelishilishi kerak (PLAN.md Q11, Q12):

- **Telegram "o'qildi"** — bot o'qilganlikni bilmaydi, shuning uchun xabar ostida "✅ O'qidim"
  tugmasi bo'ladi; yetkazilganiga 24 soatdan oshib bosilmasa — "o'qilmadi".
- **Telegramni ulamaganlarga** xabarnomalar faqat ilovada boradi.

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
│   │   └── support/
│   ├── layout.tsx        # ildiz layout
│   └── globals.css       # Tailwind va dizayn tokenlari
├── components/
│   ├── dashboard/        # davr filtri, ko'rsatkich kartalari, kunlik grafik
│   ├── layout/           # yon menyu, sarlavha, logotip
│   ├── providers/        # TanStack Query provayderi
│   ├── ratings/          # kunlik reyting: sana tanlash, jadval, o'rin o'zgarishi
│   ├── support/          # murojaatlar ro'yxati, yozishma, javob va holat
│   ├── prizes/           # sovg'alar: rasm, nom, soni, ko'rishlar sharti, tartib
│   ├── targets/          # target yoqqanlar: ro'yxat, dalil oynasi, qarorlar
│   ├── telegram/         # xabarlar holati (yuborildi/yetkazildi/o'qildi), qayta yuborish
│   ├── winner/           # g'olib: nomzod, tekshiruv ro'yxati, tasdiqlash, e'lon
│   ├── settings/         # tanlov muddati, yangilanish vaqti, minimal yosh, qoidalar
│   ├── audit/            # audit log (faqat o'qish)
│   ├── users/            # ishtirokchilar jadvali, filtrlar, amal oynasi
│   └── ui/               # tugma, input, select, dialog, amallar menyusi, sahifalash...
└── lib/
    ├── api.ts            # YAGONA API qatlami (hozir mock)
    ├── api-error.ts
    ├── auth-context.tsx  # joriy xodim va chiqish
    ├── dates.ts          # tanlov kunlari (Asia/Tashkent)
    ├── format.ts         # raqam va sana formatlari
    ├── image.ts          # rasmni yuklashdan oldin kichraytirish
    ├── prize-rules.ts    # sovg'a maydonlari tekshiruvi va ko'rinishi
    ├── labels.ts         # holatlar nomlari va ranglari
    ├── navigation.ts     # menyu, rollar
    ├── period.ts         # dashboard davri (URL bilan)
    ├── users-filters.ts  # Foydalanuvchilar filtrlari (URL bilan)
    ├── types.ts          # API tiplari
    └── mock/             # mock backend: ma'lumotlar, reyting, amallar, audit
```
