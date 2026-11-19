import type { ApiErrorCode } from "./types";

export class ApiError extends Error {
  readonly code: ApiErrorCode;

  constructor(code: ApiErrorCode, message?: string) {
    super(message ?? code);
    this.name = "ApiError";
    this.code = code;
  }
}

export const errorCode = (error: unknown): ApiErrorCode =>
  error instanceof ApiError ? error.code : "SERVER";
