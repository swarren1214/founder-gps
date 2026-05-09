export const API_ERROR_STATUS = {
  VALIDATION_ERROR: 400,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  DEPENDENCY_UNAVAILABLE: 502,
  INTERNAL_ERROR: 500
} as const;

export type ApiErrorCode = keyof typeof API_ERROR_STATUS;

export interface ApiErrorPayload {
  error: {
    code: ApiErrorCode;
    message: string;
    details?: unknown;
  };
}

export function createApiError(
  code: ApiErrorCode,
  message: string,
  details?: unknown
): ApiErrorPayload {
  return {
    error: {
      code,
      message,
      details
    }
  };
}

export function getStatusCodeForError(code: ApiErrorCode): number {
  return API_ERROR_STATUS[code];
}

export function sendApiError(
  reply: {
    status: (statusCode: number) => { send: (payload: ApiErrorPayload) => unknown };
  },
  code: ApiErrorCode,
  message: string,
  details?: unknown
) {
  return reply.status(getStatusCodeForError(code)).send(createApiError(code, message, details));
}
