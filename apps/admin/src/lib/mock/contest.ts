/**
 * MOCK tanlov ma'lumotlari: ishtirokchilar, Reellar, kunlik ko'rishlar,
 * target aniqlanishlari va support murojaatlari.
 *
 * Ma'lumot deterministik generatsiya qilinadi va bugungi sanaga bog'lanadi:
 * tanlov `DAYS_ELAPSED` kun oldin boshlangan deb hisoblanadi. Barcha ismlar,
 * telefonlar va akkauntlar o'ylab topilgan.
 *
 * Faqat `src/lib/mock/` ichidan ishlatiladi; backend ulanganda o'chiriladi.
 */
import { addDays, currentHourInTashkent, eachDay, todayIso } from "../dates";
import type {
  IsoDate,
  ParticipantStatus,
  ReelStatus,
  SupportTicketStatus,
  TargetCaseStatus,
  TargetDetectionMethod,
} from "../types";
import { createRandom, hashString, type Random } from "./random";

const SEED = 20261117;
/** Tanlov boshlanganiga necha kun bo'ldi. */
const DAYS_ELAPSED = 24;
/** Tanlovning umumiy davomiyligi (kun). */
const CONTEST_LENGTH_DAYS = 46;
const PARTICIPANT_COUNT = 140;
const TICKET_COUNT = 48;
const TARGET_COUNT = 8;

// ---------------------------------------------------------------------------
// Mock yozuvlar
// ---------------------------------------------------------------------------

export interface MockParticipant {
  id: string;
  firstName: string;
  lastName: string;
  age: number;
  phone: string;
  /** Instagram ulanmagan bo'lsa — null. */
  instagramUsername: string | null;
  /** Boshlang'ich holat; admin o'zgartirganlari `store.ts` da. */
  status: ParticipantStatus;
  registeredOn: IsoDate;
}

export interface MockReel {
  id: string;
  participantId: string;
  shortcode: string;
  url: string;
  submittedOn: IsoDate;
  /** Qabul yoki rad etilgan sana; hali ko'rilmagan bo'lsa — null. */
  reviewedOn: IsoDate | null;
  reviewOutcome: "ACCEPTED" | "REJECTED" | null;
  /** Reel Instagramdan o'chirilgan sana. */
  removedOn: IsoDate | null;
  /** Kun -> shu kungacha jami ko'rishlar (snapshot). */
  viewsByDay: Map<IsoDate, number>;
  /** Kun -> shu kuni yig'ilgan yangi ko'rishlar. */
  growthByDay: Map<IsoDate, number>;
  /**
   * Instagram "Collab" — Reel boshqa akkaunt bilan hamkorlikda joylangan.
   * Ruxsat etiladi (jamoa qarori, 17.11.2026): muhimi — ko'rishlar.
   */
  collab: { username: string; isFactory: boolean } | null;
}

export interface MockTargetDetection {
  id: string;
  reelId: string;
  participantId: string;
  detectedOn: IsoDate;
  method: TargetDetectionMethod;
  /** Boshlang'ich ko'rib chiqilish holati; admin o'zgartirganlari `store.ts` da. */
  status: TargetCaseStatus;
  /** Skrinshot usulida — ishtirokchi yuborgan fayl. */
  screenshot: { fileName: string; sizeBytes: number } | null;
}

export interface MockSupportMessage {
  id: string;
  author: "PARTICIPANT" | "STAFF";
  authorName: string;
  text: string;
  /** UTC ISO vaqt. */
  at: string;
  attachment: { fileName: string; sizeBytes: number } | null;
}

export interface MockSupportTicket {
  id: string;
  participantId: string;
  subject: string;
  createdOn: IsoDate;
  inProgressOn: IsoDate | null;
  closedOn: IsoDate | null;
  /** Generatsiya qilingan yozishma; admin javoblari `store.ts` da. */
  messages: MockSupportMessage[];
}

export interface MockContestData {
  today: IsoDate;
  startsOn: IsoDate;
  endsOn: IsoDate;
  participants: MockParticipant[];
  reels: MockReel[];
  targets: MockTargetDetection[];
  tickets: MockSupportTicket[];
}

// ---------------------------------------------------------------------------
// Holatni sana bo'yicha aniqlash
// ---------------------------------------------------------------------------

/**
 * Hodisa vaqti: `day` kuni `fromHour`–`toHour` oralig'ida, `seed` bo'yicha barqaror.
 * Bugungi hodisalar kelajak vaqtida bo'lmaydi.
 */
export function eventTime(day: IsoDate, seed: string, fromHour = 9, toHour = 20): string {
  const random = createRandom(hashString(seed));
  const maxHour = day === todayIso() ? Math.max(0, currentHourInTashkent() - 1) : 23;
  const hour = Math.min(random.int(fromHour, toHour), maxHour);
  return tashkentTime(day, hour, random.int(0, 59));
}

/** Reklama shu kuni to'xtagan deb qayd etiladi (aniqlangan kundan necha kun keyin). */
export const BOOST_END_OFFSET = 2;

/** Reklama (boost) kunlari: aniqlanishdan bir kun oldin boshlanib, bir kun keyin tugaydi. */
export function isBoostDay(detectedOn: IsoDate, date: IsoDate): boolean {
  return date >= addDays(detectedOn, -1) && date < addDays(detectedOn, BOOST_END_OFFSET);
}

/** Reelning `date` kunidagi holati; hali yuborilmagan bo'lsa — null. */
export function reelStatusOn(reel: MockReel, date: IsoDate): ReelStatus | null {
  if (reel.submittedOn > date) return null;
  if (!reel.reviewedOn || reel.reviewedOn > date) return "PENDING";
  if (reel.reviewOutcome === "REJECTED") return "REJECTED";
  if (reel.removedOn && reel.removedOn <= date) return "REMOVED";
  return "ACCEPTED";
}

/** Murojaatning `date` kunidagi holati; hali yaratilmagan bo'lsa — null. */
export function ticketStatusOn(
  ticket: MockSupportTicket,
  date: IsoDate,
): SupportTicketStatus | null {
  if (ticket.createdOn > date) return null;
  if (ticket.closedOn && ticket.closedOn <= date) return "CLOSED";
  if (ticket.inProgressOn && ticket.inProgressOn <= date) return "IN_PROGRESS";
  return "NEW";
}

// ---------------------------------------------------------------------------
// Generatsiya uchun lug'atlar
// ---------------------------------------------------------------------------

const MALE_NAMES = [
  "Aziz", "Bekzod", "Bobur", "Dilshod", "Doniyor", "Farrux", "Jasur", "Javohir", "Jamshid",
  "Akmal", "Otabek", "Rustam", "Sardor", "Sherzod", "Shoxrux", "Sanjar", "Temur", "Ulug'bek",
  "Islom", "Abdulloh", "Sirojiddin", "Nodir", "Elyor", "Asilbek",
] as const;

const FEMALE_NAMES = [
  "Madina", "Malika", "Nodira", "Gulnoza", "Kamola", "Shahzoda", "Zarina", "Dilnoza",
  "Sevara", "Nigora", "Mohira", "Feruza", "Sabina", "Muxlisa", "Laylo", "Durdona",
] as const;

/** Erkak shakli; ayollar uchun oxiriga "a" qo'shiladi. */
const LAST_NAMES = [
  "Karimov", "Rahimov", "Tursunov", "Yusupov", "Ismoilov", "Qodirov", "Ergashev", "Nazarov",
  "Mirzayev", "Aliyev", "Xolmatov", "Sobirov", "Umarov", "Hasanov", "Saidov", "Rasulov",
  "Jo'rayev", "Normatov", "Abdullayev", "To'xtayev", "Usmonov", "Valiyev",
] as const;

const PHONE_CODES = ["90", "91", "93", "94", "95", "97", "98", "99", "33", "88"] as const;

/** O'sish tahlili ko'proq uchraydi — API ruxsati hali tasdiqlanmagan bo'lishi mumkin. */
const TARGET_METHODS: readonly TargetDetectionMethod[] = [
  "INSTAGRAM_API",
  "GROWTH_ANALYSIS",
  "GROWTH_ANALYSIS",
  "SCREENSHOT",
];

interface TicketTemplate {
  subject: string;
  question: string;
  answer: string;
  /** Ishtirokchi biriktirgan skrinshot nomi. */
  attachment?: string;
}

const TICKET_TEMPLATES: readonly TicketTemplate[] = [
  {
    subject: "Reel linki qabul qilinmayapti",
    question:
      "Assalomu alaykum. Reel linkini yuboryapman, lekin \"Link noto'g'ri\" degan xato chiqyapti. Skrinshotni biriktirdim.",
    answer:
      "Assalomu alaykum! Linkni Instagram ilovasidagi \"Ulashish → Havolani nusxalash\" orqali oling va qayta yuboring. Akkauntingiz ochiq (public) bo'lishi kerak.",
    attachment: "xato_skrinshot.jpg",
  },
  {
    subject: "Instagram akkauntni ulay olmayapman",
    question: "Instagram'ni ulash tugmasini bossam, oyna ochilib darhol yopilib qolyapti.",
    answer:
      "Instagram ilovasidan chiqib, qayta kiring va ulashni yana bir bor sinab ko'ring. Akkaunt Business yoki Creator turida bo'lishi kerak.",
  },
  {
    subject: "Ko'rishlar soni yangilanmadi",
    question:
      "Reelimda 5 mingdan ortiq ko'rish bor, ilovada esa kechagi raqam turibdi. Qachon yangilanadi?",
    answer:
      "Ko'rishlar har kuni soat 00:00 da (Toshkent vaqti) yangilanadi. Ertaga reytingda yangi raqamni ko'rasiz.",
  },
  {
    subject: "SMS kod kelmayapti",
    question: "Yangi telefonda ilovaga kirmoqchiman, lekin SMS kod kelmayapti. Raqamim o'zgarmagan.",
    answer:
      "Raqamingizni tekshirdik, kod yuborilmoqda. Telefoningizda SMS bloklanmaganini tekshiring va 1 daqiqadan keyin qayta so'rang.",
  },
  {
    subject: "Reytingda o'zimni topa olmayapman",
    question: "Reelim qabul qilindi deb xabar keldi, lekin reytingda o'zimni ko'rmayapman.",
    answer:
      "Reyting har kuni 00:00 da yangilanadi. Reelingiz bugun qabul qilingani uchun ertangi reytingda ko'rinadi.",
  },
  {
    subject: "Reelim nega rad etildi?",
    question: "Reelim rad etildi, sababini tushunmadim. Videoda mahsulot bor edi.",
    answer:
      "Videoda sotib olingan mahsulot aniq ko'rinmagan. Mahsulot yaxshi ko'rinadigan yangi Reel joylab, linkini qayta yuboring.",
  },
  {
    subject: "Business akkauntga qanday o'tiladi?",
    question: "Ilova Business yoki Creator akkaunt kerak deyapti. Qanday o'tkazaman?",
    answer:
      "Instagram → Sozlamalar → Akkaunt turi va vositalar → \"Professional akkauntga o'tish\" → Creator ni tanlang. Bu bepul.",
  },
  {
    subject: "Ismimni xato yozibman",
    question: "Ro'yxatdan o'tishda familiyamni xato yozibman. To'g'rilab bera olasizmi?",
    answer:
      "Tanlov qoidalariga ko'ra ism-familiyani ro'yxatdan o'tgandan keyin o'zgartirib bo'lmaydi. G'olib aniqlanganda shaxsingiz hujjat bilan tasdiqlanadi.",
  },
  {
    subject: "Tanlov qachon tugaydi?",
    question: "Tanlov aniq qaysi sanada tugaydi? Natijalar qachon e'lon qilinadi?",
    answer:
      "Tanlov tugash sanasi ilovaning bosh sahifasidagi hisoblagichda ko'rsatilgan. G'olib oxirgi reyting asosida e'lon qilinadi.",
  },
  {
    subject: "Mahsulot chekini qayerga yuboraman?",
    question: "Mahsulotni sotib olganimni tasdiqlash uchun chekni qayerga yuboraman? Rasmini biriktirdim.",
    answer:
      "Chekingiz qabul qilindi, rahmat! Uni g'olibni tekshirish bosqichigacha saqlab qo'ying.",
    attachment: "chek.jpg",
  },
];

/** Zavodning rasmiy Instagram akkaunti — haqiqiy nomi kelishilgach almashtiriladi (PLAN.md Q10). */
export const FACTORY_INSTAGRAM_USERNAME = "zavod_rasmiy";

/**
 * Reellarning bir qismi Collab: ~12% — do'sti bilan, shundan ~25% — zavod akkaunti bilan.
 * Alohida generator ishlatiladi — boshqa mock ma'lumotlar o'zgarmaydi.
 */
function assignCollabs(reels: MockReel[], participants: MockParticipant[]): void {
  const usernames = participants
    .map((participant) => participant.instagramUsername)
    .filter((username): username is string => username !== null);

  for (const reel of reels) {
    const random = createRandom(hashString(`collab:${reel.id}`));
    if (!random.chance(0.12)) continue;
    const isFactory = random.chance(0.25);
    const own = participants.find((item) => item.id === reel.participantId)?.instagramUsername;
    const friends = usernames.filter((username) => username !== own);
    reel.collab = isFactory
      ? { username: FACTORY_INSTAGRAM_USERNAME, isFactory: true }
      : { username: random.pick(friends), isFactory: false };
  }
}

const STAFF_NAME = "Navbatchi operator";
const FOLLOW_UP_TEXT = "Rahmat, lekin muammo hali ham bor. Yana tekshirib bera olasizmi?";
const THANKS_TEXT = "Rahmat, hal bo'ldi!";

const SHORTCODE_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-";

function pad2(value: number): string {
  return value.toString().padStart(2, "0");
}

/** Instagram username uchun lotin harflariga keltirish. */
function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z]/g, "");
}

function makeShortcode(random: Random): string {
  let code = "";
  for (let i = 0; i < 11; i++) {
    code += random.pick(SHORTCODE_ALPHABET.split(""));
  }
  return code;
}

function minDate(a: IsoDate, b: IsoDate): IsoDate {
  return a < b ? a : b;
}

/** Toshkent vaqtidagi kun, soat va daqiqadan UTC ISO vaqt. */
export function tashkentTime(day: IsoDate, hour: number, minute: number): string {
  return new Date(`${day}T${pad2(hour)}:${pad2(minute)}:00+05:00`).toISOString();
}

// ---------------------------------------------------------------------------
// Generatsiya
// ---------------------------------------------------------------------------

function generateParticipants(random: Random, startsOn: IsoDate): MockParticipant[] {
  const participants: MockParticipant[] = [];

  for (let i = 0; i < PARTICIPANT_COUNT; i++) {
    const female = random.chance(0.4);
    const firstName = female ? random.pick(FEMALE_NAMES) : random.pick(MALE_NAMES);
    const baseLastName = random.pick(LAST_NAMES);
    const lastName = female ? `${baseLastName}a` : baseLastName;

    // Ko'pchilik tanlovning boshida ro'yxatdan o'tadi (0 — birinchi kun, DAYS_ELAPSED — bugun).
    const dayOffset = Math.min(DAYS_ELAPSED, Math.floor((DAYS_ELAPSED + 1) * random.next() ** 1.6));

    const statusRoll = random.next();
    const status: ParticipantStatus =
      statusRoll < 0.03
        ? "DISQUALIFIED"
        : statusRoll < 0.07
          ? "WARNED"
          : statusRoll < 0.09
            ? "BLOCKED"
            : "ACTIVE";

    participants.push({
      id: `usr_${(i + 1).toString().padStart(4, "0")}`,
      firstName,
      lastName,
      age: random.int(18, 56),
      phone: `+998 ${random.pick(PHONE_CODES)} ${random.int(100, 999)} ${pad2(random.int(0, 99))} ${pad2(random.int(0, 99))}`,
      instagramUsername: `${slug(firstName)}_${slug(lastName).slice(0, 5)}${random.int(1, 99)}`,
      status,
      registeredOn: addDays(startsOn, dayOffset),
    });
  }

  return participants;
}

function generateReels(
  random: Random,
  participants: MockParticipant[],
  today: IsoDate,
): MockReel[] {
  const reels: MockReel[] = [];

  for (const participant of participants) {
    if (!random.chance(0.9)) continue;

    const submittedOn = minDate(addDays(participant.registeredOn, random.int(0, 3)), today);
    const recent = submittedOn >= addDays(today, -1);

    let reviewedOn: IsoDate | null = null;
    let reviewOutcome: MockReel["reviewOutcome"] = null;
    let removedOn: IsoDate | null = null;

    if (!(recent && random.chance(0.6))) {
      reviewedOn = minDate(addDays(submittedOn, random.int(0, 1)), today);
      reviewOutcome = random.chance(0.07) ? "REJECTED" : "ACCEPTED";
      if (reviewOutcome === "ACCEPTED" && random.chance(0.04)) {
        const candidate = addDays(reviewedOn, random.int(2, 10));
        removedOn = candidate <= today ? candidate : null;
      }
    }

    const shortcode = makeShortcode(random);
    reels.push({
      id: `reel_${(reels.length + 1).toString().padStart(4, "0")}`,
      participantId: participant.id,
      shortcode,
      url: `https://www.instagram.com/reel/${shortcode}/`,
      submittedOn,
      reviewedOn,
      reviewOutcome,
      removedOn,
      viewsByDay: new Map(),
      growthByDay: new Map(),
      collab: null,
    });
  }

  assignCollabs(reels, participants);
  return reels;
}

/** Qabul qilingan Reellar uchun kunlik ko'rishlar tarixini to'ldiradi. */
function generateViews(
  random: Random,
  reels: MockReel[],
  boosts: Map<string, IsoDate>,
  today: IsoDate,
): void {
  for (const reel of reels) {
    if (reel.reviewOutcome !== "ACCEPTED" || !reel.reviewedOn) continue;

    // Kunlik o'rtacha ~500 ko'rish, ba'zilari "viral" bo'ladi.
    const viral = random.chance(0.05);
    const baseRate = random.logNormal(6.2, 0.9) * (viral ? 6 : 1);
    const boostedOn = boosts.get(reel.id);
    const lastDay = reel.removedOn ? addDays(reel.removedOn, -1) : today;

    let total = 0;
    eachDay(reel.reviewedOn, lastDay).forEach((day, age) => {
      const decay = 0.45 + 0.55 * Math.exp(-age / 6);
      const noise = 0.6 + random.next() * 0.8;
      let growth = baseRate * decay * noise * (age === 0 ? 1.8 : 1);

      // Target (pullik reklama) yoqilgan kunlari ko'rishlar keskin oshadi.
      if (boostedOn && isBoostDay(boostedOn, day)) {
        growth *= random.int(8, 15);
      }

      const rounded = Math.round(growth);
      total += rounded;
      reel.growthByDay.set(day, rounded);
      reel.viewsByDay.set(day, total);
    });
  }
}

function generateTargets(
  random: Random,
  reels: MockReel[],
  today: IsoDate,
): MockTargetDetection[] {
  const candidates = reels.filter(
    (reel) =>
      reel.reviewOutcome === "ACCEPTED" &&
      !reel.removedOn &&
      reel.reviewedOn !== null &&
      reel.reviewedOn <= addDays(today, -3),
  );

  const targets: MockTargetDetection[] = [];
  const used = new Set<string>();

  while (targets.length < TARGET_COUNT && used.size < candidates.length) {
    const reel = random.pick(candidates);
    if (used.has(reel.id) || !reel.reviewedOn) continue;
    used.add(reel.id);

    const index = targets.length;
    const method = random.pick(TARGET_METHODS);
    const detectedOn = minDate(addDays(reel.reviewedOn, random.int(2, 12)), today);
    targets.push({
      id: `tgt_${(index + 1).toString().padStart(3, "0")}`,
      reelId: reel.id,
      participantId: reel.participantId,
      // Oxirgisi kecha aniqlangan — reklama hali davom etmoqda ("Yoqilgan" holati).
      detectedOn: index === TARGET_COUNT - 1 ? addDays(today, -1) : detectedOn,
      method,
      // Namuna uchun: bittasi allaqachon ogohlantirilgan, bittasi ro'yxatdan chiqarilgan.
      status: index === 0 ? "WARNED" : index === 1 ? "DISMISSED" : "NEW",
      screenshot:
        method === "SCREENSHOT"
          ? { fileName: "reklama_kabineti.png", sizeBytes: random.int(150, 700) * 1024 }
          : null,
    });
  }

  return targets;
}

function generateTickets(
  random: Random,
  participants: MockParticipant[],
  startsOn: IsoDate,
  today: IsoDate,
): MockSupportTicket[] {
  const tickets: MockSupportTicket[] = [];
  const currentHour = currentHourInTashkent();

  for (let i = 0; i < TICKET_COUNT; i++) {
    const createdOn = addDays(startsOn, random.int(0, DAYS_ELAPSED));
    const registered = participants.filter((item) => item.registeredOn <= createdOn);
    if (registered.length === 0) continue;

    let inProgressOn: IsoDate | null = null;
    let closedOn: IsoDate | null = null;

    if (random.chance(0.85)) {
      const progress = addDays(createdOn, random.int(0, 2));
      inProgressOn = progress <= today ? progress : null;
    }
    if (inProgressOn && random.chance(0.8)) {
      const closed = addDays(inProgressOn, random.int(0, 3));
      closedOn = closed <= today ? closed : null;
    }

    const id = `tkt_${(i + 1).toString().padStart(4, "0")}`;
    const participant = random.pick(registered);
    const template = random.pick(TICKET_TEMPLATES);

    tickets.push({
      id,
      participantId: participant.id,
      subject: template.subject,
      createdOn,
      inProgressOn,
      closedOn,
      messages: generateMessages(
        // Har murojaatning o'z generatori — yozishma uzunligi boshqa ma'lumotlarni siljitmaydi.
        createRandom(SEED + (i + 1) * 7919),
        { id, createdOn, inProgressOn, closedOn },
        template,
        `${participant.firstName} ${participant.lastName}`,
        today,
        currentHour,
      ),
    });
  }

  return tickets;
}

interface TicketTimeline {
  id: string;
  createdOn: IsoDate;
  inProgressOn: IsoDate | null;
  closedOn: IsoDate | null;
}

/** Murojaat holatiga mos yozishma: savol, javob, ba'zan qo'shimcha savol yoki minnatdorchilik. */
function generateMessages(
  random: Random,
  timeline: TicketTimeline,
  template: TicketTemplate,
  participantName: string,
  today: IsoDate,
  currentHour: number,
): MockSupportMessage[] {
  // Bugungi xabarlar kelajak vaqtida bo'lmasligi kerak (joriy soatdan bir soat oldingacha).
  const maxHour = (day: IsoDate) => (day === today ? Math.max(0, currentHour - 1) : 23);
  const messages: MockSupportMessage[] = [];
  const push = (
    author: MockSupportMessage["author"],
    text: string,
    day: IsoDate,
    hour: number,
    attachment: MockSupportMessage["attachment"] = null,
  ) => {
    let at = tashkentTime(day, Math.min(hour, maxHour(day)), random.int(0, 59));
    // Vaqtlar ketma-ket bo'lsin: har xabar oldingisidan keyin.
    const previous = messages.at(-1);
    if (previous && at <= previous.at) {
      at = new Date(Date.parse(previous.at) + 60_000).toISOString();
    }
    messages.push({
      id: `${timeline.id}_m${messages.length + 1}`,
      author,
      authorName: author === "STAFF" ? STAFF_NAME : participantName,
      text,
      at,
      attachment,
    });
  };

  const createdHour = random.int(8, 21);
  push(
    "PARTICIPANT",
    template.question,
    timeline.createdOn,
    createdHour,
    template.attachment
      ? { fileName: template.attachment, sizeBytes: random.int(80, 900) * 1024 }
      : null,
  );

  if (!timeline.inProgressOn) return messages;

  const replyHour =
    timeline.inProgressOn === timeline.createdOn
      ? Math.min(23, createdHour + random.int(1, 2))
      : random.int(9, 18);
  push("STAFF", template.answer, timeline.inProgressOn, replyHour);

  if (timeline.closedOn) {
    if (random.chance(0.6)) {
      push("PARTICIPANT", THANKS_TEXT, timeline.closedOn, Math.min(23, replyHour + 1));
    }
  } else if (random.chance(0.35)) {
    push("PARTICIPANT", FOLLOW_UP_TEXT, timeline.inProgressOn, Math.min(23, replyHour + 1));
  }

  return messages;
}

function generate(today: IsoDate): MockContestData {
  const random = createRandom(SEED);
  const startsOn = addDays(today, -DAYS_ELAPSED);
  const endsOn = addDays(startsOn, CONTEST_LENGTH_DAYS - 1);

  const participants = generateParticipants(random, startsOn);
  const reels = generateReels(random, participants, today);

  // Reel yubormaganlarning yarmi Instagramni hali ulamagan.
  const withReel = new Set(reels.map((reel) => reel.participantId));
  for (const participant of participants) {
    if (!withReel.has(participant.id) && random.chance(0.5)) {
      participant.instagramUsername = null;
    }
  }

  // Target sanalari ko'rishlardan oldin tanlanadi — o'sha kunlari ko'rishlar sakraydi.
  const targets = generateTargets(random, reels, today);
  const boosts = new Map(targets.map((target) => [target.reelId, target.detectedOn]));
  generateViews(random, reels, boosts, today);

  // Boshlang'ich holatlar bir-biriga mos bo'lsin.
  for (const target of targets) {
    const participant = participants.find((item) => item.id === target.participantId);
    if (target.status === "WARNED" && participant?.status === "ACTIVE") {
      participant.status = "WARNED";
    }
    if (target.status === "NEW" && participant?.status === "DISQUALIFIED") {
      target.status = "DISQUALIFIED";
    }
  }

  const tickets = generateTickets(random, participants, startsOn, today);

  return { today, startsOn, endsOn, participants, reels, targets, tickets };
}

let cache: MockContestData | null = null;

/** Mock tanlov ma'lumotlari (kun almashganda qayta generatsiya qilinadi). */
export function getContestData(): MockContestData {
  const today = todayIso();
  if (!cache || cache.today !== today) {
    cache = generate(today);
  }
  return cache;
}
