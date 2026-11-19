/** Bot matnlari (o'zbek, lotin). Faza 3 da admin paneldan tahrirlanadigan bo'ladi. */
export const texts = {
  welcome:
    "Assalomu alaykum! 👋\n\nMahsulotimiz haqida Instagram Reel joylang, ko'rishlar yig'ing va bosh sovrin — avtomobilni yutib oling.\n\nIshtirok etish uchun avval telefon raqamingizni ulashing.",
  shareContactButton: "📱 Raqamni ulashish",
  contactNotOwn: "Iltimos, o'zingizning raqamingizni pastdagi tugma orqali ulashing.",
  contactTaken:
    "Bu raqam boshqa Telegram akkauntiga bog'langan. Bitta raqam — bitta ishtirokchi. Savol bo'lsa, shu yerga yozing.",
  contactSaved: "✅ Raqam qabul qilindi!\n\nEndi tanlov ilovasini ochib, ro'yxatdan o'ting:",
  welcomeFromWeb:
    "Assalomu alaykum! 👋\n\nSaytda ro'yxatdan o'tish uchun pastdagi tugma orqali telefon raqamingizni ulashing — keyin saytga qayting.",
  contactSavedWeb:
    "✅ Raqam qabul qilindi!\n\nEndi saytga qayting — sahifa o'zi yangilanadi va ro'yxatdan o'tishni davom ettirasiz. Xohlasangiz, shu yerdan ham ochishingiz mumkin:",
  openMiniApp: "🏆 Tanlovni ochish",
  menuButton: "Tanlov",
  alreadyRegistered: "Tanlov ilovasini ochish uchun pastdagi tugmani bosing:",
  miniAppNotConfigured:
    "Tanlov ilovasi hali ulanmagan. Tez orada ishga tushadi.",
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

  // Video tekshiruvi (StatsService)
  reelAccepted: (views: string) =>
    `✅ Videongiz qabul qilindi va reytingga qo'shildi!\n\nHozircha ${views} ta ko'rish. Ko'rishlar avtomatik yangilanib boradi — statistikani tanlov ilovasida kuzating.`,
  reelRejected: {
    NOT_FOUND:
      "❌ Videongiz Instagram'da topilmadi. Link to'g'riligini va akkauntingiz ochiq (yopiq emas) ekanini tekshirib, linkni qaytadan yuboring.",
    NOT_A_VIDEO:
      "❌ Yuborilgan link Reel (video) emas. Iltimos, mahsulot haqidagi Reel linkini yuboring.",
    OWNER_TAKEN:
      "❌ Bu Instagram akkauntdan boshqa ishtirokchi video yuborgan. Bitta akkaunt — bitta ishtirokchi. Xato bo'lsa, shu chatga yozing.",
  },
  reelManualReview: {
    NEW_REEL:
      "🔎 Videongizni avtomatik tekshira olmadik — Instagram'da 3 marta topilmadi.\n\nUni administrator qo'lda tekshiradi, natijani shu chatga yozamiz. Akkauntingiz ochiq (yopiq emas) va video o'chirilmaganini tekshirib qo'ying.",
    LOST_REEL:
      "⚠️ Videongiz Instagram'da ketma-ket 3 marta topilmadi va reytingdan vaqtincha chiqarildi.\n\nUni administrator qo'lda tekshiradi, natijani shu chatga yozamiz. Video o'chirilmagani va akkauntingiz ochiq ekanini tekshiring.",
  },
  reelManualApproved:
    "✅ Videongiz administrator tomonidan tekshirildi va reytingga qo'shildi. Ko'rishlar avtomatik yangilanib boradi.",
  reelRestored: "✅ Videongiz yana topildi va reytingga qaytarildi.",

  // Target (pullik reklama) — admin qaroridan keyin
  targetWarning:
    "⚠️ Ogohlantirish: videongiz pullik reklama (target) yordamida ko'tarilgani aniqlandi. Qoidalarga ko'ra bu taqiqlangan — reklamani to'xtating. Takrorlansa, tanlovdan chetlashtirilasiz. Savollar bo'lsa, shu chatga yozing.",
  targetDisqualified:
    "❌ Pullik reklama (target) taqiqi buzilgani sababli tanlovdan chetlashtirildingiz. Savollar bo'lsa, shu chatga yozing.",
} as const;
