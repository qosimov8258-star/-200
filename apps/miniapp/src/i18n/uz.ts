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
    "OLIVIA mahsuloti ishtirokidagi Instagram Reel joylang, ko'rish yig'ing va sovrinlar tasodifiy tanlovida qatnashing.",
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

  // Veb-sayt: ro'yxatdan o'tish (til tanlangach birinchi ekran — ism va telefon raqam)
  webSignupTitle: "Ro'yxatdan o'tish",
  webSignupSubtitle: "Ismingiz va telefon raqamingizni kiriting.",
  webSignupBack: "Orqaga",
  webSignupDeviceNote:
    "Hisobingiz shu brauzerda saqlanadi — keyin ham shu telefon yoki kompyuterdan kiring.",
  webLoginFailed: "Kirib bo'lmadi. Qayta urinib ko'ring.",
  webLoginNotConfigured: "Saytga kirish hali sozlanmagan. Tanlovda Telegram bot orqali qatnashing.",
  webLoginMock: "Telegram orqali kirish (sinov)",
  webLogout: "Saytdan chiqish",
  // Veb-sayt: "Hisobim bor" — Telegram bot orqali qaytib kirish (parol va SMS'siz)
  webHaveAccount: "Hisobim bor — kirish",
  webLoginTitle: "Hisobingizga kirish",
  webLoginSubtitle:
    "Telegram bot orqali bir necha soniyada — parol va SMS kerak emas. Saytda ro'yxatdan o'tgan bo'lsangiz ham shu yo'l.",
  webLoginCodeLabel: "Botda shu kodni ko'rasiz",
  webLoginSteps: [
    "Pastdagi tugmani bosing — Telegram bot ochiladi.",
    "Kerak bo'lsa, ro'yxatdan o'tgan raqamingizni ulashing.",
    "Kod bir xil bo'lsa, botda «Ha, kirish» ni bosing va shu sahifaga qayting.",
  ],
  webLoginOpenBot: "Botda tasdiqlash",
  webLoginWaiting: "Botdagi tasdiq kutilmoqda — sahifa o'zi ochiladi…",
  webLoginMockNote: "Sinov rejimi: bir necha soniyada o'zi tasdiqlanadi.",
  webLoginDenied: "Kirish bekor qilindi («Men emas»).",
  webLoginTaken:
    "Bu raqam boshqa Telegram hisobiga bog'langan — botdagi xabarni o'qing yoki botga yozing, support yordam beradi.",
  webLoginExpired: "Kod eskirdi yoki ishlatildi.",
  webLoginLocked:
    "Bu hisobga saytda qayta kirish yopiq — hisobga bir marta kiriladi. Qayta kirish uchun Telegram botda «💬 Supportga yozish» ni bosib yozing: admin tekshirib, ruxsat beradi.",
  webLoginSupport: "Supportga yozish (Telegram)",
  deviceTaken:
    "Bu qurilmada hisob allaqachon ochilgan — bitta qurilmada bitta hisob. Qaytib kirish uchun «Hisobim bor — kirish» ni bosing.",
  webLoginTooMany: "Juda ko'p urinish. 10 daqiqadan keyin qayta urinib ko'ring.",
  webLoginRetry: "Yangi kod olish",
  webLoginOr: "yoki",
  webLoginWidget: "Telegram hisobi bilan kirish",
  webLoginBack: "Orqaga",
  linkTelegramTitle: "Hisobingizni Telegram'ga ulang",
  linkTelegramBody:
    "Hozir hisobingiz faqat shu brauzerda. Telegram'ga ulasangiz — boshqa telefon yoki kompyuterdan ham kirasiz va natijalar haqida bot xabar beradi.",
  linkTelegramCta: "Telegram'ga ulash",
  linkTelegramWaiting:
    "Botda raqamingizni ulashing — saytda yozgan raqamingiz. Ulangach, saytga «Hisobim bor — kirish» orqali kirasiz.",
  phonePlaceholder: "90 123 45 67",
  phoneInvalid: "Raqamni to'liq kiriting: 90 123 45 67",
  phoneTaken: "Bu raqam bilan hisob bor — qayta ro'yxatdan o'tish shart emas.",
  phoneTakenLogin: "Hisobimga kirish",
  tooManyAttempts: "Juda ko'p urinish. Birozdan keyin qayta urinib ko'ring.",
  phoneVerified: "Tasdiqlangan",
  logoutConfirmTitle: "Saytdan chiqasizmi?",
  logoutConfirmBody:
    "Hisobingiz va ko'rishlaringiz saqlanib qoladi. Lekin hisobga saytda bir marta kiriladi: qaytib kirish uchun Telegram botda supportga yozib, admin ruxsatini olishingiz kerak bo'ladi.",
  logoutStay: "Qolaman",
  logoutLeave: "Ha, chiqish",

  // Veb-sayt: support
  supportWebHint: "Support Telegram botda — ochilgan chatga savolingizni yozing.",

  // Ro'yxatdan o'tish
  registerTitle: "Ro'yxatdan o'tish",
  registerSubtitle: "Ma'lumotlarni hujjatdagidek kiriting.",
  registerWarning: "Diqqat: ism bir marta kiritiladi. Keyin uni o'zgartirib bo'lmaydi.",
  firstName: "Ism",
  lastName: "Familiya",
  age: "Yosh",
  nameInvalid: "Kamida 2 ta harf kiriting",
  // Tasdiqlash oynasi (Telegram'dan tashqarida)
  confirmOk: "Tasdiqlash",
  confirmCancel: "Bekor qilish",
  confirmProfile: (first: string, phone: string) =>
    `Ma'lumotlar to'g'rimi?\n\n${first}\n${phone}\n\nTasdiqlagandan keyin ismni o'zgartirib bo'lmaydi.`,

  // Qoidalar
  rulesTitle: "Ommaviy oferta",
  rulesVideoLabel: "Qoidalar haqida qisqa video",
  rulesHeroBadge: "Rasmiy shartlar",
  rulesHeroBody: "«OLIVIA» reklama aksiyasida ishtirok etish shartlari (ommaviy oferta). Video yuborishdan oldin o'qib chiqing 🎄",
  rulesSectionsCount: (n: number) => `${n} ta bo'lim`,
  rulesAgree: "Ommaviy oferta shartlari bilan tanishdim va roziman",
  rulesReadToEnd: "Oferta bilan oxirigacha tanishib chiqing — rozilik belgisi eng pastda.",
  offerPdfTitle: "Ommaviy ofertani yuklab olish",
  scrollToEnd: "Oxiriga tushish",
  offerPdfHint: "Imzolangan asl nusxa · PDF, 5 MB",
  offerPdfFileName: "Ommaviy-oferta-OLIVIA.pdf",
  rulesUpdatedTitle: "Ommaviy oferta",
  rulesUpdatedBody:
    "Aksiya shartlari ommaviy oferta ko'rinishida e'lon qilindi. Davom etish uchun oferta bilan tanishib, uni qabul qiling.",
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
    "Reyting — umumiy tasdiqlangan ko'rishlar (barcha videolaringiz yig'indisi) bo'yicha va faqat ma'lumot uchun: g'oliblar har bir sovrin oralig'ida tasodifiy tanlov (random) bilan aniqlanadi.",
  /** Ekran o'quvchi uchun: reyting qatori — bitta ishtirokchi. */
  ratingVideo: "Ishtirokchi",

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
    "Videolar soni cheklanmagan: har biri alohida tekshiriladi, barcha tasdiqlangan videolaringiz ko'rishlari qo'shib hisoblanadi.",
  myReelsTitle: "Videolarim",
  myReelsCount: (accepted: number, total: number) =>
    accepted > 0 ? `${total} ta · ${accepted} tasi qabul qilingan` : `${total} ta`,
  reelSubmittedAt: (when: string) => `Yuborildi: ${when}`,
  linkPlaceholder: "https://www.instagram.com/reel/...",
  paste: "Qo'yish",
  submit: "Yuborish",
  linkEmpty: "Linkni kiriting",
  linkInvalid: "Bu Instagram Reel linki emas. Namuna: https://www.instagram.com/reel/ABC123",
  linkTaken: "Bu video boshqa ishtirokchi tomonidan yuborilgan",
  linkAlready: "Bu videoni allaqachon yuborgansiz — u ro'yxatingizda bor",
  submitted: "Link yuborildi — video tekshirilmoqda",
  rulesHeading: "Shartlar",
  ruleTag: "Video tavsifida #reklama yoki #OLIVIAaksiya xeshtegi bo'lishi shart",
  ruleOwn: "Videoda OLIVIA mahsuloti aniq ko'rinsin; video o'z akkauntingizda va ochiq bo'lsin",
  ruleOneAccount: "Har bir ishtirokchi faqat bitta shaxsiy Instagram akkaunt orqali qatnashadi",
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
    `Ko'rishlar ${syncPeriod(days)} yangilanadi — shundan so'ng umumiy ko'rishlaringiz ham yangilanadi.`,
  rejectedNote: "Video rad etildi. Savollar bo'lsa, bot orqali supportga yozing.",
  rejectReasons: {
    NOT_FOUND:
      "Video Instagram'da topilmadi. Link to'g'riligini va akkauntingiz ochiq (yopiq emas) ekanini tekshiring.",
    NOT_A_VIDEO: "Yuborilgan link Reel (video) emas. Mahsulot haqidagi Reel linkini yuboring.",
    OWNER_TAKEN:
      "Bu Instagram akkauntdan boshqa ishtirokchi video yuborgan. Bitta akkaunt — bitta ishtirokchi. Xato bo'lsa, supportga yozing.",
    NO_PRODUCT:
      "Videoda tanlov mahsuloti ko'rinmadi. Mahsulot aniq ko'rinadigan Reel joylab, linkini qaytadan yuboring.",
  },
  manualReviewNote:
    "Bu videoni administrator qo'lda tekshiradi — natijani bot orqali xabar qilamiz. Shu orada akkauntingiz ochiq (yopiq emas) va video o'chirilmaganini tekshiring.",
  /** Plitka tor (telefonda ~130px) — bir qatorga sig'adigan qisqa matn. */
  statBest: "Umumiy ko'rishlar",
  statToday: "Oxirgi o'sish",
  statRank: "Reytingdagi o'rin",
  statRankDelta: "O'rin o'zgarishi",
  noChange: "o'zgarishsiz",
  chartTitle: "Ko'rishlar o'sishi",
  chartSubtitle: "Barcha videolaringiz — har bir yangilanishdagi o'sish",
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
  phone: "Telefon raqam",
  phoneShort: "Telefon",
  profileLocked: "Ism ro'yxatdan o'tishda bir marta kiritiladi va o'zgartirilmaydi.",
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
    "Ism ro'yxatdan o'tishda bir marta kiritiladi va keyin uni o'zgartirib bo'lmaydi. Xato kiritilgan bo'lsa, supportga yozing — operator tekshirib, to'g'rilab beradi.",
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
  fundBody:
    "Har oy voucherlar tasodifiy tanlov (random) bilan o'ynaladi, aksiya yakunida esa asosiy sovrinlar ham har bir ko'rishlar oralig'ida random aniqlanadi.",
  monthlyTag: "Har oylik sovrin",
  sum: "so'm",
  perMonth: "har oy",
  totalPieces: "jami",
  randomDraw: "Tasodifiy tanlov",
  monthlyWho: (min: string, max: string) =>
    `Oylik bosqichda ro'yxatdan o'tkazilgan videolari jami ${min} dan ${max} gacha tasdiqlangan ko'rish yig'gan ishtirokchilar qatnashadi`,
  monthlyDraw: "G'oliblar tasodifiy tanlov (random) orqali aniqlanadi. Talablarni bajarsangiz, bir necha oy davomida voucher yutishingiz mumkin",
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
  mainSubtitle: "Aksiya yakunida — barcha videolaringizning umumiy tasdiqlangan ko'rishlari bo'yicha, oraliq ichida random",
  mainPrize: "Bosh sovrin",
  viewsWord: "ko'rish",
  andMore: "va undan ko'p",
  pieces: (n: number, unit: string | null) => `${n} ta${unit ? ` ${unit}` : ""}`,
  tierWinners: (n: number) =>
    n === 1
      ? "Shu oraliqdagi ishtirokchilar orasidan random bilan 1 kishi yutadi"
      : `Shu oraliqdagi ishtirokchilar orasidan random bilan ${n} kishi yutadi`,
  youAreHere: "Siz shu yerdasiz",
  tierReached: "Erishildi",
  viewsLeft: (n: string) => `yana ${n} ko'rish`,
  startLabel: "Umumiy ko'rishlaringiz",
  startNoReel: "Video yuboring — barcha videolaringiz ko'rishlari shu yerda qo'shib hisoblanadi",
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
