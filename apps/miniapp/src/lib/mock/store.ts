/**
 * Mock "server": ishtirokchi holati brauzerning localStorage'ida saqlanadi.
 * Faqat backend tayyor bo'lguncha. Holatni tozalash: `resetMockStore()`
 * (dev panelda tugma bor) yoki `reels-miniapp:mock` kalitini o'chirish.
 */
import { ApiError } from "../api-error";
import { canonicalReelUrl, parseReelShortcode } from "../reel-url";
import type {
  AuthConfig,
  ContestInfo,
  ContestPrizes,
  ContestRules,
  DailyViews,
  Me,
  MyReelItem,
  MyReels,
  RatingEntry,
  ReelRejectReason,
  ReelStatus,
  RegisterRequest,
  SupportMessage,
  SupportThread,
  TargetReportRequest,
  Winner,
} from "../types";

const KEY = "reels-miniapp:mock";
const RULES_VERSION = 1;
const MIN_AGE = 18;
const PRIZE_NAME = "BYD Chazor";

/** Server videoni Instagram'da tekshirishini taqlid qiladi: shuncha vaqt PENDING. */
const MOCK_VERIFY_MS = 4000;
/** Shunday boshlangan shortcode — Instagram'da topilmadi → qo'lda tekshiruv (oqimni sinash uchun). */
const MOCK_NOT_FOUND_PREFIX = "notfound";
/** Shunday boshlangan shortcode — "Reel emas" deb rad etiladi (rad etish oqimini sinash uchun). */
const MOCK_PHOTO_PREFIX = "photo";
/** Shunday boshlangan shortcode — boshqa ishtirokchi yuborgan video (409 REEL_TAKEN). */
const MOCK_TAKEN_PREFIX = "taken";

/** Mock'dagi bitta video; holati shortcode va yuborilgan vaqtdan kelib chiqadi. */
interface MockReel {
  shortcode: string;
  /** Yuborilgan vaqt (ms). */
  submittedAt: number;
}

interface MockState {
  /** Veb-saytga "Telegram orqali kirish" bajarilganmi (mock — Telegram'dan tashqarida). */
  webSession: boolean;
  phone: string | null;
  profile: RegisterRequest | null;
  consentVersion: number | null;
  /** Yuborilgan videolar, eskisidan yangisiga (backenddagi `Participant.reels` kabi). */
  reels: MockReel[];
  /** Support yozishmasi (mock). */
  support: SupportMessage[];
}

const EMPTY: MockState = {
  webSession: false,
  phone: null,
  profile: null,
  consentVersion: null,
  reels: [],
  support: [],
};

/** Eski mock holati (bitta video) — yuklashda `reels` ro'yxatiga ko'chiriladi. */
interface LegacyMockState {
  reelShortcode?: string | null;
  reelSubmittedAt?: number | null;
}

function load(): MockState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...EMPTY };
    const { reelShortcode, reelSubmittedAt, ...saved } = JSON.parse(raw) as Partial<MockState> &
      LegacyMockState;
    const reels: MockReel[] = Array.isArray(saved.reels)
      ? saved.reels
      : reelShortcode
        ? [{ shortcode: reelShortcode, submittedAt: reelSubmittedAt ?? Date.now() - MOCK_VERIFY_MS }]
        : [];
    return { ...EMPTY, ...saved, reels };
  } catch {
    return { ...EMPTY };
  }
}

function save(state: MockState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Saqlab bo'lmasa (masalan, yashirin rejim) — holat faqat xotirada qoladi.
  }
}

let state = load();

const update = (patch: Partial<MockState>) => {
  state = { ...state, ...patch };
  save(state);
};

export function resetMockStore(): void {
  state = { ...EMPTY };
  save(state);
}

const wait = (ms = 350) => new Promise((r) => setTimeout(r, ms));

const today = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

const isoDay = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function maskPhone(phone: string): string {
  const d = phone.replace(/\D/g, "");
  return `+${d.slice(0, 3)} ${d.slice(3, 5)} *** ** ${d.slice(-2)}`;
}

// ---------------------------------------------------------------------------

/** Haqiqiy backenddagidek: kirmagan bo'lsa — 401 (sayt kirish sahifasini ko'rsatadi). */
export async function getMe(): Promise<Me> {
  await wait(250);
  if (!state.webSession) throw new ApiError("UNAUTHORIZED");
  const stage = !state.phone
    ? "NEEDS_CONTACT"
    : !state.profile
      ? "NEEDS_PROFILE"
      : state.consentVersion !== RULES_VERSION
        ? "NEEDS_CONSENT"
        : "ACTIVE";
  return {
    stage,
    phoneMasked: state.phone ? maskPhone(state.phone) : null,
    profile: state.profile,
    rulesUpdated: state.consentVersion !== null && state.consentVersion !== RULES_VERSION,
  };
}

export async function getAuthConfig(): Promise<AuthConfig> {
  await wait(150);
  return { botUsername: "olivia_konkursbot", prizeName: PRIZE_NAME };
}

/** Login Widget'ni taqlid qiladi (haqiqiy widget faqat BotFather'da ko'rsatilgan domenda ishlaydi). */
export async function webLogin(): Promise<void> {
  await wait(400);
  update({ webSession: true });
}

export async function webLogout(): Promise<void> {
  await wait(200);
  update({ webSession: false });
}

/**
 * Brauzerda (Telegram'siz) raqam ulashishni taqlid qiladi. Haqiqiy oqimda raqam
 * botga keladi va backend uni o'zi saqlaydi — Mini App faqat `getMe` ni qayta so'raydi.
 */
export async function simulateContactShared(): Promise<void> {
  await wait(300);
  update({ phone: "+998901234567" });
}

export async function register(body: RegisterRequest): Promise<void> {
  await wait();
  if (!state.phone) throw new ApiError("UNAUTHORIZED");
  if (state.profile) throw new ApiError("PROFILE_LOCKED");
  if (body.firstName.trim().length < 2 || body.lastName.trim().length < 2) {
    throw new ApiError("INVALID_PROFILE");
  }
  if (body.age < MIN_AGE) throw new ApiError("UNDER_AGE");
  update({
    profile: {
      firstName: body.firstName.trim(),
      lastName: body.lastName.trim(),
      age: body.age,
    },
  });
}

/**
 * Tanlov tugash vaqti — backenddagidek: oxirgi kun (25.02.2027, sovg'alarning oxirgi bosqichi)
 * tugagan yarim tun, Toshkent vaqti (UTC+5).
 */
const MOCK_CONTEST_ENDS_AT = "2027-02-25T19:00:00.000Z";

export async function getContest(): Promise<ContestInfo> {
  await wait(200);
  return {
    endsAt: MOCK_CONTEST_ENDS_AT,
    participants: 1284,
    minAge: MIN_AGE,
    prizeName: PRIZE_NAME,
  };
}

export async function getRules(): Promise<ContestRules> {
  await wait(250);
  // Namunaviy matn. Yakuniy qoidalar buyurtmachi va yurist tomonidan tasdiqlanib,
  // serverdan keladi.
  return {
    version: RULES_VERSION,
    sections: [
      {
        title: "1. Ishtirok etish",
        body: "Tanlovda zavod mahsulotini sotib olgan, 18 yoshga to'lgan shaxslar qatnashadi. Bitta telefon raqami — bitta ishtirokchi.",
      },
      {
        title: "2. Video talablari",
        body: "Mahsulot haqidagi Reel o'z Instagram akkauntingizda joylanadi, ochiq bo'ladi va unda zavod akkaunti belgilanadi. Reel linki shu ilova orqali yuboriladi; videolar soni cheklanmagan. Reytingda eng ko'p ko'rilgan bitta qabul qilingan videongiz hisoblanadi — videolar ko'rishlari qo'shilmaydi. Bitta Instagram akkaunt — bitta ishtirokchi.",
      },
      {
        title: "3. Taqiqlar",
        body: "Pullik reklama (target) va nakrutka (sotib olingan ko'rishlar, botlar) taqiqlanadi. Reyting yetakchilarining akkauntlari Meta reklama kutubxonasida muntazam tekshiriladi. Sovrin topshirilishidan oldin g'olib Instagram ilovasidagi \"Reklama vositalari\" bo'limini tashkilotchilarga ko'rsatadi. Boshqa ishtirokchining reklamasini ko'rsangiz, ilovadagi \"Reklamani ko'rdim\" bo'limi orqali skrinshot yuboring. Target yoki nakrutka aniqlansa, ishtirokchi tanlovdan chetlashtiriladi.",
      },
      {
        title: "4. G'olibni aniqlash",
        body: "Ko'rishlar har kuni avtomatik yig'iladi. Tanlov yakunida videosi eng ko'p ko'rilgan ishtirokchi tekshiruvdan so'ng g'olib deb e'lon qilinadi.",
      },
      {
        title: "5. Shaxsiy ma'lumotlar",
        body: "Ism va familiyangiz ommaviy reytingda ko'rsatiladi. Telefon raqamingiz boshqa ishtirokchilarga ko'rsatilmaydi.",
      },
    ],
  };
}

export async function acceptRules(version: number): Promise<void> {
  await wait();
  if (!state.profile) throw new ApiError("UNAUTHORIZED");
  if (version !== RULES_VERSION) throw new ApiError("RULES_OUTDATED");
  update({ consentVersion: version });
}

const NAMES = [
  "Dilnoza Rahimova", "Jasur Toshmatov", "Madina Yusupova", "Bekzod Aliyev",
  "Nigora Saidova", "Sardor Qodirov", "Zarina Ismoilova", "Otabek Nazarov",
  "Shahlo Ergasheva", "Aziz Mirzayev", "Kamola Tursunova", "Rustam Xolmatov",
  "Feruza Abdullayeva", "Ulug'bek Sobirov", "Gulnoza Hamidova", "Doston Rasulov",
  "Malika Ortiqova", "Javohir Umarov", "Sevara Normatova", "Islom Haydarov",
  "Nodira Karimova", "Farrux Salimov", "Lola Mahmudova", "Sherzod Boboyev",
];
const DELTAS = [0, 1, -1, 2, 0, -2, 3, 0, 1, -1, 0, 4];

/** Namunaviy videoning kunlar bo'yicha ko'rishlari (kun oxirida); har bir video o'z koeffitsiyentiga ko'paytiriladi. */
const SAMPLE_TOTALS = [3120, 5480, 9050, 12890, 15400, 19760, 22310, 26255];

/** Backend jadvali bilan bir xil: tanlov boshidan har 10 kunda, soat 06:00 (Toshkent). */
const MOCK_CONTEST_STARTS_ON = "2026-11-25";
const MOCK_SYNC_EVERY_DAYS = 10;

function mockNextSyncAt(now = new Date()): string | null {
  for (let k = 1; k <= 50; k++) {
    const slot = new Date(`${MOCK_CONTEST_STARTS_ON}T06:00:00+05:00`);
    slot.setUTCDate(slot.getUTCDate() + k * MOCK_SYNC_EVERY_DAYS);
    if (slot > now) return slot.toISOString();
  }
  return null;
}

/** Boshqa (soxta) ishtirokchilar, ko'p ko'rishdan kamiga. */
const OTHERS = NAMES.map((fullName, i) => ({
  fullName,
  views: Math.floor(250000 / (i + 1)) + 6400 - (i + 1) * 37,
  rankDelta: DELTAS[i % DELTAS.length],
}));

/** Eng ko'p ko'rilgan video ko'rishlariga qarab soxta reytingdagi o'rin. */
const mockRank = (views: number) => 1 + OTHERS.filter((o) => o.views >= views).length;

/** Shortcode'dan barqaror koeffitsiyent (0.4–1.6) — videolar har xil ko'rish yig'adi. */
function viewsFactor(shortcode: string): number {
  let hash = 0;
  for (const ch of shortcode) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return 0.4 + (hash % 1201) / 1000;
}

/** Mock'dagi video: avval PENDING, bir necha soniyadan keyin qabul yoki rad etiladi. */
function reelStatus(reel: MockReel): { status: ReelStatus; rejectReason: ReelRejectReason | null } {
  if (Date.now() - reel.submittedAt < MOCK_VERIFY_MS) return { status: "PENDING", rejectReason: null };
  const code = reel.shortcode.toLowerCase();
  if (code.startsWith(MOCK_NOT_FOUND_PREFIX)) return { status: "MANUAL_REVIEW", rejectReason: null };
  if (code.startsWith(MOCK_PHOTO_PREFIX)) return { status: "REJECTED", rejectReason: "NOT_A_VIDEO" };
  return { status: "ACCEPTED", rejectReason: null };
}

/** Holat tartibi ro'yxatda: qabul qilinganlar → hal qilinmaganlar → rad etilganlar. */
const STATUS_GROUP: Record<ReelStatus, number> = { ACCEPTED: 0, PENDING: 1, MANUAL_REVIEW: 1, REJECTED: 2 };

/**
 * Backenddagi GET /miniapp/reels kabi: har bir video alohida. Natija (ko'rishlar, o'rin,
 * kunlik o'sish) — eng ko'p ko'rilgan bitta qabul qilingan video bo'yicha; videolar
 * ko'rishlari qo'shilmaydi. Ro'yxat tartibi `MyReels.reels` izohida.
 */
function currentReels(): MyReels {
  const t = today();
  const items = state.reels.map((reel) => {
    const { status, rejectReason } = reelStatus(reel);
    // Qabul qilingan videoning kunlar bo'yicha ko'rishlari (kun oxirida).
    const totals =
      status === "ACCEPTED" ? SAMPLE_TOTALS.map((v) => Math.round(v * viewsFactor(reel.shortcode))) : null;
    const item: MyReelItem = {
      url: canonicalReelUrl(reel.shortcode),
      shortcode: reel.shortcode,
      status,
      rejectReason,
      views: totals ? totals[totals.length - 1] : 0,
      submittedAt: new Date(reel.submittedAt).toISOString(),
      best: false,
    };
    return { reel, totals, item };
  });
  items.sort((a, b) => {
    const group = STATUS_GROUP[a.item.status] - STATUS_GROUP[b.item.status];
    if (group !== 0) return group;
    if (a.item.status === "ACCEPTED") {
      // Ko'p ko'rilgani tepada; teng bo'lsa — oldinroq yuborilgani.
      return b.item.views - a.item.views || a.reel.submittedAt - b.reel.submittedAt;
    }
    // Hal qilinmagan va rad etilganlar — yangisi tepada.
    return b.reel.submittedAt - a.reel.submittedAt;
  });

  const best = items[0]?.totals ? items[0] : null;
  if (best) best.item.best = true;
  const daily: DailyViews[] = [];
  if (best?.totals) {
    const totals = best.totals;
    for (let i = 1; i < totals.length; i++) {
      const d = new Date(t);
      d.setDate(t.getDate() - (totals.length - 1 - i));
      daily.push({ date: isoDay(d), views: totals[i] - totals[i - 1] });
    }
  }
  const bestViews = best ? best.item.views : 0;
  const synced = new Date(t);
  synced.setHours(9);
  return {
    bestViews,
    todayViews: best ? daily[daily.length - 1].views : 0,
    rank: best ? mockRank(bestViews) : null,
    rankDelta: best ? 3 : 0,
    daily,
    lastSyncedAt: best ? synced.toISOString() : null,
    nextSyncAt: mockNextSyncAt(),
    syncEveryDays: MOCK_SYNC_EVERY_DAYS,
    reels: items.map(({ item }) => item),
  };
}

export async function getRating(): Promise<RatingEntry[]> {
  await wait();
  const mine = currentReels();
  const entries: Omit<RatingEntry, "rank">[] = OTHERS.map((o) => ({ ...o, isMe: false }));
  if (state.profile && mine.rank !== null) {
    entries.splice(mine.rank - 1, 0, {
      fullName: `${state.profile.firstName} ${state.profile.lastName}`,
      views: mine.bestViews,
      rankDelta: mine.rankDelta,
      isMe: true,
    });
  }
  return entries.map((entry, i) => ({ ...entry, rank: i + 1 }));
}

/** Mock: kunlik chegara faqat sahifa ochiq turganda sanaladi. */
const mockReports: Array<{ target: string; day: string }> = [];
const MOCK_REPORTS_PER_DAY = 5;

export async function reportTarget(body: TargetReportRequest): Promise<void> {
  await wait(700);
  const raw = body.target.trim();
  const shortcode = parseReelShortcode(raw);
  const username = raw.replace(/^@/, "").toLowerCase();
  if (!shortcode && !/^[a-z0-9._]{1,30}$/.test(username)) throw new ApiError("REPORT_TARGET_INVALID");
  // Mock: "begona" bilan boshlangan akkaunt — tanlov ishtirokchisi emas.
  if (username.startsWith("begona")) throw new ApiError("REPORT_NOT_FOUND");
  if (shortcode && state.reels.some((r) => r.shortcode === shortcode)) throw new ApiError("REPORT_SELF");
  if (!body.screenshot.startsWith("data:image/")) throw new ApiError("INVALID_IMAGE");
  const day = new Date().toDateString();
  const key = shortcode ?? username;
  if (mockReports.some((r) => r.target === key && r.day === day)) throw new ApiError("REPORT_DUPLICATE");
  if (mockReports.filter((r) => r.day === day).length >= MOCK_REPORTS_PER_DAY) throw new ApiError("REPORT_LIMIT");
  mockReports.push({ target: key, day });
}

export async function getSupport(): Promise<SupportThread> {
  await wait(250);
  if (!state.webSession) throw new ApiError("UNAUTHORIZED");
  return { messages: state.support };
}

/** Birinchi xabarga mock operator avtomatik javob beradi (oqimni sinash uchun). */
export async function sendSupport(text: string): Promise<SupportThread> {
  await wait(500);
  if (!state.webSession) throw new ApiError("UNAUTHORIZED");
  const clean = text.trim();
  if (!clean || clean.length > 1000) throw new ApiError("SUPPORT_INVALID");
  const recent = state.support.filter(
    (m) => m.from === "PARTICIPANT" && Date.now() - new Date(m.createdAt).getTime() < 10 * 60 * 1000,
  );
  if (recent.length >= 5) throw new ApiError("SUPPORT_LIMIT");
  const now = new Date();
  const messages: SupportMessage[] = [...state.support, { from: "PARTICIPANT", text: clean, createdAt: now.toISOString() }];
  if (!state.support.some((m) => m.from === "OPERATOR")) {
    messages.push({
      from: "OPERATOR",
      text: "Assalomu alaykum! Murojaatingiz qabul qilindi — operatorimiz tez orada shu yerda va Telegram botda javob beradi.",
      createdAt: new Date(now.getTime() + 1000).toISOString(),
    });
  }
  update({ support: messages });
  return { messages };
}

export async function getMyReels(): Promise<MyReels> {
  await wait();
  if (!state.webSession) throw new ApiError("UNAUTHORIZED");
  return currentReels();
}

/** Videolar soni cheklanmagan; takror yuborish qoidalari backenddagidek. */
export async function submitReel(url: string): Promise<MyReels> {
  await wait(500);
  if (!state.webSession) throw new ApiError("UNAUTHORIZED");
  const shortcode = parseReelShortcode(url);
  if (!shortcode) throw new ApiError("INVALID_LINK");
  if (shortcode.toLowerCase().startsWith(MOCK_TAKEN_PREFIX)) throw new ApiError("REEL_TAKEN");
  const own = state.reels.find((r) => r.shortcode === shortcode);
  if (own && reelStatus(own).status !== "REJECTED") throw new ApiError("REEL_ALREADY_SUBMITTED");
  // O'zining rad etilgan videosi qayta yuborilsa — eski yozuv almashtiriladi. Haqiqiy
  // backendda ham shunday: avval PENDING, server Instagram'da tekshiradi.
  update({
    reels: [...state.reels.filter((r) => r.shortcode !== shortcode), { shortcode, submittedAt: Date.now() }],
  });
  return currentReels();
}

/** Sovrinlar — backenddagi `apps/backend/src/miniapp/prizes.ts` bilan bir xil. */
const PRIZES: ContestPrizes = {
  monthly: {
    title: "Korzinka voucheri",
    amount: 500_000,
    perMonth: 300,
    total: 900,
    minViews: 1_000,
    maxViews: 100_000,
  },
  stages: [
    { startsOn: "2026-11-25", endsOn: "2026-12-24" },
    { startsOn: "2026-12-25", endsOn: "2027-01-24" },
    { startsOn: "2027-01-25", endsOn: "2027-02-25" },
  ],
  tiers: [
    { kind: "tablet", title: "Planshet", quantity: 25, unit: null, minViews: 101_000, maxViews: 500_000 },
    { kind: "phone", title: "iPhone 18 Pro", quantity: 15, unit: null, minViews: 500_001, maxViews: 1_500_000 },
    {
      kind: "travel",
      title: "Tailandga 2 kishilik sayohat",
      quantity: 3,
      unit: "yo'llanma",
      minViews: 1_500_001,
      maxViews: 3_500_000,
    },
    { kind: "car", title: "BYD Chazor avtomobili", quantity: 1, unit: null, minViews: 4_000_000, maxViews: null },
  ],
  notes: [
    "Talablarni bajarsangiz, har oy voucher yutishingiz mumkin",
    "Voucherlardan tashqari bitta asosiy sovrinni ham yutishingiz mumkin",
    "Bitta ishtirokchiga faqat bitta asosiy sovrin beriladi",
    "Oylik sovrin uchun faqat shu oyda yuklangan Reellar hisoblanadi",
    "Asosiy sovrin uchun aksiya davomidagi eng ko'p ko'rilgan bitta tasdiqlangan Reelingiz hisoblanadi (videolar ko'rishlari qo'shilmaydi)",
    "Sovrinlar pulga almashtirilmaydi va boshqa odamga berilmaydi",
  ],
};

export async function getPrizes(): Promise<ContestPrizes> {
  await wait(250);
  return PRIZES;
}

export async function getWinner(): Promise<Winner | null> {
  await wait(250);
  return null;
}

export async function deleteAccount(): Promise<void> {
  await wait();
  resetMockStore();
}
