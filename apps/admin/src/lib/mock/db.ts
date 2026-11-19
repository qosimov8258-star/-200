/**
 * MOCK (soxta) ma'lumotlar bazasi — faqat `src/lib/api.mock.ts` ishlatadi
 * (`NEXT_PUBLIC_API_MODE=mock`). Production (`http`) build'ga kirmaydi.
 *
 * Quyidagi login/parollar FAQAT lokal mock rejim uchun. Ular haqiqiy
 * tizimda ishlamaydi va hech qayerda haqiqiy parol sifatida ishlatilmasin.
 */
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
