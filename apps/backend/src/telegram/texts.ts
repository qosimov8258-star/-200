/** Bot matnlari (o'zbek, lotin). Faza 3 da admin paneldan tahrirlanadigan bo'ladi. */
export const texts = {
  welcome:
    "Assalomu alaykum! 👋\n\nMahsulotimiz haqida Instagram Reel joylang, ko'rishlar yig'ing va bosh sovrin — avtomobilni yutib oling.\n\nIshtirok etish uchun avval telefon raqamingizni ulashing.",
  shareContactButton: "📱 Raqamni ulashish",
  contactNotOwn: "Iltimos, o'zingizning raqamingizni pastdagi tugma orqali ulashing.",
  contactTaken:
    "Bu raqam boshqa Telegram akkauntiga bog'langan. Bitta raqam — bitta ishtirokchi. Savol bo'lsa, shu yerga yozing.",
  contactSaved: "✅ Raqam qabul qilindi!\n\nEndi tanlov ilovasini ochib, ro'yxatdan o'ting:",
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
  operatorUnknownTarget:
    "Bu xabar qaysi ishtirokchiga tegishli ekanini topa olmadim. Ishtirokchi xabariga «Reply» qilib javob yozing.",

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
  reelRemoved:
    "⚠️ Videongiz Instagram'da topilmay qoldi va reytingdan vaqtincha chiqarildi. Video o'chirilmagani va akkauntingiz ochiq ekanini tekshiring.",
  reelRestored: "✅ Videongiz yana topildi va reytingga qaytarildi.",
} as const;
