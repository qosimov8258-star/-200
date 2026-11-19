/** Foydalanuvchiga ko'rinadigan barcha matnlar (o'zbek, lotin). Rus tili — keyin. */
export const t = {
  appTitle: "Reels tanlovi",
  loading: "Yuklanmoqda…",
  loadError: "Ma'lumotni yuklab bo'lmadi",
  retry: "Qayta urinish",
  genericError: "Xatolik yuz berdi. Qayta urinib ko'ring.",
  continue: "Davom etish",
  back: "Orqaga",

  // Xush kelibsiz va raqam ulashish
  prizeLabel: "Bosh sovrin",
  heroTitle: "Reel joylang —\navtomobil yuting",
  heroBody:
    "Mahsulot haqida Instagram Reel joylang. Eng ko'p ko'rish yig'gan ishtirokchi g'olib bo'ladi.",
  shareContact: "Raqamni ulashish",
  shareContactHint:
    "Ro'yxatdan o'tish uchun Telegram'dagi telefon raqamingizni ulashing. Bitta raqam — bitta ishtirokchi.",
  contactWaiting: "Raqam tekshirilmoqda…",
  contactDeclined: "Raqamsiz ro'yxatdan o'tib bo'lmaydi. Qayta urinib ko'ring.",
  contactUnsupported:
    "Telegram ilovangizni yangilang yoki bot chatidagi «Raqamni ulashish» tugmasini bosing.",

  // Ro'yxatdan o'tish
  registerTitle: "Ro'yxatdan o'tish",
  registerSubtitle: "Ma'lumotlarni hujjatdagidek kiriting.",
  registerWarning:
    "Diqqat: ism, familiya va yosh bir marta kiritiladi. Keyin ularni o'zgartirib bo'lmaydi.",
  firstName: "Ism",
  lastName: "Familiya",
  age: "Yosh",
  nameInvalid: "Kamida 2 ta harf kiriting",
  ageInvalid: "Yoshni raqam bilan kiriting",
  ageTooYoung: (min: number) => `Tanlovda ${min} yoshdan boshlab qatnashish mumkin`,
  confirmProfile: (first: string, last: string, age: number) =>
    `Ma'lumotlar to'g'rimi?\n\n${first} ${last}, ${age} yosh\n\nTasdiqlagandan keyin ularni o'zgartirib bo'lmaydi.`,

  // Qoidalar
  rulesTitle: "Tanlov qoidalari",
  rulesAgree: "Qoidalar bilan tanishdim va ularga roziman",
  rulesUpdatedTitle: "Qoidalar yangilandi",
  rulesUpdatedBody:
    "Tanlov qoidalariga o'zgartirish kiritildi. Davom etish uchun yangilangan qoidalar bilan tanishib chiqing.",
  rulesStale: "Qoidalar hozirgina yana yangilandi. Iltimos, qaytadan ko'rib chiqing.",

  // Navigatsiya
  navRating: "Reyting",
  navReel: "Videom",
  navProfile: "Profil",

  // Reyting
  greeting: (name: string) => `Salom, ${name}`,
  welcome: "Tanlovga xush kelibsiz",
  daysLeft: (days: number) => `Tanlov tugashiga ${days} kun qoldi`,
  contestFinished: "Tanlov yakunlandi",
  ratingTitle: "Reyting",
  participants: (count: string) => `${count} ishtirokchi`,
  filterAll: "Barchasi",
  filterTop10: "Top 10",
  filterNearMe: "Men atrofimda",
  firstPlace: "1-o'rin",
  views: (count: string) => `${count} ko'rish`,
  myRank: (rank: number) => `Mening o'rnim: ${rank}`,
  sendVideoCta: "Videongizni yuboring",
  you: "Siz",
  ratingEmpty: "Reyting hali shakllanmagan",
  nearMeEmpty: "Video yuborganingizdan keyin o'rningiz shu yerda ko'rinadi",

  // Mening videom
  reelTitle: "Mening videom",
  reelSubtitle: "Link va ko'rishlar statistikasi",
  stepLink: "Reel linkini yuboring",
  stepLinkBody:
    "Mahsulot haqidagi Reel linkini qo'ying. Video avtomatik tekshiriladi, ko'rishlar esa muntazam yangilanib boradi.",
  resubmitTitle: "Boshqa link yuboring",
  resubmitBody: "Xatoni tuzatib, Reel linkini qaytadan yuboring.",
  linkPlaceholder: "https://www.instagram.com/reel/...",
  paste: "Qo'yish",
  submit: "Yuborish",
  linkEmpty: "Linkni kiriting",
  linkInvalid: "Bu Instagram Reel linki emas. Namuna: https://www.instagram.com/reel/ABC123",
  linkTaken: "Bu video boshqa ishtirokchi tomonidan yuborilgan",
  linkAlready: "Siz allaqachon video yuborgansiz",
  submitted: "Link yuborildi — video tekshirilmoqda",
  rulesHeading: "Shartlar",
  ruleTag: "Videoda zavod akkaunti belgilangan bo'lishi kerak",
  ruleOwn: "Video o'z akkauntingizda va ochiq bo'lishi kerak",
  ruleOneAccount: "Bitta Instagram akkaunt — bitta ishtirokchi",
  ruleNoTarget: "Pullik reklama (target) taqiqlangan",
  ruleNoFakeViews:
    "Nakrutka (sotib olingan ko'rishlar, botlar) taqiqlangan — aniqlansa, ishtirokchi tanlovdan chetlashtiriladi",
  reelLink: "Video linki",
  openInInstagram: "Instagram'da ochish",
  copy: "Nusxalash",
  copied: "Nusxalandi",
  statusPending: "Tekshirilmoqda",
  statusAccepted: "Qabul qilingan",
  statusRejected: "Rad etilgan",
  statusRemoved: "O'chirilgan",
  pendingNote:
    "Video Instagram'da tekshirilmoqda — odatda bir necha daqiqa. Natijani bot ham xabar qiladi.",
  rejectedNote: "Video rad etildi. Savollar bo'lsa, bot orqali supportga yozing.",
  rejectReasons: {
    NOT_FOUND:
      "Video Instagram'da topilmadi. Link to'g'riligini va akkauntingiz ochiq (yopiq emas) ekanini tekshiring.",
    NOT_A_VIDEO: "Yuborilgan link Reel (video) emas. Mahsulot haqidagi Reel linkini yuboring.",
    OWNER_TAKEN:
      "Bu Instagram akkauntdan boshqa ishtirokchi video yuborgan. Bitta akkaunt — bitta ishtirokchi. Xato bo'lsa, supportga yozing.",
  },
  removedNote:
    "Video Instagram'da topilmadi va reytingdan vaqtincha chiqarildi. Video ochiqligini tekshiring.",
  statTotal: "Jami ko'rishlar",
  statToday: "Bugungi o'sish",
  statRank: "Reytingdagi o'rin",
  statRankDelta: "O'rin o'zgarishi",
  noChange: "o'zgarishsiz",
  chartTitle: "Kunlik ko'rishlar",
  chartSubtitle: "So'nggi 7 kun",
  lastSynced: (time: string) => `Oxirgi yangilanish: ${time}`,

  // Profil
  profileTitle: "Profil",
  phone: "Telefon",
  profileLocked:
    "Ism, familiya va yosh ro'yxatdan o'tishda bir marta kiritiladi va o'zgartirilmaydi.",
  menuSupport: "Supportga yozish",
  menuRules: "Tanlov qoidalari",
  menuWinner: "G'olib",
  supportHint:
    "Savolingizni bot chatiga yozing — operator shu yerda javob beradi. Kerak bo'lsa, skrinshot ham yuboring.",
  deleteAccount: "Ishtirokni bekor qilish",
  deleteConfirm:
    "Ishtirok bekor qilinsinmi? Videongiz va ma'lumotlaringiz tanlovdan o'chiriladi. Bu amalni ortga qaytarib bo'lmaydi.",

  // G'olib
  winnerTitle: "G'olib",
  winnerPendingTitle: "G'olib hali e'lon qilinmagan",
  winnerPendingBody: "G'olib tanlov tugagach, tekshiruvdan so'ng e'lon qilinadi.",
  winnerCongrats: "Tabriklaymiz!",
  winnerPrize: "Avtomobil sohibi",
  winnerAnnounced: (date: string) => `E'lon qilingan: ${date}`,

  // Holatlar
  blockedTitle: "Ishtirok to'xtatilgan",
  blockedBody: "Akkauntingiz vaqtincha bloklangan. Batafsil ma'lumot uchun bot orqali supportga yozing.",
  disqualifiedTitle: "Tanlovdan chetlatilgansiz",
  disqualifiedBody:
    "Tanlov qoidalari buzilgani sababli ishtirokingiz bekor qilindi. Savollar bo'lsa, bot orqali supportga yozing.",

  // Dev
  devBanner: "Dev rejim: Telegram'dan tashqarida, soxta ma'lumotlar",
  devReset: "Boshidan boshlash",
} as const;
