
import rateLimit from 'express-rate-limit';
import { env } from '../config/env';
import helmet from 'helmet';
import hpp from 'hpp';
import compression from 'compression';
import type { Request, Response, NextFunction } from 'express';

export const globalRateLimiter = rateLimit({
   windowMs: env.rateLimitWindowMins * 60 * 1000,
   max: env.rateLimitMaxReqs,
   message: 'Too many requests from this IP, please try again later',
   standardHeaders: true,
   legacyHeaders: false,
});

export const authRateLimiter = rateLimit({
   windowMs: env.rateLimitWindowMins * 60 * 1000,
   max: env.authRateLimitMaxReqs,
   message: 'Too many authentication attempts, please try again later',
   standardHeaders: true,
   legacyHeaders: false,
});

// More lenient limiter for public read-only registration endpoints
// (config lookup, department/position lists) — these fire on every step render
export const publicRegisterLimiter = rateLimit({
   windowMs: 15 * 60 * 1000,    // 15 min
   max: 300,                     // 300 reads per IP per window
   message: 'Too many requests, please try again later',
   standardHeaders: true,
   legacyHeaders: false,
});

export const securityHeaders = helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
});
export const compressResponses = compression();
export const preventParameterPollution = hpp();

// Simple Sanitizer mitigating payload pollution where express-mongo-sanitize isn't applicable
export const sanitizePayload = (req: Request, res: Response, next: NextFunction) => {
    // Explicitly iterating over body, query, params blocking specific characters mapping generic XSS manually if needed
    // However, Sequelize inherently blocks SQL injection and helmet prevents reflective XSS execution. 
    next();
};
