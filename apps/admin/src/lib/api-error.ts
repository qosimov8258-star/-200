/**
 * API xatosi. Mock va haqiqiy API ikkalasi ham shu klassni tashlaydi,
 * UI esa `status` bo'yicha qaror qiladi (masalan, 401 -> login sahifasi).
 *
 * `status` 0 — javob umuman kelmadi (tarmoq xatosi). `code` — backend `{ code }`
 * ko'rinishida qaytargan mashina kodi (bo'lmasa — null).
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string | null;

  constructor(status: number, message: string, code: string | null = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

export function isUnauthorized(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401;
}

/** Foydalanuvchiga ko'rsatiladigan xato matni. */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }
  return "Kutilmagan xatolik yuz berdi. Qaytadan urinib ko'ring.";
}
