/**
 * Mock "server": ishtirokchi holati brauzerning localStorage'ida saqlanadi.
 * Faqat backend tayyor bo'lguncha. Holatni tozalash: `resetMockStore()`
 * (dev panelda tugma bor) yoki `reels-miniapp:mock` kalitini o'chirish.
 */
import { ApiError } from "../api-error";
import { canonicalReelUrl, parseReelShortcode } from "../reel-url";
import type {
  ContestInfo,
  ContestRules,
  DailyViews,
  Me,
  MyReel,
  RatingEntry,
  RegisterRequest,
  Winner,
} from "../types";

const KEY = "reels-miniapp:mock";
const RULES_VERSION = 1;
const MIN_AGE = 18;
const MY_RANK = 12;

/** Server videoni Instagram'da tekshirishini taqlid qiladi: shuncha vaqt PENDING. */
const MOCK_VERIFY_MS = 4000;
/** Shunday boshlangan shortcode — "Instagram'da topilmadi" (rad etish oqimini sinash uchun). */
const MOCK_NOT_FOUND_PREFIX = "notfound";

interface MockState {
  phone: string | null;
  profile: RegisterRequest | null;
  consentVersion: number | null;
  reelShortcode: string | null;
  reelSubmittedAt: number | null;
}

const EMPTY: MockState = {
  phone: null,
  profile: null,
  consentVersion: null,
  reelShortcode: null,
  reelSubmittedAt: null,
};

function load(): MockState {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...EMPTY, ...(JSON.parse(raw) as Partial<MockState>) } : { ...EMPTY };
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

export async function getMe(): Promise<Me> {
  await wait(250);
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

export async function getContest(): Promise<ContestInfo> {
  await wait(200);
  const ends = today();
  ends.setDate(ends.getDate() + 44);
  ends.setHours(12);
  return {
    endsAt: ends.toISOString(),
    participants: 1284,
    minAge: MIN_AGE,
    prizeName: "Chevrolet Cobalt",
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
        body: "Mahsulot haqidagi Reel o'z Instagram akkauntingizda joylanadi, ochiq bo'ladi va unda zavod akkaunti belgilanadi. Reel linki shu ilova orqali yuboriladi. Bitta Instagram akkaunt — bitta ishtirokchi.",
      },
      {
        title: "3. Taqiqlar",
        body: "Pullik reklama (target) va nakrutka (sotib olingan ko'rishlar, botlar) taqiqlanadi. Nakrutka aniqlansa, ishtirokchi tanlovdan chetlashtiriladi.",
      },
      {
        title: "4. G'olibni aniqlash",
        body: "Ko'rishlar har kuni avtomatik yig'iladi. Tanlov yakunida eng ko'p ko'rish yig'gan ishtirokchi tekshiruvdan so'ng g'olib deb e'lon qilinadi.",
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

const SAMPLE_TOTALS = [3120, 5480, 9050, 12890, 15400, 19760, 22310, 26255];

function sampleReel(shortcode: string): MyReel {
  const t = today();
  const daily: DailyViews[] = [];
  for (let i = 1; i < SAMPLE_TOTALS.length; i++) {
    const d = new Date(t);
    d.setDate(t.getDate() - (SAMPLE_TOTALS.length - 1 - i));
    daily.push({ date: isoDay(d), views: SAMPLE_TOTALS[i] - SAMPLE_TOTALS[i - 1] });
  }
  const synced = new Date(t);
  synced.setHours(9);
  return {
    url: canonicalReelUrl(shortcode),
    shortcode,
    status: "ACCEPTED",
    rejectReason: null,
    totalViews: SAMPLE_TOTALS[SAMPLE_TOTALS.length - 1],
    todayViews: daily[daily.length - 1].views,
    rank: MY_RANK,
    rankDelta: 3,
    daily,
    lastSyncedAt: synced.toISOString(),
  };
}

/** Mock'dagi video: avval PENDING, bir necha soniyadan keyin qabul yoki rad etiladi. */
function currentReel(): MyReel | null {
  const shortcode = state.reelShortcode;
  if (!shortcode) return null;
  const empty: MyReel = {
    url: canonicalReelUrl(shortcode),
    shortcode,
    status: "PENDING",
    rejectReason: null,
    totalViews: 0,
    todayViews: 0,
    rank: null,
    rankDelta: 0,
    daily: [],
    lastSyncedAt: null,
  };
  if (Date.now() - (state.reelSubmittedAt ?? 0) < MOCK_VERIFY_MS) return empty;
  if (shortcode.toLowerCase().startsWith(MOCK_NOT_FOUND_PREFIX)) {
    return { ...empty, status: "REJECTED", rejectReason: "NOT_FOUND" };
  }
  return sampleReel(shortcode);
}

export async function getRating(): Promise<RatingEntry[]> {
  await wait();
  const mine = currentReel();
  const me = state.profile && mine?.status === "ACCEPTED" ? mine : null;
  const entries: RatingEntry[] = [];
  let n = 0;
  for (let rank = 1; rank <= NAMES.length + 1; rank++) {
    if (me && state.profile && rank === MY_RANK) {
      entries.push({
        rank,
        fullName: `${state.profile.firstName} ${state.profile.lastName}`,
        views: me.totalViews,
        rankDelta: me.rankDelta,
        isMe: true,
      });
      continue;
    }
    if (n >= NAMES.length) break;
    entries.push({
      rank,
      fullName: NAMES[n],
      views: Math.floor(250000 / rank) + 6400 - rank * 37,
      rankDelta: DELTAS[n % DELTAS.length],
      isMe: false,
    });
    n++;
  }
  return entries;
}

export async function getMyReel(): Promise<MyReel | null> {
  await wait();
  return currentReel();
}

export async function submitReel(url: string): Promise<MyReel> {
  await wait(500);
  const shortcode = parseReelShortcode(url);
  if (!shortcode) throw new ApiError("INVALID_LINK");
  const existing = currentReel();
  if (existing && existing.status !== "REJECTED") throw new ApiError("REEL_ALREADY_SUBMITTED");
  // Haqiqiy backendda ham shunday: avval PENDING, server Instagram'da tekshiradi.
  update({ reelShortcode: shortcode, reelSubmittedAt: Date.now() });
  const reel = currentReel();
  if (!reel) throw new ApiError("SERVER");
  return reel;
}

export async function getWinner(): Promise<Winner | null> {
  await wait(250);
  return null;
}

export async function deleteAccount(): Promise<void> {
  await wait();
  resetMockStore();
}
