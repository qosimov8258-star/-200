/**
 * MOCK (soxta) ma'lumotlar bazasi — faqat `src/lib/api.mock.ts` va `src/lib/mock/owner.ts`
 * ishlatadi (`NEXT_PUBLIC_API_MODE=mock`). Production (`http`) build'ga kirmaydi.
 *
 * Quyidagi login/parollar FAQAT lokal mock rejim uchun. Ular haqiqiy
 * tizimda ishlamaydi va hech qayerda haqiqiy parol sifatida ishlatilmasin.
 */
import type { OwnerUser } from "../owner-types";
import type { AdminUser } from "../types";

interface MockAdminRecord extends AdminUser {
  password: string;
}

export const mockAdmins: MockAdminRecord[] = [
  {
    id: "adm_1",
    login: "admin",
    password: "admin123",
    fullName: "Bosh administrator",
    role: "ADMIN",
  },
  {
    id: "adm_2",
    login: "support",
    password: "support123",
    fullName: "Navbatchi operator",
    role: "SUPPORT",
  },
];

interface MockOwnerRecord extends OwnerUser {
  password: string;
}

/**
 * Tashkilot egasi — yashirin `/owner` bo'limi uchun ALOHIDA hisob (admin hisoblari u yerga
 * kira olmaydi va aksincha). Haqiqiy backendda egalar `OWNER_USERS` env'ida beriladi.
 * Mock rejimda kirish: login `egasi`, parol `egasi-parol-123`.
 */
export const mockOwners: MockOwnerRecord[] = [
  {
    id: "own_1",
    login: "egasi",
    password: "egasi-parol-123",
    fullName: "Tashkilot egasi",
  },
];
