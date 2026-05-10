type ApiErrorCode =
  | "VALIDATION_ERROR"
  | "BAD_REQUEST"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "DEPENDENCY_UNAVAILABLE"
  | "INTERNAL_ERROR";

const API_ERROR_STATUS: Record<ApiErrorCode, number> = {
  VALIDATION_ERROR: 400,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  DEPENDENCY_UNAVAILABLE: 502,
  INTERNAL_ERROR: 500
};

type ApiErrorPayload = {
  error: {
    code: ApiErrorCode;
    message: string;
    details?: unknown;
  };
};

export function sendApiError(
  reply: {
    status: (statusCode: number) => { send: (payload: ApiErrorPayload) => unknown };
  },
  code: ApiErrorCode,
  message: string,
  details?: unknown
) {
  return reply.status(API_ERROR_STATUS[code]).send({
    error: {
      code,
      message,
      details
    }
  });
}