export interface ApiErrorPayload {
  code: string;
  message: string;
  details?: unknown;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error: ApiErrorPayload | null;
  meta?: Record<string, unknown>;
}

export function successResponse<T>(data: T, meta?: Record<string, unknown>): ApiResponse<T> {
  return {
    success: true,
    data,
    error: null,
    ...(meta ? { meta } : {}),
  };
}

export function errorResponse(error: ApiErrorPayload, data: null = null): ApiResponse<null> {
  return {
    success: false,
    data,
    error,
  };
}
