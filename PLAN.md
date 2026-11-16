# Reels tanlov ilovasi — loyiha rejasi

> **Manba:** [docs/tz.pdf](docs/tz.pdf) — Texnik topshiriq (16.11.2026).
> Bu jamoaning ishchi rejasi. O'zgarishlar faqat PR orqali kiritiladi.
> Ochiq savollarga javob kelganda tegishli bo'limlar yangilanadi.

---

## Mundarija

1. [TZ qisqacha](#1-tz-qisqacha)
2. [Ochiq savollar](#2-ochiq-savollar)
3. [Texnik qarorlar (taklif)](#3-texnik-qarorlar-taklif)
4. [Monorepo tuzilmasi](#4-monorepo-tuzilmasi)
5. [Ma'lumotlar modeli (dastlabki)](#5-malumotlar-modeli-dastlabki)
6. [Fazalar bo'yicha reja](#6-fazalar-boyicha-reja)
7. [Jamoa taqsimoti va taxminiy jadval](#7-jamoa-taqsimoti-va-taxminiy-jadval)
8. [Xavflar](#8-xavflar)
9. [Git ish tartibi](#9-git-ish-tartibi)

---

## 1. TZ qisqacha

**G'oya:** zavod mahsulotini sotib olgan mijozlar mahsulot haqida Instagram Reel joylaydi,
linkini ilovaga yuboradi. Tizim har kuni Reel ko'rishlarini yig'adi va reyting tuzadi.
Tanlov oxirida eng ko'p ko'rish yig'gan ishtirokchi **avtomobil** yutadi (g'olibni Admin
tasdiqlaydi). Maqsad — mahsulotni tabiiy targ'ib qilish va zavod Instagram akkauntini o'stirish.

**Tizim tarkibi:**

| Qism | Kim uchun | Asosiy vazifa |
|---|---|---|
| Mobil ilova (iOS + Android) | Ishtirokchi, Mehmon | Ro'yxatdan o'tish (SMS), Instagram ulash, Reel yuborish, reyting, support |
| Admin panel (veb) | Admin, Support operatori | Foydalanuvchilar, reyting arxivi, support, Telegram holati, target yoqqanlar, g'olib, sozlamalar, audit log |
| Telegram bot | Support, Ishtirokchi | Support murojaatlarini yetkazish, xabarnomalar, o'qilganlik holati |
| Fon xizmati ("AI") | Tizim | Kunlik ko'rishlarni yig'ish, reyting, target va anomaliyalarni aniqlash, Adminga signal |

**Muhim biznes qoidalari:**

- Bitta telefon raqami — bitta akkaunt. Ism, familiya va yosh bir marta kiritiladi va
  **serverda ham** o'zgartirish bloklanadi.
- Reelsiz ishtirokchi reytingda ko'rinmaydi. Reyting ommaviy, telefon raqamlarsiz.
- Target (pullik boost) taqiqlangan. Diskvalifikatsiyani **faqat Admin** qiladi; AI faqat signal beradi.
- Ko'rishlarni qo'lda o'zgartirib bo'lmaydi (hatto Admin ham) — faqat tizim yig'adi.
- Barcha Admin/Support harakatlari audit logga yoziladi.
- Instagram ko'rishlari faqat **Business/Creator** akkaunt va ishtirokchi ruxsati (OAuth) bilan olinadi.

**TZ dagi fazalar:** 0 — Instagram API tekshiruvi; 1 — Backend; 2 — Mobil ilova;
3 — Admin panel, Telegram bot, support; 4 — Yangi yil dizayni, test, ishga tushirish.

---

## 2. Ochiq savollar

### 2.1. TZ 9-bo'limidagi savollar (buyurtmachidan javob kutilmoqda)

- [ ] **Q1.** Tanlov qachon boshlanadi va tugaydi? Nechta avtomobil beriladi? G'olib bitta
      Reel ko'rishlari bilan aniqlanadimi yoki ishtirokchining barcha Reellari yig'indisi bilanmi?
- [ ] **Q2.** Ishtirokchi nechta Reel yubora oladi?
- [ ] **Q3.** Minimal yosh qancha (avtomobil uchun odatda 18)?
- [ ] **Q4.** Mahsulot sotib olinganini qanday tasdiqlaymiz: chek, QR kod, buyurtma raqami yoki faqat video?
- [ ] **Q5.** Instagram Business/Creator akkaunt talabi ishtirokchilar uchun maqbulmi?
- [ ] **Q6.** Target aniqlansa oqibat nima: ogohlantirish, reytingdan chiqarish yoki darhol diskvalifikatsiya?
- [ ] **Q7.** Support operatori alohida rolmi yoki Admin o'zi javob beradimi?
- [ ] **Q8.** Telegram orqali nima yuboriladi: faqat support xabarlarimi yoki barcha xabarnomalar hammi?
- [ ] **Q9.** Ilova tillari: faqat o'zbek (lotin) yoki o'zbek va rus?
- [ ] **Q10.** Zavod brendi (logotip, ranglar) va tanlov nomi.

### 2.2. TZ tahlilidan chiqqan qo'shimcha savollar

- [ ] **Q11. Telegram "o'qildi" holati.** Telegram Bot API bot xabari o'qilganini bildirmaydi.
      Taklif: xabar ostida "✅ O'qidim" tugmasi; bosilmasa — "o'qilmadi". Shu yechim maqbulmi?
- [ ] **Q12. Telegramni ulash majburiymi?** Bot foydalanuvchiga birinchi bo'lib yoza olmaydi —
      ishtirokchi ilovadagi deep link orqali botni o'zi ochishi kerak.
- [ ] **Q13. Ilova kimning developer akkauntidan chiqadi?** App Store qoidalari (5.3-bo'lim)
      bo'yicha tanlov homiysi ilova developeri bo'lishi kerak → zavodning tashkilot akkaunti
      kerak (Apple uchun D-U-N-S raqami). Bu bir necha hafta olishi mumkin.
- [ ] **Q14. Instagram akkaunt cheklovi.** Bitta Instagram akkaunt faqat bitta ishtirokchiga
      ulanadimi? Ishtirokchi yuborgan Reelini almashtira oladimi?
- [ ] **Q15. Yakuniy hisob.** G'olib qaysi lahzadagi ko'rishlar bo'yicha aniqlanadi (oxirgi kun
      00:00 snapshot)? Ko'rishlar teng bo'lsa kim yutadi?
- [ ] **Q16. Push-bildirishnomalar** (telefon ekraniga) kerakmi yoki faqat ilova ichidagi ro'yxat?
- [ ] **Q17. Akkauntni o'chirish.** App Store va Google Play ilova ichida akkauntni o'chirishni
      talab qiladi. O'chirilgan ishtirokchi reytingdan chiqadimi, ma'lumot qancha saqlanadi?
- [ ] **Q18. "Yosh" o'rniga tug'ilgan sana?** Yosh tanlov davomida o'zgarishi mumkin; 18+
      tekshiruvi uchun tug'ilgan sana aniqroq.

### 2.3. TZ da qabul qilingan taxminlar (tasdiqlansa — yopiladi)

- "Target yoqqan" = Reelni pullik reklama (boost) qilgan ishtirokchi.
- Link ilovada yuboriladi, zavod akkaunti Reelda belgilanadi (tag).
- Support va xabarnomalar Telegram orqali boradi, Admin o'qilganlik holatini ko'radi.
- Ilova — mobil (iOS va Android), admin panel — veb.
- "Yosh" ro'yxatdan o'tishda bir marta kiritiladi va o'zgarmaydi.

---

## 3. Texnik qarorlar (taklif)

| Qism | Tanlov | Izoh |
|---|---|---|
| Monorepo | **pnpm workspaces + Turborepo** | Tez o'rnatish, keshlangan build/test. React Native uchun `node-linker=hoisted` kerak bo'lishi mumkin — Faza 0 da tekshiriladi |
| Node.js | Joriy LTS, `.nvmrc` da qayd etiladi | Hamma bir xil versiyada ishlaydi |
| Backend | **NestJS + TypeScript** | Bitta kod bazasi, ikki jarayon: `api` (HTTP) va `worker` (navbat/cron) |
| Ma'lumotlar bazasi | **PostgreSQL + Prisma** | Migratsiyalar repoda saqlanadi |
| Navbat / cron | **BullMQ + Redis** | Kunlik sync, retry, rate limit, takrorlanuvchi joblar |
| API kontrakt | **OpenAPI (Swagger)** → generatsiya qilingan TS klient | Admin va mobil bir xil tiplardan foydalanadi |
| Validatsiya | zod (`packages/shared`) yoki class-validator | Faza 0 da bittasi tanlanadi |
| Admin panel | **Next.js** (App Router), TanStack Query/Table, shadcn/ui | Oddiy, ishchi dizayn |
| Mobil | **React Native (Expo)**: expo-router, EAS Build, expo-notifications | TZ: "Flutter yoki RN" — jamoa stekiga mos RN tanlandi |
| Telegram | grammY, backend ichidagi modul | Dev — polling, prod — webhook |
| SMS | Eskiz (dev muhitda — `mock` provayder) | OTP shablon matni Eskiz moderatsiyasidan o'tishi kerak |
| Fayllar | S3-mos saqlash (lokal — MinIO) | Support skrinshotlari |
| Auth (mobil) | SMS OTP → JWT access + refresh (rotatsiya) | |
| Auth (admin) | Login/parol (argon2) + TOTP 2FA, httpOnly cookie | TZ: 2FA tavsiya etiladi |
| Maxfiylik | Instagram tokenlari AES-256-GCM bilan shifrlanadi | TZ 8-bo'lim |
| Vaqt | DB da UTC; "tanlov kuni" `Asia/Tashkent` bo'yicha | |
| Monitoring | Sentry + strukturalangan loglar (pino) | |

---

## 4. Monorepo tuzilmasi

```text
reels-contest/
├── apps/
│   ├── backend/                    # NestJS — API + worker + Telegram bot
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   ├── migrations/         # commit qilinadi, qo'lda tahrirlanmaydi
│   │   │   └── seed.ts             # test ma'lumotlar (fake ishtirokchilar)
│   │   ├── src/
│   │   │   ├── main.ts             # HTTP API kirish nuqtasi
│   │   │   ├── worker.ts           # BullMQ worker kirish nuqtasi
│   │   │   ├── app.module.ts
│   │   │   ├── config/             # env validatsiyasi
│   │   │   ├── common/             # guard, interceptor, filter, decorator
│   │   │   ├── prisma/             # PrismaService
│   │   │   └── modules/
│   │   │       ├── auth/           # SMS OTP, JWT, admin login + 2FA
│   │   │       ├── users/          # profil (qulflangan maydonlar), rozilik, o'chirish
│   │   │       ├── contest/        # sozlamalar, qoidalar matni
│   │   │       ├── instagram/      # OAuth, Graph API klient, token refresh
│   │   │       ├── reels/          # link qabul qilish va tekshirish
│   │   │       ├── ratings/        # snapshotlar, kunlik reyting
│   │   │       ├── moderation/     # target tekshiruvi, anomaliyalar, sanksiyalar
│   │   │       ├── support/        # murojaatlar va xabarlar
│   │   │       ├── notifications/  # ilova ichidagi + push
│   │   │       ├── telegram/       # bot, support guruhi, xabar holatlari
│   │   │       ├── winner/         # g'olib nomzodi, tekshiruv, e'lon
│   │   │       ├── admin/          # xodimlar, RBAC (ADMIN / SUPPORT)
│   │   │       ├── audit/          # audit log
│   │   │       ├── storage/        # S3 / lokal fayl saqlash
│   │   │       └── jobs/           # cron rejalashtiruvchi va navbat protsessorlari
│   │   └── test/                   # e2e testlar
│   ├── admin/                      # Next.js admin panel
│   │   └── src/
│   │       ├── app/
│   │       │   ├── (auth)/login/
│   │       │   └── (panel)/        # dashboard, users, ratings, support, telegram,
│   │       │                       # targets, winner, settings, audit-log
│   │       ├── components/
│   │       └── lib/                # api klient, auth, formatlash
│   └── mobile/                     # React Native (Expo)
│       └── src/
│           ├── app/                # expo-router ekranlari (9 ta ekran, TZ 7-bo'lim)
│           ├── components/
│           ├── features/           # auth, rating, reels, support, notifications
│           ├── i18n/               # uz (lotin), ru
│           └── theme/              # dizayn tokenlari (Yangi yil mavzusi shu yerda)
├── packages/
│   ├── shared/                     # umumiy tiplar, enumlar, konstantalar, sxemalar
│   ├── api-client/                 # OpenAPI dan generatsiya qilingan klient
│   └── config/                     # umumiy tsconfig, eslint, prettier
├── docs/
│   ├── tz.pdf                      # texnik topshiriq
│   └── phase-0-report.md           # Faza 0 natijalari (keyin qo'shiladi)
├── .github/
│   ├── workflows/ci.yml            # lint, typecheck, test, build
│   └── pull_request_template.md
├── docker-compose.yml              # PostgreSQL, Redis, MinIO (lokal)
├── .env.example
├── .gitignore
├── .nvmrc
├── package.json
├── pnpm-workspace.yaml
├── turbo.json
├── PLAN.md
└── README.md
```

**Nima uchun shunday:**

- **Telegram bot alohida app emas**, backend moduli: u bir xil DB, support ticketlar va
  xabarnoma navbatidan foydalanadi. Kerak bo'lsa keyin ajratish oson.
- **API va worker bitta kod bazasida, lekin alohida jarayon:** kunlik sync og'ir ish —
  API javob tezligiga ta'sir qilmasligi kerak; prod da alohida konteyner sifatida ishga tushadi.
- **`packages/api-client`** — backend o'zgarsa, admin va mobil kompilyatsiyada xatoni ko'radi.
- **`theme/` tokenlari** — Faza 2 da oddiy dizayn bilan quriladi, Faza 4 da faqat
  token va assetlar almashtiriladi (ekranlarni qayta yozish shart emas).

---

## 5. Ma'lumotlar modeli (dastlabki)

TZ 8-bo'limidagi jadvallar + amalga oshirish uchun kerakli qo'shimchalar (*q* — qo'shimcha).
Yakuniy Prisma sxemasi Faza 1 boshida, Faza 0 natijalari va savollarga javoblardan keyin yoziladi.

| Jadval | Asosiy maydonlar | Izoh |
|---|---|---|
| `users` | phone (unique), first_name, last_name, age, status, profile_locked_at, locale | status: ACTIVE / WARNED / DISQUALIFIED / BLOCKED / DELETED |
| `user_consents` *q* | user_id, rules_version, accepted_at | Qoidalarga rozilik isboti |
| `refresh_tokens` *q* | user_id, token_hash, device, expires_at, revoked_at | |
| `instagram_accounts` | user_id, ig_user_id (unique), username, account_type, access_token_enc, token_expires_at, status | Token shifrlangan |
| `reels` | user_id, instagram_account_id, url, shortcode (unique), ig_media_id, status, reject_reason, factory_tagged | status: PENDING / ACCEPTED / REJECTED / REMOVED |
| `reel_view_snapshots` | reel_id, contest_day, views, fetched_at, raw (jsonb) | Faqat worker yozadi |
| `daily_ratings` | contest_day, user_id, reel_id, rank, views, delta_views, delta_rank | Kunlik "muzlatilgan" natija |
| `target_checks` | reel_id, status, method, evidence, checked_at | status: ON / OFF / UNKNOWN; tarix saqlanadi |
| `flags` *q* | user_id, reel_id, type, severity, status, resolved_by | AI → Admin signallari navbati |
| `sanctions` *q* | user_id, type, reason, admin_id | WARNING / DISQUALIFICATION / BLOCK |
| `support_tickets`, `support_messages` | ticket: status; message: author_type, text, attachments, tg_message_id | status: NEW / IN_PROGRESS / CLOSED |
| `attachments` *q* | storage_key, mime, size | Support skrinshotlari |
| `notifications` *q* | user_id, type, payload, read_at | Ilova ichidagi bildirishnomalar |
| `push_devices` *q* | user_id, push_token, platform | |
| `telegram_links` *q* | user_id, chat_id, linked_at | Deep link orqali bog'lash |
| `telegram_messages` | chat_id, kind, status, sent_at, read_at | QUEUED / SENT / DELIVERED / READ / FAILED |
| `admins` | login, password_hash, role, totp_secret_enc, is_active | role: ADMIN / SUPPORT |
| `audit_logs` | actor_id, action, entity, entity_id, before, after, ip, created_at | Faqat qo'shiladi (append-only) |
| `contest_settings` | starts_at, ends_at, rules_text, rules_version, sync_time, min_age | |
| `winners` *q* | user_id, reel_id, final_views, checklist, confirmed_by, announced_at | |

**Server darajasidagi kafolatlar:** ism/familiya/yoshni yangilovchi endpoint yo'q;
ko'rishlarni qo'lda yozuvchi endpoint yo'q; `reels.shortcode` va `instagram_accounts.ig_user_id`
unique; audit log faqat qo'shiladi.

---

## 6. Fazalar bo'yicha reja

> Har bir faza oxirida: demo (jamoa + buyurtmachi), `PLAN.md` yangilanadi, ochiq savollar qayta ko'riladi.

### Faza 0 — Tadqiqot va poydevor (≈1 hafta)

**Maqsad:** Instagram API imkoniyatlarini amalda tekshirish, tashqi ruxsatlarni (Meta,
do'konlar, SMS) erta boshlash va monorepo poydevorini qo'yish.

**0.1. Instagram API spike (kritik yo'l)**

- [ ] Meta Developer da app yaratish (Business turi), zavod Business Portfolio siga ulash,
      **Business Verification** ni boshlash
- [ ] Integratsiya yo'lini tanlash: "Instagram API with Instagram Login" (Facebook sahifasiz)
      yoki "with Facebook Login" — ruxsatlar va cheklovlarni taqqoslash
- [ ] Test Business/Creator akkaunt bilan OAuth → qisqa muddatli → uzoq muddatli token → refresh oqimi
- [ ] Reel ko'rishlarini olish: joriy API versiyasidagi ko'rishlar metrikasi nomi, yangilanish
      kechikishi, xato kodlari
- [ ] Reel linkidan (shortcode) media ID ni topish: ishtirokchi medialari ichidan permalink bo'yicha moslash
- [ ] Reel o'chirilganda / akkaunt yopilganda / ruxsat bekor qilinganda API javoblarini qayd qilish
- [ ] **Target aniqlash** — har bir usul uchun "ishlaydi / qisman / ishlamaydi":
  - [ ] API orqali media bilan bog'liq reklama/boost ma'lumoti (qaysi maydon, qaysi ruxsat kerak)
  - [ ] Ko'rishlar o'sish tezligi bo'yicha evristika
  - [ ] Zaxira: Admin skrinshot so'rashi
- [ ] Zavod akkaunti Reelda belgilanganini (tag / collab) API orqali tekshirish imkoniyati
- [ ] Rate limitlar hisobi: N ishtirokchi × kunlik so'rovlar soni
- [ ] Meta App Review talablari (ruxsatlar ro'yxati, screencast) → minimal prototip bilan
      **review ga topshirish** (Faza 1 boshigacha)

**0.2. Tashkiliy ishlar (darhol boshlanadi — tashqi kutish vaqtlari uzun)**

- [ ] Buyurtmachi bilan uchrashuv: 2-bo'limdagi Q1–Q18 savollar
- [ ] Developer akkauntlar: Apple Developer Program va Google Play — **zavod nomidan,
      tashkilot sifatida** (Q13). D-U-N-S raqamini tekshirish
- [ ] Eskiz: akkaunt, jo'natuvchi nomi, OTP shablon matnini moderatsiyaga yuborish
- [ ] Telegram: bot yaratish (@BotFather), support operatorlari guruhi
- [ ] Hosting: shaxsiy ma'lumotlarni O'zbekiston ichida saqlash talabi bo'yicha yurist xulosasi →
      DigitalOcean yoki mahalliy server qarori
- [ ] Tanlov qoidalarining yuridik ko'rigi (avtomobil sovrini, ommaviy reytingda ism-familiya)
- [ ] Dizayner bilan Yangi yil maketlari ishini boshlash (Faza 4 ga kechiktirmaslik uchun)

**0.3. Repo poydevori**

- [ ] pnpm workspace + Turborepo, `.nvmrc`, `packages/config` (tsconfig, eslint, prettier)
- [ ] `docker-compose.yml`: PostgreSQL, Redis, MinIO
- [ ] NestJS, Next.js, Expo skeletlari ("hello world" darajasida, ishga tushadi)
- [ ] `.gitattributes` (LF qator oxirlari — Windows/macOS aralash jamoa uchun)
- [ ] GitHub: `main` himoyasi, PR shabloni, CI (lint, typecheck, test, build)
- [ ] README: lokal ishga tushirish yo'riqnomasi

**Natija:** `docs/phase-0-report.md` (API imkoniyatlari bo'yicha xulosa, target aniqlash usuli
bo'yicha qaror, TZ 5.2/5.4 ga tuzatishlar), ishlaydigan monorepo skeleti, Meta App Review topshirilgan.

**Tayyorlik mezoni:**
- Test akkauntdagi haqiqiy Reel ko'rishlari API orqali olinib, bazaga yozildi (prototip).
- `pnpm dev` uchala app ni ko'taradi; CI yashil.
- Target aniqlash bo'yicha yakuniy usul buyurtmachi bilan kelishildi.

---

### Faza 1 — Backend yadrosi (≈2 hafta)

**Maqsad:** ro'yxatdan o'tish, Reel qabul qilish, kunlik ko'rishlar va reyting ishlaydigan,
hujjatlashtirilgan API.

**Vazifalar:**

- [ ] **Prisma sxemasi** (5-bo'lim asosida) + birinchi migratsiya + seed (500 ta fake ishtirokchi)
- [ ] **Auth (mobil):** OTP yuborish/tekshirish, urinishlar limiti va qayta yuborish cooldown
      (Redis), IP bo'yicha limit; JWT access + refresh rotatsiyasi; `mock` SMS provayder
- [ ] **Users:** ro'yxatdan o'tish (ism, familiya, yosh) → profil qulflanadi; qoidalarga rozilik
      (versiya bilan); minimal yosh tekshiruvi; akkauntni o'chirish
- [ ] **Contest:** sozlamalar (muddat, qoidalar matni, yangilanish vaqti, minimal yosh);
      ommaviy qoidalar endpointi
- [ ] **Instagram:** backend orqali OAuth (ilovaga deep link bilan qaytish), akkaunt turini
      tekshirish (shaxsiy bo'lsa — ko'rsatma), tokenni shifrlab saqlash, avtomatik refresh job
- [ ] **Reels:** link normalizatsiyasi → tekshiruv (mavjud, ulangan akkauntga tegishli, ochiq,
      boshqa ishtirokchida yo'q, kerak bo'lsa zavod tagi) → holat → bildirishnoma
- [ ] **Kunlik job (worker):** sozlamadagi vaqtda (`Asia/Tashkent`) har bir Reel uchun alohida
      job, retry/backoff, rate limit → snapshot → `daily_ratings` → oldingi kun bilan farq;
      o'chirilgan Reel → reytingdan vaqtincha chiqarish + xabar
- [ ] **Moderatsiya:** target tekshiruvi (Faza 0 qaroriga ko'ra), ko'rishlar anomaliyasi qoidalari
      (sozlanadigan chegaralar) → `flags` → Adminga signal
- [ ] **Reyting API:** umumiy reyting (Mehmon uchun ham, telefonlarsiz, keshlangan), o'z o'rni,
      o'zgarish, birinchi o'rin alohida
- [ ] **Notifications:** ilova ichidagi ro'yxat + push (Expo Push); Telegram kanali uchun interfeys
- [ ] **Admin auth va RBAC:** login/parol, rollar ADMIN/SUPPORT, guard, 2FA (TOTP),
      audit log interceptor
- [ ] OpenAPI (Swagger) + `packages/api-client` generatsiyasi
- [ ] Testlar: unit (reyting hisoblash, anomaliya, OTP limitlari), e2e (asosiy oqim)
- [ ] Staging muhitga deploy (Docker)

**Natija:** staging da ishlaydigan API, Swagger hujjati, mobil va admin uchun barqaror kontrakt.

**Tayyorlik mezoni:**
- E2E test: ro'yxatdan o'tish → Instagram ulash → Reel yuborish → kunlik job → reytingda ko'rinish.
- Ism/familiya/yoshni o'zgartirish urinishi serverda rad etiladi (test bilan).
- Ko'rishlarni qo'lda o'zgartiruvchi endpoint mavjud emas.

---

### Faza 2 — Mobil ilova (≈2–3 hafta, Faza 1 bilan qisman parallel)

**Maqsad:** TZ 7-bo'limidagi 9 ta ekran oddiy (lekin tokenlarga asoslangan) dizaynda,
staging API bilan to'liq ishlaydi.

**Vazifalar:**

- [ ] Expo + expo-router, TanStack Query, `api-client`, i18n (uz-lotin; ru kalitlari tayyor),
      `theme/` tokenlari
- [ ] Faza 1 tugaguncha — mock ma'lumotlar bilan UI (kontrakt OpenAPI dan)
- [ ] Ekranlar:
  - [ ] 1. Kirish va telefon tasdiqlash (OTP)
  - [ ] 2. Ro'yxatdan o'tish (ism, familiya, yosh, ogohlantirish ekrani)
  - [ ] 3. Tanlov qoidalari (rozilik bermasdan davom etib bo'lmaydi)
  - [ ] 4. Bosh ekran (reyting, o'z o'rni, o'zgarish, birinchi o'rin ajratilgan)
  - [ ] 5. Reel linkini yuborish (+ Instagram ulash, Creator ga o'tish yo'riqnomasi)
  - [ ] 6. Mening profilim (qulflangan maydonlar, akkauntni o'chirish)
  - [ ] 7. Support (murojaatlar ro'yxati, chat, skrinshot biriktirish)
  - [ ] 8. Bildirishnomalar
  - [ ] 9. G'olib e'loni
- [ ] Mehmon rejimi: qoidalar va reyting ro'yxatdan o'tmasdan
- [ ] Push-bildirishnoma ruxsati va token ro'yxatdan o'tkazish
- [ ] Telegram ulash tugmasi (deep link) — Q12 javobiga ko'ra
- [ ] Xato, bo'sh va offline holatlar
- [ ] EAS Build: dev client, TestFlight va Google Play internal testing

**Natija:** TestFlight / Play internal testing da ishlaydigan build.

**Tayyorlik mezoni:** iOS va Android real qurilmalarda staging bilan to'liq oqim o'tadi;
barcha matnlar i18n fayllarida (kodda qattiq yozilgan matn yo'q).

---

### Faza 3 — Admin panel, Telegram bot, Support (≈2 hafta, Faza 2 bilan parallel)

**Maqsad:** zavod xodimlari tanlovni to'liq boshqara oladi; support Telegram orqali ishlaydi.

**Admin panel (Next.js):**

- [ ] Login + 2FA, rolga qarab menyu (Admin / Support)
- [ ] Dashboard: jami ko'rishlar, bugungi o'sish, ishtirokchilar, Reellar, ochiq murojaatlar,
      target yoqqanlar; davr bo'yicha filtr
- [ ] Foydalanuvchilar: qidiruv, filtr, profil (ko'rishlar tarixi, o'rin, holat), bloklash,
      ogohlantirish, diskvalifikatsiya
- [ ] Reellar moderatsiyasi: mahsulot bormi — qabul / rad (sabab bilan)
- [ ] Reyting: kunlik arxiv, dinamika, sana tanlash, **Excel eksport**
- [ ] Signallar (flags) navbati: anomaliyalar va target holatlari
- [ ] Target yoqqanlar: ro'yxat, dalil, ogohlantirish / diskvalifikatsiya / ro'yxatdan chiqarish
- [ ] Support: murojaatlar, javob, holatni o'zgartirish
- [ ] Telegram: xabarlar holati, o'qilmaganlarga qayta yuborish
- [ ] G'olib: nomzod, tekshiruv ro'yxati (target, Reel mavjud, soxta ko'rish, xarid), tasdiqlash, e'lon
- [ ] Sozlamalar va Audit log (faqat o'qish)

**Telegram bot (backend `telegram` moduli):**

- [ ] Support guruhi: yangi murojaat → guruhga xabar; operator reply → ilovaga javob; holat tugmalari
- [ ] Ishtirokchini ulash: bir martalik token bilan deep link → `chat_id` bog'lash
- [ ] Xabarnomalar (Q8 ga ko'ra) va holat kuzatuvi: yuborildi → yetkazildi → o'qildi (Q11)
- [ ] O'qilmaganlarga qayta yuborish (admin tugmasi va/yoki avtomatik)

**Natija/Tayyorlik mezoni:**
- Support operatori faqat murojaatlarni ko'radi va boshqara oladi (RBAC e2e test).
- Har bir Admin/Support harakati audit logda (kim, nima, qachon).
- Murojaat ilova → Telegram → ilova yo'lida to'liq aylanadi.

---

### Faza 4 — Yangi yil dizayni, test, ishga tushirish (≈1–2 hafta)

**Maqsad:** yakuniy dizayn, sifat va xavfsizlik tekshiruvi, prod ga chiqish va do'konlarda chop etish.

**Vazifalar:**

- [ ] **Dizayn (mobil):** to'q ko'k/yashil fon, qizil-oltin urg'ular, avtomobil banneri,
      tanlov tugashigacha hisoblagich, yengil qor effekti (zaif qurilmalarda o'chiriladi),
      reyting o'rni o'zgarishi animatsiyasi
- [ ] **Dizayn (admin):** Yangi yil elementlari faqat logotip va sarlavhada
- [ ] Yakuniy matnlar (uz / ru — Q9 ga ko'ra)
- [ ] **QA:** test-keyslar, regression, real qurilmalar (past va o'rta segment Android ham)
- [ ] **Yuk testi:** kunlik job N ishtirokchi uchun belgilangan vaqtda tugashi; reyting endpointi
- [ ] **Xavfsizlik:** OTP brute-force, RBAC, token shifrlash, rate limit, bog'liqliklar auditi
- [ ] **Prod infra:** server, domen, HTTPS, avtomatik backup va tiklash sinovi, Sentry, uptime monitoring
- [ ] **Do'konlar:** App Store va Google Play ga topshirish (qoidalar ekrani, "Apple homiy emas" bandi,
      maxfiylik siyosati, akkaunt o'chirish)
- [ ] Meta App Review tasdiqlangan bo'lishi (aks holda faqat test akkauntlar ishlaydi)
- [ ] **Launch runbook:** tanlov boshlanishi, kunlik job monitoringi, g'olibni aniqlash
      (staging da dry-run), favqulodda holatlar tartibi

**Tayyorlik mezoni:** ilova ikkala do'konda chop etilgan; prod da birinchi kunlik job
muvaffaqiyatli o'tdi; g'olib oqimi staging da to'liq sinalgan.

---

## 7. Jamoa taqsimoti va taxminiy jadval

**Rollar (taklif, 3 kishi):**

| | Faza 0 | Faza 1 | Faza 2 | Faza 3 | Faza 4 |
|---|---|---|---|---|---|
| **Dasturchi A** (backend) | Instagram spike, Meta app | Backend yadrosi, kunlik job | API qo'llab-quvvatlash | Telegram/support backend | Yuk testi, prod infra |
| **Dasturchi B** (mobil) | Expo skeleti, do'kon akkauntlari | Mock bilan UI | Mobil ilova | Mobil support/Telegram | Yangi yil dizayni, do'konga topshirish |
| **Dasturchi C** (admin + infra) | Repo, CI, Docker, Eskiz, Telegram bot | Auth/SMS, admin API, audit | Admin panel | Admin panel, Telegram bot | QA, xavfsizlik |

**Taxminiy jadval (haftalar):**

| Hafta | Ish |
|---|---|
| 1 | Faza 0 (spike + tashkiliy + poydevor) |
| 2–3 | Faza 1 (B — mobil UI mock bilan, C — auth va admin API) |
| 3–5 | Faza 2 va Faza 3 parallel |
| 6–7 | Faza 4 |

> ⚠️ **Muddat xavfi:** agar ish 18-noyabrdan boshlansa, 7-hafta 30-dekabr – 5-yanvarga to'g'ri
> keladi. Yangi yil mavzusidagi tanlov bayramdan oldin boshlanishi kerak bo'lsa (Q1), MVP ni
> qisqartirish taklif qilinadi:
>
> - **Launch uchun shart:** ro'yxatdan o'tish, Instagram ulash, Reel yuborish, kunlik reyting,
>   qoidalar, support (Telegram guruh orqali), admin: foydalanuvchilar, reyting, support,
>   signallar, sozlamalar, audit log.
> - **Launch dan keyin:** G'olib bo'limi (tanlov oxirigacha kerak), Excel eksport,
>   Telegram o'qilganlik va qayta yuborish, rus tili, murakkab animatsiyalar, AI kontent tahlili.
>
> Meta App Review va do'kon akkauntlari (D-U-N-S) — tashqi kutish, ularni 1-haftada boshlash shart.

---

## 8. Xavflar

| Xavf | Ta'siri | Choralar |
|---|---|---|
| Meta App Review kechikadi yoki rad etiladi | Haqiqiy ishtirokchilar ko'rishlari yig'ilmaydi | Faza 0 da erta topshirish, Business Verification parallel; dev test akkauntlar bilan davom etadi |
| Targetni API orqali aniqlab bo'lmaydi | "Target mumkin emas" qoidasi nazoratsiz | Evristika + skrinshot zaxirasi; TZ 5.2 Faza 0 natijasiga ko'ra yangilanadi |
| Ishtirokchilar Business/Creator ga o'tmaydi | Ishtirok kamayadi | Ilovada qadam-baqadam yo'riqnoma (rasm/video) |
| Do'kon akkauntlari (D-U-N-S, tashkilot tekshiruvi) | Release kechikadi | 1-haftada boshlash; zavod nomidan tashkilot akkaunti |
| Shaxsiy ma'lumotlar lokalizatsiyasi | Hostingni ko'chirishga to'g'ri keladi | Faza 0 da yurist xulosasi, deploy dan oldin qaror |
| Telegram o'qilganlik holati | TZ talabi so'zma-so'z bajarilmaydi | "O'qidim" tugmasi (Q11), buyurtmachi bilan kelishish |
| Soxta ko'rishlar | Adolatsiz g'olib | Anomaliya signallari + g'olib tekshiruv ro'yxati |
| Instagram token muddati (~60 kun) | Ko'rishlar yig'ilmay qoladi | Avtomatik refresh job; muvaffaqiyatsiz bo'lsa — qayta ulash xabari |
| Eskiz shablon moderatsiyasi | OTP ishlamaydi | Erta topshirish; dev da `mock` provayder |
| Yangi yil muddati | Dizayn mavzusi o'z ma'nosini yo'qotadi | MVP qisqartirish (7-bo'lim), parallel ish |

---

## 9. Git ish tartibi

- **`main` — himoyalangan.** To'g'ridan-to'g'ri push taqiqlanadi; faqat PR orqali,
  kamida 1 ta review va yashil CI bilan.
- **Branch nomlari:** `feature/<qisqa-tavsif>`, `fix/<...>`, `chore/<...>`, `docs/<...>`.
- **Commitlar:** [Conventional Commits](https://www.conventionalcommits.org/) —
  `feat(backend): ...`, `fix(mobile): ...`, `chore(admin): ...`.
- **Merge:** squash merge; branch merge dan keyin o'chiriladi.
- **Prisma migratsiyalari:** bir PR — bir mantiqiy migratsiya; `main` ga tushgan migratsiya
  tahrirlanmaydi; konfliktda rebase qilib migratsiya qayta generatsiya qilinadi.
- **Maxfiy ma'lumotlar** hech qachon commit qilinmaydi. Yangi env o'zgaruvchi qo'shilsa —
  `.env.example` ham yangilanadi (PR checklist bandi).
- **Katta o'zgarishlar** (sxema, API kontrakt) — PR dan oldin jamoada qisqa muhokama.
