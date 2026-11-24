/**
 * Mock "server": ishtirokchi holati brauzerning localStorage'ida saqlanadi.
 * Faqat backend tayyor bo'lguncha. Holatni tozalash: `resetMockStore()`
 * (dev panelda tugma bor) yoki `reels-miniapp:mock` kalitini o'chirish.
 */
import { ApiError } from "../api-error";
import { canonicalReelUrl, parseReelShortcode } from "../reel-url";
import { STORY_MAX_ACTIVE, STORY_MAX_BYTES, storyMime } from "../stories";
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
  WebRegisterRequest,
  StoryGroup,
  StoryItem,
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
  /** Saytning o'zida (Telegram'siz) ro'yxatdan o'tilganmi. */
  webAccount?: boolean;
  phone: string | null;
  profile: { firstName: string; lastName: string; age: number } | null;
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
  clearMyStories();
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
    account: state.webAccount ? "web" : "telegram",
  };
}

export async function getAuthConfig(): Promise<AuthConfig> {
  await wait(150);
  return { botUsername: "olivia_konkursbot", prizeName: PRIZE_NAME };
}

/** Login Widget'ni taqlid qiladi (haqiqiy widget faqat BotFather'da ko'rsatilgan domenda ishlaydi). */
export async function webLogin(): Promise<void> {
  await wait(400);
  update({ webSession: true, webAccount: false });
}

/** Saytdan ro'yxatdan o'tish (backenddagidek tekshiruvlar; "+998 90 000 00 00" — band raqam sinovi). */
export async function webRegister(body: WebRegisterRequest): Promise<void> {
  await wait(500);
  const digits = body.phone.replace(/\D/g, "");
  const local = digits.length === 12 && digits.startsWith("998") ? digits.slice(3) : digits;
  if (body.firstName.trim().length < 2) throw new ApiError("INVALID_PROFILE");
  if (!/^\d{9}$/.test(local)) throw new ApiError("INVALID_PHONE");
  if (local === "900000000") throw new ApiError("PHONE_TAKEN");
  if (body.age < MIN_AGE) throw new ApiError("UNDER_AGE");
  update({
    webSession: true,
    webAccount: true,
    phone: `+998${local}`,
    profile: { firstName: body.firstName.trim(), lastName: "", age: body.age },
  });
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
  if (body.firstName.trim().length < 2) throw new ApiError("INVALID_PROFILE");
  if (body.age < MIN_AGE) throw new ApiError("UNDER_AGE");
  update({
    profile: {
      firstName: body.firstName.trim(),
      lastName: body.lastName?.trim() ?? "",
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
        body: "Mahsulot haqidagi Reel o'z Instagram akkauntingizda joylanadi, ochiq bo'ladi va unda zavod akkaunti belgilanadi. Reel linki shu ilova orqali yuboriladi; videolar soni cheklanmagan. Reytingda har bir qabul qilingan videongiz alohida o'rin oladi; sizning o'rningiz va asosiy sovrin — eng ko'p ko'rilgan bitta videongiz bo'yicha, videolar ko'rishlari qo'shilmaydi. Bitta Instagram akkaunt — bitta ishtirokchi.",
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
    // Haqiqiyda admin panelda yuklanadi; mock'da — namunaviy klip (ko'rinishini sinash uchun).
    video: { id: "mock-rules-video", mime: "video/mp4" },
  };
}

/** Mock: qoida videosi o'rniga namunaviy klip. */
export const rulesVideoUrl = (): string => `${import.meta.env.BASE_URL}stories/sample-3.mp4`;

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

/** Backend jadvali bilan bir xil: tanlov boshidan har kuni, soat 00:00 (Toshkent). */
const MOCK_CONTEST_STARTS_ON = "2026-11-25";
const MOCK_SYNC_EVERY_DAYS = 1;

function mockNextSyncAt(now = new Date()): string | null {
  for (let k = 1; k <= 50; k++) {
    const slot = new Date(`${MOCK_CONTEST_STARTS_ON}T00:00:00+05:00`);
    slot.setUTCDate(slot.getUTCDate() + k * MOCK_SYNC_EVERY_DAYS);
    if (slot > now) return slot.toISOString();
  }
  return null;
}

/** Boshqa (soxta) ishtirokchilarning eng ko'p ko'rilgan videolari ko'rishlari, ko'pidan kamiga. */
const OTHER_BEST_VIEWS = NAMES.map((_, i) => Math.floor(250000 / (i + 1)) + 6400 - (i + 1) * 37);

/**
 * Ba'zi soxta ishtirokchilarning qo'shimcha videolari: [ishtirokchi (`NAMES`) indeksi, eng yaxshi
 * videosi ko'rishlariga nisbatan ulush]. Reyting har bir video bo'yicha — bir ism bir necha marta chiqadi.
 */
const OTHER_EXTRA_VIDEOS: ReadonlyArray<readonly [number, number]> = [
  [0, 0.42], [0, 0.11], [1, 0.63], [3, 0.55], [3, 0.2], [6, 0.7], [10, 0.5], [13, 0.86],
];

/** Soxta ishtirokchilarning barcha qabul qilingan videolari (reyting qatorlari, tartiblanmagan). */
const OTHER_VIDEOS: Omit<RatingEntry, "rank" | "isMe">[] = [
  ...NAMES.map((fullName, i) => ({ fullName, views: OTHER_BEST_VIEWS[i] })),
  ...OTHER_EXTRA_VIDEOS.map(([i, share]) => ({ fullName: NAMES[i], views: Math.round(OTHER_BEST_VIEWS[i] * share) })),
].map((video, k) => ({ ...video, rankDelta: DELTAS[k % DELTAS.length] }));

/** Shortcode'dan barqaror xesh — mock videolar har xil ko'rish va o'rin o'zgarishi oladi. */
function shortcodeHash(shortcode: string): number {
  let hash = 0;
  for (const ch of shortcode) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return hash;
}

/** Shortcode'dan barqaror koeffitsiyent (0.4–1.6) — videolar har xil ko'rish yig'adi. */
const viewsFactor = (shortcode: string) => 0.4 + (shortcodeHash(shortcode) % 1201) / 1000;

/** O'z videoning oldingi yangilanishga nisbatan o'rin o'zgarishi (mock, barqaror). */
const MY_DELTAS = [3, 0, 1, -2, 2, -1];
const myRankDelta = (shortcode: string) => MY_DELTAS[shortcodeHash(shortcode) % MY_DELTAS.length];

/** Mock'dagi video: avval PENDING, bir necha soniyadan keyin qabul yoki rad etiladi. */
function reelStatus(reel: MockReel): { status: ReelStatus; rejectReason: ReelRejectReason | null } {
  if (Date.now() - reel.submittedAt < MOCK_VERIFY_MS) return { status: "PENDING", rejectReason: null };
  const code = reel.shortcode.toLowerCase();
  if (code.startsWith(MOCK_NOT_FOUND_PREFIX)) return { status: "MANUAL_REVIEW", rejectReason: null };
  if (code.startsWith(MOCK_PHOTO_PREFIX)) return { status: "REJECTED", rejectReason: "NOT_A_VIDEO" };
  return { status: "ACCEPTED", rejectReason: null };
}

/** Qabul qilingan videoning kunlar bo'yicha ko'rishlari (kun oxirida); boshqa holatda — null. */
function acceptedTotals(reel: MockReel): number[] | null {
  if (reelStatus(reel).status !== "ACCEPTED") return null;
  return SAMPLE_TOTALS.map((v) => Math.round(v * viewsFactor(reel.shortcode)));
}

/** Reyting qatori; o'z videomizda — shortcode (faqat mock ichida, tashqariga berilmaydi). */
type MockRatingRow = RatingEntry & { shortcode: string | null };

/**
 * Backenddagi reyting kabi: har bir qabul qilingan video — alohida qator, bitta ishtirokchi bir
 * necha marta chiqadi. Tartib: ko'rishlar bo'yicha kamayib; teng bo'lsa — oldinroq yuborilgan video
 * (soxta ishtirokchilarniki har doim oldinroq deb olinadi). Profili to'ldirilmagan bo'lsa, o'z
 * videolari reytingga kirmaydi.
 */
function mockRating(): MockRatingRow[] {
  const rows: (Omit<MockRatingRow, "rank"> & { submittedAt: number })[] = OTHER_VIDEOS.map((video) => ({
    ...video,
    isMe: false,
    shortcode: null,
    submittedAt: 0,
  }));
  if (state.profile) {
    const fullName = `${state.profile.firstName} ${state.profile.lastName}`.trim();
    for (const reel of state.reels) {
      const totals = acceptedTotals(reel);
      if (!totals) continue;
      rows.push({
        fullName,
        views: totals[totals.length - 1],
        rankDelta: myRankDelta(reel.shortcode),
        isMe: true,
        shortcode: reel.shortcode,
        submittedAt: reel.submittedAt,
      });
    }
  }
  rows.sort((a, b) => b.views - a.views || a.submittedAt - b.submittedAt);
  return rows.map((row, i) => ({
    rank: i + 1,
    fullName: row.fullName,
    views: row.views,
    rankDelta: row.rankDelta,
    isMe: row.isMe,
    shortcode: row.shortcode,
  }));
}

/** Holat tartibi ro'yxatda: qabul qilinganlar → hal qilinmaganlar → rad etilganlar. */
const STATUS_GROUP: Record<ReelStatus, number> = { ACCEPTED: 0, PENDING: 1, MANUAL_REVIEW: 1, REJECTED: 2 };

/**
 * Backenddagi GET /miniapp/reels kabi: har bir video alohida, har birining reytingdagi o'z o'rni
 * (`rank`). Natija (ko'rishlar, ishtirokchining o'rni, kunlik o'sish) — eng ko'p ko'rilgan bitta
 * qabul qilingan video bo'yicha; videolar ko'rishlari qo'shilmaydi. Ro'yxat tartibi `MyReels.reels`
 * izohida.
 */
function currentReels(): MyReels {
  const t = today();
  const myRows = new Map<string, MockRatingRow>();
  for (const row of mockRating()) if (row.shortcode) myRows.set(row.shortcode, row);
  const items = state.reels.map((reel) => {
    const { status, rejectReason } = reelStatus(reel);
    const totals = acceptedTotals(reel);
    const item: MyReelItem = {
      url: canonicalReelUrl(reel.shortcode),
      shortcode: reel.shortcode,
      status,
      rejectReason,
      views: totals ? totals[totals.length - 1] : 0,
      submittedAt: new Date(reel.submittedAt).toISOString(),
      best: false,
      rank: myRows.get(reel.shortcode)?.rank ?? null,
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
  // Ishtirokchining o'rni — eng yaxshi videosining qatori (reytingdagi birinchi `isMe` qatori).
  const bestRow = best ? myRows.get(best.reel.shortcode) : undefined;
  const synced = new Date(t);
  synced.setHours(9);
  return {
    bestViews: best ? best.item.views : 0,
    todayViews: best ? daily[daily.length - 1].views : 0,
    rank: bestRow?.rank ?? null,
    rankDelta: bestRow?.rankDelta ?? 0,
    daily,
    lastSyncedAt: best ? synced.toISOString() : null,
    nextSyncAt: mockNextSyncAt(),
    syncEveryDays: MOCK_SYNC_EVERY_DAYS,
    reels: items.map(({ item }) => item),
  };
}

/** Har bir video — alohida qator; video linklari (shortcode) tashqariga berilmaydi. */
export async function getRating(): Promise<RatingEntry[]> {
  await wait();
  return mockRating().map(({ rank, fullName, views, rankDelta, isMe }) => ({ rank, fullName, views, rankDelta, isMe }));
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
    "500 000 so'mlik voucher random tanlanadi va bir kishiga aksiya davomida faqat bir marta beriladi",
    "Asosiy sovrinlar random emas — reyting bo'yicha: har bir sovrinning ko'rishlar oralig'ida eng ko'p ko'rilgan videosi bor ishtirokchilar oladi",
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

// --- Istoriyalar ----------------------------------------------------------------
// Namunaviy guruhlar — `public/stories/` dagi kichik kliplar (ffmpeg bilan yasalgan, 9:16, 4 soniya).
// O'zingiz yuklaganlar faqat xotirada (`URL.createObjectURL`), sahifa yangilansa yo'qoladi.

const STORY_TTL_MS = 24 * 60 * 60 * 1000;
const SAMPLE_CLIPS = [1, 2, 3].map((n) => `${import.meta.env.BASE_URL}stories/sample-${n}.mp4`);
/** Mock'dagi o'z guruhimning kaliti (haqiqiy backendda — shaffof bo'lmagan tasodifiy kalit). */
const MY_STORY_AUTHOR_KEY = "mock-me";

interface MockStory extends StoryItem {
  /** `<video src>`: namunaviy klip yoki yuklangan faylning object URL'i. */
  src: string;
}

interface MockStoryGroup {
  authorKey: string;
  fullName: string;
  stories: MockStory[];
}

/** Namunaviy istoriya: necha daqiqa oldin joylangan va qaysi klip. */
const sampleStory = (id: string, minutesAgo: number, clip: number): MockStory => {
  const created = Date.now() - minutesAgo * 60_000;
  return {
    id,
    createdAt: new Date(created).toISOString(),
    expiresAt: new Date(created + STORY_TTL_MS).toISOString(),
    src: SAMPLE_CLIPS[clip],
  };
};

/** Boshqa (soxta) ishtirokchilarning istoriyalari, eskisidan yangisiga. */
const SAMPLE_STORY_GROUPS: MockStoryGroup[] = [
  {
    authorKey: "mock-a1",
    fullName: NAMES[0],
    stories: [sampleStory("s-a1-1", 95, 0), sampleStory("s-a1-2", 38, 1)],
  },
  {
    authorKey: "mock-a2",
    fullName: NAMES[2],
    stories: [sampleStory("s-a2-1", 300, 2), sampleStory("s-a2-2", 240, 0), sampleStory("s-a2-3", 125, 1)],
  },
  { authorKey: "mock-a3", fullName: NAMES[1], stories: [sampleStory("s-a3-1", 190, 1)] },
  { authorKey: "mock-a4", fullName: NAMES[5], stories: [sampleStory("s-a4-1", 545, 2)] },
  { authorKey: "mock-a5", fullName: NAMES[4], stories: [sampleStory("s-a5-1", 1260, 0)] },
];

/** O'zim yuklagan istoriyalar (faqat xotirada), eskisidan yangisiga. */
let myStories: MockStory[] = [];
let storySeq = 0;

const isLive = (story: StoryItem, now = Date.now()) => Date.parse(story.expiresAt) > now;

/** "Boshidan boshlash" va ishtirokni bekor qilish — o'z istoriyalarim ham o'chadi. */
function clearMyStories(): void {
  for (const story of myStories) URL.revokeObjectURL(story.src);
  myStories = [];
}

/** Muddati tugagan o'z istoriyalarim olib tashlanadi (serverdagidek — fayl ham o'chadi). */
function pruneMyStories(): void {
  const now = Date.now();
  for (const story of myStories) if (!isLive(story, now)) URL.revokeObjectURL(story.src);
  myStories = myStories.filter((story) => isLive(story, now));
}

/** Ishtirokchi istoriya joylay oladimi: kirgan, profili to'liq, qoidalarga rozi (ACTIVE). */
const canPostStory = () =>
  state.webSession && state.phone !== null && state.profile !== null && state.consentVersion === RULES_VERSION;

const publicStory = ({ id, createdAt, expiresAt }: MockStory): StoryItem => ({ id, createdAt, expiresAt });
const newestAt = (group: StoryGroup) => Date.parse(group.stories[group.stories.length - 1].createdAt);

function currentStories(): StoryGroup[] {
  pruneMyStories();
  const now = Date.now();
  const others: StoryGroup[] = SAMPLE_STORY_GROUPS.map((group) => ({
    authorKey: group.authorKey,
    fullName: group.fullName,
    isMe: false,
    stories: group.stories.filter((story) => isLive(story, now)).map(publicStory),
  }))
    .filter((group) => group.stories.length > 0)
    .sort((a, b) => newestAt(b) - newestAt(a));
  // Saytdan chiqilgan bo'lsa ham istoriyalar ommaviy, faqat "isMe" belgisi bo'lmaydi.
  if (myStories.length === 0 || !state.profile) return others;
  const mine: StoryGroup = {
    authorKey: MY_STORY_AUTHOR_KEY,
    fullName: `${state.profile.firstName} ${state.profile.lastName}`,
    isMe: state.webSession,
    stories: myStories.map(publicStory),
  };
  return state.webSession ? [mine, ...others] : [...others, mine].sort((a, b) => newestAt(b) - newestAt(a));
}

/** Ochiq: mehmon ham ko'radi. */
export async function getStories(): Promise<StoryGroup[]> {
  await wait(300);
  return currentStories();
}

/** Yuklanishni taqlid qiladi: foiz ~1,5 soniyada bosqichma-bosqich o'sadi. */
export async function uploadStory(file: File, onProgress: (fraction: number) => void): Promise<StoryGroup[]> {
  if (!canPostStory()) {
    await wait(300);
    throw new ApiError("UNAUTHORIZED");
  }
  if (file.size > STORY_MAX_BYTES) {
    // nginx kabi — tana o'qilmasdan rad etiladi.
    await wait(300);
    throw new ApiError("STORY_TOO_LARGE");
  }
  const steps = 12;
  for (let i = 1; i <= steps; i++) {
    await wait(120);
    onProgress(i / steps);
  }
  await wait(250);
  if (!storyMime(file) || file.size === 0) throw new ApiError("STORY_INVALID_FILE");
  pruneMyStories();
  if (myStories.length >= STORY_MAX_ACTIVE) throw new ApiError("STORY_LIMIT");
  const created = Date.now();
  storySeq += 1;
  myStories = [
    ...myStories,
    {
      id: `mine-${created.toString(36)}-${storySeq}`,
      createdAt: new Date(created).toISOString(),
      expiresAt: new Date(created + STORY_TTL_MS).toISOString(),
      src: URL.createObjectURL(file),
    },
  ];
  return currentStories();
}

export async function deleteStory(id: string): Promise<void> {
  await wait(300);
  const story = myStories.find((s) => s.id === id);
  if (!state.webSession || !story) throw new ApiError("NOT_FOUND");
  URL.revokeObjectURL(story.src);
  myStories = myStories.filter((s) => s.id !== id);
}

/** Topilmasa — mavjud bo'lmagan manzil (`<video>` xato beradi, xuddi backenddagi 404 kabi). */
export function storyVideoUrl(id: string): string {
  const all = [...myStories, ...SAMPLE_STORY_GROUPS.flatMap((group) => group.stories)];
  return all.find((story) => story.id === id)?.src ?? `${import.meta.env.BASE_URL}stories/not-found-${encodeURIComponent(id)}.mp4`;
}
