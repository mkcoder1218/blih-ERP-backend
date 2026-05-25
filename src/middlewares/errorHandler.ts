
import type { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';

export function notFound(req: Request, res: Response, next: NextFunction) {
  res.status(404);
  const error = new Error(`Not Found - ${req.originalUrl}`);
  next(error);
}

export function errorHandler(err: Error, req: Request, res: Response, next: NextFunction) {
  const anyErr = err as any;
  const statusCode =
    typeof anyErr.statusCode === "number"
      ? anyErr.statusCode
      : res.statusCode !== 200
        ? res.statusCode
        : 500;

  res.status(statusCode);

  let message = anyErr.message || "Request failed";

  // Specifically obscure DB and strict token errors from the payload
  const isSuspicious =
    String(message).toLowerCase().includes('password') ||
    String(message).toLowerCase().includes('token') ||
    String(message).toLowerCase().includes('sequelize');
  if (isSuspicious && env.nodeEnv === 'production') {
    message = 'An internal system error occurred.';
  }

  const payload: any = {
    success: false,
    message,
    data: anyErr.details || null,
    requestId: (res as any).locals.requestId
  };

  if (env.nodeEnv !== "production") payload.stack = err.stack;

  res.json(payload);
}
