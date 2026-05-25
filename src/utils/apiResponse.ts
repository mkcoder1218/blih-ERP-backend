import type { Response } from "express";

export type ApiResponse<T> = {
  success: boolean;
  message: string;
  data: T | null;
  requestId?: string;
};

export function ok<T>(res: Response, data: T, message = "OK", statusCode = 200) {
  const requestId = (res as any).locals?.requestId;
  const payload: ApiResponse<T> = { success: true, message, data, requestId };
  return res.status(statusCode).json(payload);
}

export function fail(res: Response, message: string, statusCode = 400) {
  const requestId = (res as any).locals?.requestId;
  const payload: ApiResponse<null> = { success: false, message, data: null, requestId };
  return res.status(statusCode).json(payload);
}

