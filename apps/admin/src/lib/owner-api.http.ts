/**
 * Ega (tashkilot egasi) bo'limi API'sining HAQIQIY implementatsiyasi — backendga `fetch` bilan.
 *
 * - Kontrakt (manzillar, tiplar, xavf ballari qoidalari) — `./owner-types.ts`.
 * - Eksport qilingan funksiyalar nomi va imzosi `./mock/owner.ts` dagi bilan bir xil;
 *   qaysi biri ishlatilishini `./owner-api.ts` tanlaydi. Komponentlar faqat `@/lib/owner-api`
 *   dan import qiladi.
 * - Sessiya — backend qo'yadigan alohida `reels_owner` cookie'si (`Path=/api/v1/owner`,
 *   HttpOnly). Admin sessiyasi bu manzillarga kira olmaydi. So'rovlar nisbiy yo'l bilan
 *   (`/api/v1/owner/...`), `credentials: "same-origin"` — `./http-client.ts`.
 */
import { ApiError } from "./api-error";
import { requestJson, requestVoid, segment } from "./http-client";
import type {
  OwnerLoginRequest,
  OwnerParticipant,
  OwnerParticipantListQuery,
  OwnerParticipantListResponse,
  OwnerParticipantUpdate,
  OwnerTargetUpdate,
  OwnerUser,
  RiskAccount,
  RiskListQuery,
  RiskListResponse,
  RiskVerdict,
} from "./owner-types";
import type { TargetCaseListItem, TargetCaseListQuery, TargetCaseListResponse } from "./types";

// ---------------------------------------------------------------------------
// Kirish
// ---------------------------------------------------------------------------

/**
 * Ega login va paroli bilan kirish. Backend `reels_owner` cookie'sini qo'yadi (2 soat).
 * @endpoint POST /api/v1/owner/auth/login
 * @throws ApiError 401 — login yoki parol noto'g'ri; 429 — juda ko'p urinish
 */
export async function ownerLogin(request: OwnerLoginRequest): Promise<OwnerUser> {
  return requestJson<OwnerUser>("POST", "/owner/auth/login", {
    body: { login: request.login, password: request.password },
    fallback: { 401: "Login yoki parol noto'g'ri." },
  });
}

/**
 * Chiqish. Sessiya allaqachon tugagan bo'lsa (401) ham chiqildi deb hisoblanadi.
 * @endpoint POST /api/v1/owner/auth/logout
 */
export async function ownerLogout(): Promise<void> {
  try {
    await requestVoid("POST", "/owner/auth/logout");
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      return;
    }
    throw error;
  }
}

/**
 * Joriy ega (sessiyani tekshirish).
 * @endpoint GET /api/v1/owner/auth/me
 * @throws ApiError 401 — sessiya yo'q yoki muddati tugagan
 */
export async function getOwnerMe(): Promise<OwnerUser> {
  return requestJson<OwnerUser>("GET", "/owner/auth/me");
}

// ---------------------------------------------------------------------------
// Ishtirokchilar
// ---------------------------------------------------------------------------

/**
 * Barcha ishtirokchilar (ro'yxatdan to'liq o'tmaganlar ham): qidiruv, holat filtri, sahifalash.
 * @endpoint GET /api/v1/owner/participants?search=&status=&page=&pageSize=
 */
export async function getOwnerParticipants(query: OwnerParticipantListQuery): Promise<OwnerParticipantListResponse> {
  return requestJson<OwnerParticipantListResponse>("GET", "/owner/participants", { query });
}

/**
 * Ishtirokchi ma'lumotini o'zgartirish — faqat berilgan maydonlar.
 * @endpoint PATCH /api/v1/owner/participants/:id
 * @throws ApiError 400 — bo'sh yoki noma'lum maydon; 404; 409 — telefon boshqa ishtirokchida; 422 — qiymat noto'g'ri
 */
export async function updateOwnerParticipant(id: string, update: OwnerParticipantUpdate): Promise<OwnerParticipant> {
  return requestJson<OwnerParticipant>("PATCH", `/owner/participants/${segment(id)}`, {
    body: update,
    fallback: {
      404: "Ishtirokchi topilmadi. U o'chirilgan bo'lishi mumkin.",
      409: "Bu telefon raqami boshqa ishtirokchida.",
    },
  });
}

/**
 * Ishtirokchini va uning videosini butunlay o'chirish (qaytarib bo'lmaydi).
 * @endpoint DELETE /api/v1/owner/participants/:id
 * @throws ApiError 404
 */
export async function deleteOwnerParticipant(id: string): Promise<void> {
  await requestVoid("DELETE", `/owner/participants/${segment(id)}`, {
    fallback: { 404: "Ishtirokchi topilmadi. U allaqachon o'chirilgan bo'lishi mumkin." },
  });
}

// ---------------------------------------------------------------------------
// Target holatlari
// ---------------------------------------------------------------------------

/**
 * Target holatlari — barcha holatlar (yopilganlari ham); `status` berilmasa — hammasi.
 * @endpoint GET /api/v1/owner/targets?status=&search=&page=&pageSize=
 */
export async function getOwnerTargets(query: TargetCaseListQuery): Promise<TargetCaseListResponse> {
  return requestJson<TargetCaseListResponse>("GET", "/owner/targets", { query });
}

/**
 * Target holatini istalgan holatga o'tkazish (izoh ixtiyoriy). Ishtirokchiga bot xabari yuborilmaydi.
 * @endpoint PATCH /api/v1/owner/targets/:id
 * @throws ApiError 400/422 — holat yoki izoh noto'g'ri; 404
 */
export async function updateOwnerTarget(id: string, update: OwnerTargetUpdate): Promise<TargetCaseListItem> {
  return requestJson<TargetCaseListItem>("PATCH", `/owner/targets/${segment(id)}`, {
    body: update,
    fallback: { 404: "Target holati topilmadi." },
  });
}

// ---------------------------------------------------------------------------
// Xavfga yaqin hisoblar
// ---------------------------------------------------------------------------

/**
 * Xavf balli bo'yicha hisoblar (ball kamayishi, teng bo'lsa — ko'rishlar).
 * @endpoint GET /api/v1/owner/risk?level=&includeSafe=&search=&page=&pageSize=
 */
export async function getRiskAccounts(query: RiskListQuery): Promise<RiskListResponse> {
  return requestJson<RiskListResponse>("GET", "/owner/risk", { query });
}

/**
 * Ega belgisi: SAFE — xavfsiz, WATCH — kuzatuvda, null — belgini olib tashlash.
 * @endpoint POST /api/v1/owner/risk/:id/review
 * @throws ApiError 404 — ishtirokchi yoki xavf belgisi topilmadi
 */
export async function reviewRiskAccount(id: string, verdict: RiskVerdict | null): Promise<RiskAccount> {
  return requestJson<RiskAccount>("POST", `/owner/risk/${segment(id)}/review`, {
    body: { verdict },
    fallback: { 404: "Bu hisob xavfli ro'yxatda topilmadi." },
  });
}
