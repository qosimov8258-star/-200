/**
 * Ko'rishlar yig'ilishi va videolar tekshirilishi davri (`MyReels.syncEveryDays`):
 * 1 → "har kuni", 7 → "haftada bir marta", boshqasi → "har N kunda".
 */
const syncPeriod = (days: number) =>
  days === 1 ? "har kuni" : days === 7 ? "haftada bir marta" : `har ${days} kunda`;

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
    "Mahsulot haqida Instagram Reel joylang. Videosi eng ko'p ko'rilgan ishtirokchi g'olib bo'ladi.",
  shareContact: "Raqamni ulashish",
  shareContactHint:
    "Ro'yxatdan o'tish uchun Telegram'dagi telefon raqamingizni ulashing. Bitta raqam — bitta ishtirokchi.",
  contactWaiting: "Raqam tekshirilmoqda…",
  contactDeclined: "Raqamsiz ro'yxatdan o'tib bo'lmaydi. Qayta urinib ko'ring.",
  contactUnsupported:
    "Telegram ilovangizni yangilang yoki bot chatidagi «Raqamni ulashish» tugmasini bosing.",
  shareContactViaBot: "Botda raqamni ulashish",
  shareContactWebHint:
    "Raqam Telegram bot orqali ulashiladi: tugmani bosing, ochilgan chatda «Raqamni ulashish» ni tanlang va shu sahifaga qayting. Bitta raqam — bitta ishtirokchi.",
  contactWebWaiting: "Telegram'da raqamni ulashgach, sahifa o'zi yangilanadi…",

  // Veb-sayt: kirish
  webLoginBody:
    "Telegram akkauntingiz orqali kiring — parol yoki SMS kerak emas. Botda va saytda akkauntingiz bitta, ma'lumotlar bir xil.",
  webLoginFailed: "Kirib bo'lmadi. Qayta urinib ko'ring.",
  webLoginNotConfigured: "Saytga kirish hali sozlanmagan. Tanlovda Telegram bot orqali qatnashing.",
  webLoginMock: "Telegram orqali kirish (sinov)",
  webOpenBot: "Telegram'da botni ochish",
  webLogout: "Saytdan chiqish",
  logoutConfirmTitle: "Saytdan chiqasizmi?",
  logoutConfirmBody:
    "Hisobingiz va ko'rishlaringiz saqlanib qoladi. Qaytish uchun yana Telegram orqali kirasiz — sovg'alar sizni kutadi.",
  logoutStay: "Qolaman",
  logoutLeave: "Ha, chiqish",

  // Veb-sayt: ro'yxatdan o'tmagan mehmon (bosh sahifani ko'radi, qatnashish uchun "Profil" da kiradi)
  guestName: "Mehmon",
  guestStatus: "Hali ro'yxatdan o'tmagansiz",
  guestJoinTitle: "Ro'yxatdan o'tish",
  guestJoinCta: "Ro'yxatdan o'tish",
  guestReelTitle: "Videongizni yuborish uchun ro'yxatdan o'ting",
  guestReelBody:
    "Telegram orqali kiring — parol yoki SMS kerak emas. Keyin Reel linklarini yuborasiz — har bir qabul qilingan videongiz reytingda alohida o'rin oladi.",
  guestReportTitle: "Xabar yuborish uchun ro'yxatdan o'ting",
  guestReportBody: "Reklama haqida faqat tanlov ishtirokchilari xabar bera oladi. Telegram orqali kirish bir daqiqa oladi.",
  supportWebHint: "Support Telegram botda — ochilgan chatga savolingizni yozing.",

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
  // Tasdiqlash oynasi (Telegram'dan tashqarida)
  confirmOk: "Tasdiqlash",
  confirmCancel: "Bekor qilish",
  confirmProfile: (first: string, last: string, age: number) =>
    `Ma'lumotlar to'g'rimi?\n\n${first} ${last}, ${age} yosh\n\nTasdiqlagandan keyin ularni o'zgartirib bo'lmaydi.`,

  // Qoidalar
  rulesTitle: "Tanlov qoidalari",
  rulesVideoLabel: "Qoidalar haqida qisqa video",
  rulesHeroBadge: "Rasmiy shartlar",
  rulesHeroBody: "Qishki Olivia tanlovida qatnashish va sovg'a yutish shartlari. Video yuborishdan oldin o'qib chiqing 🎄",
  rulesSectionsCount: (n: number) => `${n} ta bo'lim`,
  rulesAgree: "Qoidalar bilan tanishdim va ularga roziman",
  rulesUpdatedTitle: "Qoidalar yangilandi",
  rulesUpdatedBody:
    "Tanlov qoidalariga o'zgartirish kiritildi. Davom etish uchun yangilangan qoidalar bilan tanishib chiqing.",
  rulesStale: "Qoidalar hozirgina yana yangilandi. Iltimos, qaytadan ko'rib chiqing.",

  // Navigatsiya
  navHome: "Asosiy",
  navRating: "Reyting",
  // Pastki menyu: qisqa "Video" (ekran sarlavhasi — "Mening videolarim").
  navReel: "Video",
  navProfile: "Profil",
  navMore: "Ko'proq",
  navPrizes: "Sovg'alar",
  moreClose: "Yopish",
  morePrizesHint: "Voucherlar va asosiy sovrinlar",
  moreRulesHint: "Ishtirok shartlari",
  moreWinnerHint: "Tanlov natijasi",

  // Reyting
  greetingByTime: { morning: "Xayrli tong", day: "Xayrli kun", evening: "Xayrli kech" },
  /** Ism ostida almashib turadigan satrlar. */
  homeTaglines: [
    "Tanlovga xush kelibsiz",
    "Yangi yil sovg'alari kutmoqda 🎁",
    "Ko'rishlar sovg'aga aylanadi ✨",
    "Bosh sovrin — avtomobil 🚗",
  ],
  homeStartedTitle: "tanlovi boshlandi! 🎉",
  homeStartedBody: "Mahsulotimiz haqida Reels joylang, ko'rishlar yig'ing va qimmatbaho sovg'alarni yuting.",
  homeCountdownLabel: "Tanlov tugashiga qoldi",
  homeCountdownAria: (days: number, hours: number, minutes: number) =>
    `Tanlov tugashiga ${days} kun ${hours} soat ${minutes} daqiqa qoldi`,
  homeContestOver: "Tanlov yakunlandi",
  homeJoin: "Ishtirok etish",
  homePrizesTitle: "Sovg'alar",
  homeAllPrizes: "Batafsil",
  homeVoucherCount: (perMonth: number, total: number) => `Har oy ${perMonth} ta · jami ${total} ta`,
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
  ratingPerVideoHint:
    "Har bir video alohida o'rin oladi, shuning uchun bitta ishtirokchi bir necha marta chiqishi mumkin. Sizning o'rningiz — eng ko'p ko'rilgan videongiz o'rni.",
  /** Ekran o'quvchi uchun: reyting qatori — bitta video. */
  ratingVideo: "Video",

  // Istoriyalar (24 soatlik videolar, bosh sahifada)
  storiesLabel: "Istoriyalar",
  storyAdd: "Istoriya qo'shish",
  storyAddHint: "Mahsulot haqida qisqa video joylang — 24 soat davomida hammaga ko'rinadi.",
  storyUploadingLabel: "Yuklanmoqda",
  storyUploadingAria: (percent: number) => `Istoriya yuklanmoqda: ${percent}%`,
  storyUploaded: "Istoriya joylandi — 24 soat ko'rinadi",
  storyBusy: "Oldingi video hali yuklanmoqda — biroz kuting.",
  storyErrorType: "Faqat video yuklash mumkin: MP4, MOV yoki WebM.",
  storyErrorSize: "Video juda katta — hajmi 50 MB gacha bo'lishi kerak.",
  storyErrorInvalid: "Videoni o'qib bo'lmadi. Boshqa video tanlang.",
  storyErrorLimit:
    "Bir vaqtda ko'pi bilan 10 ta istoriya bo'ladi. Eskisini o'chiring yoki muddati tugashini kuting.",
  storyErrorUnauthorized: "Istoriya joylash uchun ro'yxatdan o'tgan faol ishtirokchi bo'lishingiz kerak.",
  storyErrorNetwork: "Video yuklanmadi. Internetni tekshirib, qayta urinib ko'ring.",
  storyDismiss: "Yopish",
  storyViewerLabel: (name: string) => `${name} istoriyasi`,
  storyMineOpen: "Istoriyamni ko'rish",
  storyClose: "Yopish",
  storyMute: "Ovozni o'chirish",
  storyUnmute: "Ovozni yoqish",
  storyDelete: "Istoriyani o'chirish",
  storyDeleteConfirm: "Bu istoriya o'chirilsinmi? Uni endi hech kim ko'rmaydi.",
  storyDeleted: "Istoriya o'chirildi",
  storyDeleteFailed: "Istoriyani o'chirib bo'lmadi. Qayta urinib ko'ring.",
  storyUnavailable: "Istoriya muddati tugagan yoki o'chirilgan",
  storyPrev: "Oldingi istoriya",
  storyNext: "Keyingi istoriya",
  agoJustNow: "hozirgina",
  agoMinutes: (n: number) => `${n} daqiqa oldin`,
  agoHours: (n: number) => `${n} soat oldin`,

  // Mening videolarim
  reelTitle: "Mening videolarim",
  reelSubtitle: "Linklar va ko'rishlar statistikasi",
  stepLink: "Reel linkini yuboring",
  stepLinkBody:
    "Mahsulot haqidagi Reel linkini qo'ying. Video avtomatik tekshiriladi, ko'rishlar esa muntazam yangilanib boradi.",
  addReelTitle: "Yangi video qo'shing",
  addReelBody:
    "Videolar soni cheklanmagan: har biri alohida tekshiriladi va reytingda alohida o'rin oladi. Sizning o'rningiz — eng ko'p ko'rilgan videongiz o'rni, ko'rishlar qo'shilmaydi.",
  myReelsTitle: "Videolarim",
  myReelsCount: (accepted: number, total: number) =>
    accepted > 0 ? `${total} ta · ${accepted} tasi qabul qilingan` : `${total} ta`,
  reelSubmittedAt: (when: string) => `Yuborildi: ${when}`,
  reelBestBadge: "Eng yaxshi natija",
  reelRank: (rank: number) => `${rank}-o'rin`,
  reelRankHint: "Shu videoning reytingdagi o'rni",
  linkPlaceholder: "https://www.instagram.com/reel/...",
  paste: "Qo'yish",
  submit: "Yuborish",
  linkEmpty: "Linkni kiriting",
  linkInvalid: "Bu Instagram Reel linki emas. Namuna: https://www.instagram.com/reel/ABC123",
  linkTaken: "Bu video boshqa ishtirokchi tomonidan yuborilgan",
  linkAlready: "Bu videoni allaqachon yuborgansiz — u ro'yxatingizda bor",
  submitted: "Link yuborildi — video tekshirilmoqda",
  rulesHeading: "Shartlar",
  ruleTag: "Videoda zavod akkaunti belgilangan bo'lishi kerak",
  ruleOwn: "Video o'z akkauntingizda va ochiq bo'lishi kerak",
  ruleOneAccount: "Bitta Instagram akkaunt — bitta ishtirokchi",
  ruleNoTarget: "Pullik reklama (target) taqiqlangan",
  ruleNoFakeViews:
    "Nakrutka (sotib olingan ko'rishlar, botlar) taqiqlangan — aniqlansa, ishtirokchi tanlovdan chetlashtiriladi",
  openInInstagram: "Instagram'da ochish",
  copy: "Nusxalash",
  copied: "Nusxalandi",
  statusPending: "Tekshirilmoqda",
  statusAccepted: "Qabul qilindi",
  statusRejected: "Rad etildi",
  statusManualReview: "Qo'lda tekshirilmoqda",
  pendingNote: "Video tekshiruv navbatida. Natijani bot ham xabar qiladi.",
  /** "Tekshirilmoqda" va "Qo'lda tekshirilmoqda" videolar ostidagi izoh (buyurtmachi matni). */
  weeklyCheckNote: (days: number) =>
    `Videolar ${syncPeriod(days)} tekshiriladi — tekshiruvdan so'ng reytingdagi o'rningiz aniqlanadi.`,
  rejectedNote: "Video rad etildi. Savollar bo'lsa, bot orqali supportga yozing.",
  rejectReasons: {
    NOT_FOUND:
      "Video Instagram'da topilmadi. Link to'g'riligini va akkauntingiz ochiq (yopiq emas) ekanini tekshiring.",
    NOT_A_VIDEO: "Yuborilgan link Reel (video) emas. Mahsulot haqidagi Reel linkini yuboring.",
    OWNER_TAKEN:
      "Bu Instagram akkauntdan boshqa ishtirokchi video yuborgan. Bitta akkaunt — bitta ishtirokchi. Xato bo'lsa, supportga yozing.",
  },
  manualReviewNote:
    "Bu videoni Instagram'da 3 marta topa olmadik, shuning uchun uni administrator qo'lda tekshiradi. Natijani bot orqali xabar qilamiz. Shu orada akkauntingiz ochiq (yopiq emas) va video o'chirilmaganini tekshiring.",
  /** Plitka tor (telefonda ~130px) — bir qatorga sig'adigan qisqa matn. */
  statBest: "Eng ko'p ko'rilgan",
  statToday: "Oxirgi o'sish",
  statRank: "Reytingdagi o'rin",
  statRankDelta: "O'rin o'zgarishi",
  noChange: "o'zgarishsiz",
  chartTitle: "Ko'rishlar o'sishi",
  chartSubtitle: "Eng ko'p ko'rilgan videongiz — har bir yangilanishdagi o'sish",
  lastSyncedLabel: "Oxirgi yangilanish",
  nextSyncLabel: "Keyingi yangilanish",
  syncEvery: (days: number) => `Ko'rishlar ${syncPeriod(days)} yangilanadi`,
  inDays: (days: number) => (days <= 0 ? "bugun" : days === 1 ? "ertaga" : `${days} kundan keyin`),
  months: [
    "yanvar",
    "fevral",
    "mart",
    "aprel",
    "may",
    "iyun",
    "iyul",
    "avgust",
    "sentabr",
    "oktabr",
    "noyabr",
    "dekabr",
  ],

  // Profil
  profileTitle: "Profil",
  profileRole: "Tanlov ishtirokchisi",
  profileWish: "Yangi yil muborak!",
  profileStatRank: "O'rin",
  profileStatViews: "Ko'rish",
  profileStatDays: "Kun qoldi",
  profileFooter: "Yangi yilingiz omadli kelsin! — Olivia jamoasi",
  profileDevTeam: "Dasturchilar jamoasi:",
  phone: "Telefon",
  profileLocked:
    "Ism, familiya va yosh ro'yxatdan o'tishda bir marta kiritiladi va o'zgartirilmaydi.",
  menuSupport: "Supportga yozish",
  supportTitle: "Support",
  supportIntroTitle: "Savolingiz bormi? Yozing!",
  supportIntroBody:
    "Operatorlarimiz ish vaqtida javob beradi. Javob shu yerda va Telegram botda ham keladi — ilovadan ham, saytdan ham yozishingiz mumkin.",
  supportEmpty: "Hali yozishma yo'q. Savolingizni pastda yozing ❄️",
  supportOperator: "Operator",
  supportTyping: "yozmoqda…",
  supportPlaceholder: "Savolingizni yozing…",
  supportSend: "Yuborish",
  supportErrorInvalid: "Xabar bo'sh yoki juda uzun (1000 belgigacha).",
  supportErrorLimit: "Juda ko'p xabar yubordingiz — 10 daqiqadan keyin qayta urinib ko'ring.",
  supportDraftField: (field: string) =>
    `Assalomu alaykum! Profilimdagi «${field}» noto'g'ri kiritilgan. To'g'risi: `,
  lockedTitle: (field: string) => `«${field}» o'zgartirilmaydi`,
  lockedBody:
    "Ism, familiya va yosh ro'yxatdan o'tishda bir marta kiritiladi va keyin o'zgartirib bo'lmaydi. Xato kiritilgan bo'lsa, supportga yozing — operator tekshirib, to'g'rilab beradi.",
  lockedWriteSupport: "Supportga yozish",
  lockedClose: "Yopish",
  menuRules: "Tanlov qoidalari",
  menuWinner: "G'olib",
  supportHint:
    "Savolingizni bot chatiga yozing — operator shu yerda javob beradi. Kerak bo'lsa, skrinshot ham yuboring.",
  deleteAccount: "Ishtirokni bekor qilish",
  deleteConfirm:
    "Ishtirok bekor qilinsinmi? Videolaringiz va ma'lumotlaringiz tanlovdan o'chiriladi. Bu amalni ortga qaytarib bo'lmaydi.",

  // G'olib
  winnerTitle: "G'olib",
  winnerPendingTitle: "G'olib hali e'lon qilinmagan",
  winnerPendingBody: "G'olib tanlov tugagach, tekshiruvdan so'ng e'lon qilinadi.",
  winnerCongrats: "Tabriklaymiz!",
  winnerPrize: "Avtomobil sohibi",
  winnerAnnounced: (date: string) => `E'lon qilingan: ${date}`,
  winnerCountdown: "Tanlov tugashiga",
  winnerUnitDays: "kun",
  winnerUnitHours: "soat",
  winnerUnitMinutes: "daqiqa",
  unitSeconds: "soniya",

  // Holatlar
  blockedTitle: "Ishtirok to'xtatilgan",
  blockedBody: "Akkauntingiz vaqtincha bloklangan. Batafsil ma'lumot uchun bot orqali supportga yozing.",
  disqualifiedTitle: "Tanlovdan chetlatilgansiz",
  disqualifiedBody:
    "Tanlov qoidalari buzilgani sababli ishtirokingiz bekor qilindi. Savollar bo'lsa, bot orqali supportga yozing.",

  // Sovg'alar
  prizesTitle: "Sovg'alar",
  prizesSubtitle: "Ko'rish yig'ing — sovrinlarni oling",
  fundLabel: "Sovrin fondi",
  fundTotal: "ta sovrin",
  fundBody: "Har oy voucherlar random o'ynaladi (bir kishiga bir marta), aksiya yakunida esa asosiy sovrinlar reyting bo'yicha topshiriladi.",
  monthlyTag: "Har oylik sovrin",
  sum: "so'm",
  perMonth: "har oy",
  totalPieces: "jami",
  randomDraw: "Tasodifiy tanlov",
  monthlyWho: (min: string, max: string) =>
    `Oy davomidagi eng ko'p ko'rilgan tasdiqlangan Reeli ${min} dan ${max} gacha ko'rish yig'gan ishtirokchilar qatnashadi`,
  monthlyDraw: "G'oliblar tasodifiy tanlov (random) orqali aniqlanadi. Voucher bir kishiga aksiya davomida faqat bir marta beriladi",
  stagesTitle: "Bosqichlar",
  stageLabel: (n: number) => `${n}-bosqich`,
  stageNow: "Hozir",
  stageDone: "Yakunlangan",
  stageSoon: "Kutilmoqda",
  stageStartsIn: (n: number, days: number) =>
    days === 0 ? `${n}-bosqich bugun boshlanadi` : `${n}-bosqich ${days} kundan keyin boshlanadi`,
  stageEndsIn: (n: number, days: number) =>
    days === 0 ? `${n}-bosqichning oxirgi kuni` : `${n}-bosqich davom etmoqda — tugashiga ${days} kun`,
  stagesFinished: "Barcha bosqichlar yakunlandi",
  mainTitle: "Asosiy sovrinlar",
  mainSubtitle: "Aksiya yakunida — eng ko'p ko'rilgan bitta Reelingiz ko'rishlari bo'yicha (videolar qo'shilmaydi)",
  mainPrize: "Bosh sovrin",
  viewsWord: "ko'rish",
  andMore: "va undan ko'p",
  pieces: (n: number, unit: string | null) => `${n} ta${unit ? ` ${unit}` : ""}`,
  tierWinners: (n: number) =>
    n === 1
      ? "Toifada videosi eng ko'p ko'rilgan ishtirokchi yutadi"
      : `Toifada videosi eng ko'p ko'rilgan ${n} kishi yutadi`,
  youAreHere: "Siz shu yerdasiz",
  tierReached: "Erishildi",
  viewsLeft: (n: string) => `yana ${n} ko'rish`,
  startLabel: "Eng ko'p ko'rilgan videongiz",
  startNoReel: "Video yuboring — eng ko'p ko'rilgan videongiz ko'rishlari shu yerda hisoblanadi",
  startSendVideo: "Video yuborish",
  startNext: (title: string, left: string) => `Keyingi sovrin — ${title}: yana ${left} ko'rish`,
  startTop: "Siz eng yuqori toifadasiz!",
  notesTitle: "Muhim",
  goodLuck: "Omad!",

  // Reklama haqida xabar (shikoyat)
  menuReport: "Reklamani ko'rdim",
  moreReportHint: "Target haqida xabar berish",
  reportTitle: "Reklamani ko'rdim",
  reportHeroTitle: "Kimdir videosini reklama qilyaptimi?",
  reportHeroBody:
    "Tanlovda pullik reklama (target) taqiqlangan. Lentangizda boshqa ishtirokchining videosi «Reklama» yoki «Sponsored» belgisi bilan chiqsa — skrinshot oling va shu yerga yuboring.",
  reportStep1: "Reklamaning skrinshotini oling — «Reklama» yozuvi ko'rinib tursin",
  reportStep2: "Akkaunt nomini yoki Reel linkini yozing",
  reportStep3: "Yuboring — admin tekshirib chiqadi",
  reportTargetLabel: "Kim reklama qilyapti?",
  reportTargetPlaceholder: "@username yoki Reel linki",
  reportScreenshotLabel: "Reklama skrinshoti",
  reportPickScreenshot: "Skrinshotni tanlang",
  reportPickHint: "Galereyadan rasm",
  reportReplace: "Almashtirish",
  reportRemove: "Rasmni olib tashlash",
  reportPreparing: "Rasm tayyorlanmoqda…",
  reportCommentLabel: "Izoh (ixtiyoriy)",
  reportCommentPlaceholder: "Masalan: kecha kechqurun lentamda chiqdi",
  reportSend: "Yuborish",
  reportPrivacy: "Kim yuborgani faqat adminga ko'rinadi. Kuniga ko'pi bilan 5 ta xabar.",
  reportDoneTitle: "Rahmat! Xabaringiz yuborildi",
  reportDoneBody:
    "Admin skrinshotni tekshiradi. Qoidabuzarlik tasdiqlansa, ishtirokchi tanlovdan chetlashtiriladi.",
  reportAnother: "Yana xabar berish",
  reportBackToRating: "Reytingga qaytish",
  reportTargetEmpty: "Akkaunt nomini yoki Reel linkini yozing.",
  reportScreenshotEmpty: "Reklama skrinshotini qo'shing.",
  reportTargetInvalid: "Akkaunt nomi yoki Reel linki noto'g'ri yozilgan.",
  reportNotFound: "Bu akkaunt yoki video tanlovda qatnashmayapti.",
  reportSelf: "O'zingiz haqingizda xabar yubora olmaysiz.",
  reportDuplicate: "Bugun bu ishtirokchi haqida allaqachon xabar yuborgansiz.",
  reportLimit: "Bugungi chegara tugadi (kuniga 5 ta). Ertaga urinib ko'ring.",
  reportImageInvalid: "Rasmni o'qib bo'lmadi. Boshqa skrinshot tanlang.",

  // Dev
  devBanner: "Dev rejim: Telegram'dan tashqarida, soxta ma'lumotlar",
  devReset: "Boshidan boshlash",
} as const;
