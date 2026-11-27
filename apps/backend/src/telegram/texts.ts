/** Bot matnlari (o'zbek, lotin). Faza 3 da admin paneldan tahrirlanadigan bo'ladi. */
export const texts = {
  welcome:
    "Assalomu alaykum! 👋\n\nMahsulotimiz haqida Instagram Reel joylang, ko'rishlar yig'ing va bosh sovrin — avtomobilni yutib oling.\n\nIshtirok etish uchun avval telefon raqamingizni ulashing.",
  shareContactButton: "📱 Raqamni ulashish",
  contactNotOwn: "Iltimos, o'zingizning raqamingizni pastdagi tugma orqali ulashing.",
  contactTaken:
    "Bu raqam boshqa Telegram akkauntiga bog'langan. Bitta raqam — bitta ishtirokchi. Savol bo'lsa, shu yerga yozing.",
  contactTakenWeb:
    "Bu raqam bilan saytda ro'yxatdan o'tilgan, sizning Telegram hisobingizda esa alohida profil bor — ikkalasini o'zimiz qo'sha olmaymiz. Shu yerga yozing, support yordam beradi.",
  welcomeLink:
    "Assalomu alaykum! 👋\n\nSaytdagi hisobingizni Telegram'ga ulash uchun pastdagi tugma orqali raqamingizni ulashing. Saytda ro'yxatdan o'tganda yozgan raqamingiz bo'lishi kerak.",
  contactLinked:
    "✅ Raqam tasdiqlandi — saytdagi hisobingiz Telegram'ga ulandi!\n\nEndi tanlovni shu yerdan ham ochasiz. Saytda (istalgan qurilmada) «Telegram orqali kirish» ni bosing — xavfsizlik uchun saytdagi eski kirish yopildi.",
  contactSaved: "✅ Raqam qabul qilindi!\n\nEndi tanlov ilovasini ochib, ro'yxatdan o'ting:",
  welcomeFromWeb:
    "Assalomu alaykum! 👋\n\nSaytda ro'yxatdan o'tish uchun pastdagi tugma orqali telefon raqamingizni ulashing — keyin saytga qayting.",
  contactSavedWeb:
    "✅ Raqam qabul qilindi!\n\nEndi saytga qayting — sahifa o'zi yangilanadi va ro'yxatdan o'tishni davom ettirasiz. Xohlasangiz, shu yerdan ham ochishingiz mumkin:",
  openMiniApp: "🏆 Tanlovni ochish",
  menuButton: "Tanlov",
  alreadyRegistered: "Tanlov ilovasini ochish uchun pastdagi tugmani bosing:",
  // Saytdagi "Hisobim bor" — bot orqali kirish.
  loginShareContact: (code: string) =>
    `🔐 Saytga kirish\n\nSaytdagi kod: ${code}\n\nKirish uchun pastdagi tugma orqali Telegram'dagi raqamingizni ulashing. Saytda ro'yxatdan o'tgan bo'lsangiz — o'sha raqam bo'lsin.\n\n⚠️ Saytda «Hisobim bor» ni o'zingiz bosmagan bo'lsangiz — hech narsa qilmang.`,
  loginConfirm: (name: string, code: string) =>
    `🔐 Saytga kirish so'rovi\n\nHisob: ${name}\nSaytdagi kod: ${code}\n\nKod saytdagi bilan bir xil va kirishni o'zingiz so'ragan bo'lsangiz — «Ha, kirish» ni bosing.\n\n⚠️ Havolani boshqa odam yuborgan bo'lsa — «Men emas» ni bosing.`,
  loginConfirmButton: "✅ Ha, kirish",
  loginDenyButton: "✖️ Men emas",
  loginConfirmedToast: "Tasdiqlandi",
  loginDone: "✅ Tasdiqlandi! Saytga qayting — hisobingiz o'zi ochiladi.",
  loginDenied: "Kirish bekor qilindi. Hisobingiz xavfsiz.",
  loginExpired: "Bu kirish havolasi eskirgan yoki ishlatilgan. Saytda «Hisobim bor» ni qayta bosing.",
  loginContactLinked: "✅ Raqam tasdiqlandi — saytdagi hisobingiz Telegram'ga ulandi.",
  loginContactSaved: "✅ Raqam qabul qilindi.",
  miniAppNotConfigured:
    "Tanlov ilovasi hali ulanmagan. Tez orada ishga tushadi.",
  tooManyRequests: "⏳ Juda tez yozyapsiz. Bir daqiqadan keyin qayta urinib ko'ring.",
  supportTooMany:
    "⏳ Qisqa vaqtda juda ko'p xabar yubordingiz. Operator avvalgi xabarlaringizni ko'radi — 10 daqiqadan keyin yana yozishingiz mumkin.",
  operatorNotAllowed:
    "⛔ Javob yuborilmadi: ishtirokchilarga faqat support guruhi adminlari (yoki TELEGRAM_SUPPORT_OPERATOR_IDS dagilar) javob bera oladi.",
  supportReceived:
    "📨 Xabaringiz supportga yuborildi. Operator javobi shu chatga keladi.",
  supportNeedsContact:
    "Supportga yozishdan oldin telefon raqamingizni ulashing — shunda sizni taniy olamiz.",
  supportUnavailable: "Support hozircha ulanmagan. Keyinroq urinib ko'ring.",
  operatorPrefix: "💬 Support javobi:\n\n",
  operatorDelivered: "✅ Ishtirokchiga yuborildi",
  operatorBlocked: "❌ Yetkazilmadi: ishtirokchi botni bloklagan.",
  operatorFailed: "❌ Yetkazilmadi: Telegram xatosi. Birozdan keyin qayta yozib ko'ring.",
  operatorUnknownTarget:
    "Bu xabar qaysi ishtirokchiga tegishli ekanini topa olmadim. Ishtirokchi xabariga «Reply» qilib javob yozing.",

  // Xabarnomalar ostidagi tugma: bosilsa — xabar "o'qildi" (admin panel → Telegram).
  readButton: "✅ O'qidim",
  readThanks: "Rahmat! Xabar o'qildi deb belgilandi.",

  // Video tekshiruvi (StatsService). Ishtirokchida bir nechta video bo'lishi mumkin — har bir
  // xabar oxiriga qaysi video haqida ekani qo'shiladi (`reelLink`).
  reelLink: (url: string) => `🔗 Video: ${url}`,
  reelAccepted: (views: string) =>
    `✅ Videongiz qabul qilindi!\n\nHozircha ${views} ta ko'rish. Ko'rishlar avtomatik yangilanib boradi; barcha tasdiqlangan videolaringiz ko'rishlari qo'shib hisoblanadi. Statistikani aksiya ilovasida kuzating.`,
  reelRejected: {
    NOT_FOUND:
      "❌ Videongiz Instagram'da topilmadi. Link to'g'riligini va akkauntingiz ochiq (yopiq emas) ekanini tekshirib, linkni qaytadan yuboring.",
    NOT_A_VIDEO:
      "❌ Yuborilgan link Reel (video) emas. Iltimos, mahsulot haqidagi Reel linkini yuboring.",
    OWNER_TAKEN:
      "❌ Bu Instagram akkauntdan boshqa ishtirokchi video yuborgan. Bitta akkaunt — bitta ishtirokchi. Xato bo'lsa, shu chatga yozing.",
    NO_PRODUCT:
      "❌ Videoda tanlov mahsuloti ko'rinmadi. Iltimos, mahsulot aniq ko'rinadigan Reel joylab, linkini qaytadan yuboring. Xato bo'lsa, shu chatga yozing.",
  },
  reelManualReview: {
    NEW_REEL:
      "🔎 Videongizni avtomatik tekshira olmadik — Instagram'dan ma'lumot olinmadi.\n\nUni administrator qo'lda tekshiradi, natijani shu chatga yozamiz. Akkauntingiz ochiq (yopiq emas) va video o'chirilmaganini tekshirib qo'ying.",
    AI_CHECK:
      "🔎 Videongizni administrator qo'lda tekshiradi — avtomatik tekshiruvda mahsulot aniq ko'rinmadi.\n\nNatijani shu chatga yozamiz.",
    LOST_REEL:
      "⚠️ Videongiz Instagram'da ketma-ket 3 marta topilmadi — uning ko'rishlari reytingda vaqtincha hisobga olinmaydi.\n\nUni administrator qo'lda tekshiradi, natijani shu chatga yozamiz. Video o'chirilmagani va akkauntingiz ochiq ekanini tekshiring.",
  },
  reelManualApproved:
    "✅ Videongiz administrator tomonidan tekshirildi va reytingga qo'shildi. Ko'rishlar avtomatik yangilanib boradi.",
  reelRestored: "✅ Videongiz yana topildi — uning ko'rishlari reytingda yana hisobga olinadi.",

  // Target (pullik reklama) — admin qaroridan keyin
  targetWarning:
    "⚠️ Ogohlantirish: videongiz pullik reklama (target) yordamida ko'tarilgani aniqlandi. Qoidalarga ko'ra bu taqiqlangan — reklamani to'xtating. Takrorlansa, tanlovdan chetlashtirilasiz. Savollar bo'lsa, shu chatga yozing.",
  targetDisqualified:
    "❌ Pullik reklama (target) taqiqi buzilgani sababli tanlovdan chetlashtirildingiz. Savollar bo'lsa, shu chatga yozing.",
} as const;

/** `as const` dagi aniq satrlarni oddiy `string` ga kengaytiradi — ruscha matnlar ham shu shaklda. */
type Widen<T> = T extends string
  ? string
  : T extends (...args: infer A) => infer R
    ? (...args: A) => Widen<R>
    : T extends object
      ? { readonly [K in keyof T]: Widen<T[K]> }
      : T;

/** Bot matnlari shakli (o'zbekcha `texts` asosida); ruscha — `texts.ru.ts`. */
export type BotTexts = Widen<typeof texts>;
