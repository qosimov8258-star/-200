/**
 * Ega (tashkilot egasi) bo'limining YAGONA API qatlami — `/owner` sahifasi komponentlari
 * faqat shu fayldan import qiladi va backendga to'g'ridan-to'g'ri `fetch` qilmaydi.
 *
 * Rejim admin panel bilan bir xil (`./api.ts`, `NEXT_PUBLIC_API_MODE`):
 *   - `./owner-api.http.ts` — haqiqiy backend (`/api/v1/owner/...`, alohida `reels_owner` cookie'si);
 *   - `./mock/owner.ts` — soxta ma'lumotlar, backendsiz lokal ishlash uchun.
 * Rejim build vaqtida o'zgarmasga aylanadi — prod build'ga mock ma'lumot va mock parol kirmaydi.
 *
 * Kontrakt — `./owner-types.ts`; xatolar `./api-error.ts` dagi `ApiError` bilan.
 */
import * as mock from "./mock/owner";
import * as http from "./owner-api.http";

// Rejim shu modulning o'zida hisoblanadi (`./api.ts` dagi bilan bir xil ifoda): `next.config.ts`
// `NEXT_PUBLIC_API_MODE` ni build vaqtida yozadi, ifoda o'zgarmasga aylanadi va keraksiz
// implementatsiya bundle'dan tushadi. `API_MODE` ni boshqa moduldan import qilsak, bundler uni
// o'zgarmas deb bilmaydi va prod build'ga mock ma'lumot hamda mock parollar kirib qoladi.
const mode = process.env.NEXT_PUBLIC_API_MODE ?? (process.env.NODE_ENV === "production" ? "http" : "mock");

/** Mock implementatsiya ham haqiqiysi bilan bir xil tipda bo'lishi shart (TS tekshiradi). */
const impl: typeof http = mode === "mock" ? mock : http;

/** Mock rejim belgisi (kirish formasida yo'riqnoma ko'rsatish uchun). */
export const IS_MOCK_OWNER_API: boolean = mode === "mock";

// Kirish
export const ownerLogin = impl.ownerLogin;
export const ownerLogout = impl.ownerLogout;
export const getOwnerMe = impl.getOwnerMe;

// Ishtirokchilar
export const getOwnerParticipants = impl.getOwnerParticipants;
export const updateOwnerParticipant = impl.updateOwnerParticipant;
export const deleteOwnerParticipant = impl.deleteOwnerParticipant;

// Target holatlari
export const getOwnerTargets = impl.getOwnerTargets;
export const updateOwnerTarget = impl.updateOwnerTarget;

// Xavfga yaqin hisoblar
export const getRiskAccounts = impl.getRiskAccounts;
export const reviewRiskAccount = impl.reviewRiskAccount;
