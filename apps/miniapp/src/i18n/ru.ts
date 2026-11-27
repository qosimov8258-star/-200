import type { Texts } from "./index";

/**
 * Русское склонение после числа: 1 → `one` ("просмотр"), 2–4 → `few` ("просмотра"),
 * 0 и 5–20 → `many` ("просмотров"); 11–14 — всегда `many`.
 */
const plural = (n: number, one: string, few: string, many: string) => {
  const mod100 = Math.abs(n) % 100;
  const mod10 = mod100 % 10;
  if (mod100 >= 11 && mod100 <= 14) return many;
  if (mod10 === 1) return one;
  if (mod10 >= 2 && mod10 <= 4) return few;
  return many;
};

/** Число из уже отформатированной строки ("1 234 567" → 1234567) — для выбора формы слова. */
const numberOf = (formatted: string) => Number(formatted.replace(/\D/g, "")) || 0;

const dayWord = (n: number) => plural(n, "день", "дня", "дней");
const viewWord = (formatted: string) => plural(numberOf(formatted), "просмотр", "просмотра", "просмотров");

/**
 * Период сбора просмотров и проверки видео (`MyReels.syncEveryDays`):
 * 1 → "ежедневно", 7 → "раз в неделю", иначе → "каждые N дней" ("каждый 21 день").
 */
const syncPeriod = (days: number) =>
  days === 1
    ? "ежедневно"
    : days === 7
      ? "раз в неделю"
      : `${plural(days, "каждый", "каждые", "каждые")} ${days} ${dayWord(days)}`;

/** Все тексты интерфейса на русском языке (та же структура, что и uz.ts). */
export const ru: Texts = {
  appTitle: "Конкурс Reels",
  loading: "Загрузка…",
  loadError: "Не удалось загрузить данные",
  retry: "Повторить",
  genericError: "Произошла ошибка. Попробуйте ещё раз.",
  continue: "Продолжить",
  back: "Назад",

  // Приветствие и передача номера
  prizeLabel: "Главный приз",
  heroTitle: "Выложите Reels —\nвыиграйте автомобиль",
  heroBody:
    "Выложите в Instagram Reels с продукцией OLIVIA, набирайте просмотры и участвуйте в розыгрыше призов.",
  shareContact: "Поделиться номером",
  shareContactHint:
    "Для регистрации поделитесь номером телефона из Telegram. Один номер — один участник.",
  contactWaiting: "Проверяем номер…",
  contactDeclined: "Без номера зарегистрироваться нельзя. Попробуйте ещё раз.",
  contactUnsupported:
    "Обновите приложение Telegram или нажмите кнопку «Поделиться номером» в чате бота.",
  shareContactViaBot: "Поделиться номером в боте",
  shareContactWebHint:
    "Номер передаётся через Telegram-бота: нажмите кнопку, в открывшемся чате выберите «Поделиться номером» и вернитесь на эту страницу. Один номер — один участник.",
  contactWebWaiting: "Когда поделитесь номером в Telegram, страница обновится сама…",

  // Веб-сайт: регистрация (первый экран после выбора языка — имя и номер телефона)
  webSignupTitle: "Регистрация",
  webSignupSubtitle: "Введите имя и номер телефона.",
  webSignupBack: "Назад",
  webSignupDeviceNote:
    "Аккаунт сохраняется в этом браузере — входите и дальше с этого телефона или компьютера.",
  webLoginFailed: "Не удалось войти. Попробуйте ещё раз.",
  webLoginNotConfigured: "Вход на сайт пока не настроен. Участвуйте в конкурсе через Telegram-бота.",
  webLoginMock: "Вход через Telegram (тест)",
  webLogout: "Выйти с сайта",
  // Веб-сайт: «У меня есть аккаунт» — повторный вход через Telegram-бота (без пароля и SMS)
  webHaveAccount: "У меня есть аккаунт — войти",
  webLoginTitle: "Вход в аккаунт",
  webLoginSubtitle:
    "Через Telegram-бота за несколько секунд — без пароля и SMS. Этот способ подходит и для тех, кто регистрировался на сайте.",
  webLoginCodeLabel: "Этот код вы увидите в боте",
  webLoginSteps: [
    "Нажмите кнопку ниже — откроется Telegram-бот.",
    "Если нужно, поделитесь номером, с которым регистрировались.",
    "Если код совпадает, нажмите в боте «Да, войти» и вернитесь на эту страницу.",
  ],
  webLoginOpenBot: "Подтвердить в боте",
  webLoginWaiting: "Ждём подтверждения в боте — страница откроется сама…",
  webLoginMockNote: "Тестовый режим: подтвердится автоматически через несколько секунд.",
  webLoginDenied: "Вход отменён («Это не я»).",
  webLoginTaken:
    "Этот номер привязан к другому аккаунту Telegram — прочитайте сообщение в боте или напишите боту, поддержка поможет.",
  webLoginExpired: "Код устарел или уже использован.",
  webLoginTooMany: "Слишком много попыток. Попробуйте снова через 10 минут.",
  webLoginRetry: "Получить новый код",
  webLoginOr: "или",
  webLoginWidget: "Войти через аккаунт Telegram",
  webLoginBack: "Назад",
  linkTelegramTitle: "Привяжите аккаунт к Telegram",
  linkTelegramBody:
    "Сейчас ваш аккаунт есть только в этом браузере. Привяжите его к Telegram — сможете входить с другого телефона или компьютера, а бот сообщит о результатах.",
  linkTelegramCta: "Привязать к Telegram",
  linkTelegramWaiting:
    "Поделитесь в боте номером — тем, что указали на сайте. После привязки входите на сайт через «У меня есть аккаунт — войти».",
  phonePlaceholder: "90 123 45 67",
  phoneInvalid: "Введите номер полностью: 90 123 45 67",
  phoneTaken: "С этим номером уже есть аккаунт — регистрироваться заново не нужно.",
  phoneTakenLogin: "Войти в аккаунт",
  tooManyAttempts: "Слишком много попыток. Попробуйте чуть позже.",
  phoneVerified: "Подтверждён",
  logoutConfirmTitle: "Выйти с сайта?",
  logoutConfirmBody:
    "Ваш аккаунт и просмотры сохранятся. Чтобы вернуться, нажмите «У меня есть аккаунт — войти» — подарки ждут вас.",
  logoutStay: "Остаться",
  logoutLeave: "Да, выйти",

  // Веб-сайт: поддержка
  supportWebHint: "Поддержка — в Telegram-боте: напишите свой вопрос в открывшемся чате.",

  // Регистрация
  registerTitle: "Регистрация",
  registerSubtitle: "Введите данные так, как в документе.",
  registerWarning: "Внимание: имя вводится один раз. Изменить его потом нельзя.",
  firstName: "Имя",
  lastName: "Фамилия",
  age: "Возраст",
  nameInvalid: "Введите не менее 2 букв",
  // Окно подтверждения (вне Telegram)
  confirmOk: "Подтвердить",
  confirmCancel: "Отмена",
  confirmProfile: (first: string, phone: string) =>
    `Данные верны?\n\n${first}\n${phone}\n\nПосле подтверждения имя изменить нельзя.`,

  // Правила
  rulesTitle: "Публичная оферта",
  rulesVideoLabel: "Короткое видео о правилах",
  rulesHeroBadge: "Официальные условия",
  rulesHeroBody: "Условия участия в рекламной акции «OLIVIA» (публичная оферта). Прочитайте перед отправкой видео 🎄",
  rulesSectionsCount: (n: number) => `${n} ${plural(n, "раздел", "раздела", "разделов")}`,
  rulesAgree: "С условиями публичной оферты ознакомлен(а) и согласен(на)",
  rulesReadToEnd: "Прочитайте оферту до конца — отметка о согласии в самом низу.",
  offerPdfTitle: "Скачать публичную оферту",
  scrollToEnd: "Вниз, к концу",
  offerPdfHint: "Подписанный оригинал · PDF, 5 МБ",
  offerPdfFileName: "Публичная-оферта-OLIVIA.pdf",
  rulesUpdatedTitle: "Публичная оферта",
  rulesUpdatedBody:
    "Условия акции опубликованы в виде публичной оферты. Чтобы продолжить, ознакомьтесь с офертой и примите её.",
  rulesStale: "Правила только что снова обновились. Пожалуйста, просмотрите их ещё раз.",

  // Навигация
  navHome: "Главная",
  navRating: "Рейтинг",
  // Нижнее меню: коротко «Видео» (заголовок экрана — «Мои видео»).
  navReel: "Видео",
  navProfile: "Профиль",
  navMore: "Ещё",
  navPrizes: "Призы",
  moreClose: "Закрыть",
  morePrizesHint: "Ваучеры и главные призы",
  moreRulesHint: "Условия участия",
  moreWinnerHint: "Итоги конкурса",

  // Рейтинг
  greetingByTime: { morning: "Доброе утро", day: "Добрый день", evening: "Добрый вечер" },
  /** Строки, сменяющиеся под именем. */
  homeTaglines: [
    "Добро пожаловать в конкурс",
    "Новогодние подарки ждут 🎁",
    "Просмотры превращаются в подарки ✨",
    "Главный приз — автомобиль 🚗",
  ],
  homeStartedTitle: "запускает конкурс! 🎉",
  homeStartedBody: "Выкладывайте Reels о нашей продукции, набирайте просмотры и выигрывайте ценные подарки.",
  homeCountdownLabel: "До конца конкурса осталось",
  homeCountdownAria: (days: number, hours: number, minutes: number) =>
    `До конца конкурса: ${days} ${dayWord(days)} ${hours} ${plural(hours, "час", "часа", "часов")} ${minutes} ${plural(minutes, "минута", "минуты", "минут")}`,
  homeContestOver: "Конкурс завершён",
  homePrizesTitle: "Призы",
  homeAllPrizes: "Подробнее",
  homeVoucherCount: (perMonth: number, total: number) => `Каждый месяц ${perMonth} шт. · всего ${total} шт.`,
  daysLeft: (days: number) =>
    `До конца конкурса ${plural(days, "остался", "осталось", "осталось")} ${days} ${dayWord(days)}`,
  contestFinished: "Конкурс завершён",
  ratingTitle: "Рейтинг",
  participants: (count: string) =>
    `${count} ${plural(numberOf(count), "участник", "участника", "участников")}`,
  filterAll: "Все",
  filterTop10: "Топ-10",
  filterNearMe: "Рядом со мной",
  firstPlace: "1-е место",
  views: (count: string) => `${count} ${viewWord(count)}`,
  myRank: (rank: number) => `Моё место: ${rank}`,
  sendVideoCta: "Отправьте своё видео",
  you: "Вы",
  ratingEmpty: "Рейтинг ещё не сформирован",
  nearMeEmpty: "После отправки видео здесь появится ваше место",
  ratingPerVideoHint:
    "Рейтинг строится по общему числу подтверждённых просмотров (сумма по всем вашим видео) и носит лишь информационный характер: победители в каждом диапазоне призов определяются случайным выбором (random).",
  /** Для экранного диктора: строка рейтинга — один участник. */
  ratingVideo: "Участник",

  // Истории (видео на 24 часа, на главной)
  storiesLabel: "Истории",
  storyAdd: "Добавить историю",
  storyAddHint: "Выложите короткое видео о продукции — его будут видеть все в течение 24 часов.",
  storyUploadingLabel: "Загрузка",
  storyUploadingAria: (percent: number) => `Загрузка истории: ${percent}%`,
  storyUploaded: "История опубликована — она будет видна 24 часа",
  storyBusy: "Предыдущее видео ещё загружается — подождите немного.",
  storyErrorType: "Можно загрузить только видео: MP4, MOV или WebM.",
  storyErrorSize: "Видео слишком большое — размер должен быть не более 50 МБ.",
  storyErrorInvalid: "Не удалось прочитать видео. Выберите другое.",
  storyErrorLimit:
    "Одновременно можно держать не более 10 историй. Удалите старую или дождитесь окончания её срока.",
  storyErrorUnauthorized: "Чтобы публиковать истории, нужно быть зарегистрированным активным участником.",
  storyErrorNetwork: "Видео не загрузилось. Проверьте интернет и попробуйте ещё раз.",
  storyDismiss: "Закрыть",
  storyViewerLabel: (name: string) => `История: ${name}`,
  storyMineOpen: "Посмотреть мою историю",
  storyClose: "Закрыть",
  storyMute: "Выключить звук",
  storyUnmute: "Включить звук",
  storyDelete: "Удалить историю",
  storyDeleteConfirm: "Удалить эту историю? Её больше никто не увидит.",
  storyDeleted: "История удалена",
  storyDeleteFailed: "Не удалось удалить историю. Попробуйте ещё раз.",
  storyUnavailable: "Срок истории истёк, или она удалена",
  storyPrev: "Предыдущая история",
  storyNext: "Следующая история",
  agoJustNow: "только что",
  agoMinutes: (n: number) => `${n} ${plural(n, "минуту", "минуты", "минут")} назад`,
  agoHours: (n: number) => `${n} ${plural(n, "час", "часа", "часов")} назад`,

  // Мои видео
  reelTitle: "Мои видео",
  reelSubtitle: "Ссылки и статистика просмотров",
  stepLink: "Отправьте ссылку на Reels",
  stepLinkBody:
    "Вставьте ссылку на Reels о продукции. Видео проверяется автоматически, а просмотры регулярно обновляются.",
  addReelTitle: "Добавьте новое видео",
  addReelBody:
    "Количество видео не ограничено: каждое проверяется отдельно, просмотры всех подтверждённых видео суммируются.",
  myReelsTitle: "Мои видео",
  myReelsCount: (accepted: number, total: number) =>
    accepted > 0 ? `${total} видео · принято: ${accepted}` : `${total} видео`,
  reelSubmittedAt: (when: string) => `Отправлено: ${when}`,
  linkPlaceholder: "https://www.instagram.com/reel/...",
  paste: "Вставить",
  submit: "Отправить",
  linkEmpty: "Введите ссылку",
  linkInvalid: "Это не ссылка на Instagram Reels. Пример: https://www.instagram.com/reel/ABC123",
  linkTaken: "Это видео уже отправил другой участник",
  linkAlready: "Вы уже отправляли это видео — оно есть в вашем списке",
  submitted: "Ссылка отправлена — видео проверяется",
  rulesHeading: "Условия",
  ruleTag: "В описании видео обязателен хештег #reklama или #OLIVIAaksiya",
  ruleOwn: "Продукция OLIVIA должна быть чётко видна в видео; видео — в вашем собственном открытом аккаунте",
  ruleOneAccount: "Каждый участник участвует только через один личный аккаунт Instagram",
  ruleNoTarget: "Платная реклама (таргет) запрещена",
  ruleNoFakeViews:
    "Накрутка (купленные просмотры, боты) запрещена — при её выявлении участник отстраняется от конкурса",
  openInInstagram: "Открыть в Instagram",
  copy: "Копировать",
  copied: "Скопировано",
  statusPending: "На проверке",
  statusAccepted: "Принято",
  statusRejected: "Отклонено",
  statusManualReview: "На ручной проверке",
  pendingNote: "Видео в очереди на проверку. О результате также сообщит бот.",
  /** Пояснение под видео «На проверке» и «На ручной проверке» (текст заказчика). */
  weeklyCheckNote: (days: number) =>
    `Просмотры обновляются ${syncPeriod(days)} — после этого обновятся и ваши общие просмотры.`,
  rejectedNote: "Видео отклонено. Если есть вопросы, напишите в поддержку через бота.",
  rejectReasons: {
    NOT_FOUND:
      "Видео не найдено в Instagram. Проверьте ссылку и убедитесь, что ваш аккаунт открытый (не закрытый).",
    NOT_A_VIDEO: "Отправленная ссылка — не Reels (видео). Отправьте ссылку на Reels о продукции.",
    OWNER_TAKEN:
      "С этого аккаунта Instagram видео уже отправлял другой участник. Один аккаунт — один участник. Если это ошибка, напишите в поддержку.",
    NO_PRODUCT:
      "В видео не видно продукции конкурса. Выложите Reels, где продукция хорошо видна, и отправьте ссылку заново.",
  },
  manualReviewNote:
    "Это видео администратор проверит вручную — о результате сообщим через бота. А пока убедитесь, что ваш аккаунт открытый (не закрытый) и видео не удалено.",
  /** Плитка узкая (~130px на телефоне) — короткий текст в одну строку. */
  statBest: "Всего просмотров",
  statToday: "Последний прирост",
  statRank: "Место в рейтинге",
  statRankDelta: "Изменение места",
  noChange: "без изменений",
  chartTitle: "Рост просмотров",
  chartSubtitle: "Все ваши видео — прирост при каждом обновлении",
  lastSyncedLabel: "Последнее обновление",
  nextSyncLabel: "Следующее обновление",
  syncEvery: (days: number) => `Просмотры обновляются ${syncPeriod(days)}`,
  inDays: (days: number) => (days <= 0 ? "сегодня" : days === 1 ? "завтра" : `через ${days} ${dayWord(days)}`),
  months: [
    "января",
    "февраля",
    "марта",
    "апреля",
    "мая",
    "июня",
    "июля",
    "августа",
    "сентября",
    "октября",
    "ноября",
    "декабря",
  ],

  // Профиль
  profileTitle: "Профиль",
  profileRole: "Участник конкурса",
  profileWish: "С Новым годом!",
  profileStatRank: "Место",
  profileStatViews: "Просмотры",
  profileStatDays: "Дней осталось",
  profileFooter: "Пусть Новый год принесёт удачу! — Команда Olivia",
  profileDevTeam: "Команда разработчиков:",
  phone: "Номер телефона",
  phoneShort: "Телефон",
  profileLocked: "Имя вводится один раз при регистрации и не меняется.",
  menuSupport: "Написать в поддержку",
  supportTitle: "Поддержка",
  supportIntroTitle: "Есть вопрос? Пишите!",
  supportIntroBody:
    "Наши операторы отвечают в рабочее время. Ответ придёт сюда и в Telegram-бот — писать можно и из приложения, и с сайта.",
  supportEmpty: "Переписки пока нет. Напишите свой вопрос ниже ❄️",
  supportOperator: "Оператор",
  supportTyping: "печатает…",
  supportPlaceholder: "Напишите ваш вопрос…",
  supportSend: "Отправить",
  supportErrorInvalid: "Сообщение пустое или слишком длинное (до 1000 символов).",
  supportErrorLimit: "Вы отправили слишком много сообщений — попробуйте снова через 10 минут.",
  supportDraftField: (field: string) =>
    `Здравствуйте! В моём профиле неверно указано поле «${field}». Правильно: `,
  lockedTitle: (field: string) => `«${field}» нельзя изменить`,
  lockedBody:
    "Имя вводится один раз при регистрации, и изменить его потом нельзя. Если допущена ошибка, напишите в поддержку — оператор проверит и исправит.",
  lockedWriteSupport: "Написать в поддержку",
  lockedClose: "Закрыть",
  menuRules: "Правила конкурса",
  menuWinner: "Победитель",
  supportHint:
    "Напишите свой вопрос в чат бота — оператор ответит там же. При необходимости приложите скриншот.",
  deleteAccount: "Отменить участие",
  deleteConfirm:
    "Отменить участие? Ваши видео и данные будут удалены из конкурса. Это действие нельзя отменить.",

  // Победитель
  winnerTitle: "Победитель",
  winnerPendingTitle: "Победитель ещё не объявлен",
  winnerPendingBody: "Победитель будет объявлен после окончания конкурса и проверки.",
  winnerCongrats: "Поздравляем!",
  winnerPrize: "Обладатель автомобиля",
  winnerAnnounced: (date: string) => `Объявлено: ${date}`,
  winnerCountdown: "До конца конкурса",
  winnerUnitDays: "дн.",
  winnerUnitHours: "ч",
  winnerUnitMinutes: "мин",
  unitSeconds: "сек",

  // Состояния
  blockedTitle: "Участие приостановлено",
  blockedBody: "Ваш аккаунт временно заблокирован. Чтобы узнать подробности, напишите в поддержку через бота.",
  disqualifiedTitle: "Вы отстранены от конкурса",
  disqualifiedBody:
    "Ваше участие аннулировано из-за нарушения правил конкурса. Если есть вопросы, напишите в поддержку через бота.",

  // Призы
  prizesTitle: "Призы",
  prizesSubtitle: "Набирайте просмотры — получайте призы",
  fundLabel: "Призовой фонд",
  fundTotal: "призов",
  fundBody:
    "Каждый месяц ваучеры разыгрываются случайным выбором (random), а по итогам акции главные призы тоже определяются random в каждом диапазоне просмотров.",
  monthlyTag: "Ежемесячный приз",
  sum: "сум",
  perMonth: "в месяц",
  totalPieces: "всего",
  randomDraw: "Случайный выбор",
  monthlyWho: (min: string, max: string) =>
    `Участвуют те, чьи видео, зарегистрированные в месячном этапе, набрали в сумме от ${min} до ${max} подтверждённых просмотров`,
  monthlyDraw:
    "Победители определяются случайным выбором (random). Выполняя требования, можно выигрывать ваучеры в течение нескольких месяцев",
  stagesTitle: "Этапы",
  stageLabel: (n: number) => `${n}-й этап`,
  stageNow: "Сейчас",
  stageDone: "Завершён",
  stageSoon: "Ожидается",
  stageStartsIn: (n: number, days: number) =>
    days === 0 ? `${n}-й этап начинается сегодня` : `${n}-й этап начнётся через ${days} ${dayWord(days)}`,
  stageEndsIn: (n: number, days: number) =>
    days === 0
      ? `Последний день ${n}-го этапа`
      : `Идёт ${n}-й этап — до конца ${plural(days, "остался", "осталось", "осталось")} ${days} ${dayWord(days)}`,
  stagesFinished: "Все этапы завершены",
  mainTitle: "Главные призы",
  mainSubtitle:
    "По итогам акции — по общему числу подтверждённых просмотров всех ваших видео, random внутри диапазона",
  mainPrize: "Главный приз",
  viewsWord: "просмотров",
  andMore: "и более",
  pieces: (n: number, unit: string | null) => `${n} ${unit ? unit : "шт."}`,
  tierWinners: (n: number) =>
    n === 1
      ? "Среди участников этого диапазона random определит 1 победителя"
      : `Среди участников этого диапазона random определит ${n} ${plural(n, "победителя", "победителей", "победителей")}`,
  youAreHere: "Вы здесь",
  tierReached: "Достигнуто",
  viewsLeft: (n: string) => `ещё ${n} ${viewWord(n)}`,
  startLabel: "Ваши общие просмотры",
  startNoReel: "Отправьте видео — здесь будут суммироваться просмотры всех ваших видео",
  startSendVideo: "Отправить видео",
  startNext: (title: string, left: string) => `Следующий приз — ${title}: ещё ${left} ${viewWord(left)}`,
  startTop: "Вы в самом высоком диапазоне!",
  notesTitle: "Важно",
  goodLuck: "Удачи!",

  // Сообщение о рекламе (жалоба)
  menuReport: "Вижу рекламу",
  moreReportHint: "Сообщить о таргете",
  reportTitle: "Вижу рекламу",
  reportHeroTitle: "Кто-то рекламирует своё видео?",
  reportHeroBody:
    "В конкурсе запрещена платная реклама (таргет). Если в вашей ленте видео другого участника отмечено «Реклама» или «Sponsored» — сделайте скриншот и отправьте его сюда.",
  reportStep1: "Сделайте скриншот рекламы — так, чтобы была видна надпись «Реклама»",
  reportStep2: "Укажите имя аккаунта или ссылку на Reels",
  reportStep3: "Отправьте — администратор проверит",
  reportTargetLabel: "Кто рекламирует?",
  reportTargetPlaceholder: "@username или ссылка на Reels",
  reportScreenshotLabel: "Скриншот рекламы",
  reportPickScreenshot: "Выберите скриншот",
  reportPickHint: "Фото из галереи",
  reportReplace: "Заменить",
  reportRemove: "Удалить фото",
  reportPreparing: "Подготовка фото…",
  reportCommentLabel: "Комментарий (необязательно)",
  reportCommentPlaceholder: "Например: появилось в ленте вчера вечером",
  reportSend: "Отправить",
  reportPrivacy: "Кто отправил сообщение, видит только администратор. Не более 5 сообщений в день.",
  reportDoneTitle: "Спасибо! Сообщение отправлено",
  reportDoneBody:
    "Администратор проверит скриншот. Если нарушение подтвердится, участник будет отстранён от конкурса.",
  reportAnother: "Сообщить ещё",
  reportBackToRating: "Вернуться к рейтингу",
  reportTargetEmpty: "Укажите имя аккаунта или ссылку на Reels.",
  reportScreenshotEmpty: "Добавьте скриншот рекламы.",
  reportTargetInvalid: "Имя аккаунта или ссылка на Reels указаны неверно.",
  reportNotFound: "Этот аккаунт или видео не участвует в конкурсе.",
  reportSelf: "Нельзя отправить сообщение о самом себе.",
  reportDuplicate: "Сегодня вы уже сообщали об этом участнике.",
  reportLimit: "Лимит на сегодня исчерпан (5 в день). Попробуйте завтра.",
  reportImageInvalid: "Не удалось прочитать фото. Выберите другой скриншот.",

  // Dev
  devBanner: "Dev-режим: вне Telegram, тестовые данные",
  devReset: "Начать сначала",
};
